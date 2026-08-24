"""Behavior contracts for the per-user-turn model/tool governor."""

from __future__ import annotations

import asyncio
import contextvars
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from agent.turn_budget import (
    TurnBudgetExceeded,
    TurnGovernor,
    bind_turn_governor,
    get_turn_governor,
    set_turn_governor,
    reset_turn_governor,
)


def _response(*, model: str = "aux-model", input_tokens: int = 21, output_tokens: int = 3):
    return SimpleNamespace(
        model=model,
        usage=SimpleNamespace(
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        ),
        choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))],
    )


def test_model_warning_fires_once_at_six_and_thirteenth_attempt_is_blocked():
    governor = TurnGovernor(turn_id="turn-1", root_session_id="session-1")

    reservations = [
        governor.reserve_model_attempt(task="main", role="main")
        for _ in range(12)
    ]

    assert [item.warning for item in reservations] == [
        False, False, False, False, False, True,
        False, False, False, False, False, False,
    ]
    assert reservations[-1].total == 12
    assert reservations[-1].remaining == 0

    with pytest.raises(TurnBudgetExceeded) as caught:
        governor.reserve_model_attempt(task="title_generation", role="auxiliary")

    assert caught.value.kind == "model"
    assert caught.value.attempted_count == 13
    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 12
    assert snapshot["model"]["denied"] == 1
    assert snapshot["paused"] is True


def test_tool_warning_fires_once_at_eight_and_batch_admits_only_remaining_prefix():
    governor = TurnGovernor(turn_id="turn-tools")

    reservations = [
        governor.reserve_tool_calls(task="terminal", role="main")
        for _ in range(19)
    ]
    assert sum(item.warning for item in reservations) == 1
    assert reservations[7].warning is True

    crossing = governor.reserve_tool_calls(
        count=3,
        task="terminal",
        role="main",
    )

    assert crossing.admitted == 1
    assert crossing.denied == 2
    assert crossing.total == 20
    assert crossing.remaining == 0
    assert crossing.paused is True
    snapshot = governor.snapshot()
    assert snapshot["tool_calls"] == 20
    assert snapshot["tool"]["denied"] == 2


def test_task_and_role_breakdowns_include_attempts_denials_and_usage():
    governor = TurnGovernor(
        turn_id="turn-breakdown",
        model_hard_limit=2,
        model_warn_limit=1,
    )
    governor.reserve_model_attempt(task="main", role="main")
    governor.reserve_model_attempt(task="title_generation", role="auxiliary")
    governor.reserve_tool_calls(count=2, task="terminal", role="subagent")
    with pytest.raises(TurnBudgetExceeded):
        governor.reserve_model_attempt(task="advisor", role="auxiliary")
    governor.update_usage(
        task="title_generation",
        role="auxiliary",
        input_tokens=100,
        output_tokens=7,
        cache_read_tokens=40,
        cache_write_tokens=5,
        reasoning_tokens=3,
        estimated_cost_usd=0.0125,
    )

    snapshot = governor.snapshot()
    assert snapshot["by_task"]["main"]["model_attempts"] == 1
    assert snapshot["by_task"]["title_generation"]["model_attempts"] == 1
    assert snapshot["by_task"]["advisor"]["denied_model_attempts"] == 1
    assert snapshot["by_role"]["subagent"]["tool_calls"] == 2
    assert snapshot["by_role"]["auxiliary"]["input_tokens"] == 100
    assert snapshot["usage"] == {
        "input_tokens": 100,
        "output_tokens": 7,
        "cache_read_tokens": 40,
        "cache_write_tokens": 5,
        "reasoning_tokens": 3,
        "estimated_cost_usd": 0.0125,
    }


def test_reservations_are_atomic_under_thread_contention():
    governor = TurnGovernor(
        turn_id="turn-race",
        model_warn_limit=500,
        model_hard_limit=1000,
    )

    def reserve_many() -> int:
        warnings = 0
        for _ in range(25):
            warnings += int(
                governor.reserve_model_attempt(
                    task="background_review",
                    role="auxiliary",
                ).warning
            )
        return warnings

    with ThreadPoolExecutor(max_workers=16) as pool:
        warning_counts = list(pool.map(lambda _index: reserve_many(), range(40)))

    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 1000
    assert snapshot["model"]["denied"] == 0
    assert sum(warning_counts) == 1


