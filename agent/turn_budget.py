"""Thread-safe aggregate budgets for one user turn.

The governor counts admitted *physical* model attempts and tool dispatches.
Call sites reserve immediately before an outbound request or dispatch, so a
failed request still consumes call budget while token/cost usage is recorded
separately only when a response supplies it.

One :class:`TurnGovernor` is shared by a parent agent and every child spawned
for that turn.  The ContextVar helpers carry the same object through asyncio
tasks and through worker threads when Hermes' context-propagating thread
helpers are used; the lock protects the shared aggregate itself.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
import threading
from typing import Any, Dict, Iterator, Optional


DEFAULT_MODEL_WARN_LIMIT = 6
DEFAULT_MODEL_HARD_LIMIT = 12
DEFAULT_TOOL_WARN_LIMIT = 8
DEFAULT_TOOL_HARD_LIMIT = 20

_USAGE_FIELDS = (
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "reasoning_tokens",
)


def _label(value: Optional[str], fallback: str) -> str:
    rendered = str(value or "").strip()
    return rendered or fallback


def _empty_breakdown() -> Dict[str, Any]:
    return {
        "model_attempts": 0,
        "tool_calls": 0,
        "denied_model_attempts": 0,
        "denied_tool_calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "reasoning_tokens": 0,
        "estimated_cost_usd": 0.0,
    }


@dataclass(frozen=True)
class BudgetReservation:
    """Outcome of one atomic model/tool reservation."""

    kind: str
    task: str
    role: str
    requested: int
    admitted: int
    denied: int
    total: int
    remaining: int
    warning: bool
    paused: bool
    warn_limit: int
    hard_limit: int

    @property
    def allowed(self) -> bool:
        return self.denied == 0


class TurnBudgetExceeded(RuntimeError):
    """Raised before a model request that the turn budget cannot admit."""

    def __init__(self, turn_id: str, reservation: BudgetReservation):
        self.turn_id = turn_id
        self.reservation = reservation
        self.kind = reservation.kind
        self.task = reservation.task
        self.role = reservation.role
        self.hard_limit = reservation.hard_limit
        self.attempted_count = reservation.total + reservation.denied
        super().__init__(
            f"Turn {turn_id!r} paused: {reservation.kind} budget "
            f"allows {reservation.hard_limit} admitted calls; attempted "
            f"{self.attempted_count}."
        )


class TurnGovernor:
    """Atomic aggregate model/tool budget and per-turn usage meter."""

    def __init__(
        self,
        *,
        turn_id: str,
        root_session_id: Optional[str] = None,
        model_warn_limit: int = DEFAULT_MODEL_WARN_LIMIT,
        model_hard_limit: int = DEFAULT_MODEL_HARD_LIMIT,
        tool_warn_limit: int = DEFAULT_TOOL_WARN_LIMIT,
        tool_hard_limit: int = DEFAULT_TOOL_HARD_LIMIT,
    ) -> None:
        self.turn_id = _label(turn_id, "unknown-turn")
        self.root_session_id = (
            _label(root_session_id, "") if root_session_id is not None else None
        )
        self.model_warn_limit, self.model_hard_limit = self._validate_limits(
            "model", model_warn_limit, model_hard_limit
        )
        self.tool_warn_limit, self.tool_hard_limit = self._validate_limits(
            "tool", tool_warn_limit, tool_hard_limit
        )

        self._lock = threading.RLock()
        self._model_calls = 0
        self._tool_calls = 0
        self._denied_model_attempts = 0
        self._denied_tool_calls = 0
        self._model_warning_emitted = False
        self._tool_warning_emitted = False
        self._paused = False
        self._pause_reason: Optional[str] = None
        self._usage: Dict[str, Any] = {
            **{field: 0 for field in _USAGE_FIELDS},
            "estimated_cost_usd": 0.0,
        }
        self._by_task: Dict[str, Dict[str, Any]] = {}
        self._by_role: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def _validate_limits(kind: str, warn_limit: int, hard_limit: int) -> tuple[int, int]:
        try:
            warn = int(warn_limit)
            hard = int(hard_limit)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{kind} limits must be integers") from exc
        if warn < 1 or hard < 1 or warn > hard:
            raise ValueError(
                f"{kind} limits must satisfy 1 <= warn_limit <= hard_limit"
            )
        return warn, hard

    def reserve_model_attempt(
        self,
        *,
        task: Optional[str] = None,
        role: Optional[str] = None,
    ) -> BudgetReservation:
        """Reserve one physical outbound model attempt or raise before I/O."""
        reservation = self._reserve(
            kind="model",
            count=1,
            task=_label(task, "unknown"),
            role=_label(role, "main"),
        )
        if reservation.denied:
            raise TurnBudgetExceeded(self.turn_id, reservation)
        return reservation

    def reserve_tool_calls(
        self,
        *,
        count: int = 1,
        task: Optional[str] = None,
        role: Optional[str] = None,
    ) -> BudgetReservation:
        """Atomically reserve a tool batch, admitting only its safe prefix.

        Tool batches need a non-throwing partial result so the caller can pair
        every denied ``tool_call_id`` with a deterministic result before the
        turn pauses.
        """
        return self._reserve(
            kind="tool",
            count=count,
            task=_label(task, "unknown"),
            role=_label(role, "main"),
        )

    def _reserve(
        self,
        *,
        kind: str,
        count: int,
        task: str,
        role: str,
    ) -> BudgetReservation:
        try:
            requested = int(count)
        except (TypeError, ValueError) as exc:
            raise ValueError("reservation count must be a positive integer") from exc
        if requested < 1:
            raise ValueError("reservation count must be a positive integer")

        with self._lock:
            if kind == "model":
                before = self._model_calls
                hard_limit = self.model_hard_limit
                warn_limit = self.model_warn_limit
                warning_emitted = self._model_warning_emitted
            elif kind == "tool":
                before = self._tool_calls
                hard_limit = self.tool_hard_limit
                warn_limit = self.tool_warn_limit
                warning_emitted = self._tool_warning_emitted
            else:
                raise ValueError(f"unknown budget kind: {kind}")

            available = 0 if self._paused else max(0, hard_limit - before)
            admitted = min(requested, available)
            denied = requested - admitted
            total = before + admitted
            warning = (
                not warning_emitted
                and admitted > 0
                and before < warn_limit <= total
            )

            if kind == "model":
                self._model_calls = total
                self._denied_model_attempts += denied
                if warning:
                    self._model_warning_emitted = True
            else:
                self._tool_calls = total
                self._denied_tool_calls += denied
                if warning:
                    self._tool_warning_emitted = True

            self._add_breakdown(
                task=task,
                role=role,
                field="model_attempts" if kind == "model" else "tool_calls",
                amount=admitted,
            )
            self._add_breakdown(
                task=task,
                role=role,
                field=(
                    "denied_model_attempts"
                    if kind == "model"
                    else "denied_tool_calls"
                ),
                amount=denied,
            )

            if denied:
                self._paused = True
                if self._pause_reason is None:
                    self._pause_reason = f"{kind}_hard_limit"

            return BudgetReservation(
                kind=kind,
                task=task,
                role=role,
                requested=requested,
                admitted=admitted,
                denied=denied,
                total=total,
                remaining=max(0, hard_limit - total),
                warning=warning,
                paused=self._paused,
                warn_limit=warn_limit,
                hard_limit=hard_limit,
            )

    def _add_breakdown(
        self,
        *,
        task: str,
        role: str,
        field: str,
        amount: int | float,
    ) -> None:
        if not amount:
            return
        task_row = self._by_task.setdefault(task, _empty_breakdown())
        role_row = self._by_role.setdefault(role, _empty_breakdown())
        task_row[field] += amount
        role_row[field] += amount

    def update_usage(
        self,
        *,
        task: Optional[str] = None,
        role: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
        reasoning_tokens: int = 0,
        estimated_cost_usd: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Add successful-response usage without changing call counters."""
        task_name = _label(task, "unknown")
        role_name = _label(role, "main")
        raw_values = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_read_tokens": cache_read_tokens,
            "cache_write_tokens": cache_write_tokens,
            "reasoning_tokens": reasoning_tokens,
        }
        values: Dict[str, int] = {}
        for field, value in raw_values.items():
            try:
                rendered = int(value or 0)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{field} must be a non-negative integer") from exc
            if rendered < 0:
                raise ValueError(f"{field} must be a non-negative integer")
            values[field] = rendered

        try:
            cost = float(estimated_cost_usd or 0.0)
        except (TypeError, ValueError) as exc:
            raise ValueError("estimated_cost_usd must be non-negative") from exc
        if cost < 0:
            raise ValueError("estimated_cost_usd must be non-negative")

        with self._lock:
            for field, value in values.items():
                self._usage[field] += value
                self._add_breakdown(
                    task=task_name,
                    role=role_name,
                    field=field,
                    amount=value,
                )
            self._usage["estimated_cost_usd"] += cost
            self._add_breakdown(
                task=task_name,
                role=role_name,
                field="estimated_cost_usd",
                amount=cost,
            )
            return self._snapshot_unlocked()

    def snapshot(self) -> Dict[str, Any]:
        """Return a detached, JSON-serializable view of the aggregate."""
        with self._lock:
            return self._snapshot_unlocked()

    def _snapshot_unlocked(self) -> Dict[str, Any]:
        return {
            "turn_id": self.turn_id,
            "root_session_id": self.root_session_id,
            "model_calls": self._model_calls,
            "tool_calls": self._tool_calls,
            "paused": self._paused,
            "pause_reason": self._pause_reason,
            "model": {
                "count": self._model_calls,
                "warn_limit": self.model_warn_limit,
                "hard_limit": self.model_hard_limit,
                "remaining": max(0, self.model_hard_limit - self._model_calls),
                "warning_emitted": self._model_warning_emitted,
                "denied": self._denied_model_attempts,
            },
            "tool": {
                "count": self._tool_calls,
                "warn_limit": self.tool_warn_limit,
                "hard_limit": self.tool_hard_limit,
                "remaining": max(0, self.tool_hard_limit - self._tool_calls),
                "warning_emitted": self._tool_warning_emitted,
                "denied": self._denied_tool_calls,
            },
            "usage": dict(self._usage),
            "by_task": {key: dict(value) for key, value in self._by_task.items()},
            "by_role": {key: dict(value) for key, value in self._by_role.items()},
        }


