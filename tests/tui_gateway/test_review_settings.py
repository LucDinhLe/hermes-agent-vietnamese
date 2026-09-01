from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import tui_gateway.server as server

from tui_gateway.review_settings import (
    DEFAULT_REVIEW_MODEL,
    DEFAULT_REVIEW_PROVIDER,
    apply_review_settings,
    live_review_status,
    review_settings,
)


def _agent(*, model: str = "economy-model", provider: str = "openai-codex"):
    return SimpleNamespace(
        model=model,
        provider=provider,
        review_checkpoint_runtime=None,
        session_id="review-session",
    )


def test_defaults_are_disabled_and_use_exact_subscription_route() -> None:
    settings = review_settings({})

    assert settings.enabled is False
    assert settings.provider == DEFAULT_REVIEW_PROVIDER
    assert settings.model == DEFAULT_REVIEW_MODEL


def test_enabled_settings_attach_review_runtime_without_auth_material() -> None:
    agent = _agent()
    runtime = MagicMock(enabled=True)
    runtime.route = SimpleNamespace(provider="openai-codex", model="gpt-5.6-sol")

    with patch(
        "agent.review_checkpoints.create_review_checkpoint_runtime",
        return_value=runtime,
    ) as create:
        applied = apply_review_settings(
            agent,
            {"advisor": {"enabled": True, "provider": "openai-codex", "model": "gpt-5.6-sol"}},
        )

    assert applied.enabled is True
    assert agent.review_checkpoint_runtime is runtime
    kwargs = create.call_args.kwargs
    assert kwargs["session_id"] == "review-session"
    assert kwargs["require_distinct_from_main"] is True
    assert "api_key" not in kwargs
    assert "token" not in kwargs


def test_disabling_removes_runtime_and_preserves_normal_agent_path() -> None:
    agent = _agent()
    agent.review_checkpoint_runtime = object()

    settings = apply_review_settings(agent, {"advisor": {"enabled": False}})

    assert settings.enabled is False
    assert agent.review_checkpoint_runtime is None


def test_status_reports_when_review_route_matches_main() -> None:
    agent = _agent(model="gpt-5.6-sol")
    runtime = SimpleNamespace(
        enabled=True,
        route=SimpleNamespace(provider="openai-codex", model="gpt-5.6-sol"),
    )
    agent.review_checkpoint_runtime = runtime

    status = live_review_status(agent, {})

    assert status["enabled"] is True
    assert status["distinct_from_main"] is False
    assert status["credential_policy"] == "subscription_oauth_only"
    assert status["fallback_policy"] == "none"


def test_config_rpc_toggles_profile_setting_and_live_runtime() -> None:
    agent = _agent()
    session = {"agent": agent, "running": False}
    runtime = MagicMock(enabled=True)
    runtime.route = SimpleNamespace(provider="openai-codex", model="gpt-5.6-sol")

    with (
        patch.dict(server._sessions, {"ui-session": session}, clear=False),
        patch.object(server, "_load_cfg", return_value={"advisor": {"enabled": False}}),
        patch.object(server, "_write_config_key") as write_key,
        patch(
            "agent.review_checkpoints.create_review_checkpoint_runtime",
            return_value=runtime,
        ),
    ):
        response = server._methods["config.set"](
            "rid",
            {"key": "advisor", "session_id": "ui-session", "value": "on"},
        )

    assert response["result"]["value"] == "on"
    assert response["result"]["credential_policy"] == "subscription_oauth_only"
    assert response["result"]["fallback_policy"] == "none"
    assert write_key.call_args_list == [
        (("advisor.enabled", True),),
        (("advisor.provider", "openai-codex"),),
        (("advisor.model", "gpt-5.6-sol"),),
    ]
    assert agent.review_checkpoint_runtime is runtime


def test_config_rpc_rejects_mid_turn_toggle() -> None:
    session = {"agent": _agent(), "running": True}

    with (
        patch.dict(server._sessions, {"busy-session": session}, clear=False),
        patch.object(server, "_load_cfg", return_value={}),
        patch.object(server, "_write_config_key") as write_key,
    ):
        response = server._methods["config.set"](
            "rid",
            {"key": "advisor", "session_id": "busy-session", "value": "on"},
        )

    assert "error" in response
    write_key.assert_not_called()


def test_config_get_reports_live_advisor_route() -> None:
    agent = _agent()
    agent.review_checkpoint_runtime = SimpleNamespace(
        enabled=True,
        route=SimpleNamespace(provider="openai-codex", model="gpt-5.6-sol"),
    )

    with (
        patch.dict(server._sessions, {"ui-session": {"agent": agent}}, clear=False),
        patch.object(server, "_load_cfg", return_value={}),
    ):
        response = server._methods["config.get"](
            "rid",
            {"key": "advisor", "session_id": "ui-session"},
        )

    assert response["result"] == {
        "key": "advisor",
        "value": "on",
        "enabled": True,
        "provider": "openai-codex",
        "model": "gpt-5.6-sol",
        "credential_policy": "subscription_oauth_only",
        "fallback_policy": "none",
        "distinct_from_main": True,
    }
