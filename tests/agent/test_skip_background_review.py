"""Tests for the skip_background_review constructor flag.

Verifies that AIAgent can be instructed to skip the end-of-turn
_spawn_background_review fork (~30K tokens / event), which is essential
on cron sessions that have no human-in-the-loop value from skill/memory
review forks.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from run_agent import AIAgent
from agent.turn_finalizer import finalize_turn


def _make_agent(
    skip_background_review: bool = False,
    *,
    tool_profile: str = "lean",
) -> AIAgent:
    """Construct a minimally-configured AIAgent for unit testing."""
    with patch(
        "tools.tool_search.resolve_session_tool_profile",
        return_value=tool_profile,
    ):
        return AIAgent(
            model="openai/gpt-4o-mini",
            provider="openrouter",
            api_key="sk-dummy",
            base_url="https://openrouter.ai/api/v1",
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
            skip_background_review=skip_background_review,
            platform="cli",
        )


def _stub_agent_for_finalize(agent: AIAgent) -> None:
    """Stub the heavy finalizer dependencies to isolate the review gate."""
    agent._spawn_background_review = MagicMock()
    agent._save_trajectory = MagicMock()
    agent._cleanup_task_resources = MagicMock()
    agent._persist_session = MagicMock()
    agent._session_messages = []
    agent._file_mutation_verifier_enabled = lambda: False
    agent.clear_interrupt = MagicMock()
    agent._stream_callback = None
    agent._sync_external_memory_for_turn = MagicMock()
    agent._skill_nudge_interval = 10
    agent._iters_since_skill = 20  # exceeds nudge interval → _should_review_skills = True
    agent.valid_tool_names = {"skill_manage"}
    agent.iteration_budget = MagicMock()
    agent.iteration_budget.remaining = 100
    agent.iteration_budget.used = 5
    agent.iteration_budget.max_total = 100
    agent.max_iterations = 50
    agent._emit_status = MagicMock()
    agent._safe_print = MagicMock()
    agent._apply_persist_user_message_override = MagicMock()
    agent.context_compressor = None
    agent._turn_preflight_display_snapshot = None
    agent._turn_received_provider_response = False
    agent.model = "test-model"
    agent.session_id = "test-session"
    agent.quiet_mode = True
    agent._turn_failed_file_mutations = {}
    agent._db_flush_scan_prefix = None


def _run_finalize(agent: AIAgent) -> None:
    """Call finalize_turn with conditions that would trigger background review."""
    finalize_turn(
        agent,
        final_response="ok",
        api_call_count=1,
        interrupted=False,
        failed=False,
        messages=[{"role": "assistant", "content": "ok"}],
        conversation_history=[],
        effective_task_id="test",
        turn_id="test-turn",
        user_message="test",
        original_user_message="test",
        _should_review_memory=True,
        _turn_exit_reason="text_response(1)",
    )


def test_default_lean_profile_skips_background_review() -> None:
    """Fresh lean Q&A never spawns the hidden review model call."""
    agent = _make_agent()
    assert agent.tool_profile == "lean"
    assert agent.skip_background_review is True


def test_skip_background_review_flag_persists() -> None:
    """Passing skip_background_review=True records the flag on the instance."""
    agent = _make_agent(skip_background_review=True, tool_profile="full")
    assert agent.skip_background_review is True


def test_finalize_turn_skips_review_when_flag_set() -> None:
    """finalize_turn must NOT call _spawn_background_review when skip_background_review=True.

    Exercises the actual finalizer call path (not a duplicated guard expression)
    so it catches divergence between the production guard and the test.
    """
    agent = _make_agent(skip_background_review=True)
    _stub_agent_for_finalize(agent)
    _run_finalize(agent)
    agent._spawn_background_review.assert_not_called()


def test_full_profile_fires_review_when_flag_unset() -> None:
    """The explicit full profile preserves legacy background-review behavior."""
    agent = _make_agent(skip_background_review=False, tool_profile="full")
    _stub_agent_for_finalize(agent)
    _run_finalize(agent)
    agent._spawn_background_review.assert_called_once()


def test_cron_construction_sets_skip_background_review() -> None:
    """The cron scheduler MUST construct AIAgent with skip_background_review=True.

    Verified via source-text inspection — the cron scheduler is heavy to
    boot in tests, so we assert that the source declares the flag rather
    than running the scheduler. This catches accidental removal.
    """
    import pathlib

    scheduler_src = pathlib.Path(__file__).resolve().parents[2] / "cron" / "scheduler.py"
    text = scheduler_src.read_text(encoding="utf-8")

    assert "skip_background_review=True" in text, (
        "cron/scheduler.py must construct AIAgent with skip_background_review=True."
    )
