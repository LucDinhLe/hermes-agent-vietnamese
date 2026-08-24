"""Regression contracts for provider-internal physical model attempts.

These tests stay entirely offline.  Provider clients are mocks and every
assertion distinguishes an admitted physical request from a fallback blocked
before I/O by the per-turn governor.
"""

from __future__ import annotations

from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, call, patch

import pytest

from agent.turn_budget import (
    TurnBudgetExceeded,
    TurnGovernor,
    UnobservableModelRuntimeError,
    bind_turn_governor,
    reserve_agent_model_attempt,
)


def _chat_response() -> SimpleNamespace:
    return SimpleNamespace(
        model="mock-model",
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(role="assistant", content="ok"),
                finish_reason="stop",
            )
        ],
        usage=None,
    )


def test_aux_stream_fallback_is_a_second_attempt_and_is_blocked_before_io():
    from agent.auxiliary_client import (
        _create_with_progress,
        _relay_sync_completion,
        aux_progress_hook,
    )

    governor = TurnGovernor(
        turn_id="aux-stream-fallback",
        model_warn_limit=1,
        model_hard_limit=1,
    )
    calls = []

    def create(**kwargs):
        calls.append(dict(kwargs))
        if kwargs.get("stream"):
            raise RuntimeError("stream is not supported by this model")
        return _chat_response()

    client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )

    with bind_turn_governor(governor), aux_progress_hook(lambda: None):
        with pytest.raises(TurnBudgetExceeded):
            _relay_sync_completion(
                client,
                {"model": "mock-model", "messages": []},
                provider="mock",
                create=lambda request: _create_with_progress(
                    client,
                    request,
                    "compression",
                ),
            )

    assert len(calls) == 1
    assert calls[0]["stream"] is True
    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 1
    assert snapshot["model"]["denied"] == 1


def test_anthropic_stream_fallback_reserves_again_before_messages_create():
    from agent.anthropic_adapter import create_anthropic_message

    governor = TurnGovernor(
        turn_id="anthropic-stream-fallback",
        model_warn_limit=1,
        model_hard_limit=1,
    )
    governor.reserve_model_attempt(task="main", role="main")
    messages = SimpleNamespace(
        stream=MagicMock(
            side_effect=RuntimeError("stream is not supported by this endpoint")
        ),
        create=MagicMock(return_value=object()),
    )
    client = SimpleNamespace(messages=messages)

    with bind_turn_governor(governor):
        with pytest.raises(TurnBudgetExceeded):
            create_anthropic_message(
                client,
                {"model": "claude-mock", "messages": []},
            )

    messages.stream.assert_called_once()
    messages.create.assert_not_called()
    assert governor.snapshot()["model"]["denied"] == 1


def test_bedrock_stream_fallback_reserves_again_before_converse():
    from agent.bedrock_adapter import call_converse_stream

    governor = TurnGovernor(
        turn_id="bedrock-stream-fallback",
        model_warn_limit=1,
        model_hard_limit=1,
    )
    governor.reserve_model_attempt(task="main", role="main")
    client = MagicMock()
    client.converse_stream.side_effect = RuntimeError(
        "AccessDeniedException: not authorized to perform "
        "bedrock:InvokeModelWithResponseStream"
    )

    with (
        bind_turn_governor(governor),
        patch(
            "agent.bedrock_adapter._get_bedrock_runtime_client",
            return_value=client,
        ),
    ):
        with pytest.raises(TurnBudgetExceeded):
            call_converse_stream(
                region="us-east-1",
                model="anthropic.claude-mock",
                messages=[{"role": "user", "content": "hi"}],
            )

    client.converse_stream.assert_called_once()
    client.converse.assert_not_called()
    assert governor.snapshot()["model"]["denied"] == 1


def test_bedrock_runtime_disables_retries_but_control_plane_keeps_defaults():
    from agent.bedrock_adapter import (
        _get_bedrock_control_client,
        _get_bedrock_runtime_client,
        _single_attempt_botocore_config,
        reset_client_cache,
    )

    class FakeConfig:
        def __init__(self, *, retries):
            self.retries = retries

    botocore_module = ModuleType("botocore")
    botocore_config_module = ModuleType("botocore.config")
    botocore_config_module.Config = FakeConfig
    botocore_module.config = botocore_config_module
    with patch.dict(
        "sys.modules",
        {
            "botocore": botocore_module,
            "botocore.config": botocore_config_module,
        },
    ):
        config = _single_attempt_botocore_config()
    assert config.retries["total_max_attempts"] == 1

    boto3 = MagicMock()
    boto3.client.side_effect = [object(), object()]
    reset_client_cache()
    try:
        with (
            patch("agent.bedrock_adapter._require_boto3", return_value=boto3),
            patch(
                "agent.bedrock_adapter._single_attempt_botocore_config",
                return_value=config,
            ),
        ):
            _get_bedrock_runtime_client("us-east-1")
            _get_bedrock_control_client("us-east-1")
    finally:
        reset_client_cache()

    assert boto3.client.call_args_list == [
        call("bedrock-runtime", region_name="us-east-1", config=config),
        call("bedrock", region_name="us-east-1"),
    ]


