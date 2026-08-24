"""Regression coverage for the immutable lean-session tool surface."""

from __future__ import annotations

import json
from types import SimpleNamespace


def _tool(name: str, description: str = "Capability") -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": {}},
        },
    }


def _names(tool_defs) -> set[str]:
    return {tool["function"]["name"] for tool in tool_defs}


def test_lean_profile_defers_core_tools_but_keeps_clarify_direct():
    from tools.tool_search import (
        TOOL_PROFILE_LEAN,
        classify_tools,
    )

    visible, deferred = classify_tools(
        [_tool("terminal"), _tool("read_file"), _tool("clarify")],
        profile=TOOL_PROFILE_LEAN,
    )

    assert _names(visible) == {"clarify"}
    assert _names(deferred) == {"terminal", "read_file"}


def test_full_profile_is_the_explicit_legacy_escape_hatch():
    from tools.tool_search import TOOL_PROFILE_FULL, classify_tools

    visible, deferred = classify_tools(
        [_tool("terminal"), _tool("read_file"), _tool("clarify")],
        profile=TOOL_PROFILE_FULL,
    )

    assert _names(visible) == {"terminal", "read_file", "clarify"}
    assert deferred == []


def test_lean_assembly_is_small_and_does_not_push_tools_for_simple_answers():
    from tools.tool_search import (
        BRIDGE_TOOL_NAMES,
        TOOL_PROFILE_LEAN,
        ToolSearchConfig,
        assemble_tool_defs,
        estimate_tokens_from_schemas,
    )

    raw = [
        _tool("terminal", "Run shell commands."),
        _tool("read_file", "Read a file."),
        _tool("write_file", "Write a file."),
        _tool("web_search", "Search current web data."),
        _tool("skills_list", "List installed skills."),
        _tool("clarify", "Ask the user a clarifying question."),
    ]
    result = assemble_tool_defs(
        raw,
        profile=TOOL_PROFILE_LEAN,
        context_length=1_050_000,
        # Lean remains lean even when the legacy Tool Search switch is off;
        # tools.profile=full is the only explicit eager escape hatch.
        config=ToolSearchConfig.from_raw({"enabled": "off", "listing": "on"}),
    )

    assert result.activated is True
    assert _names(result.tool_defs) == {"clarify", *BRIDGE_TOOL_NAMES}
    assert result.listing_form == "none"
    assert estimate_tokens_from_schemas(result.tool_defs) < 10_500
    assert estimate_tokens_from_schemas(result.tool_defs) / 1_050_000 < 0.01

    search = next(
        tool for tool in result.tool_defs
        if tool["function"]["name"] == "tool_search"
    )
    description = search["function"]["description"].lower()
    assert "simple explanation" in description
    assert "do not use" in description


def test_lean_bridge_can_discover_describe_and_resolve_core_tools():
    from tools.tool_search import (
        TOOL_PROFILE_LEAN,
        dispatch_tool_describe,
        dispatch_tool_search,
        resolve_underlying_call,
    )

    raw = [_tool("terminal", "Run commands in a terminal session.")]
    search = json.loads(
        dispatch_tool_search(
            {"query": "terminal commands"},
            current_tool_defs=raw,
            profile=TOOL_PROFILE_LEAN,
        )
    )
    assert search["total_available"] == 1
    assert search["matches"][0]["name"] == "terminal"

    described = json.loads(
        dispatch_tool_describe(
            {"name": "terminal"},
            current_tool_defs=raw,
            profile=TOOL_PROFILE_LEAN,
        )
    )
    assert described["name"] == "terminal"

    name, arguments, error = resolve_underlying_call(
        {"name": "terminal", "arguments": {"command": "echo ok"}},
        profile=TOOL_PROFILE_LEAN,
    )
    assert (name, arguments, error) == (
        "terminal",
        {"command": "echo ok"},
        None,
    )


def test_model_dispatch_bridge_reaches_scoped_core_without_running_it(monkeypatch):
    import model_tools

    raw = [_tool("terminal", "Run commands in a terminal session.")]
    dispatched = []

    def fake_dispatch(name, args, **kwargs):
        dispatched.append((name, args))
        return json.dumps({"ok": True, "tool": name})

    monkeypatch.setattr(model_tools.registry, "dispatch", fake_dispatch)
    result = json.loads(
        model_tools.handle_function_call(
            function_name="tool_call",
            function_args={
                "name": "terminal",
                "arguments": {"command": "echo never-executed"},
            },
            tool_profile="lean",
            tool_catalog_defs=raw,
        )
    )

    assert result == {"ok": True, "tool": "terminal"}
    assert dispatched == [
        ("terminal", {"command": "echo never-executed"}),
    ]


