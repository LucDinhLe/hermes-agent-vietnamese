"""Conversation-loop contracts for the read-only Advisor checkpoints."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from agent.advisor import AdvisorDecision, AdvisorSettings
from agent.iteration_budget import IterationBudget
from run_agent import AIAgent


def _response(content="done", *, tool_calls=None, finish_reason="stop"):
    message = SimpleNamespace(content=content, tool_calls=tool_calls)
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message, finish_reason=finish_reason)],
        model="test/model",
        usage=None,
    )


def _tool_call(name="patch", call_id="call-1"):
    return SimpleNamespace(
        id=call_id,
        type="function",
        function=SimpleNamespace(
            name=name,
            arguments='{"patch":"*** Begin Patch\\n*** End Patch"}',
        ),
    )


@pytest.fixture
def agent(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    monkeypatch.setenv("HERMES_VERIFY_ON_STOP", "0")
    with (
        patch("run_agent.get_tool_definitions", return_value=[]),
        patch("run_agent.check_toolset_requirements", return_value={}),
        patch("run_agent.OpenAI"),
    ):
        instance = AIAgent(
            session_id="advisor-checkpoint-test",
            api_key="test-key",
            base_url="https://example.invalid/v1",
            provider="openai-compat",
            model="test/model",
            max_iterations=3,
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
        )
    instance._cached_system_prompt = "stable test prompt"
    instance._session_db = None
    instance._session_json_enabled = False
    instance.save_trajectories = False
    instance.compression_enabled = False
    instance._cleanup_task_resources = lambda *_a, **_kw: None
    instance._save_trajectory = lambda *_a, **_kw: None
    instance._advisor_settings = AdvisorSettings(enabled=True, max_revisions=2)
    return instance


def test_plan_revise_withholds_mutating_tool_and_preserves_pairing(agent):
    agent.event_callback = MagicMock()
    agent.valid_tool_names = ["patch"]
    answers = iter(
        [
            _response("I will patch it", tool_calls=[_tool_call()], finish_reason="tool_calls"),
            _response("I need the target file before editing."),
        ]
    )
    agent._interruptible_api_call = lambda _kwargs: next(answers)
    agent._execute_tool_calls = MagicMock()

    decisions = [
        AdvisorDecision(
            verdict="REVISE",
            summary="Target file is missing",
            feedback="Inspect the target before editing.",
        ),
        AdvisorDecision(verdict="PASS", summary="Honest final response"),
    ]

    with (
        patch("agent.advisor.review_packet", side_effect=decisions) as review,
        patch("hermes_cli.plugins.has_hook", return_value=False),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        result = agent.run_conversation("Update the requested file safely")

    agent._execute_tool_calls.assert_not_called()
    assert review.call_count == 2
    withheld = [m for m in result["messages"] if m.get("_advisor_withheld")]
    assert len(withheld) == 1
    assert withheld[0]["role"] == "tool"
    assert withheld[0]["tool_call_id"] == "call-1"
    assert "Inspect the target" in withheld[0]["content"]
    assert result["final_response"] == "I need the target file before editing."
    states = [
        call.args[1]["state"]
        for call in agent.event_callback.call_args_list
        if call.args and call.args[0] == "advisor.progress"
    ]
    assert states == ["reviewing", "revision_requested", "reviewing", "passed"]


def test_final_revise_is_ephemeral_and_replaced_by_checked_answer(agent):
    agent.event_callback = MagicMock()
    answers = iter([_response("Premature result"), _response("Corrected result")])
    agent._interruptible_api_call = lambda _kwargs: next(answers)
    decisions = [
        AdvisorDecision(
            verdict="REVISE",
            summary="The answer overclaims completion",
            feedback="State what remains unverified.",
        ),
        AdvisorDecision(verdict="PASS", summary="Aligned and honest"),
    ]

    with (
        patch("agent.advisor.review_packet", side_effect=decisions) as review,
        patch("hermes_cli.plugins.has_hook", return_value=False),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        result = agent.run_conversation("Give me the verified result")

    assert review.call_count == 2
    assert result["final_response"] == "Corrected result"
    assert [m["role"] for m in result["messages"]] == ["user", "assistant"]
    assert all(not m.get("_advisor_final_synthetic") for m in result["messages"])
    states = [
        call.args[1]["state"]
        for call in agent.event_callback.call_args_list
        if call.args and call.args[0] == "advisor.progress"
    ]
    assert states == ["reviewing", "revision_requested", "reviewing", "passed"]


def test_advisor_off_makes_zero_review_calls(agent):
    agent._advisor_settings = AdvisorSettings(enabled=False)
    agent._interruptible_api_call = lambda _kwargs: _response("Normal result")

    with (
        patch("agent.advisor.review_packet") as review,
        patch("hermes_cli.plugins.has_hook", return_value=False),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        result = agent.run_conversation("Answer normally")

    review.assert_not_called()
    assert result["final_response"] == "Normal result"


def test_progress_events_expose_plan_and_final_checkpoints_in_loop_order(agent):
    agent.valid_tool_names = ["patch"]
    agent.event_callback = MagicMock()
    answers = iter(
        [
            _response(
                "I will apply the requested change",
                tool_calls=[_tool_call()],
                finish_reason="tool_calls",
            ),
            _response("Verified result"),
        ]
    )
    agent._interruptible_api_call = lambda _kwargs: next(answers)

    def execute_success(message, messages, *_args):
        for tool_call in message.tool_calls or []:
            messages.append(
                {
                    "role": "tool",
                    "name": tool_call.function.name,
                    "tool_call_id": tool_call.id,
                    "content": '{"ok":true}',
                }
            )

    agent._execute_tool_calls = MagicMock(side_effect=execute_success)

    with (
        patch(
            "agent.advisor.review_packet",
            side_effect=[
                AdvisorDecision(verdict="PASS", summary="Plan is aligned"),
                AdvisorDecision(verdict="PASS", summary="Result is aligned"),
            ],
        ),
        patch("hermes_cli.plugins.has_hook", return_value=False),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        result = agent.run_conversation("Make the change and verify it")

    progress = [
        call.args
        for call in agent.event_callback.call_args_list
        if call.args and call.args[0] == "advisor.progress"
    ]

    assert result["final_response"] == "Verified result"
    assert progress == [
        (
            "advisor.progress",
            {"checkpoint": "plan", "state": "reviewing"},
        ),
        (
            "advisor.progress",
            {
                "checkpoint": "plan",
                "state": "passed",
                "summary": "Plan is aligned",
            },
        ),
        (
            "advisor.progress",
            {"checkpoint": "final", "state": "reviewing"},
        ),
        (
            "advisor.progress",
            {
                "checkpoint": "final",
                "state": "passed",
                "summary": "Result is aligned",
            },
        ),
    ]


def test_passed_recovery_review_does_not_consume_revision_budget(agent):
    agent.max_iterations = 5
    agent.iteration_budget = IterationBudget(5)
    agent.valid_tool_names = ["patch", "terminal", "write_file"]
    answers = iter(
        [
            _response("Patch first", tool_calls=[_tool_call("patch", "call-1")], finish_reason="tool_calls"),
            _response("Run a check", tool_calls=[_tool_call("terminal", "call-2")], finish_reason="tool_calls"),
            _response("Write a report", tool_calls=[_tool_call("write_file", "call-3")], finish_reason="tool_calls"),
            _response("Stopped after review"),
        ]
    )
    agent._interruptible_api_call = lambda _kwargs: next(answers)

    def execute_success(message, messages, *_args):
        for tool_call in message.tool_calls or []:
            messages.append(
                {
                    "role": "tool",
                    "name": tool_call.function.name,
                    "tool_call_id": tool_call.id,
                    "content": '{"ok":true}',
                }
            )

    agent._execute_tool_calls = MagicMock(side_effect=execute_success)
    decisions = [
        AdvisorDecision(verdict="PASS", summary="Initial plan is aligned"),
        AdvisorDecision(verdict="PASS", summary="Changed approach is aligned"),
        AdvisorDecision(
            verdict="REVISE",
            summary="Report target is unclear",
            feedback="Ask where the report should be written.",
        ),
        AdvisorDecision(verdict="PASS", summary="Final response is honest"),
    ]

    with (
        patch("agent.advisor.review_packet", side_effect=decisions) as review,
        patch("hermes_cli.plugins.has_hook", return_value=False),
        patch("hermes_cli.plugins.invoke_hook", return_value=[]),
    ):
        result = agent.run_conversation("Apply the changes and report the result")

    assert review.call_count == 4
    withheld = [m for m in result["messages"] if m.get("_advisor_withheld")]
    assert len(withheld) == 1
    assert '"revision_budget_exhausted": false' in withheld[0]["content"]
    assert result["final_response"] == "Stopped after review"