def test_vertex_auxiliary_client_disables_openai_sdk_retries():
    from agent.auxiliary_client import resolve_provider_client

    constructor = MagicMock(return_value=object())
    openai_module = ModuleType("openai")
    openai_module.OpenAI = constructor
    base_url = (
        "https://aiplatform.googleapis.com/v1beta1/projects/p/"
        "locations/global/endpoints/openapi"
    )

    with (
        patch.dict("sys.modules", {"openai": openai_module}),
        patch(
            "agent.vertex_adapter.has_vertex_credentials",
            return_value=True,
        ),
        patch(
            "agent.vertex_adapter.get_vertex_config",
            return_value=("ya29.mock-token", base_url),
        ),
    ):
        client, model = resolve_provider_client(
            "vertex",
            "google/gemini-3-flash-preview",
        )

    assert client is constructor.return_value
    assert model == "google/gemini-3-flash-preview"
    constructor.assert_called_once_with(
        api_key="ya29.mock-token",
        base_url=base_url,
        max_retries=0,
    )


def test_bedrock_context_probe_reserves_each_tier_and_cap_blocks_payload():
    from agent.bedrock_adapter import probe_bedrock_context_length

    governor = TurnGovernor(
        turn_id="bedrock-probe-cap",
        model_warn_limit=1,
        model_hard_limit=1,
    )
    client = MagicMock()
    client.converse.side_effect = RuntimeError("opaque provider failure")

    with (
        bind_turn_governor(governor),
        patch(
            "agent.bedrock_adapter._get_bedrock_runtime_client",
            return_value=client,
        ),
        patch("agent.bedrock_adapter._BEDROCK_PROBE_TIERS", (100, 200)),
        patch("agent.bedrock_adapter._WORDS_PER_TOKEN", 1.0),
    ):
        with pytest.raises(TurnBudgetExceeded):
            probe_bedrock_context_length("anthropic.claude-mock", "us-east-1")

    client.converse.assert_called_once()
    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 1
    assert snapshot["model"]["denied"] == 1


def test_bedrock_context_probe_records_usage_from_an_accepted_request():
    from agent.bedrock_adapter import probe_bedrock_context_length

    governor = TurnGovernor(
        turn_id="bedrock-probe-usage",
        model_warn_limit=2,
        model_hard_limit=2,
    )
    client = MagicMock()
    client.converse.return_value = {
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"text": "accepted"}],
            }
        },
        "stopReason": "end_turn",
        "usage": {"inputTokens": 5, "outputTokens": 2, "totalTokens": 7},
    }

    with (
        bind_turn_governor(governor),
        patch(
            "agent.bedrock_adapter._get_bedrock_runtime_client",
            return_value=client,
        ),
        patch("agent.bedrock_adapter._BEDROCK_PROBE_TIERS", (100,)),
        patch("agent.bedrock_adapter._WORDS_PER_TOKEN", 1.0),
    ):
        assert (
            probe_bedrock_context_length(
                "anthropic.claude-mock",
                "us-east-1",
            )
            == 100
        )

    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 1
    assert snapshot["usage"]["input_tokens"] == 5
    assert snapshot["usage"]["output_tokens"] == 2


@pytest.mark.parametrize(
    ("provider", "api_mode", "runtime_label"),
    [
        ("openai-codex", "codex_app_server", "Codex app-server"),
        ("claude-code", "chat_completions", "Claude Code CLI"),
        ("copilot-acp", "chat_completions", "GitHub Copilot ACP"),
    ],
)
def test_main_opaque_runtime_is_blocked_before_budget_or_provider_io(
    provider,
    api_mode,
    runtime_label,
):
    governor = TurnGovernor(turn_id=f"opaque-{provider}")
    agent = SimpleNamespace(
        provider=provider,
        api_mode=api_mode,
        platform="cli",
        session_id="mock-session",
    )

    with bind_turn_governor(governor):
        with pytest.raises(UnobservableModelRuntimeError, match=runtime_label):
            reserve_agent_model_attempt(agent)

    snapshot = governor.snapshot()
    assert snapshot["model_calls"] == 0
    assert snapshot["model"]["denied"] == 0
    assert snapshot["paused"] is False


def test_direct_codex_runtime_remains_governed_and_available():
    governor = TurnGovernor(turn_id="direct-codex")
    agent = SimpleNamespace(
        provider="openai-codex",
        api_mode="codex_responses",
        platform="cli",
        session_id="mock-session",
    )

    with bind_turn_governor(governor):
        reservation = reserve_agent_model_attempt(agent)

    assert reservation is not None
    assert reservation.admitted == 1
    assert governor.snapshot()["model_calls"] == 1