def test_lean_catalog_discovers_core_plugin_and_mcp_capabilities():
    from tools.tool_search import TOOL_PROFILE_LEAN, dispatch_tool_search

    raw = [
        _tool("terminal", "Run local terminal commands."),
        _tool("plugin_weather_lookup", "Look up weather through a plugin."),
        _tool("mcp__docs__search", "Search connected documentation."),
    ]

    for query, expected in (
        ("terminal commands", "terminal"),
        ("plugin weather", "plugin_weather_lookup"),
        ("connected documentation", "mcp__docs__search"),
    ):
        result = json.loads(
            dispatch_tool_search(
                {"query": query},
                current_tool_defs=raw,
                profile=TOOL_PROFILE_LEAN,
            )
        )
        assert result["matches"][0]["name"] == expected


def test_default_profile_is_lean_with_normalized_full_escape():
    from hermes_cli.config_defaults import DEFAULT_CONFIG
    from tools.tool_search import normalize_tool_profile

    assert DEFAULT_CONFIG["tools"]["profile"] == "lean"
    assert normalize_tool_profile(" FULL ") == "full"


def test_session_profile_prefers_persisted_value_over_changed_config(monkeypatch):
    from tools import tool_search

    class FakeDB:
        def get_session_model_config_value(self, session_id, key, default=None):
            assert session_id == "resume-me"
            assert key == "tool_profile"
            return "full"

    monkeypatch.setattr(tool_search, "load_tool_profile", lambda: "lean")

    assert tool_search.resolve_session_tool_profile(
        session_db=FakeDB(),
        session_id="resume-me",
    ) == "full"


def test_frozen_agent_refresh_updates_catalog_without_changing_prompt_bytes(monkeypatch):
    from tools import mcp_tool
    import model_tools

    visible = [_tool("clarify"), _tool("tool_search"), _tool("tool_describe"), _tool("tool_call")]
    agent = SimpleNamespace(
        tools=list(visible),
        valid_tool_names=_names(visible),
        enabled_toolsets=["hermes-telegram"],
        disabled_toolsets=None,
        tool_profile="lean",
        _tool_schema_frozen=True,
        _tool_search_catalog_defs=tuple([_tool("terminal")]),
        _tool_snapshot_generation=0,
        _memory_manager=None,
        context_compressor=None,
        _context_engine_tool_names=set(),
    )
    before = json.dumps(agent.tools, sort_keys=True, separators=(",", ":"))
    monkeypatch.setattr(
        model_tools,
        "get_tool_definitions",
        lambda **kwargs: [_tool("terminal"), _tool("mcp_late_tool")],
    )

    added = mcp_tool.refresh_agent_mcp_tools(agent)

    after = json.dumps(agent.tools, sort_keys=True, separators=(",", ":"))
    assert before == after
    assert agent.valid_tool_names == _names(visible)
    assert added == {"mcp_late_tool"}
    assert _names(agent._tool_search_catalog_defs) == {
        "terminal",
        "mcp_late_tool",
    }


def test_real_telegram_lean_schema_stays_below_one_percent():
    """Offline benchmark over the real registered Telegram surface."""
    import model_tools
    from tools.tool_search import estimate_tokens_from_schemas

    active = model_tools.get_tool_definitions(
        enabled_toolsets=["hermes-telegram"],
        quiet_mode=True,
        tool_profile="lean",
    )
    raw = model_tools.get_tool_definitions(
        enabled_toolsets=["hermes-telegram"],
        quiet_mode=True,
        tool_profile="lean",
        skip_tool_search_assembly=True,
    )

    active_tokens = estimate_tokens_from_schemas(active)
    assert active_tokens < estimate_tokens_from_schemas(raw)
    assert active_tokens < 10_500
    assert active_tokens / 1_050_000 < 0.01
    assert {"tool_search", "tool_describe", "tool_call"} <= _names(active)
