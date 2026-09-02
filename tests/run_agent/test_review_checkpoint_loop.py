"""End-to-end ordering contract for plan and final review checkpoints."""

from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest

from agent.review_checkpoints import create_review_checkpoint_runtime
from agent.review_runner import ReviewResult
from run_agent import AIAgent
from tests.run_agent.test_run_agent import (
    _make_tool_defs,
    _mock_response,
    _mock_tool_call,
)


class _ReviewLoopAgent(AIAgent):
    _cached_system_prompt: str | None
    _use_prompt_caching: bool
    _session_json_enabled: bool
    save_trajectories: bool
    compression_enabled: bool
    tool_delay: float


@pytest.fixture()
def agent():
    with (
        patch(
            "run_agent.get_tool_definitions",
            return_value=_make_tool_defs("web_search", "terminal"),
        ),
        patch("run_agent.check_toolset_requirements", return_value={}),
        patch("run_agent.OpenAI"),
    ):
        instance = _ReviewLoopAgent(
            session_id="review-loop-session",
            api_key="test-key",
            base_url="https://example.invalid/v1",
            provider="openai-compat",
            model="economy-model",
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
        )
    instance.client = MagicMock()
    instance._cached_system_prompt = "stable test prompt"
    instance._use_prompt_caching = False
    instance._session_db = None
    instance._session_json_enabled = False
    instance.save_trajectories = False
    instance.compression_enabled = False
    instance.tool_delay = 0
    return instance


def _install(agent, verdicts, review_calls, *, enabled=True, summaries=None):
    verdict_iter = iter(verdicts)
    summary_iter = iter(summaries or [])

    def run(request):
        review_calls.append(request)
        verdict = next(verdict_iter)
        return ReviewResult(
            checkpoint_id=request.checkpoint_id,
            status="completed",
            verdict=verdict,
            summary=next(summary_iter, f"Reviewer returned {verdict}."),
            feedback=("Use the verified product identity.",) if verdict == "REVISE" else (),
        )

    agent.review_checkpoint_runtime = create_review_checkpoint_runtime(
        session_id=agent.session_id,
        provider="openai-codex",
        model="gpt-review",
        enabled=enabled,
        run_review_fn=run,
    )


