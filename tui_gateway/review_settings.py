"""Desktop/TUI wiring for the experimental subscription review runner.

The upstream review checkpoint implementation intentionally exposes a runtime
API without choosing product settings.  This module is the thin product seam:
it reads one explicit profile-local config block and attaches (or removes) the
runtime from an already constructed agent.  It never resolves or copies token
material; the review backend resolves an OAuth credential from the active
Hermes profile only when a checkpoint runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Mapping


DEFAULT_REVIEW_PROVIDER = "openai-codex"
DEFAULT_REVIEW_MODEL = "gpt-5.6-sol"
SUPPORTED_REVIEW_PROVIDERS = frozenset({"anthropic", "openai-codex"})


@dataclass(frozen=True)
class ReviewSettings:
    enabled: bool = False
    provider: str = DEFAULT_REVIEW_PROVIDER
    model: str = DEFAULT_REVIEW_MODEL
    failure_policy: str = "continue"
    max_revisions: int = 1
    timeout_seconds: float = 60.0


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    return default


def review_settings(config: Mapping[str, Any] | None) -> ReviewSettings:
    raw = config.get("advisor") if isinstance(config, Mapping) else None
    section = raw if isinstance(raw, Mapping) else {}
    provider = str(section.get("provider") or DEFAULT_REVIEW_PROVIDER).strip().lower()
    model = str(section.get("model") or DEFAULT_REVIEW_MODEL).strip()
    failure_policy = str(section.get("failure_policy") or "continue").strip().lower()

    if provider not in SUPPORTED_REVIEW_PROVIDERS:
        provider = DEFAULT_REVIEW_PROVIDER
    if not model:
        model = DEFAULT_REVIEW_MODEL
    if failure_policy not in {"block", "continue"}:
        failure_policy = "continue"

    try:
        max_revisions = max(0, min(1, int(section.get("max_revisions", 1))))
    except (TypeError, ValueError):
        max_revisions = 1
    try:
        timeout_seconds = max(5.0, min(300.0, float(section.get("timeout_seconds", 60.0))))
    except (TypeError, ValueError):
        timeout_seconds = 60.0

    return ReviewSettings(
        enabled=_as_bool(section.get("enabled"), False),
        provider=provider,
        model=model,
        failure_policy=failure_policy,
        max_revisions=max_revisions,
        timeout_seconds=timeout_seconds,
    )


def apply_review_settings(
    agent: Any,
    config: Mapping[str, Any] | None,
    *,
    emit: Callable[[dict], None] | None = None,
) -> ReviewSettings:
    """Apply profile-local settings to one live agent without touching auth."""

    settings = review_settings(config)
    if not settings.enabled:
        agent.review_checkpoint_runtime = None
        return settings

    from agent.review_checkpoints import create_review_checkpoint_runtime

    def record_usage(result: Any, request: Any) -> None:
        usage = result.usage or {}
        if not usage:
            return
        db = getattr(agent, "_session_db", None)
        session_id = str(getattr(agent, "session_id", "") or "")
        if db is None or not session_id:
            return
        route = result.actual_route or {}
        db.record_auxiliary_usage(
            session_id,
            "advisor_review",
            model=str(route.get("model") or request.model),
            billing_provider=str(route.get("provider") or request.provider),
            billing_base_url=None,
            input_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            cache_read_tokens=int(usage.get("cache_read_tokens") or 0),
            cache_write_tokens=int(usage.get("cache_write_tokens") or 0),
            reasoning_tokens=int(usage.get("reasoning_tokens") or 0),
            estimated_cost_usd=None,
        )

    agent.review_checkpoint_runtime = create_review_checkpoint_runtime(
        session_id=str(getattr(agent, "session_id", "") or ""),
        provider=settings.provider,
        model=settings.model,
        enabled=True,
        max_revisions=settings.max_revisions,
        failure_policy=settings.failure_policy,
        require_distinct_from_main=True,
        timeout_seconds=settings.timeout_seconds,
        emit=emit,
        record_usage=record_usage,
    )
    return settings


def live_review_status(agent: Any, config: Mapping[str, Any] | None) -> dict[str, Any]:
    settings = review_settings(config)
    runtime = getattr(agent, "review_checkpoint_runtime", None) if agent is not None else None
    enabled = bool(getattr(runtime, "enabled", False)) if agent is not None else settings.enabled
    route = getattr(runtime, "route", None)
    provider = str(getattr(route, "provider", "") or settings.provider)
    model = str(getattr(route, "model", "") or settings.model)
    main_provider = str(getattr(agent, "provider", "") or "") if agent is not None else ""
    main_model = str(getattr(agent, "model", "") or "") if agent is not None else ""

    return {
        "value": "on" if enabled else "off",
        "enabled": enabled,
        "provider": provider,
        "model": model,
        "credential_policy": "subscription_oauth_only",
        "fallback_policy": "none",
        "distinct_from_main": not (
            enabled and provider == main_provider and model == main_model
        ),
    }