def test_context_binding_shares_one_aggregate_with_a_subagent_thread():
    governor = TurnGovernor(turn_id="turn-shared", root_session_id="root-session")
    token = set_turn_governor(governor)
    try:
        governor.reserve_model_attempt(task="main", role="main")
        inherited = contextvars.copy_context()

        def child() -> bool:
            current = get_turn_governor()
            assert current is governor
            current.reserve_model_attempt(task="delegate_task", role="subagent")
            return True

        with ThreadPoolExecutor(max_workers=1) as pool:
            assert pool.submit(inherited.run, child).result() is True
    finally:
        reset_turn_governor(token)

    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 2
    assert snapshot["by_role"]["main"]["model_attempts"] == 1
    assert snapshot["by_role"]["subagent"]["model_attempts"] == 1
    assert get_turn_governor() is None


def test_nested_context_manager_restores_the_outer_governor():
    outer = TurnGovernor(turn_id="outer")
    inner = TurnGovernor(turn_id="inner")

    with bind_turn_governor(outer):
        assert get_turn_governor() is outer
        with bind_turn_governor(inner):
            assert get_turn_governor() is inner
        assert get_turn_governor() is outer
    assert get_turn_governor() is None


def test_aux_accounting_context_keeps_legacy_pair_and_carries_turn_metadata():
    from agent.aux_accounting import (
        get_accounting_context,
        get_accounting_details,
        reset_accounting_context,
        set_accounting_context,
    )

    session_db = object()
    governor = TurnGovernor(turn_id="turn-accounting", root_session_id="session-1")
    token = set_accounting_context(
        session_db,
        "session-1",
        turn_id="turn-accounting",
        governor=governor,
    )
    try:
        assert get_accounting_context() == (session_db, "session-1")
        details = get_accounting_details()
        assert details is not None
        assert details.turn_id == "turn-accounting"
        assert details.governor is governor
    finally:
        reset_accounting_context(token)

    assert get_accounting_context() is None
    assert get_accounting_details() is None


def test_aux_usage_updates_governor_without_a_session_database():
    from agent.aux_accounting import (
        record_aux_usage,
        reset_accounting_context,
        set_accounting_context,
    )

    governor = TurnGovernor(turn_id="turn-usage")
    token = set_accounting_context(
        None,
        None,
        turn_id="turn-usage",
        governor=governor,
    )
    try:
        record_aux_usage(_response(input_tokens=33, output_tokens=4), "compression")
    finally:
        reset_accounting_context(token)

    snapshot = governor.snapshot()
    assert snapshot["usage"]["input_tokens"] == 33
    assert snapshot["usage"]["output_tokens"] == 4
    assert snapshot["by_task"]["compression"]["input_tokens"] == 33


def test_moa_usage_exclusions_remain_backward_compatible():
    from agent.aux_accounting import (
        record_aux_usage,
        reset_accounting_context,
        set_accounting_context,
    )

    session_db = MagicMock()
    governor = TurnGovernor(turn_id="turn-moa")
    token = set_accounting_context(
        session_db,
        "session-moa",
        turn_id="turn-moa",
        governor=governor,
    )
    try:
        record_aux_usage(_response(), "moa_reference")
        record_aux_usage(_response(), "moa_aggregator")
    finally:
        reset_accounting_context(token)

    session_db.record_auxiliary_usage.assert_not_called()
    assert governor.snapshot()["usage"]["input_tokens"] == 0


