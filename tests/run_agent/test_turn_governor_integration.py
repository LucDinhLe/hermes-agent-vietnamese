"""Integration seams for v32's aggregate per-user-turn governor."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from agent.chat_completion_helpers import _dispatch_nonstreaming_api_request
from agent.tool_dispatch_helpers import make_tool_result_message
from agent.turn_budget import TurnBudgetExceeded, TurnGovernor
from run_agent import AIAgent


def _tool_call(call_id: str, name: str = "terminal") -> SimpleNamespace:
    return SimpleNamespace(
        id=call_id,
        function=SimpleNamespace(name=name, arguments="{}"),
    )


def test_main_nonstream_retries_warn_once_and_block_provider_attempt_13():
    """The central non-stream dispatcher reserves before client creation/I/O."""
    governor = TurnGovernor(turn_id="main-retries")
    physical_create = MagicMock(return_value=SimpleNamespace(usage=None))
    request_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=physical_create),
        )
    )
    make_client = MagicMock(return_value=request_client)
    events = MagicMock()
    warnings = MagicMock()
    agent = SimpleNamespace(
        api_mode="chat_completions",
        provider="openai",
        platform="cli",
        session_id="sess-main",
        _active_turn_governor=governor,
        _active_turn_budget_task_id="task-main",
        event_callback=events,
        _emit_warning=warnings,
    )

    for _ in range(12):
        _dispatch_nonstreaming_api_request(
            agent,
            {"model": "test-model", "messages": []},
            make_client=make_client,
        )

    with pytest.raises(TurnBudgetExceeded):
        _dispatch_nonstreaming_api_request(
            agent,
            {"model": "test-model", "messages": []},
            make_client=make_client,
        )

    assert physical_create.call_count == 12
    assert make_client.call_count == 12
    warnings.assert_called_once()
    assert events.call_count == 13
    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 12
    assert snapshot["model"]["denied"] == 1
    assert snapshot["by_task"]["task-main"]["model_attempts"] == 12


def test_tool_batch_dispatches_only_admitted_prefix_and_pairs_denied_ids():
    """No tool side effect starts after the aggregate hard limit."""
    governor = TurnGovernor(
        turn_id="tool-prefix",
        tool_warn_limit=1,
        tool_hard_limit=1,
    )
    executed = []

    def execute_sequential(message, messages, _task_id, _api_call_count):
        for call in message.tool_calls:
            executed.append(call.id)
            messages.append(
                make_tool_result_message(
                    call.function.name,
                    "executed",
                    call.id,
                    effect_disposition="none",
                )
            )

    agent = SimpleNamespace(
        platform="cli",
        session_id="sess-tools",
        _active_turn_governor=governor,
        _active_turn_budget_task_id="task-tools",
        _execute_tool_calls_sequential=execute_sequential,
        _execute_tool_calls_concurrent=MagicMock(),
        _get_tool_call_name_static=AIAgent._get_tool_call_name_static,
        _emit_warning=MagicMock(),
        event_callback=MagicMock(),
    )
    assistant_message = SimpleNamespace(
        tool_calls=[
            _tool_call("call-1"),
            _tool_call("call-2"),
            _tool_call("call-3"),
        ]
    )
    messages = []

    with patch(
        "agent.tool_executor._flush_session_db_after_tool_progress",
        return_value=True,
    ):
        AIAgent._execute_tool_calls(
            agent,
            assistant_message,
            messages,
            "task-tools",
            api_call_count=1,
        )

    assert executed == ["call-1"]
    assert [message["tool_call_id"] for message in messages] == [
        "call-1",
        "call-2",
        "call-3",
    ]
    assert messages[0]["content"] == "executed"
    assert all("No side effect occurred" in row["content"] for row in messages[1:])
    assert agent._turn_budget_paused is True
    assert agent._turn_budget_pause_reason == "tool_hard_limit"
    snapshot = governor.snapshot()
    assert snapshot["tool_calls"] == 1
    assert snapshot["tool"]["denied"] == 2


def test_hidden_auxiliary_call_crossing_six_publishes_the_same_warning():
    """A title/compression call cannot cross the warning threshold silently."""
    from agent.aux_accounting import (
        reserve_aux_model_attempt,
        reset_accounting_context,
        set_accounting_context,
    )

    governor = TurnGovernor(turn_id="hidden-warning")
    agent = SimpleNamespace(
        platform="cli",
        session_id="sess-hidden",
        _active_turn_governor=governor,
        event_callback=MagicMock(),
        _emit_warning=MagicMock(),
    )
    token = set_accounting_context(
        None,
        None,
        turn_id=governor.turn_id,
        governor=governor,
        role="main",
        agent=agent,
    )
    try:
        for _ in range(6):
            reserve_aux_model_attempt("title_generation")
    finally:
        reset_accounting_context(token)

    agent._emit_warning.assert_called_once()
    assert agent.event_callback.call_count == 6
    assert governor.snapshot()["by_task"]["title_generation"]["model_attempts"] == 6
