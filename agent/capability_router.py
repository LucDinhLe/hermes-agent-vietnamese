"""Local-only Skill receipts for newly-created sessions and agents."""

from __future__ import annotations

import copy
import hashlib
import json
import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Optional

from hermes_cli.capability_profile import TaskSkillDiscovery, discover_task_skills


CAPABILITY_RECEIPT_VERSION = 1
CAPABILITY_RECEIPT_KEY = "capability_receipt"
MCP_CAPABILITY_RECEIPT_KEY = "mcp_capability_receipt"
_MCP_TOOL_PREFIX = "mcp__"
_MCP_ROUTE_LIMIT = 8
_ROUTE_STOPWORDS = {
    "and", "for", "from", "into", "the", "this", "that", "with",
    "connected", "tool", "tools", "use", "using", "please",
}
_ROUTE_TERM_ALIASES = {
    "tim": "search",
    "kiem": "search",
    "tra": "search",
    "doc": "read",
    "viet": "write",
    "xoa": "delete",
    "tao": "create",
    "gui": "send",
    "cap": "update",
    "nhat": "update",
    "tai": "documentation",
    "lieu": "documentation",
    "lien": "contact",
    "he": "contact",
}


@dataclass(frozen=True)
class TaskMCPDiscovery:
    """Exact connected MCP tools assigned to one session or agent."""

    tools: tuple[str, ...]
    servers: dict[str, tuple[str, ...]]
    reasons: dict[str, str]
    model_attempts: int = 0
    used_provider: bool = False
    used_network: bool = False


