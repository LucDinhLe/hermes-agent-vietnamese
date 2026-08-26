from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

from agent.capability_router import (
    MCP_CAPABILITY_RECEIPT_KEY,
    _mcp_selection_hash,
    apply_agent_mcp_scope,
    attach_agent_mcp_capability_receipt,
    initialize_new_session_capabilities,
    restore_agent_capability_receipt,
    route_agent_mcp_capabilities,
)
from model_tools import handle_function_call


def _tool(name: str, description: str = "") -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": {}},
        },
    }


def _agent() -> SimpleNamespace:
    visible = [_tool("tool_search"), _tool("tool_describe"), _tool("tool_call")]
    catalog = [
        _tool("read_file", "Read a local file"),
        _tool("mcp__docs__search", "Search connected product documentation"),
        _tool("mcp__docs__write", "Write pages to connected documentation"),
        _tool("mcp__crm__delete_contact", "Delete a CRM contact"),
    ]
    return SimpleNamespace(
        tools=visible,
        valid_tool_names={item["function"]["name"] for item in visible},
        _tool_search_catalog_defs=tuple(catalog),
        _tool_catalog_names=frozenset(item["function"]["name"] for item in catalog),
        _session_init_model_config={},
        _tool_schema_frozen=True,
    )


def test_local_mcp_route_selects_exact_connected_tool_without_calls_or_mutation():
    agent = _agent()
    before = tuple(agent._tool_search_catalog_defs)

    route = route_agent_mcp_capabilities(
        agent,
        "Search the connected product documentation",
    )

    assert route.tools == ("mcp__docs__search",)
    assert route.servers == {"docs": ("mcp__docs__search",)}
    assert route.model_attempts == 0
    assert route.used_provider is False
    assert route.used_network is False
    assert tuple(agent._tool_search_catalog_defs) == before


def test_mcp_receipt_filters_search_describe_and_direct_dispatch():
    agent = _agent()
    route = route_agent_mcp_capabilities(
        agent,
        "Search the connected product documentation",
    )
    attach_agent_mcp_capability_receipt(agent, route)
    apply_agent_mcp_scope(agent)

    names = {item["function"]["name"] for item in agent._tool_search_catalog_defs}
    assert "read_file" in names
    assert "mcp__docs__search" in names
    assert "mcp__docs__write" not in names
    assert "mcp__crm__delete_contact" not in names

    search = json.loads(
        handle_function_call(
            "tool_search",
            {"query": "write connected documentation"},
            tool_profile="lean",
            tool_catalog_defs=list(agent._tool_search_catalog_defs),
            capability_mcp_tools=agent._capability_mcp_tools,
        )
    )
    assert all(match["name"] != "mcp__docs__write" for match in search["matches"])
    described = handle_function_call(
        "tool_describe",
        {"name": "mcp__docs__write"},
        tool_profile="lean",
        tool_catalog_defs=list(agent._tool_search_catalog_defs),
        capability_mcp_tools=agent._capability_mcp_tools,
    )
    assert "not currently available" in described

    denied = handle_function_call(
        "mcp__docs__write",
        {},
        capability_mcp_tools=agent._capability_mcp_tools,
    )
    assert "not assigned" in denied

    with patch("model_tools.registry.dispatch", return_value='{"ok": true}') as dispatch:
        allowed = handle_function_call(
            "mcp__docs__search",
            {},
            capability_mcp_tools=agent._capability_mcp_tools,
            skip_pre_tool_call_hook=True,
            skip_tool_request_middleware=True,
            skip_tool_execution_middleware=True,
        )
    assert allowed == '{"ok": true}'
    dispatch.assert_called_once()


