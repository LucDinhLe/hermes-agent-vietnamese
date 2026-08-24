"""Lean-session init, resume, and simple-answer regression tests."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from run_agent import AIAgent


def _tool(name: str) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": f"{name} capability",
            "parameters": {"type": "object", "properties": {}},
        },
    }


def _build_agent(*, session_id=None, session_db=None) -> AIAgent:
    raw = [_tool("terminal"), _tool("read_file"), _tool("clarify")]
    with (
        patch("run_agent.get_tool_definitions", return_value=raw),
        patch("run_agent.check_toolset_requirements", return_value={}),
        patch("run_agent.OpenAI"),
        patch("agent.agent_init.fetch_model_metadata", return_value=None),
    ):
        agent = AIAgent(
            api_key="test-key",
            base_url="https://example.invalid/v1",
            provider="custom",
            model="gpt-test",
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
            platform="telegram",
            session_id=session_id,
            session_db=session_db,
        )
    agent.client = MagicMock()
    return agent


def _response(content: str):
    message = SimpleNamespace(content=content, tool_calls=None)
    choice = SimpleNamespace(message=message, finish_reason="stop")
    return SimpleNamespace(choices=[choice], model="test/model", usage=None)


def test_fresh_telegram_session_freezes_lean_schema_and_hidden_catalog(monkeypatch):
    monkeypatch.setattr("tools.tool_search.load_tool_profile", lambda: "lean")
    agent = _build_agent()

    assert agent.tool_profile == "lean"
    assert agent._tool_schema_frozen is True
    assert agent.valid_tool_names == {
        "clarify",
        "tool_search",
        "tool_describe",
        "tool_call",
    }
    assert agent._tool_catalog_names == {"terminal", "read_file", "clarify"}
    assert agent.skip_background_review is True
    assert agent._session_init_model_config["tool_profile"] == "lean"


def test_simple_lean_answer_is_one_model_call_no_tools_or_background_review(monkeypatch):
    monkeypatch.setattr("tools.tool_search.load_tool_profile", lambda: "lean")
    agent = _build_agent()
    agent.client.chat.completions.create.return_value = _response("Một câu trả lời ngắn.")
    agent._spawn_background_review = MagicMock()
    agent._cached_system_prompt = "You are helpful."
    agent._use_prompt_caching = False
    agent.compression_enabled = False
    agent.save_trajectories = False

    with (
        patch.object(agent, "_persist_session"),
        patch.object(agent, "_save_trajectory"),
        patch.object(agent, "_cleanup_task_resources"),
        patch("model_tools.handle_function_call") as tool_dispatch,
    ):
        result = agent.run_conversation("Giải thích ngắn gọn khái niệm này")

    assert result["completed"] is True
    assert result["api_calls"] == 1
    assert agent.client.chat.completions.create.call_count == 1
    tool_dispatch.assert_not_called()
    agent._spawn_background_review.assert_not_called()


def test_resume_restores_persisted_full_profile_even_when_config_is_lean(
    tmp_path,
    monkeypatch,
):
    from hermes_state import SessionDB

    db = SessionDB(db_path=tmp_path / "state.db")
    db.create_session(
        "resume-full",
        source="telegram",
        model_config={"tool_profile": "full"},
    )
    monkeypatch.setattr("tools.tool_search.load_tool_profile", lambda: "lean")
    try:
        agent = _build_agent(session_id="resume-full", session_db=db)
        assert agent.tool_profile == "full"
        assert {"terminal", "read_file", "clarify"} <= agent.valid_tool_names
        assert agent.skip_background_review is False
        assert agent._session_init_model_config["tool_profile"] == "full"
        # Do not let this test-owned DB be finalized by a later destructor.
        agent._session_db = None
    finally:
        db.close()


def test_first_session_upsert_persists_profile_without_losing_lineage(
    tmp_path,
    monkeypatch,
):
    from hermes_state import SessionDB

    db = SessionDB(db_path=tmp_path / "state.db")
    db.create_session(
        "fresh-lean",
        source="telegram",
        model_config={"_reset_from": "older-session"},
    )
    monkeypatch.setattr("tools.tool_search.load_tool_profile", lambda: "lean")
    try:
        agent = _build_agent(session_id="fresh-lean", session_db=db)
        agent._ensure_db_session()
        stored = json.loads(db.get_session("fresh-lean")["model_config"])
        assert stored["tool_profile"] == "lean"
        assert stored["_reset_from"] == "older-session"
        agent._session_db = None
    finally:
        db.close()
