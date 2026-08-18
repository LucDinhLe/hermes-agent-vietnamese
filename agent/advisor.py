"""Read-only Advisor checkpoints for the primary agent loop.

The Advisor is deliberately a side LLM call, not an agent: it receives a
small, redacted review packet, has no tools, and returns a compact structured
verdict.  Conversation-loop code owns every state transition and whether a
proposed tool batch is executed or withheld.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from agent.tool_guardrails import IDEMPOTENT_TOOL_NAMES
from utils import is_truthy_value, safe_json_loads


logger = logging.getLogger(__name__)

_ALLOWED_VERDICTS = frozenset({"PASS", "REVISE", "ASK_USER", "BLOCK"})
_DEFAULT_MAX_REVISIONS = 2
_MAX_OBJECTIVE_CHARS = 6000
_MAX_CANDIDATE_CHARS = 12000
_MAX_FEEDBACK_CHARS = 2400
_MAX_SUMMARY_CHARS = 600
_SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "credential",
    "password",
    "secret",
    "token",
)

_SYSTEM_PROMPT = """You are Hermes Advisor, an independent read-only reviewer.
Check whether the proposed plan or final answer stays aligned with the user's
stated objective and constraints. Do not use tools. Do not reveal or request
hidden chain-of-thought. Return JSON only with exactly these fields:
{"verdict":"PASS|REVISE|ASK_USER|BLOCK","summary":"brief finding","feedback":"specific correction for the working model"}
PASS only when the reviewed material is sufficiently aligned. Use ASK_USER only
when a material user choice is genuinely missing. Use BLOCK only for a clear
safety, authorization, or goal-conflict boundary. Keep feedback concise."""


@dataclass(frozen=True)
class AdvisorSettings:
    enabled: bool = False
    max_revisions: int = _DEFAULT_MAX_REVISIONS
    fail_open: bool = True


@dataclass(frozen=True)
class AdvisorDecision:
    verdict: str
    summary: str = ""
    feedback: str = ""
    available: bool = True
    error: str = ""

    @property
    def passes(self) -> bool:
        return self.verdict == "PASS"


def settings_from_config(config: Mapping[str, Any] | None) -> AdvisorSettings:
    section = config.get("advisor") if isinstance(config, Mapping) else None
    if not isinstance(section, Mapping):
        section = {}
    try:
        max_revisions = int(section.get("max_revisions", _DEFAULT_MAX_REVISIONS))
    except (TypeError, ValueError):
        max_revisions = _DEFAULT_MAX_REVISIONS
    return AdvisorSettings(
        enabled=is_truthy_value(section.get("enabled"), default=False),
        max_revisions=max(1, min(max_revisions, 4)),
        fail_open=is_truthy_value(section.get("fail_open"), default=True),
    )


def tool_call_name(tool_call: Any) -> str:
    function = tool_call.get("function") if isinstance(tool_call, dict) else getattr(tool_call, "function", None)
    if isinstance(function, dict):
        return str(function.get("name") or "")
    return str(getattr(function, "name", "") or "")


def tool_call_id(tool_call: Any) -> str:
    if isinstance(tool_call, dict):
        return str(tool_call.get("id") or "")
    return str(getattr(tool_call, "id", "") or "")


def _tool_call_arguments(tool_call: Any) -> dict[str, Any]:
    function = tool_call.get("function") if isinstance(tool_call, dict) else getattr(tool_call, "function", None)
    raw = function.get("arguments") if isinstance(function, dict) else getattr(function, "arguments", None)
    if isinstance(raw, dict):
        return raw
    parsed = safe_json_loads(raw) if isinstance(raw, str) else None
    return parsed if isinstance(parsed, dict) else {}


def batch_requires_review(tool_calls: Sequence[Any]) -> bool:
    """Treat unknown tools as potentially mutating; known read-only tools pass."""
    return any(tool_call_name(tc) not in IDEMPOTENT_TOOL_NAMES for tc in tool_calls)


def material_tool_signature(tool_calls: Sequence[Any]) -> str:
    names = sorted({tool_call_name(tc) or "unknown" for tc in tool_calls if tool_call_name(tc) not in IDEMPOTENT_TOOL_NAMES})
    return hashlib.sha256("\n".join(names).encode("utf-8")).hexdigest()[:16]


def _redacted_tool_calls(tool_calls: Sequence[Any]) -> list[dict[str, Any]]:
    try:
        from agent.display import redact_tool_args_for_display
    except Exception:
        redact_tool_args_for_display = None

    rows: list[dict[str, Any]] = []
    for tc in tool_calls:
        name = tool_call_name(tc) or "unknown"
        args = _tool_call_arguments(tc)
        if callable(redact_tool_args_for_display):
            try:
                safe_args = redact_tool_args_for_display(name, args)
            except Exception:
                safe_args = None
        else:
            safe_args = None
        safe_args = _redact_sensitive_values(
            safe_args if isinstance(safe_args, dict) else {}
        )
        rows.append(
            {
                "tool": name,
                "argument_keys": sorted(str(key) for key in args)[:24],
                "redacted_arguments": safe_args,
            }
        )
    return rows


def _redact_sensitive_values(value: Any, key: str = "") -> Any:
    normalized = key.lower().replace("-", "_")
    if normalized and any(part in normalized for part in _SENSITIVE_KEY_PARTS):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {
            str(child_key): _redact_sensitive_values(child_value, str(child_key))
            for child_key, child_value in value.items()
        }
    if isinstance(value, list):
        return [_redact_sensitive_values(item) for item in value[:50]]
    if isinstance(value, str):
        return value[:1000]
    return value


def build_plan_packet(
    *,
    objective: Any,
    assistant_text: str,
    tool_calls: Sequence[Any],
    checkpoint: str = "plan",
) -> dict[str, Any]:
    return {
        "checkpoint": checkpoint,
        "user_objective": _text(objective, _MAX_OBJECTIVE_CHARS),
        "working_model_plan": _text(assistant_text, _MAX_CANDIDATE_CHARS),
        "proposed_actions": _redacted_tool_calls(tool_calls),
        "instruction": "Judge goal alignment, missing constraints, authorization, and whether these actions are an appropriate next step.",
    }


def build_final_packet(
    *,
    objective: Any,
    candidate: str,
    changed_paths: Iterable[str] = (),
    tool_names: Iterable[str] = (),
) -> dict[str, Any]:
    return {
        "checkpoint": "final",
        "user_objective": _text(objective, _MAX_OBJECTIVE_CHARS),
        "candidate_answer": _text(candidate, _MAX_CANDIDATE_CHARS),
        "evidence_summary": {
            "changed_paths": [str(path)[:500] for path in list(changed_paths)[:40]],
            "tools_used": sorted({str(name) for name in tool_names if name})[:40],
        },
        "instruction": "Judge whether the candidate directly and honestly satisfies the objective, reports gaps, and avoids claiming unsupported completion.",
    }


def review_packet(packet: Mapping[str, Any], *, call_fn=None) -> AdvisorDecision:
    """Call the configured advisor model with no tools and parse its verdict."""
    if call_fn is None:
        from agent.auxiliary_client import call_llm

        call_fn = call_llm
    try:
        response = call_fn(
            task="advisor",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(packet, ensure_ascii=False, separators=(",", ":"))},
            ],
            temperature=0,
            max_tokens=700,
            tools=None,
        )
        raw = response.choices[0].message.content or ""
        return parse_decision(raw)
    except Exception as exc:
        logger.warning("Advisor checkpoint unavailable: %s", type(exc).__name__)
        return AdvisorDecision(
            verdict="PASS",
            summary="Advisor unavailable; fail-open policy applied.",
            available=False,
            error=type(exc).__name__,
        )


def enforce_availability_policy(
    decision: AdvisorDecision, settings: AdvisorSettings
) -> AdvisorDecision:
    if decision.available or settings.fail_open:
        return decision
    return AdvisorDecision(
        verdict="BLOCK",
        summary="Advisor is required but unavailable.",
        feedback=(
            "Do not perform state-changing work. Explain that the required "
            "Advisor model is unavailable and ask the user whether to retry or disable it."
        ),
        available=False,
        error=decision.error,
    )


def parse_decision(raw: str) -> AdvisorDecision:
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 2 and lines[-1].strip() == "```":
            text = "\n".join(lines[1:-1]).strip()
    try:
        data = json.loads(text)
    except Exception as exc:
        raise ValueError("advisor response was not valid JSON") from exc
    if not isinstance(data, dict):
        raise ValueError("advisor response must be a JSON object")
    verdict = str(data.get("verdict") or "").strip().upper()
    if verdict not in _ALLOWED_VERDICTS:
        raise ValueError(f"unsupported advisor verdict: {verdict or 'empty'}")
    summary = _text(data.get("summary"), _MAX_SUMMARY_CHARS)
    feedback = _text(data.get("feedback"), _MAX_FEEDBACK_CHARS)
    if verdict != "PASS" and not feedback:
        raise ValueError("non-PASS advisor verdict requires feedback")
    return AdvisorDecision(verdict=verdict, summary=summary, feedback=feedback)


def withheld_tool_result(decision: AdvisorDecision, *, exhausted: bool = False) -> str:
    payload = {
        "ok": False,
        "withheld_by": "advisor",
        "verdict": decision.verdict,
        "summary": decision.summary,
        "feedback": decision.feedback,
        "revision_budget_exhausted": bool(exhausted),
        "instruction": (
            "Do not repeat this action unchanged. Revise the plan or ask the user for the missing decision."
        ),
    }
    return json.dumps(payload, ensure_ascii=False)


def final_revision_nudge(decision: AdvisorDecision) -> str:
    return (
        "[Internal Advisor checkpoint — do not quote this wrapper.]\n"
        f"Verdict: {decision.verdict}\n"
        f"Finding: {decision.summary}\n"
        f"Required correction: {decision.feedback}\n"
        "Revise the candidate answer so it better satisfies the user's original objective. "
        "If a material user choice is missing, ask that question plainly."
    )


def _text(value: Any, limit: int) -> str:
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        value = "\n".join(parts)
    text = str(value or "").strip()
    return text[:limit]


__all__ = [
    "AdvisorDecision",
    "AdvisorSettings",
    "batch_requires_review",
    "build_final_packet",
    "build_plan_packet",
    "enforce_availability_policy",
    "final_revision_nudge",
    "material_tool_signature",
    "parse_decision",
    "review_packet",
    "settings_from_config",
    "tool_call_id",
    "tool_call_name",
    "withheld_tool_result",
]