def test_mcp_receipt_persists_and_tampering_restores_empty_scope():
    agent = _agent()
    route = route_agent_mcp_capabilities(
        agent,
        "Search the connected product documentation",
    )
    attach_agent_mcp_capability_receipt(agent, route)
    record = agent._session_init_model_config[MCP_CAPABILITY_RECEIPT_KEY]
    assert record["servers"] == {"docs": ["mcp__docs__search"]}

    resumed = _agent()
    assert restore_agent_capability_receipt(
        resumed, {MCP_CAPABILITY_RECEIPT_KEY: record}
    )
    assert resumed._capability_mcp_tools == ("mcp__docs__search",)

    tampered = dict(record)
    tampered["tools"] = ["mcp__crm__delete_contact"]
    rejected = _agent()
    assert restore_agent_capability_receipt(
        rejected, {MCP_CAPABILITY_RECEIPT_KEY: tampered}
    )
    assert rejected._capability_mcp_tools == ()

    server_tampered = dict(record)
    server_tampered["servers"] = {
        "crm": list(record["servers"]["docs"])
    }
    wrong_server = _agent()
    assert restore_agent_capability_receipt(
        wrong_server, {MCP_CAPABILITY_RECEIPT_KEY: server_tampered}
    )
    assert wrong_server._capability_mcp_tools == ()

    forged_server = dict(record)
    forged_server["servers"] = {"crm": ["mcp__docs__search"]}
    forged_server["selection_hash"] = _mcp_selection_hash(
        forged_server["tools"], forged_server["servers"]
    )
    wrong_server_with_matching_hash = _agent()
    assert restore_agent_capability_receipt(
        wrong_server_with_matching_hash,
        {MCP_CAPABILITY_RECEIPT_KEY: forged_server},
    )
    assert wrong_server_with_matching_hash._capability_mcp_tools == ()


def test_child_mcp_route_can_only_narrow_parent_receipt():
    parent = _agent()
    parent._capability_mcp_tools = ("mcp__docs__search",)

    route = route_agent_mcp_capabilities(
        parent,
        "Delete a CRM contact and search the docs",
        allowed_tools=parent._capability_mcp_tools,
    )

    assert route.tools == ("mcp__docs__search",)
    assert "crm" not in route.servers


def test_local_route_can_assign_two_explicit_actions_from_one_server():
    agent = _agent()

    route = route_agent_mcp_capabilities(
        agent,
        "Search and write connected documentation",
    )

    assert route.tools == ("mcp__docs__search", "mcp__docs__write")


def test_local_route_understands_vietnamese_action_terms():
    agent = _agent()

    route = route_agent_mcp_capabilities(agent, "Tìm kiếm tài liệu sản phẩm")

    assert route.tools == ("mcp__docs__search",)


def test_fresh_root_routes_and_freezes_mcp_before_first_prompt():
    agent = _agent()
    agent.platform = "cli"
    agent._cached_system_prompt = None

    with patch("agent.capability_router.route_agent_capabilities", return_value=None):
        initialize_new_session_capabilities(
            agent,
            "Search the connected product documentation",
            conversation_history=None,
        )

    assert agent._capability_mcp_tools == ("mcp__docs__search",)
    assert MCP_CAPABILITY_RECEIPT_KEY in agent._session_init_model_config
    assert "mcp__docs__write" not in agent._tool_catalog_names
    assert agent._capability_route_initialized is True


def test_full_profile_listing_is_rebuilt_without_unassigned_mcp_names():
    from tools.tool_search import ToolSearchConfig, assemble_tool_defs

    agent = _agent()
    raw_catalog = list(agent._tool_search_catalog_defs)
    config = ToolSearchConfig.from_raw(
        {"enabled": "on", "listing": "on", "threshold_pct": 0}
    )
    assembly = assemble_tool_defs(
        raw_catalog,
        context_length=100_000,
        config=config,
        profile="full",
    )
    agent.tools = assembly.tool_defs
    agent.valid_tool_names = {
        item["function"]["name"] for item in agent.tools
    }
    agent.tool_profile = "full"
    agent._tool_search_config = config
    agent.context_compressor = SimpleNamespace(context_length=100_000)
    assert "mcp__docs__write" in json.dumps(agent.tools)

    route = route_agent_mcp_capabilities(
        agent,
        "Search the connected product documentation",
    )
    attach_agent_mcp_capability_receipt(agent, route)
    apply_agent_mcp_scope(agent)

    rendered = json.dumps(agent.tools)
    assert "mcp__docs__search" in rendered
    assert "mcp__docs__write" not in rendered
    assert "mcp__crm__delete_contact" not in rendered