def test_hidden_sync_retries_reserve_every_physical_attempt_including_failures():
    from agent.aux_accounting import reset_accounting_context, set_accounting_context
    from agent.auxiliary_client import call_llm

    governor = TurnGovernor(turn_id="turn-hidden-retry")
    client = MagicMock()
    client.base_url = "https://api.example.test/v1"
    outcomes = [
        ConnectionError("first failed attempt"),
        ConnectionError("second failed attempt"),
        _response(input_tokens=17, output_tokens=2),
    ]

    def physical_create(_client, _request, _task, *, force_stream=False):
        outcome = outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    accounting_token = set_accounting_context(
        None,
        None,
        turn_id="turn-hidden-retry",
        governor=governor,
    )
    try:
        with (
            patch(
                "agent.auxiliary_client._resolve_task_provider_model",
                return_value=("openrouter", "aux-model", None, None, None),
            ),
            patch(
                "agent.auxiliary_client._get_cached_client",
                return_value=(client, "aux-model"),
            ),
            patch(
                "agent.auxiliary_client._effective_provider_for_client",
                return_value="openrouter",
            ),
            patch("agent.auxiliary_client._create_with_progress", physical_create),
            patch("agent.auxiliary_client._provider_requires_stream", return_value=False),
            patch("agent.auxiliary_client._transient_retry_count", return_value=2),
            patch("agent.auxiliary_client._TRANSIENT_RETRY_BACKOFF_BASE", 0.0),
        ):
            result = call_llm(
                task="title_generation",
                messages=[{"role": "user", "content": "title this"}],
            )
    finally:
        reset_accounting_context(accounting_token)

    assert result.choices[0].message.content == "ok"
    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 3
    assert snapshot["by_task"]["title_generation"]["model_attempts"] == 3
    assert snapshot["usage"]["input_tokens"] == 17


def test_hidden_async_failure_is_reserved_before_provider_io():
    from agent.aux_accounting import reset_accounting_context, set_accounting_context
    from agent.auxiliary_client import (
        _relay_async_completion,
        _relay_auxiliary_call_async,
    )

    governor = TurnGovernor(turn_id="turn-hidden-async")

    async def failed_create(_request):
        raise ConnectionError("async provider failed")

    async def execute_current_async(request, callback, **_kwargs):
        return await callback(request)

    @_relay_auxiliary_call_async
    async def invoke(task):
        return await _relay_async_completion(
            client=None,
            kwargs={"model": "aux-model", "messages": []},
            provider="openrouter",
            create=failed_create,
        )

    accounting_token = set_accounting_context(
        None,
        None,
        turn_id="turn-hidden-async",
        governor=governor,
    )
    try:
        with patch(
            "agent.relay_llm.execute_current_async",
            new=execute_current_async,
        ):
            with pytest.raises(ConnectionError, match="async provider failed"):
                asyncio.run(invoke("background_review"))
    finally:
        reset_accounting_context(accounting_token)

    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 1
    assert snapshot["by_task"]["background_review"]["model_attempts"] == 1


def test_auxiliary_hard_limit_blocks_network_before_thirteenth_attempt():
    from agent.aux_accounting import reset_accounting_context, set_accounting_context
    from agent.auxiliary_client import call_llm

    governor = TurnGovernor(turn_id="turn-aux-hard")
    client = MagicMock()
    client.base_url = "https://api.example.test/v1"
    physical_calls = 0

    def physical_create(_client, _request, _task, *, force_stream=False):
        nonlocal physical_calls
        physical_calls += 1
        return _response()

    accounting_token = set_accounting_context(
        None,
        None,
        turn_id="turn-aux-hard",
        governor=governor,
    )
    try:
        with (
            patch(
                "agent.auxiliary_client._resolve_task_provider_model",
                return_value=("openrouter", "aux-model", None, None, None),
            ),
            patch(
                "agent.auxiliary_client._get_cached_client",
                return_value=(client, "aux-model"),
            ),
            patch(
                "agent.auxiliary_client._effective_provider_for_client",
                return_value="openrouter",
            ),
            patch("agent.auxiliary_client._create_with_progress", physical_create),
            patch("agent.auxiliary_client._provider_requires_stream", return_value=False),
        ):
            for _ in range(12):
                call_llm(
                    task="approval",
                    messages=[{"role": "user", "content": "review"}],
                )
            with pytest.raises(TurnBudgetExceeded):
                call_llm(
                    task="approval",
                    messages=[{"role": "user", "content": "review again"}],
                )
    finally:
        reset_accounting_context(accounting_token)

    assert physical_calls == 12
    assert governor.snapshot()["model_calls"] == 12
