"""V32 regression: a 350K-token logical session survives compaction and relaunch."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from agent.context_compressor import SUMMARY_PREFIX, estimate_messages_tokens_rough
from hermes_state import SessionDB
from run_agent import AIAgent


CONTEXT_WINDOW_TOKENS = 1_050_000
LOCAL_COMPACTION_THRESHOLD = 208_000
LOGICAL_HISTORY_MIN_TOKENS = 350_000

TASK_ANCHOR = "TASK-ANCHOR: keep Hermes v32 continuity alive"
PATH_ANCHOR = r"PATH-ANCHOR: C:\work\hermes\release\candidate.json"
COMMIT_ANCHOR = "COMMIT-ANCHOR: ffa71a84065f9272bb65df28787fe80470f72558"
ERROR_ANCHOR = "ERROR-ANCHOR: maximum context length is 272000 tokens"
DECISION_ANCHOR = "DECISION-ANCHOR: never switch provider automatically"
ANCHORS = (
    TASK_ANCHOR,
    PATH_ANCHOR,
    COMMIT_ANCHOR,
    ERROR_ANCHOR,
    DECISION_ANCHOR,
)


def _response(text: str):
    message = SimpleNamespace(
        content=text,
        tool_calls=None,
        reasoning_content=None,
        reasoning=None,
    )
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message, finish_reason="stop")],
        model="mock-model",
        usage=SimpleNamespace(
            prompt_tokens=1_000,
            completion_tokens=20,
            total_tokens=1_020,
            prompt_tokens_details=None,
        ),
    )


def _logical_history() -> list[dict[str, str]]:
    """Build an alternating transcript whose rough estimate is above 350K."""
    messages: list[dict[str, str]] = []
    for index in range(92):
        user_prefix = f"logical-user-{index:03d}"
        if index == 6:
            user_prefix += "\n" + "\n".join(ANCHORS)
        messages.append(
            {
                "role": "user",
                "content": user_prefix + "\n" + ("U" * 7_800),
            }
        )
        messages.append(
            {
                "role": "assistant",
                "content": f"logical-assistant-{index:03d}\n" + ("A" * 7_800),
            }
        )
    return messages


def _summary_body() -> str:
    return "\n".join(
        (
            "## Goal",
            TASK_ANCHOR,
            "## Completed Actions",
            "1. Preserved the release checkpoint.",
            "## Active State",
            PATH_ANCHOR,
            COMMIT_ANCHOR,
            ERROR_ANCHOR,
            "## Decisions",
            DECISION_ANCHOR,
            "## Active Task",
            "Continue the current Hermes v32 release gate.",
        )
    )


def _make_agent(db: SessionDB, session_id: str) -> AIAgent:
    with (
        patch("run_agent.get_tool_definitions", return_value=[]),
        patch("run_agent.check_toolset_requirements", return_value={}),
        patch("run_agent.OpenAI"),
        patch(
            "agent.context_compressor.get_model_context_length",
            return_value=CONTEXT_WINDOW_TOKENS,
        ),
        patch(
            "agent.model_metadata.get_model_context_length",
            return_value=CONTEXT_WINDOW_TOKENS,
        ),
    ):
        agent = AIAgent(
            api_key="mock-key",
            base_url="https://openrouter.ai/api/v1",
            provider="openrouter",
            model="mock-model",
            max_iterations=4,
            enabled_toolsets=[],
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
            skip_background_review=True,
            save_trajectories=False,
            platform="cli",
            session_db=db,
            session_id=session_id,
        )
    agent.client = MagicMock()
    agent._cached_system_prompt = "You are a deterministic continuity test agent."
    agent._use_prompt_caching = False
    agent.compression_enabled = True
    agent.compression_in_place = True
    agent.context_compressor.context_length = CONTEXT_WINDOW_TOKENS
    agent.context_compressor.threshold_tokens = LOCAL_COMPACTION_THRESHOLD
    return agent


def test_350k_logical_session_compacts_continues_and_survives_relaunch(tmp_path):
    history = _logical_history()
    logical_tokens = estimate_messages_tokens_rough(history)
    assert logical_tokens >= LOGICAL_HISTORY_MIN_TOKENS

    db_path = tmp_path / "state.db"
    session_id = "v32-continuity-350k"
    db = SessionDB(db_path=db_path)
    first_agent = _make_agent(db, session_id)
    first_agent.client.chat.completions.create.return_value = _response(
        "FIRST-TURN-CONTINUED"
    )

    summary_prompts: list[str] = []

    def _summarize(**kwargs):
        prompt_text = kwargs["messages"][0]["content"]
        summary_prompts.append(prompt_text)
        for anchor in ANCHORS:
            assert anchor in prompt_text
        return _response(_summary_body())

    with (
        patch("agent.context_compressor.call_llm", side_effect=_summarize),
        patch("agent.conversation_loop.time.sleep", return_value=None),
    ):
        first_result = first_agent.run_conversation(
            "Continue from the logical history without losing the release state.",
            conversation_history=history,
            task_id="v32-continuity-first",
        )

    assert first_result["completed"] is True
    assert first_result["final_response"] == "FIRST-TURN-CONTINUED"
    assert summary_prompts, "the >350K logical transcript did not trigger compaction"
    assert first_agent.context_compressor.compression_count >= 1

    first_wire = first_agent.client.chat.completions.create.call_args.kwargs["messages"]
    assert estimate_messages_tokens_rough(first_wire) < LOCAL_COMPACTION_THRESHOLD
    assert any(
        SUMMARY_PREFIX in str(message.get("content", ""))
        for message in first_wire
    )
    first_wire_text = "\n".join(str(message.get("content", "")) for message in first_wire)
    for anchor in ANCHORS:
        assert anchor in first_wire_text

    persisted = db.get_messages_as_conversation(session_id)
    persisted_text = "\n".join(str(message.get("content", "")) for message in persisted)
    for anchor in ANCHORS:
        assert anchor in persisted_text
    db.close()

    reopened_db = SessionDB(db_path=db_path)
    try:
        relaunched_history = reopened_db.get_messages_as_conversation(session_id)
        second_agent = _make_agent(reopened_db, session_id)

        def _continue_after_relaunch(**kwargs):
            wire_text = "\n".join(
                str(message.get("content", ""))
                for message in kwargs["messages"]
            )
            for anchor in ANCHORS:
                assert anchor in wire_text
            assert "What is the locked commit after relaunch?" in wire_text
            return _response(f"RELAUNCH-CONTINUED {COMMIT_ANCHOR}")

        second_agent.client.chat.completions.create.side_effect = (
            _continue_after_relaunch
        )
        second_result = second_agent.run_conversation(
            "What is the locked commit after relaunch?",
            conversation_history=relaunched_history,
            task_id="v32-continuity-relaunch",
        )

        assert second_result["completed"] is True
        assert COMMIT_ANCHOR in second_result["final_response"]
        assert second_agent.client.chat.completions.create.call_count == 1
    finally:
        reopened_db.close()