_turn_governor: ContextVar[Optional[TurnGovernor]] = ContextVar(
    "turn_governor", default=None
)


def set_turn_governor(governor: Optional[TurnGovernor]) -> Token:
    """Publish one aggregate governor for the current execution context."""
    return _turn_governor.set(governor)


def reset_turn_governor(token: Token) -> None:
    """Restore the prior governor, failing closed to no ambient governor."""
    try:
        _turn_governor.reset(token)
    except Exception:
        _turn_governor.set(None)


def get_turn_governor() -> Optional[TurnGovernor]:
    return _turn_governor.get()


@contextmanager
def bind_turn_governor(governor: Optional[TurnGovernor]) -> Iterator[Optional[TurnGovernor]]:
    token = set_turn_governor(governor)
    try:
        yield governor
    finally:
        reset_turn_governor(token)


__all__ = [
    "BudgetReservation",
    "DEFAULT_MODEL_HARD_LIMIT",
    "DEFAULT_MODEL_WARN_LIMIT",
    "DEFAULT_TOOL_HARD_LIMIT",
    "DEFAULT_TOOL_WARN_LIMIT",
    "TurnBudgetExceeded",
    "TurnGovernor",
    "bind_turn_governor",
    "get_turn_governor",
    "reset_turn_governor",
    "set_turn_governor",
]
