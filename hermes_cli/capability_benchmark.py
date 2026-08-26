"""Deterministic, offline measurements for task-scoped Skill receipts.

This module deliberately renders the same ``<available_skills>`` block used
by the production system prompt, but only from an explicitly supplied,
isolated profile directory.  It never constructs an agent or probes a model.
"""

from __future__ import annotations

import socket
import subprocess
from collections.abc import Callable, MutableMapping, Sequence
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Any, Iterator
from unittest.mock import patch

from agent.capability_router import _selection_hash
from agent.model_metadata import estimate_tokens_rough
from agent.prompt_builder import _build_skills_system_prompt_inner
from hermes_cli.prompt_size import _compute_skills_breakdown
from hermes_constants import reset_hermes_home_override, set_hermes_home_override


_SCOPE_MIN = 3
_SCOPE_MAX = 8


def _deny_attempt(kind: str, attempts: MutableMapping[str, int]) -> Callable[..., Any]:
    def denied(*_args: Any, **_kwargs: Any) -> Any:
        attempts[kind] += 1
        raise RuntimeError(f"offline capability benchmark blocked {kind} access")

    return denied


@contextmanager
def _offline_guard() -> Iterator[dict[str, int]]:
    """Fail immediately if the benchmark path attempts network or a process."""
    attempts = {"network": 0, "process": 0}
    deny_network = _deny_attempt("network", attempts)
    deny_process = _deny_attempt("process", attempts)
    with ExitStack() as stack:
        stack.enter_context(patch.object(socket.socket, "connect", deny_network))
        stack.enter_context(patch.object(socket.socket, "connect_ex", deny_network))
        stack.enter_context(patch.object(socket, "create_connection", deny_network))
        stack.enter_context(patch.object(socket, "getaddrinfo", deny_network))
        stack.enter_context(patch.object(subprocess, "Popen", deny_process))
        stack.enter_context(patch.object(subprocess, "run", deny_process))
        stack.enter_context(patch.object(subprocess, "call", deny_process))
        stack.enter_context(patch.object(subprocess, "check_call", deny_process))
        stack.enter_context(patch.object(subprocess, "check_output", deny_process))
        yield attempts


def _normalize_scope(label: str, names: Sequence[str]) -> tuple[str, ...]:
    normalized = tuple(dict.fromkeys(str(name).strip() for name in names if str(name).strip()))
    if not _SCOPE_MIN <= len(normalized) <= _SCOPE_MAX:
        raise ValueError(f"{label} must contain {_SCOPE_MIN}-{_SCOPE_MAX} unique Skills")
    return normalized


def _measure_scope(
    skills_dir: Path,
    names: tuple[str, ...] | None,
    available_tools: set[str],
    available_toolsets: set[str],
) -> dict[str, Any]:
    prompt = _build_skills_system_prompt_inner(
        skills_dir=skills_dir,
        external_dirs=[],
        available_tools=available_tools,
        available_toolsets=available_toolsets,
        compact_categories=None,
        project_dirs=[],
        skill_names=None if names is None else frozenset(names),
    )
    rendered_names = tuple(sorted(item["name"] for item in _compute_skills_breakdown(prompt)))
    if names is not None and set(rendered_names) != set(names):
        missing = sorted(set(names) - set(rendered_names))
        extra = sorted(set(rendered_names) - set(names))
        raise ValueError(
            "receipt does not match the rendered Skill scope "
            f"(missing={missing}, extra={extra})"
        )
    selection = rendered_names if names is None else names
    return {
        "skill_count": len(rendered_names),
        "skills": list(rendered_names),
        "chars": len(prompt),
        "bytes": len(prompt.encode("utf-8")),
        "tokens_estimate": estimate_tokens_rough(prompt),
        "selection_hash": _selection_hash(selection),
    }


def run_capability_benchmark(
    *,
    skills_dir: Path,
    parent_skills: Sequence[str],
    session_skills: Sequence[str],
    child_skills: Sequence[str],
    simple_prompt: str,
    main_responder: Callable[[str], str],
    activity_counters: MutableMapping[str, int] | None = None,
    available_tools: Sequence[str] = (),
    available_toolsets: Sequence[str] = ("terminal", "files"),
) -> dict[str, Any]:
    """Measure full and receipt-scoped indices plus one mock simple turn.

    ``main_responder`` is an injected mock provider boundary. The benchmark
    invokes it exactly once and has no code path that dispatches tools,
    delegates agents, or starts a background review.
    """
    skills_dir = Path(skills_dir).resolve()
    if not skills_dir.is_dir():
        raise ValueError(f"isolated skills_dir does not exist: {skills_dir}")
    parent = _normalize_scope("parent_skills", parent_skills)
    session = _normalize_scope("session_skills", session_skills)
    child = _normalize_scope("child_skills", child_skills)
    if session != parent:
        raise ValueError(
            "session_skills must exactly match parent_skills for persisted receipt evidence"
        )
    tool_names = {str(name).strip() for name in available_tools if str(name).strip()}
    toolset_names = {
        str(name).strip() for name in available_toolsets if str(name).strip()
    }
    counters = activity_counters if activity_counters is not None else {
        "main": 0,
        "tool": 0,
        "subagent": 0,
        "background_review": 0,
    }
    for key in ("main", "tool", "subagent", "background_review"):
        counters.setdefault(key, 0)
    if any(counters[key] for key in ("main", "tool", "subagent", "background_review")):
        raise ValueError("simple prompt activity counters must start at zero")

    home_token = set_hermes_home_override(str(skills_dir.parent))
    try:
        with _offline_guard() as attempts:
            scopes = {
                "full_catalog": _measure_scope(
                    skills_dir, None, tool_names, toolset_names
                ),
                "parent": _measure_scope(skills_dir, parent, tool_names, toolset_names),
                "session": _measure_scope(skills_dir, session, tool_names, toolset_names),
                "child": _measure_scope(skills_dir, child, tool_names, toolset_names),
            }
            main_before = counters["main"]
            response = str(main_responder(str(simple_prompt)))
            # A callback may count itself (the normal spy shape). Otherwise
            # the harness owns the one mock-main count.
            if counters["main"] == main_before:
                counters["main"] += 1
            if counters["main"] - main_before != 1:
                raise ValueError("simple prompt must produce exactly one main response")
            if any(counters[key] for key in ("tool", "subagent", "background_review")):
                raise ValueError(
                    "simple prompt must not call tools, subagents, or background review"
                )
    finally:
        reset_hermes_home_override(home_token)

    return {
        "methodology": {
            "offline": True,
            "provider_calls": 0,
            "network_calls": attempts["network"],
            "process_calls": attempts["process"],
            "token_measurement": "Hermes rough preflight estimate",
        },
        "skill_scopes": scopes,
        "simple_prompt": {
            "prompt": str(simple_prompt),
            "response": response,
            "main_responses": 1,
            "tool_calls": counters["tool"],
            "subagent_calls": counters["subagent"],
            "background_reviews": counters["background_review"],
        },
    }