def test_agent_bound_governor_still_blocks_when_contextvar_is_missing():
    governor = TurnGovernor(turn_id="bound-without-contextvar")
    agent = SimpleNamespace(
        provider="claude-code",
        api_mode="chat_completions",
        platform="cli",
        session_id="mock-session",
        _active_turn_governor=governor,
    )

    with pytest.raises(UnobservableModelRuntimeError, match="Claude Code CLI"):
        reserve_agent_model_attempt(agent)

    assert governor.snapshot()["model_calls"] == 0


def test_aux_opaque_runtime_is_blocked_before_callback():
    from agent import auxiliary_client as aux

    governor = TurnGovernor(turn_id="opaque-aux")
    create = MagicMock(return_value=_chat_response())
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )
    context_token = aux._RELAY_AUX_CALL_CONTEXT.set(
        {
            "task": "compression",
            "request_id": "aux-opaque-test",
            "attempt_count": 0,
            "provider": "copilot-acp",
            "model": "mock-model",
            "response_model": None,
            "api_mode": "chat_completions",
        }
    )
    try:
        with bind_turn_governor(governor):
            with pytest.raises(
                UnobservableModelRuntimeError,
                match="GitHub Copilot ACP",
            ):
                aux._relay_sync_completion(
                    client,
                    {"model": "mock-model", "messages": []},
                    provider="copilot-acp",
                )
    finally:
        aux._RELAY_AUX_CALL_CONTEXT.reset(context_token)

    create.assert_not_called()
    assert governor.snapshot()["model_calls"] == 0


def test_claude_code_defensive_boundary_blocks_before_auth_probe(tmp_path):
    from agent.claude_code_client import ClaudeCodeClient

    governor = TurnGovernor(turn_id="opaque-claude-defense")
    client = ClaudeCodeClient(command="claude", cwd=str(tmp_path))
    with (
        bind_turn_governor(governor),
        patch("agent.claude_code_client.probe_claude_code_auth") as auth_probe,
    ):
        iterator = client._stream_response(
            model="sonnet",
            messages=[{"role": "user", "content": "hello"}],
            timeout_seconds=1,
        )
        with pytest.raises(UnobservableModelRuntimeError, match="Claude Code CLI"):
            next(iterator)

    auth_probe.assert_not_called()
    assert governor.snapshot()["model_calls"] == 0


def test_copilot_acp_defensive_boundary_blocks_before_cli_probe(tmp_path):
    from agent.copilot_acp_client import CopilotACPClient

    governor = TurnGovernor(turn_id="opaque-copilot-defense")
    client = CopilotACPClient(acp_command="copilot", acp_cwd=str(tmp_path))
    with (
        bind_turn_governor(governor),
        patch("agent.copilot_acp_client._acp_supported") as acp_probe,
    ):
        with pytest.raises(UnobservableModelRuntimeError, match="GitHub Copilot ACP"):
            client._run_prompt("hello", timeout_seconds=1)

    acp_probe.assert_not_called()
    assert governor.snapshot()["model_calls"] == 0


def test_codex_app_server_boundary_blocks_before_session_construction():
    from agent.codex_runtime import run_codex_app_server_turn

    governor = TurnGovernor(turn_id="opaque-codex-defense")
    with bind_turn_governor(governor):
        result = run_codex_app_server_turn(
            SimpleNamespace(),
            user_message="hello",
            original_user_message="hello",
            messages=[],
            effective_task_id="mock-task",
        )

    assert governor.snapshot()["model_calls"] == 0
    assert result["failed"] is True
    assert result["api_calls"] == 0
    assert result["provider_error_kind"] == "unobservable_model_runtime"
    assert result["turn_exit_reason"] == "unobservable_model_runtime_blocked"
    assert "Codex app-server" in result["final_response"]


@pytest.mark.parametrize(
    ("provider", "base_url", "runtime_label"),
    [
        ("claude-code", "claude-code://local", "Claude Code CLI"),
        ("copilot-acp", "acp://copilot", "GitHub Copilot ACP"),
    ],
)
def test_high_level_opaque_provider_returns_one_visible_failure_without_io(
    provider,
    base_url,
    runtime_label,
):
    from run_agent import AIAgent

    agent = AIAgent(
        api_key="mock-subscription",
        base_url=base_url,
        provider=provider,
        api_mode="chat_completions",
        quiet_mode=True,
        skip_context_files=True,
        skip_memory=True,
    )
    provider_create = MagicMock(side_effect=AssertionError("provider I/O reached"))
    agent.client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=provider_create))
    )

    result = agent.run_conversation("hello")

    provider_create.assert_not_called()
    assert result["failed"] is True
    assert result["api_calls"] == 0
    assert result["turn_exit_reason"] == "unobservable_model_runtime_blocked"
    assert runtime_label in result["final_response"]
    assert result["messages"][-1]["role"] == "assistant"
    assert result["messages"][-1]["content"] == result["final_response"]
