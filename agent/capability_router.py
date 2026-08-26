"""Local-only Skill receipts for newly-created sessions and agents."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any, Optional

from hermes_cli.capability_profile import TaskSkillDiscovery, discover_task_skills


CAPABILITY_RECEIPT_VERSION = 1
CAPABILITY_RECEIPT_KEY = "capability_receipt"


def _selection_hash(selected: Sequence[str]) -> str:
    payload = json.dumps(list(selected), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _receipt_record(agent: Any) -> Optional[dict[str, Any]]:
    payload = capability_payload(agent)
    if payload is None:
        return None
    return {
        "version": CAPABILITY_RECEIPT_VERSION,
        "selected": payload["selected"],
        "recommended": payload["recommended"],
        "reasons": payload["reasons"],
        "selection_hash": _selection_hash(payload["selected"]),
    }


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
    if CAPABILITY_RECEIPT_KEY not in model_config:
        return False

    record = model_config.get(CAPABILITY_RECEIPT_KEY)
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
        # The key proves this is a capability-scoped session. Never fall back
        # to the profile-wide catalog when its receipt cannot be trusted.
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
    agent._capability_route_initialized = True
    init_config = getattr(agent, "_session_init_model_config", None)
    if isinstance(init_config, dict):
        init_config[CAPABILITY_RECEIPT_KEY] = (
            dict(record) if valid else _receipt_record(agent)
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