def _selection_hash(selected: Sequence[str]) -> str:
    payload = json.dumps(list(selected), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _mcp_selection_hash(
    selected: Sequence[str], servers: Mapping[str, Sequence[str]]
) -> str:
    payload = json.dumps(
        {
            "tools": list(selected),
            "servers": {
                str(server): list(tool_names)
                for server, tool_names in sorted(servers.items())
            },
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _receipt_record(agent: Any) -> Optional[dict[str, Any]]:
    payload = capability_payload(agent)
    if payload is None:
        return None
    record = {
        "version": CAPABILITY_RECEIPT_VERSION,
        "selected": payload["selected"],
        "recommended": payload["recommended"],
        "reasons": payload["reasons"],
        "selection_hash": _selection_hash(payload["selected"]),
    }
    mcp_record = _mcp_receipt_record(agent)
    if mcp_record is not None:
        record["mcp"] = mcp_record
    return record


def _mcp_receipt_record(agent: Any) -> Optional[dict[str, Any]]:
    selected = getattr(agent, "_capability_mcp_tools", None)
    if selected is None:
        return None
    servers = dict(getattr(agent, "_capability_mcp_servers", {}) or {})
    reasons = dict(getattr(agent, "_capability_mcp_reasons", {}) or {})
    return {
        "version": CAPABILITY_RECEIPT_VERSION,
        "tools": list(selected),
        "servers": {
            str(server): list(tool_names)
            for server, tool_names in sorted(servers.items())
        },
        "reasons": {
            name: str(reasons[name]) for name in selected if name in reasons
        },
        "selection_hash": _mcp_selection_hash(selected, servers),
    }


def _mcp_server_component(tool_name: str) -> str:
    payload = str(tool_name)[len(_MCP_TOOL_PREFIX):]
    server, separator, _tool = payload.partition("__")
    return server if separator else ""


def validate_mcp_capability_record(record: Any) -> Optional[dict[str, Any]]:
    """Return a normalized exact MCP receipt, or ``None`` if untrusted."""
    if not isinstance(record, Mapping):
        return None
    tools_value = record.get("tools")
    servers_value = record.get("servers")
    reasons_value = record.get("reasons")
    if not (
        record.get("version") == CAPABILITY_RECEIPT_VERSION
        and isinstance(tools_value, list)
        and isinstance(servers_value, Mapping)
        and isinstance(reasons_value, Mapping)
    ):
        return None
    tools = tuple(str(name).strip() for name in tools_value if str(name).strip())
    if len(tools) != len(tools_value) or len(set(tools)) != len(tools):
        return None
    servers: dict[str, tuple[str, ...]] = {}
    for raw_server, raw_names in servers_value.items():
        server = str(raw_server)
        if not server or not isinstance(raw_names, list):
            return None
        names = tuple(str(name).strip() for name in raw_names if str(name).strip())
        if len(names) != len(raw_names):
            return None
        servers[server] = names
    mapped_tools = tuple(
        name for server in sorted(servers) for name in servers[server]
    )
    if not (
        all(name.startswith(_MCP_TOOL_PREFIX) for name in tools)
        and mapped_tools == tools
        and all(
            _mcp_server_component(name) == server
            for server, names in servers.items()
            for name in names
        )
        and record.get("selection_hash") == _mcp_selection_hash(tools, servers)
    ):
        return None
    selected = set(tools)
    return {
        "tools": tools,
        "servers": servers,
        "reasons": {
            str(name): str(reason)
            for name, reason in reasons_value.items()
            if str(name) in selected
        },
    }


def _route_terms(value: str) -> set[str]:
    normalized = unicodedata.normalize("NFKD", str(value or "").lower())
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    terms: set[str] = set()
    for token in re.findall(r"[a-z0-9]+", ascii_value):
        if len(token) < 3 or token in _ROUTE_STOPWORDS:
            continue
        terms.add(_ROUTE_TERM_ALIASES.get(token, token))
    return terms


def _agent_mcp_definitions(agent: Any) -> list[Mapping[str, Any]]:
    definitions = getattr(agent, "_tool_search_catalog_defs", None)
    if definitions is None:
        definitions = getattr(agent, "tools", None)
    return [item for item in (definitions or ()) if isinstance(item, Mapping)]


def route_agent_mcp_capabilities(
    agent: Any,
    task: str,
    *,
    allowed_tools: Optional[Sequence[str]] = None,
) -> TaskMCPDiscovery:
    """Select a minimal exact subset of already-connected MCP tool schemas.

    The catalog is the agent's local, already-authorized registry snapshot.
    This function never discovers, connects, installs, logs in, or writes
    config. Unconnected servers have no schema here and therefore cannot be
    selected or described.
    """
    allowed = None if allowed_tools is None else {str(name) for name in allowed_tools}
    task_terms = _route_terms(task)
    candidates: dict[str, list[tuple[int, str]]] = {}
    reasons: dict[str, str] = {}
    for definition in _agent_mcp_definitions(agent):
        function = definition.get("function")
        if not isinstance(function, Mapping):
            continue
        name = str(function.get("name") or "")
        if not name.startswith(_MCP_TOOL_PREFIX):
            continue
        if allowed is not None and name not in allowed:
            continue
        server = _mcp_server_component(name)
        if not server:
            continue
        searchable = " ".join(
            (name.replace("_", " "), str(function.get("description") or ""))
        )
        matched = sorted(task_terms & _route_terms(searchable))
        if not matched:
            continue
        score = len(matched)
        candidates.setdefault(server, []).append((score, name))
        reasons[name] = "Local task terms: " + ", ".join(matched)

    selected: list[str] = []
    servers: dict[str, tuple[str, ...]] = {}
    # Keep the best-matching tool(s) per server. A tie represents multiple
    # concrete actions named by the task (for example search + write); all
    # others stay hidden. The exact set is deterministic and globally bounded.
    for server in sorted(candidates):
        ranked = sorted(candidates[server], key=lambda item: (-item[0], item[1]))
        best_score = ranked[0][0]
        server_selected: list[str] = []
        for score, name in ranked:
            if score != best_score or len(selected) >= _MCP_ROUTE_LIMIT:
                break
            selected.append(name)
            server_selected.append(name)
        if server_selected:
            servers[server] = tuple(server_selected)
        if len(selected) >= _MCP_ROUTE_LIMIT:
            break
    selected_tuple = tuple(selected)
    return TaskMCPDiscovery(
        tools=selected_tuple,
        servers=servers,
        reasons={name: reasons[name] for name in selected_tuple},
    )


def attach_agent_mcp_capability_receipt(
    agent: Any, route: TaskMCPDiscovery
) -> None:
    """Attach and persist an immutable exact MCP receipt."""
    agent._capability_mcp_tools = tuple(route.tools)
    agent._capability_mcp_servers = {
        str(server): tuple(tool_names)
        for server, tool_names in route.servers.items()
    }
    agent._capability_mcp_reasons = dict(route.reasons)
    model_config = getattr(agent, "_session_init_model_config", None)
    if isinstance(model_config, dict):
        mcp_record = _mcp_receipt_record(agent)
        model_config[MCP_CAPABILITY_RECEIPT_KEY] = mcp_record
        skill_record = model_config.get(CAPABILITY_RECEIPT_KEY)
        if isinstance(skill_record, dict):
            skill_record["mcp"] = mcp_record


def _mcp_tool_allowed(name: str, allowed: set[str]) -> bool:
    return not str(name).startswith(_MCP_TOOL_PREFIX) or str(name) in allowed


def apply_agent_mcp_scope(agent: Any) -> None:
    """Remove every unassigned MCP schema from this agent's exact snapshots."""
    selected = getattr(agent, "_capability_mcp_tools", None)
    if selected is None:
        return
    allowed = set(selected)
    catalog = getattr(agent, "_tool_search_catalog_defs", None)
    if catalog is not None:
        scoped_catalog = tuple(
            item
            for item in catalog
            if _mcp_tool_allowed(
                (item.get("function") or {}).get("name", ""), allowed
            )
        )
        agent._tool_search_catalog_defs = scoped_catalog
        agent._tool_catalog_names = frozenset(
            (item.get("function") or {}).get("name")
            for item in scoped_catalog
            if (item.get("function") or {}).get("name")
        )
        if getattr(agent, "_tool_schema_frozen", False):
            # Reassemble the bridge from the scoped raw catalog. Filtering
            # only the hidden catalog would leave unauthorized MCP names in a
            # full-profile tool_search listing that was frozen at agent init.
            from tools.tool_search import (
                ToolSearchConfig,
                assemble_tool_defs,
            )

            context_length = int(
                getattr(
                    getattr(agent, "context_compressor", None),
                    "context_length",
                    0,
                )
                or 0
            )
            config = getattr(agent, "_tool_search_config", None)
            if config is None:
                # Test doubles/legacy in-memory agents have no frozen config;
                # use deterministic defaults without reading ambient profile.
                config = ToolSearchConfig.from_raw(None)
            assembly = assemble_tool_defs(
                copy.deepcopy(list(scoped_catalog)),
                context_length=context_length,
                config=config,
                profile=getattr(agent, "tool_profile", "lean") or "lean",
            )
            agent.tools = copy.deepcopy(assembly.tool_defs)
            agent._tool_profile_assembly = assembly
        else:
            tools = list(getattr(agent, "tools", None) or [])
            agent.tools = [
                item
                for item in tools
                if _mcp_tool_allowed(
                    (item.get("function") or {}).get("name", ""), allowed
                )
            ]
    else:
        tools = list(getattr(agent, "tools", None) or [])
        agent.tools = [
            item
            for item in tools
            if _mcp_tool_allowed(
                (item.get("function") or {}).get("name", ""), allowed
            )
        ]
    agent.valid_tool_names = {
        (item.get("function") or {}).get("name")
        for item in agent.tools
        if (item.get("function") or {}).get("name")
    }
    try:
        agent._tool_search_scope_cache = None
    except Exception:
        pass


def route_agent_capabilities(agent: Any, task: str) -> Optional[TaskSkillDiscovery]:
    """Build a read-only task receipt from the agent's profile allowlist.

    ``None`` means the profile has no allowlist and therefore retains legacy
    behavior. An empty ``selected`` tuple is an explicit fail-closed receipt.
    The scan is local metadata only: no provider, model, network, or config
    mutation is involved.
    """
    from agent.system_prompt import _agent_home
    from hermes_cli.config import read_raw_config
    from hermes_constants import reset_hermes_home_override, set_hermes_home_override
    from tools.skills_tool import _find_all_skills

    home = _agent_home(agent)
    home_token = set_hermes_home_override(str(home)) if home is not None else None
    try:
        config = read_raw_config()
        skills_config = config.get("skills")
        if not isinstance(skills_config, Mapping) or "allowed" not in skills_config:
            return None
        allowed_value = skills_config.get("allowed")
        allowed = (
            allowed_value
            if isinstance(allowed_value, (list, tuple, set, frozenset))
            else ()
        )
        installed = {
            str(item.get("name", "")).strip()
            for item in _find_all_skills(skip_disabled=True)
            if isinstance(item, Mapping) and str(item.get("name", "")).strip()
        }
        return discover_task_skills(
            task=str(task or ""),
            installed_skills=installed,
            allowed_skills=allowed,
            limit=8,
        )
    finally:
        if home_token is not None:
            reset_hermes_home_override(home_token)


def attach_agent_capability_receipt(
    agent: Any, route: Optional[TaskSkillDiscovery]
) -> None:
    """Attach immutable routing evidence before the agent's first request."""
    if route is None:
        agent._capability_skills = None
        agent._capability_recommended_skills = ()
        agent._capability_skill_reasons = {}
        return
    agent._capability_skills = tuple(route.selected)
    agent._capability_recommended_skills = tuple(route.recommended)
    agent._capability_skill_reasons = dict(route.reasons)
    model_config = getattr(agent, "_session_init_model_config", None)
    if isinstance(model_config, dict):
        model_config[CAPABILITY_RECEIPT_KEY] = _receipt_record(agent)


def restore_agent_capability_receipt(agent: Any, model_config: Any) -> bool:
    """Restore a persisted receipt; malformed/tampered records fail closed."""
    if isinstance(model_config, str):
        try:
            model_config = json.loads(model_config)
        except (TypeError, ValueError):
            return False
    if not isinstance(model_config, Mapping):
        return False
    has_skill_receipt = CAPABILITY_RECEIPT_KEY in model_config
    skill_record = model_config.get(CAPABILITY_RECEIPT_KEY)
    nested_mcp = (
        skill_record.get("mcp") if isinstance(skill_record, Mapping) else None
    )
    mcp_record = nested_mcp or model_config.get(MCP_CAPABILITY_RECEIPT_KEY)
    has_mcp_receipt = mcp_record is not None
    if not has_skill_receipt and not has_mcp_receipt:
        return False

    valid = False
    record = skill_record
    if has_skill_receipt:
        valid = isinstance(record, Mapping)
        selected_value = record.get("selected") if valid else None
        recommended_value = record.get("recommended") if valid else None
        reasons_value = record.get("reasons") if valid else None
        selected = (
            tuple(str(name).strip() for name in selected_value if str(name).strip())
            if isinstance(selected_value, list)
            else ()
        )
        recommended = (
            tuple(str(name).strip() for name in recommended_value if str(name).strip())
            if isinstance(recommended_value, list)
            else ()
        )
        expected_hash = _selection_hash(selected)
        valid = bool(
            valid
            and record.get("version") == CAPABILITY_RECEIPT_VERSION
            and isinstance(selected_value, list)
            and isinstance(recommended_value, list)
            and isinstance(reasons_value, Mapping)
            and record.get("selection_hash") == expected_hash
        )
        if not valid:
            # The key proves this is a capability-scoped session. Never fall
            # back to the profile-wide catalog when its receipt is untrusted.
            selected = ()
            recommended = ()
            reasons_value = {}

        agent._capability_skills = selected
        agent._capability_recommended_skills = recommended
        visible = set(selected) | set(recommended)
        agent._capability_skill_reasons = {
            str(name): str(reason)
            for name, reason in reasons_value.items()
            if str(name) in visible
        }

    validated_mcp = validate_mcp_capability_record(mcp_record)
    mcp_valid = validated_mcp is not None
    mcp_tools = validated_mcp["tools"] if validated_mcp else ()
    normalized_servers = validated_mcp["servers"] if validated_mcp else {}
    mcp_reasons_value = validated_mcp["reasons"] if validated_mcp else {}
    agent._capability_mcp_tools = mcp_tools
    agent._capability_mcp_servers = normalized_servers
    agent._capability_mcp_reasons = {
        str(name): str(reason)
        for name, reason in mcp_reasons_value.items()
        if str(name) in set(mcp_tools)
    }
    apply_agent_mcp_scope(agent)
    agent._capability_route_initialized = True
    init_config = getattr(agent, "_session_init_model_config", None)
    if isinstance(init_config, dict):
        if has_skill_receipt:
            init_config[CAPABILITY_RECEIPT_KEY] = (
                dict(record) if valid else _receipt_record(agent)
            )
        init_config[MCP_CAPABILITY_RECEIPT_KEY] = (
            dict(mcp_record) if mcp_valid else _mcp_receipt_record(agent)
        )
    return True


def initialize_new_session_capabilities(
    agent: Any,
    user_message: Any,
    conversation_history: Optional[Sequence[Mapping[str, Any]]],
) -> Optional[TaskSkillDiscovery]:
    """Route exactly once before a fresh root session freezes its prompt."""
    if getattr(agent, "platform", "") == "subagent":
        return None
    if getattr(agent, "_capability_route_initialized", False):
        return None
    if getattr(agent, "_cached_system_prompt", None) is not None:
        return None
    if conversation_history:
        # A resumed session restores its persisted prompt bytes. Never infer a
        # new receipt from the first post-resume user message.
        return None

    route = route_agent_capabilities(agent, str(user_message or ""))
    attach_agent_capability_receipt(agent, route)
    mcp_route = route_agent_mcp_capabilities(agent, str(user_message or ""))
    attach_agent_mcp_capability_receipt(agent, mcp_route)
    apply_agent_mcp_scope(agent)
    agent._capability_route_initialized = True
    return route


def capability_payload(agent: Any) -> Optional[dict[str, Any]]:
    selected = getattr(agent, "_capability_skills", None)
    if selected is None:
        return None
    recommended = tuple(
        getattr(agent, "_capability_recommended_skills", ()) or ()
    )
    reasons = dict(getattr(agent, "_capability_skill_reasons", {}) or {})
    return {
        "selected": list(selected),
        "recommended": list(recommended),
        "reasons": {
            name: reasons[name]
            for name in (*selected, *recommended)
            if name in reasons
        },
        "model_attempts": 0,
        "used_provider": False,
        "used_network": False,
    }


def mcp_capability_payload(agent: Any) -> Optional[dict[str, Any]]:
    selected = getattr(agent, "_capability_mcp_tools", None)
    if selected is None:
        return None
    return {
        "tools": list(selected),
        "servers": {
            str(server): list(tool_names)
            for server, tool_names in sorted(
                dict(getattr(agent, "_capability_mcp_servers", {}) or {}).items()
            )
        },
        "reasons": dict(getattr(agent, "_capability_mcp_reasons", {}) or {}),
        "model_attempts": 0,
        "used_provider": False,
        "used_network": False,
    }


def capability_recommendation_prompt(agent: Any) -> str:
    """Render recommendation-only matches without granting access to them."""
    recommended = tuple(
        getattr(agent, "_capability_recommended_skills", ()) or ()
    )
    if not recommended:
        return ""
    reasons = dict(getattr(agent, "_capability_skill_reasons", {}) or {})
    matches = "\n".join(
        f"- `{name}`: {reasons.get(name, 'Matches the current task locally.')}"
        for name in recommended
    )
    return (
        "## Skill recommendations (not authorized)\n"
        f"Local metadata matching found:\n{matches}\n"
        "These Skills are installed but are not assigned to this session/agent. "
        "You may suggest them to the user, but do not load, enable, or mutate "
        "them. User approval changes the profile allowlist and applies only to "
        "a new session/agent."
    )