def _run(agent, message, handle):
    with (
        patch("run_agent.handle_function_call", side_effect=handle),
        patch.object(agent, "_flush_messages_to_session_db", return_value=True),
        patch.object(agent, "_persist_session"),
        patch.object(agent, "_save_trajectory"),
        patch.object(agent, "_cleanup_task_resources"),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        return agent.run_conversation(message)


def test_plan_block_happens_before_tool_handler(agent):
    review_calls = []
    _install(agent, ["BLOCK"], review_calls)
    tool = _mock_tool_call("terminal", '{"command":"touch private"}', call_id="c1")
    agent.client.chat.completions.create.return_value = _mock_response(
        content="I will search.",
        finish_reason="tool_calls",
        tool_calls=[tool],
    )
    handler = MagicMock(return_value="must not run")

    result = _run(agent, "search", handler)

    handler.assert_not_called()
    assert [request.phase for request in review_calls] == ["plan"]
    assert "Advisor đã chặn hành động này" in result["final_response"]
    assert result["completed"] is False


def test_plan_revise_closes_tool_protocol_and_replans_without_execution(agent):
    review_calls = []
    _install(agent, ["REVISE", "PASS"], review_calls)
    tool = _mock_tool_call("terminal", '{"command":"touch output"}', call_id="c1")
    agent.client.chat.completions.create.side_effect = [
        _mock_response(
            content="I will search.",
            finish_reason="tool_calls",
            tool_calls=[tool],
        ),
        _mock_response(content="Replanned safely.", finish_reason="stop"),
    ]
    handler = MagicMock(return_value="must not run")

    result = _run(agent, "search", handler)

    handler.assert_not_called()
    assert result["final_response"] == "Replanned safely."
    assert [request.phase for request in review_calls] == ["plan", "final"]
    tool_results = [
        message for message in result["messages"] if message.get("role") == "tool"
    ]
    assert len(tool_results) == 1
    assert "requested a revised plan" in tool_results[0]["content"]


def test_final_revise_holds_first_candidate_and_publishes_main_model_rewrite(agent):
    review_calls = []
    _install(agent, ["REVISE", "PASS"], review_calls)
    responses = iter([
        _mock_response(content="Unreviewed candidate", finish_reason="stop"),
        _mock_response(content="Corrected main-model answer", finish_reason="stop"),
    ])
    api_message_snapshots = []

    def create(**kwargs):
        api_message_snapshots.append(deepcopy(kwargs["messages"]))
        return next(responses)

    agent.client.chat.completions.create.side_effect = create
    surface = MagicMock()
    agent.stream_delta_callback = surface

    result = _run(agent, "answer", MagicMock())

    assert [request.phase for request in review_calls] == ["final", "final"]
    assert result["final_response"] == "Corrected main-model answer"
    assert "Unreviewed candidate" not in result["final_response"]
    assert result["completed"] is True
    rewrite_messages = api_message_snapshots[1]
    revision_prompt = next(
        message
        for message in rewrite_messages
        if message.get("role") == "user" and "Use the verified product identity" in message.get("content", "")
    )
    assert "Use the verified product identity" in revision_prompt["content"]
    assert "Do not mention Advisor" in revision_prompt["content"]
    assert all(
        not any('Advisor reviewed the previous candidate' in text for text in request.candidate.get('user_context', []))
        for request in review_calls
    )
    assert not any(
        message.get("_review_revision_candidate") or message.get("_review_revision_synthetic")
        for message in result["messages"]
    )


def test_second_revise_keeps_bounded_main_model_rewrite(agent):
    review_calls = []
    _install(agent, ["REVISE", "REVISE"], review_calls)
    agent.client.chat.completions.create.side_effect = [
        _mock_response(content="First candidate", finish_reason="stop"),
        _mock_response(content="Bounded revised answer", finish_reason="stop"),
    ]

    result = _run(agent, "answer", MagicMock())

    assert result["final_response"] == "Bounded revised answer"
    assert result["completed"] is True
    assert not any(
        message.get("_review_revision_candidate") or message.get("_review_revision_synthetic")
        for message in result["messages"]
    )


def test_final_ask_user_is_a_real_localized_clarification(agent):
    review_calls = []
    _install(agent, ["ASK_USER"], review_calls, summaries=["Đại ca muốn so sánh phiên bản nào của OpenClaw?"])
    agent.client.chat.completions.create.return_value = _mock_response(
        content="Candidate that needs clarification", finish_reason="stop"
    )

    result = _run(agent, "answer", MagicMock())

    assert result["completed"] is True
    assert "Đại ca muốn so sánh" in result["final_response"]
    assert "Review checkpoint" not in result["final_response"]


def test_final_block_holds_candidate_and_shows_localized_safety_card(agent):
    review_calls = []
    _install(agent, ["BLOCK"], review_calls, summaries=["Yêu cầu có thể làm lộ khóa truy cập."])
    agent.client.chat.completions.create.return_value = _mock_response(
        content="Unreviewed candidate", finish_reason="stop"
    )

    result = _run(agent, "answer", MagicMock())

    assert result["completed"] is False
    assert "Advisor đã chặn" in result["final_response"]
    assert "Unreviewed candidate" not in result["final_response"]


def test_final_pass_publishes_original_candidate(agent):
    review_calls = []
    _install(agent, ["PASS"], review_calls)
    agent.client.chat.completions.create.return_value = _mock_response(
        content="Reviewed candidate",
        finish_reason="stop",
    )

    result = _run(agent, "answer", MagicMock())

    assert result["final_response"] == "Reviewed candidate"
    assert [request.phase for request in review_calls] == ["final"]
    assert result["completed"] is True


def test_disabled_runtime_preserves_normal_tool_execution(agent):
    review_calls = []
    _install(agent, [], review_calls, enabled=False)
    tool = _mock_tool_call("web_search", "{}", call_id="c1")
    agent.client.chat.completions.create.side_effect = [
        _mock_response(content="", finish_reason="tool_calls", tool_calls=[tool]),
        _mock_response(content="Normal result", finish_reason="stop"),
    ]
    handler = MagicMock(return_value="search result")

    result = _run(agent, "search", handler)

    handler.assert_called_once()
    assert review_calls == []
    assert result["final_response"] == "Normal result"
