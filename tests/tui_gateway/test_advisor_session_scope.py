"""Per-session Advisor state for the Desktop/TUI gateway."""

from __future__ import annotations

import json
import threading
from types import SimpleNamespace
from unittest.mock import patch

from agent.advisor import AdvisorSettings
from tui_gateway.compute_host import ComputeHost
import tui_gateway.server as server


def _agent(enabled: bool = False):
    return SimpleNamespace(
        _advisor_settings=AdvisorSettings(
            enabled=enabled,
            fail_open=False,
            max_revisions=3,
        ),
        api_mode="chat_completions",
        base_url="https://example.test/v1",
        model="reviewed-model",
        provider="openai",
        reasoning_config=None,
        service_tier=None,
        session_id="stored-session",
    )


def _set(params: dict) -> dict:
    return server._methods["config.set"]("rid-1", params)


class TestConfigSetAdvisorSessionScope:
    def test_live_session_toggle_is_scoped_and_preserves_other_settings(self) -> None:
        agent = _agent()
        session = {"agent": agent, "session_key": "stored-session"}

        with (
            patch.dict(server._sessions, {"runtime-session": session}, clear=False),
            patch.object(server, "_write_config_key") as write_key,
            patch.object(server, "_persist_live_session_runtime") as persist,
            patch.object(server, "_emit") as emit,
        ):
            response = _set(
                {
                    "key": "advisor",
                    "session_id": "runtime-session",
                    "value": "on",
                }
            )

        assert response["result"] == {
            "key": "advisor",
            "value": "on",
            "scope": "session",
            "deferred": False,
        }
        assert session["create_advisor_override"] is True
        assert agent._advisor_settings == AdvisorSettings(
            enabled=True,
            fail_open=False,
            max_revisions=3,
        )
        write_key.assert_not_called()
        persist.assert_called_once_with(session)
        emit.assert_called_once()

    def test_lazy_session_pins_override_without_global_write(self) -> None:
        session = {"agent": None, "session_key": "stored-session"}

        with (
            patch.dict(server._sessions, {"runtime-session": session}, clear=False),
            patch.object(server, "_write_config_key") as write_key,
            patch.object(server, "_persist_session_advisor_override") as persist,
        ):
            response = _set(
                {
                    "key": "advisor",
                    "session_id": "runtime-session",
                    "value": "off",
                }
            )

        assert response["result"]["scope"] == "session"
        assert response["result"]["value"] == "off"
        assert session["create_advisor_override"] is False
        write_key.assert_not_called()
        persist.assert_called_once_with(session)

    def test_no_session_updates_the_profile_default(self) -> None:
        with patch.object(server, "_write_config_key") as write_key:
            response = _set({"key": "advisor", "value": "on"})

        assert response["result"]["scope"] == "global"
        write_key.assert_called_once_with("advisor.enabled", True)

    def test_unknown_session_does_not_fall_through_to_global_default(self) -> None:
        with patch.object(server, "_write_config_key") as write_key:
            response = _set(
                {
                    "key": "advisor",
                    "session_id": "stale-runtime-session",
                    "value": "on",
                }
            )

        assert response["error"]["code"] == 4041
        write_key.assert_not_called()


def test_advisor_override_round_trips_through_session_model_config() -> None:
    config = server._runtime_model_config(_agent(enabled=True))
    assert config["advisor_enabled"] is True

    restored = server._stored_session_runtime_overrides(
        {
            "model": "reviewed-model",
            "model_config": json.dumps(config),
        }
    )
    assert restored["advisor_enabled_override"] is True


def test_lazy_resume_info_surfaces_persisted_advisor_override() -> None:
    info = server._lazy_resume_info(
        "C:/workspace",
        advisor_enabled=True,
    )

    assert info["advisor_enabled"] is True


def test_fallback_session_info_surfaces_deferred_advisor_override() -> None:
    session = {
        "agent": None,
        "create_advisor_override": False,
        "cwd": "C:/workspace",
    }

    with (
        patch.object(server, "_git_branch_for_cwd", return_value=""),
        patch.object(server, "_project_info_for_cwd", return_value=None),
        patch.object(server, "_resolve_model", return_value="reviewed-model"),
    ):
        info = server._fallback_session_info(session)

    assert info["advisor_enabled"] is False


def test_apply_advisor_override_keeps_revision_and_failure_policy() -> None:
    agent = _agent(enabled=False)

    server._apply_advisor_enabled_override(agent, True)

    assert agent._advisor_settings == AdvisorSettings(
        enabled=True,
        fail_open=False,
        max_revisions=3,
    )


def test_compute_host_turn_frame_carries_session_advisor_override() -> None:
    frame = server._compute_host_turn_frame(
        "request-1",
        "runtime-session",
        {
            "history_lock": threading.Lock(),
            "history": [],
            "history_version": 0,
            "session_key": "stored-session",
            "create_advisor_override": True,
        },
        "Review this turn",
    )

    assert frame["advisor_enabled_override"] is True


def test_compute_host_existing_session_applies_latest_advisor_override() -> None:
    agent = _agent(enabled=False)
    session = {"agent": agent, "history_lock": threading.Lock()}
    host = object.__new__(ComputeHost)
    host._transport = object()
    fake_server = SimpleNamespace(
        _apply_advisor_enabled_override=server._apply_advisor_enabled_override,
        _sessions={"runtime-session": session},
    )

    resolved = host._ensure_server_session(
        fake_server,
        {
            "sid": "runtime-session",
            "advisor_enabled_override": True,
        },
    )

    assert resolved["create_advisor_override"] is True
    assert agent._advisor_settings.enabled is True
