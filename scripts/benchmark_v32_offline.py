#!/usr/bin/env python3
"""Deterministic, provider-free before/after evidence for Hermes v32.

The harness compares two committed source trees extracted with ``git archive``
into separate temporary workspaces.  Child probes receive an empty Hermes
profile, a credential-free environment, fixed tool-availability answers, and a
socket-level network deny guard.  No model response is fabricated: token
figures are explicitly static estimates from Hermes' own rough estimator.

The four scenarios are:

* fresh Telegram Q&A request;
* ten synthetic user/assistant pairs;
* tool-heavy raw-output retention plus turn-governor simulation;
* a synthetic logical transcript at or just above 350K estimated tokens,
  evaluated against native/local compaction planning thresholds.

Usage (from the repository root)::

    python scripts/benchmark_v32_offline.py \
      --baseline-ref 3cce675ce --current-ref HEAD --format markdown

The script writes only inside an automatically removed temporary workspace.
Use shell redirection or an explicit caller-owned capture if an artifact is
desired; checked-in evidence is intentionally reviewed separately.
"""

from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import inspect
import io
import json
import os
from pathlib import Path, PurePosixPath
import socket
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
from typing import Any


SCHEMA_VERSION = 1
DEFAULT_BASELINE_REF = "3cce675ce"
CONTEXT_WINDOW_TOKENS = 1_050_000
LOGICAL_HISTORY_TARGET_TOKENS = 350_000
FRESH_QUESTION = "Giải thích ngắn gọn vì sao bầu trời có màu xanh."
TOOL_RESULT_COUNT = 24
TOOL_RESULT_BYTES = 32_000
MODEL_ATTEMPTS_PLANNED = 14
TOOL_CALLS_PLANNED = 25
_PROBE_SENTINEL = "__HERMES_V32_BENCHMARK_JSON__="

# Keep revision extraction fast and below Windows' legacy path limit.  The
# probe imports runtime Python only; docs, tests, frontends, and bundled skill
# prose cannot affect any scenario and are deliberately absent.
_RUNTIME_ARCHIVE_PATHS = (
    "acp_adapter",
    "agent",
    "apps",
    "cron",
    "gateway",
    "hermes",
    "hermes_cli",
    "locales",
    "plugins",
    "providers",
    "tools",
    "batch_runner.py",
    "cli.py",
    "hermes_bootstrap.py",
    "hermes_constants.py",
    "hermes_logging.py",
    "hermes_state.py",
    "hermes_state_common.py",
    "hermes_state_portability.py",
    "hermes_state_schema.py",
    "hermes_state_search.py",
    "hermes_time.py",
    "mcp_serve.py",
    "mini_swe_runner.py",
    "model_tools.py",
    "registration_lifecycle.py",
    "run_agent.py",
    "toolset_distributions.py",
    "toolsets.py",
    "trajectory_compressor.py",
    "utils.py",
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _run_git(repo: Path, *args: str, binary: bool = False) -> str | bytes:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=not binary,
    )
    return completed.stdout


def _resolve_revision(repo: Path, ref: str) -> str:
    try:
        resolved = _run_git(repo, "rev-parse", f"{ref}^{{commit}}")
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"benchmark revision {ref!r} is unavailable locally; fetch enough "
            "Git history before running this focused benchmark"
        ) from exc
    return str(resolved).strip()


def _revision_time(repo: Path, revision: str) -> str:
    return str(_run_git(repo, "show", "-s", "--format=%cI", revision)).strip()


def _safe_extract_git_archive(archive_bytes: bytes, destination: Path) -> None:
    """Extract a trusted Git archive while still rejecting traversal paths."""
    destination.mkdir(parents=True, exist_ok=False)
    root = destination.resolve()
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
        members = archive.getmembers()
        for member in members:
            posix_name = PurePosixPath(member.name)
            if posix_name.is_absolute() or ".." in posix_name.parts:
                raise RuntimeError(f"unsafe path in git archive: {member.name!r}")
            resolved = (destination / Path(*posix_name.parts)).resolve()
            try:
                resolved.relative_to(root)
            except ValueError as exc:
                raise RuntimeError(
                    f"archive path escapes workspace: {member.name!r}"
                ) from exc
        archive.extractall(destination, members=members)


def _extract_revision(repo: Path, revision: str, destination: Path) -> None:
    archive = _run_git(
        repo,
        "archive",
        "--format=tar",
        revision,
        "--",
        *_RUNTIME_ARCHIVE_PATHS,
        binary=True,
    )
    assert isinstance(archive, bytes)
    _safe_extract_git_archive(archive, destination)


def _isolated_child_env(profile_root: Path, source_root: Path) -> dict[str, str]:
    """Return a credential-free environment sufficient for local Python."""
    keep = (
        "PATH",
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "PATHEXT",
    )
    env = {key: os.environ[key] for key in keep if os.environ.get(key)}
    profile_root.mkdir(parents=True, exist_ok=True)
    temp_root = profile_root / "tmp"
    appdata = profile_root / "appdata"
    localappdata = profile_root / "localappdata"
    hermes_home = profile_root / "hermes"
    for path in (temp_root, appdata, localappdata, hermes_home):
        path.mkdir(parents=True, exist_ok=True)
    env.update(
        {
            "HOME": str(profile_root),
            "USERPROFILE": str(profile_root),
            "APPDATA": str(appdata),
            "LOCALAPPDATA": str(localappdata),
            "TEMP": str(temp_root),
            "TMP": str(temp_root),
            "HERMES_HOME": str(hermes_home),
            "HERMES_DISABLE_VERSION_CHECK": "1",
            "HERMES_BENCHMARK_OFFLINE": "1",
            "PYTHONPATH": str(source_root),
            "PYTHONNOUSERSITE": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
            "TZ": "UTC",
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            "NO_PROXY": "*",
            "no_proxy": "*",
            "HTTP_PROXY": "",
            "HTTPS_PROXY": "",
            "ALL_PROXY": "",
        }
    )
    return env


def _run_source_probe(
    *,
    source_root: Path,
    profile_root: Path,
    variant: str,
    revision: str,
) -> dict[str, Any]:
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--_probe-source",
        str(source_root),
        "--_variant",
        variant,
        "--_revision",
        revision,
    ]
    completed = subprocess.run(
        command,
        cwd=source_root,
        env=_isolated_child_env(profile_root, source_root),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=180,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"{variant} probe failed ({completed.returncode})\n"
            f"stdout:\n{completed.stdout[-4000:]}\n"
            f"stderr:\n{completed.stderr[-4000:]}"
        )
    for line in reversed(completed.stdout.splitlines()):
        if line.startswith(_PROBE_SENTINEL):
            return json.loads(line[len(_PROBE_SENTINEL) :])
    raise RuntimeError(
        f"{variant} probe returned no evidence payload\n"
        f"stdout:\n{completed.stdout[-4000:]}\n"
        f"stderr:\n{completed.stderr[-4000:]}"
    )


def _install_external_io_deny_guard() -> dict[str, int]:
    """Fail closed and count network/DNS/subprocess attempts in a probe."""
    attempts = {
        "socket_connect": 0,
        "socket_connect_ex": 0,
        "create_connection": 0,
        "dns_resolution": 0,
        "subprocess": 0,
    }
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def denied_connect(sock: socket.socket, address: Any) -> Any:
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            attempts["socket_connect"] += 1
            raise RuntimeError(
                f"offline benchmark blocked network connection to {address!r}"
            )
        return original_connect(sock, address)

    def denied_connect_ex(sock: socket.socket, address: Any) -> int:
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            attempts["socket_connect_ex"] += 1
            raise RuntimeError(
                f"offline benchmark blocked network connection to {address!r}"
            )
        return original_connect_ex(sock, address)

    def denied_create_connection(*args: Any, **kwargs: Any) -> Any:
        attempts["create_connection"] += 1
        address = args[0] if args else kwargs.get("address")
        raise RuntimeError(
            f"offline benchmark blocked network connection to {address!r}"
        )

    def denied_getaddrinfo(*args: Any, **kwargs: Any) -> Any:
        attempts["dns_resolution"] += 1
        host = args[0] if args else kwargs.get("host")
        raise RuntimeError(f"offline benchmark blocked DNS resolution for {host!r}")

    def denied_popen(*args: Any, **kwargs: Any) -> Any:
        attempts["subprocess"] += 1
        command = args[0] if args else kwargs.get("args")
        raise RuntimeError(f"offline benchmark blocked subprocess: {command!r}")

    socket.socket.connect = denied_connect  # type: ignore[method-assign]
    socket.socket.connect_ex = denied_connect_ex  # type: ignore[method-assign]
    socket.create_connection = denied_create_connection  # type: ignore[assignment]
    socket.getaddrinfo = denied_getaddrinfo  # type: ignore[assignment]
    subprocess.Popen = denied_popen  # type: ignore[assignment,misc]
    return attempts


def _remove_current_worktree_editable_finders() -> list[str]:
    """Remove only Hermes' PEP 660 finder from the child interpreter.

    The benchmark intentionally reuses the repository virtualenv for third
    party dependencies.  Its editable-install finder would otherwise satisfy a
    module missing from the baseline archive (for example ``agent.turn_budget``)
    from the current checkout, silently contaminating before/after evidence.
    """
    removed: list[str] = []
    retained_meta = []
    for finder in sys.meta_path:
        module_name = str(getattr(finder, "__module__", ""))
        if module_name.startswith("__editable___hermes_agent_"):
            removed.append(module_name)
        else:
            retained_meta.append(finder)
    sys.meta_path[:] = retained_meta

    retained_hooks = []
    for hook in sys.path_hooks:
        module_name = str(getattr(hook, "__module__", ""))
        if module_name.startswith("__editable___hermes_agent_"):
            removed.append(module_name)
        else:
            retained_hooks.append(hook)
    sys.path_hooks[:] = retained_hooks
    sys.path[:] = [
        entry
        for entry in sys.path
        if "__editable__.hermes_agent-" not in str(entry)
    ]
    sys.path_importer_cache.clear()
    return sorted(set(removed))


def _tool_names(tool_defs: list[dict[str, Any]]) -> list[str]:
    return sorted(
        str(tool.get("function", {}).get("name") or "")
        for tool in tool_defs
        if isinstance(tool, dict) and tool.get("function", {}).get("name")
    )


def _schema_bytes(tool_defs: list[dict[str, Any]]) -> bytes:
    return json.dumps(
        tool_defs,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _ten_turn_messages() -> list[dict[str, str]]:
    topics = (
        "quang hợp",
        "lạm phát",
        "mã hóa đầu-cuối",
        "giấc ngủ sâu",
        "lãi kép",
        "điện toán đám mây",
        "tư duy phản biện",
        "biến đổi khí hậu",
        "học tăng cường",
        "thiền chánh niệm",
    )
    messages: list[dict[str, str]] = []
    for index, topic in enumerate(topics, start=1):
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Lượt {index}: Hãy giải thích {topic} bằng ba câu ngắn, "
                    "không dùng công cụ và nêu một ví dụ đời thường."
                ),
            }
        )
        messages.append(
            {
                "role": "assistant",
                "content": (
                    f"{topic.capitalize()} được mô tả bằng một định nghĩa ngắn. "
                    "Ý chính thứ hai làm rõ cơ chế hoặc hệ quả. "
                    f"Ví dụ đời thường số {index} giúp nối khái niệm với thực tế."
                ),
            }
        )
    return messages


def _request_estimate(
    *,
    system_prompt: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
) -> dict[str, Any]:
    from agent.model_metadata import (
        _estimate_tools_tokens_rough,
        estimate_messages_tokens_rough,
        estimate_request_tokens_rough,
        estimate_tokens_rough,
    )

    system_tokens = estimate_tokens_rough(system_prompt)
    conversation_tokens = estimate_messages_tokens_rough(messages)
    schema_tokens = _estimate_tools_tokens_rough(tools)
    active_tokens = estimate_request_tokens_rough(
        messages,
        system_prompt=system_prompt,
        tools=tools,
    )
    return {
        "measurement_kind": "static_estimate",
        "estimator": "agent.model_metadata.estimate_request_tokens_rough",
        "system_prompt_tokens_estimate": system_tokens,
        "conversation_tokens_estimate": conversation_tokens,
        "tool_schema_tokens_estimate": schema_tokens,
        "active_input_tokens_estimate": active_tokens,
        "active_context_percent": round(
            active_tokens * 100.0 / CONTEXT_WINDOW_TOKENS, 4
        ),
        "under_one_percent": active_tokens < CONTEXT_WINDOW_TOKENS * 0.01,
    }


def _ten_turn_request_estimate(
    *, system_prompt: str, tools: list[dict[str, Any]]
) -> dict[str, Any]:
    messages = _ten_turn_messages()
    empty = _request_estimate(system_prompt=system_prompt, messages=[], tools=tools)
    previous_tokens = empty["active_input_tokens_estimate"]
    cumulative_turns = []
    for turn in range(1, 11):
        estimate = _request_estimate(
            system_prompt=system_prompt,
            messages=messages[: turn * 2],
            tools=tools,
        )
        active_tokens = estimate["active_input_tokens_estimate"]
        cumulative_turns.append(
            {
                "turn": turn,
                "message_count": turn * 2,
                "active_input_tokens_estimate": active_tokens,
                "active_context_percent": estimate["active_context_percent"],
                "delta_from_prior_turn_tokens_estimate": (
                    active_tokens - previous_tokens
                ),
            }
        )
        previous_tokens = active_tokens
    final = _request_estimate(
        system_prompt=system_prompt, messages=messages, tools=tools
    )
    final["cumulative_turns"] = cumulative_turns
    return final


class _MemorySpillEnv:
    """Execution-environment double that records spill sizes without disk I/O."""

    def __init__(self) -> None:
        self.writes: dict[str, int] = {}

    def get_temp_dir(self) -> str:
        return "/isolated/hermes-v32-benchmark"

    def execute(
        self,
        command: str,
        timeout: float | None = None,
        stdin_data: str | None = None,
        **_: Any,
    ) -> dict[str, Any]:
        del timeout
        marker = "cat > "
        path = command.split(marker, 1)[-1].strip() if marker in command else command
        self.writes[path] = len((stdin_data or "").encode("utf-8"))
        return {"returncode": 0, "stdout": "", "stderr": ""}


def _tool_output_probe() -> dict[str, Any]:
    from tools.budget_config import DEFAULT_BUDGET, PINNED_THRESHOLDS
    from tools.tool_result_storage import (
        PERSISTED_OUTPUT_TAG,
        enforce_turn_budget,
        generate_preview,
        maybe_persist_tool_result,
    )

    env = _MemorySpillEnv()
    raw_by_id: dict[str, str] = {}
    messages: list[dict[str, str]] = []
    for index in range(TOOL_RESULT_COUNT):
        tool_call_id = f"tool-{index:02d}"
        prefix = f"result-{index:02d}:"
        raw = (prefix + ("x" * TOOL_RESULT_BYTES))[:TOOL_RESULT_BYTES]
        raw_by_id[tool_call_id] = raw
        bounded = maybe_persist_tool_result(
            raw,
            tool_name="terminal",
            tool_use_id=tool_call_id,
            env=env,
            config=DEFAULT_BUDGET,
            threshold=DEFAULT_BUDGET.default_result_size,
        )
        messages.append(
            {"role": "tool", "tool_call_id": tool_call_id, "content": bounded}
        )
    enforce_turn_budget(messages, env=env, config=DEFAULT_BUDGET)

    fully_inline_raw_bytes = 0
    retained_preview_bytes = 0
    for message in messages:
        raw = raw_by_id[message["tool_call_id"]]
        content = message["content"]
        if content == raw:
            fully_inline_raw_bytes += len(raw.encode("utf-8"))
            continue
        preview, _has_more = generate_preview(
            raw, max_chars=DEFAULT_BUDGET.preview_size
        )
        if preview and preview in content:
            retained_preview_bytes += len(preview.encode("utf-8"))
    inline_sizes = [len(message["content"].encode("utf-8")) for message in messages]
    persisted_count = sum(
        PERSISTED_OUTPUT_TAG in message["content"] for message in messages
    )
    return {
        "measurement_kind": "deterministic_simulation",
        "fixture": {
            "result_count": TOOL_RESULT_COUNT,
            "bytes_per_result": TOOL_RESULT_BYTES,
            "total_raw_bytes": TOOL_RESULT_COUNT * TOOL_RESULT_BYTES,
            "encoding": "ASCII (character/byte comparable across revisions)",
        },
        "per_result_cap_bytes": DEFAULT_BUDGET.default_result_size,
        "per_turn_cap_bytes": DEFAULT_BUDGET.turn_budget,
        "preview_cap_bytes": DEFAULT_BUDGET.preview_size,
        "read_file_unbounded": PINNED_THRESHOLDS.get("read_file") == float("inf"),
        "fully_inline_raw_bytes": fully_inline_raw_bytes,
        "retained_raw_preview_bytes": retained_preview_bytes,
        "retained_raw_bytes": fully_inline_raw_bytes + retained_preview_bytes,
        "persisted_result_count": persisted_count,
        "inline_context_bytes": sum(inline_sizes),
        "max_inline_result_bytes": max(inline_sizes, default=0),
        "all_inline_results_below_10k": all(size < 10_000 for size in inline_sizes),
        "spill_artifact_count": len(env.writes),
        "spill_artifact_bytes": sum(env.writes.values()),
    }


def _governor_probe() -> dict[str, Any]:
    try:
        from agent.turn_budget import TurnBudgetExceeded, TurnGovernor
    except (ImportError, ModuleNotFoundError):
        return {
            "measurement_kind": "static_counterfactual",
            "available": False,
            "model": {
                "planned": MODEL_ATTEMPTS_PLANNED,
                "admitted": MODEL_ATTEMPTS_PLANNED,
                "denied": 0,
                "warning_crossing_totals": [],
                "first_pause_attempt": None,
            },
            "tool": {
                "planned": TOOL_CALLS_PLANNED,
                "admitted": TOOL_CALLS_PLANNED,
                "denied": 0,
                "warning_crossing_totals": [],
                "first_pause_attempt": None,
            },
            "note": "Revision has no aggregate TurnGovernor; all planned calls are shown as ungoverned.",
        }

    model_governor = TurnGovernor(turn_id="benchmark-model")
    model_warnings: list[int] = []
    first_model_pause: int | None = None
    for attempt in range(1, MODEL_ATTEMPTS_PLANNED + 1):
        try:
            reservation = model_governor.reserve_model_attempt(
                task="benchmark", role="main"
            )
        except TurnBudgetExceeded as exc:
            reservation = exc.reservation
            if first_model_pause is None:
                first_model_pause = attempt
        if reservation.warning:
            model_warnings.append(reservation.total)

    tool_governor = TurnGovernor(turn_id="benchmark-tool")
    tool_warnings: list[int] = []
    first_tool_pause: int | None = None
    for attempt in range(1, TOOL_CALLS_PLANNED + 1):
        reservation = tool_governor.reserve_tool_calls(
            count=1, task="benchmark", role="main"
        )
        if reservation.warning:
            tool_warnings.append(reservation.total)
        if reservation.denied and first_tool_pause is None:
            first_tool_pause = attempt

    model_snapshot = model_governor.snapshot()["model"]
    tool_snapshot = tool_governor.snapshot()["tool"]
    return {
        "measurement_kind": "deterministic_simulation",
        "available": True,
        "model": {
            "planned": MODEL_ATTEMPTS_PLANNED,
            "admitted": model_snapshot["count"],
            "denied": model_snapshot["denied"],
            "warn_limit": model_snapshot["warn_limit"],
            "hard_limit": model_snapshot["hard_limit"],
            "warning_crossing_totals": model_warnings,
            "first_pause_attempt": first_model_pause,
        },
        "tool": {
            "planned": TOOL_CALLS_PLANNED,
            "admitted": tool_snapshot["count"],
            "denied": tool_snapshot["denied"],
            "warn_limit": tool_snapshot["warn_limit"],
            "hard_limit": tool_snapshot["hard_limit"],
            "warning_crossing_totals": tool_warnings,
            "first_pause_attempt": first_tool_pause,
        },
    }


def _synthetic_logical_history() -> tuple[list[dict[str, str]], int]:
    from agent.model_metadata import estimate_messages_tokens_rough

    message_count = 70
    payload_chars = 19_960
    history = [
        {
            "role": "user" if index % 2 == 0 else "assistant",
            "content": f"logical-{index:02d}:" + ("L" * payload_chars),
        }
        for index in range(message_count)
    ]
    estimate = estimate_messages_tokens_rough(history)
    if estimate < LOGICAL_HISTORY_TARGET_TOKENS:
        deficit = LOGICAL_HISTORY_TARGET_TOKENS - estimate
        history[-1]["content"] += "L" * (deficit * 4 + 8)
        estimate = estimate_messages_tokens_rough(history)
    return history, estimate


def _compaction_probe() -> dict[str, Any]:
    from agent.context_compressor import ContextCompressor
    from agent.native_compaction import native_compaction_context_management
    from hermes_cli.config_defaults import DEFAULT_CONFIG

    compression = dict(DEFAULT_CONFIG.get("compression") or {})
    route_cap = compression.get("threshold_tokens")
    try:
        from agent.native_compaction import local_compaction_threshold_cap

        local_cap = local_compaction_threshold_cap(
            "gpt-5.6-sol",
            "openai-codex",
            "https://chatgpt.com/backend-api/codex",
            compression.get("codex_responses_local_fallback_threshold"),
        )
        if local_cap is not None:
            route_cap = min(route_cap, local_cap) if route_cap else local_cap
    except ImportError:
        local_cap = None

    compressor = ContextCompressor(
        model="gpt-5.6-sol",
        threshold_percent=float(compression.get("threshold", 0.50)),
        quiet_mode=True,
        base_url="https://chatgpt.com/backend-api/codex",
        provider="openai-codex",
        api_mode="codex_responses",
        config_context_length=CONTEXT_WINDOW_TOKENS,
        threshold_tokens_cap=route_cap,
    )

    raw_native = compression.get("codex_responses_native", False)
    try:
        from agent.native_compaction import coerce_native_compaction_enabled

        native_enabled = coerce_native_compaction_enabled(raw_native, default=True)
    except ImportError:
        native_enabled = bool(raw_native)

    planning_agent = SimpleNamespace(
        codex_responses_native_compaction=native_enabled,
        compression_enabled=True,
        model="gpt-5.6-sol",
        base_url="https://chatgpt.com/backend-api/codex",
        codex_responses_compact_threshold=compression.get(
            "codex_responses_compact_threshold", 200_000
        ),
        context_compressor=compressor,
    )
    native_payload = native_compaction_context_management(
        planning_agent,
        is_codex_backend=True,
        is_xai_responses=False,
        is_github_responses=False,
    )

    _history, logical_tokens = _synthetic_logical_history()
    native_threshold = (
        int(native_payload[0]["compact_threshold"]) if native_payload else None
    )
    local_threshold = int(compressor.threshold_tokens)
    native_due = native_threshold is not None and logical_tokens >= native_threshold
    local_due = logical_tokens >= local_threshold
    if native_due and local_due:
        decision = "native_and_local_fallback_due"
    elif native_due:
        decision = "native_due"
    elif local_due:
        decision = "local_due"
    else:
        decision = "no_compaction_due"

    thresholds = [value for value in (native_threshold, local_threshold) if value]
    earliest_threshold = min(thresholds) if thresholds else None
    return {
        "measurement_kind": "static_planning_estimate",
        "execution": "not_executed_offline",
        "fixture": {
            "message_count": len(_history),
            "target_tokens": LOGICAL_HISTORY_TARGET_TOKENS,
            "logical_history_tokens_estimate": logical_tokens,
            "context_window_tokens": CONTEXT_WINDOW_TOKENS,
            "logical_context_percent": round(
                logical_tokens * 100.0 / CONTEXT_WINDOW_TOKENS, 4
            ),
        },
        "native_config_value": raw_native,
        "native_enabled_for_direct_codex_route": native_enabled,
        "native_context_management_present": native_payload is not None,
        "native_compact_threshold_tokens": native_threshold,
        "native_due_at_fixture": native_due,
        "local_threshold_ratio": float(compression.get("threshold", 0.50)),
        "route_local_fallback_cap_tokens": local_cap,
        "effective_local_threshold_tokens": local_threshold,
        "local_due_at_fixture": local_due,
        "earliest_compaction_threshold_tokens": earliest_threshold,
        "earliest_threshold_below_observed_272k_ceiling": bool(
            earliest_threshold is not None and earliest_threshold < 272_000
        ),
        "planning_decision": decision,
        "ordering_note": (
            "Both thresholds being due does not predict runtime order: the last "
            "real-usage anchor can defer rough local preflight, while native "
            "compaction is provider-side. This offline harness records gates only."
        ),
    }


def _probe_source(source_root: Path, variant: str, revision: str) -> dict[str, Any]:
    source_root = source_root.resolve()
    if not (source_root / "run_agent.py").is_file():
        raise RuntimeError(f"not a Hermes source archive: {source_root}")
    os.chdir(source_root)
    sys.path.insert(0, str(source_root))
    removed_editable_finders = _remove_current_worktree_editable_finders()
    # On Windows asyncio defines a helper subclass of subprocess.Popen at
    # import time, and platform.system() shells out to ``ver`` once; materialize
    # both interpreter-level helpers before measuring/blocking Hermes I/O.
    import asyncio  # noqa: F401
    import platform

    platform.system()

    external_io_attempts = _install_external_io_deny_guard()

    # Freeze availability instead of executing check_fn probes. This gives both
    # revisions the same worst-case granted Telegram catalog and prevents local
    # Docker/browser/credential state from changing schema counts.
    import tools.registry as registry_module

    registry_module._check_fn_cached = lambda _fn: True

    # Do not load user/project/pip plugins. Their import-time code and schemas
    # would make the comparison machine-dependent; built-in discovery remains.
    import hermes_cli.plugins as plugin_module

    plugin_module.discover_plugins = lambda: []

    import model_tools
    import run_agent
    from unittest.mock import MagicMock, patch

    clear_cache = getattr(model_tools, "_clear_tool_defs_cache", None)
    if callable(clear_cache):
        clear_cache()

    kwargs: dict[str, Any] = {
        "enabled_toolsets": ["hermes-telegram"],
        "quiet_mode": True,
        "skip_tool_search_assembly": True,
    }
    signature = inspect.signature(model_tools.get_tool_definitions)
    if "tool_profile" in signature.parameters:
        kwargs["tool_profile"] = "lean"
    raw_tools = model_tools.get_tool_definitions(**kwargs)

    fixed_now = datetime(2026, 8, 24, 0, 0, 0, tzinfo=timezone.utc)
    provider_client = MagicMock(name="offline_provider_client")
    provider_factory = MagicMock(
        name="offline_provider_factory", return_value=provider_client
    )
    with ExitStack() as stack:
        stack.enter_context(patch.object(run_agent, "OpenAI", provider_factory))
        stack.enter_context(
            patch("agent.agent_init.fetch_model_metadata", return_value=None)
        )
        stack.enter_context(
            patch("agent.context_compressor.get_model_context_length", return_value=CONTEXT_WINDOW_TOKENS)
        )
        stack.enter_context(
            patch("agent.model_metadata.get_model_context_length", return_value=CONTEXT_WINDOW_TOKENS)
        )
        stack.enter_context(patch("hermes_time.now", return_value=fixed_now))
        stack.enter_context(patch("hermes_time.get_timezone", return_value=timezone.utc))
        agent = run_agent.AIAgent(
            api_key="offline-benchmark-placeholder",
            base_url="https://example.invalid/v1",
            provider="custom",
            api_mode="chat_completions",
            model="gpt-5.6-sol",
            quiet_mode=True,
            skip_context_files=True,
            skip_memory=True,
            platform="telegram",
            enabled_toolsets=["hermes-telegram"],
        )
        system_prompt = agent._build_system_prompt()

    active_tools = list(agent.tools or [])
    raw_schema = _schema_bytes(raw_tools)
    active_schema = _schema_bytes(active_tools)
    profile = str(getattr(agent, "tool_profile", "full") or "full")
    fresh = _request_estimate(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": FRESH_QUESTION}],
        tools=active_tools,
    )
    ten_turn = _ten_turn_request_estimate(
        system_prompt=system_prompt, tools=active_tools
    )
    raw_names = _tool_names(raw_tools)
    active_names = _tool_names(active_tools)
    provider_request_calls = sum(
        endpoint.call_count
        for endpoint in (
            provider_client.chat.completions.create,
            provider_client.completions.create,
            provider_client.responses.create,
            provider_client.models.list,
        )
    )
    raw_output = _tool_output_probe()
    governor = _governor_probe()
    logical = _compaction_probe()
    config_values = {
        "context_window_tokens": CONTEXT_WINDOW_TOKENS,
        "tool_profile": profile,
        "result_cap_bytes": raw_output["per_result_cap_bytes"],
        "turn_cap_bytes": raw_output["per_turn_cap_bytes"],
        "preview_cap_bytes": raw_output["preview_cap_bytes"],
        "model_warn_limit": governor["model"].get("warn_limit"),
        "model_hard_limit": governor["model"].get("hard_limit"),
        "tool_warn_limit": governor["tool"].get("warn_limit"),
        "tool_hard_limit": governor["tool"].get("hard_limit"),
        "native_compact_threshold_tokens": logical[
            "native_compact_threshold_tokens"
        ],
        "effective_local_threshold_tokens": logical[
            "effective_local_threshold_tokens"
        ],
    }
    config_bytes = json.dumps(
        config_values, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    agent._session_db = None
    agent._owns_session_db = False

    return {
        "variant": variant,
        "revision": revision,
        "profile": profile,
        "probe_contract": {
            "network": "socket-denied",
            "network_and_subprocess_attempts": external_io_attempts,
            "provider_client_constructions": provider_factory.call_count,
            "provider_calls": provider_request_calls,
            "tool_calls_executed": 0,
            "editable_worktree_finders_removed": removed_editable_finders,
            "external_plugin_discovery": "disabled",
            "tool_availability": "forced true; schemas loaded, handlers not executed",
            "profile_home": "isolated temporary directory",
        },
        "schema": {
            "raw_tool_count": len(raw_tools),
            "active_tool_count": len(active_tools),
            "deferred_tool_count": max(0, len(raw_tools) - len(active_tools)),
            "raw_schema_bytes": len(raw_schema),
            "active_schema_bytes": len(active_schema),
            "raw_schema_sha256": hashlib.sha256(raw_schema).hexdigest(),
            "active_schema_sha256": hashlib.sha256(active_schema).hexdigest(),
            "raw_tool_names": raw_names,
            "active_tool_names": active_names,
            "tool_search_activated": "tool_search" in active_names,
        },
        "config": {
            "measurement_kind": "canonical_static_configuration",
            "values": config_values,
            "sha256": hashlib.sha256(config_bytes).hexdigest(),
        },
        "system_prompt": {
            "measurement_kind": "static_estimate",
            "chars": len(system_prompt),
            "note": "Built with empty profile, no context files/memory, fixed UTC date.",
        },
        "fresh": fresh,
        "ten_turn_qa": ten_turn,
        "tool_heavy": {
            "raw_output": raw_output,
            "governor": governor,
        },
        "logical_350k": logical,
    }


def _percent_change(before: int, after: int) -> float | None:
    if not before:
        return None
    return round((after - before) * 100.0 / before, 2)


def _build_deltas(baseline: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    return {
        "fresh_active_tokens_percent_change": _percent_change(
            baseline["fresh"]["active_input_tokens_estimate"],
            current["fresh"]["active_input_tokens_estimate"],
        ),
        "ten_turn_active_tokens_percent_change": _percent_change(
            baseline["ten_turn_qa"]["active_input_tokens_estimate"],
            current["ten_turn_qa"]["active_input_tokens_estimate"],
        ),
        "active_schema_bytes_percent_change": _percent_change(
            baseline["schema"]["active_schema_bytes"],
            current["schema"]["active_schema_bytes"],
        ),
        "retained_raw_bytes_percent_change": _percent_change(
            baseline["tool_heavy"]["raw_output"]["retained_raw_bytes"],
            current["tool_heavy"]["raw_output"]["retained_raw_bytes"],
        ),
    }


def validate_report(report: dict[str, Any]) -> list[dict[str, Any]]:
    """Return auditable pass/fail checks without hiding acceptance misses."""
    baseline = report["variants"]["baseline"]
    current = report["variants"]["current"]
    checks = [
        (
            "network_free",
            all(
                variant["probe_contract"]["provider_calls"] == 0
                and variant["probe_contract"]["network"] == "socket-denied"
                and not any(
                    variant["probe_contract"]["network_and_subprocess_attempts"][
                        key
                    ]
                    for key in (
                        "socket_connect",
                        "socket_connect_ex",
                        "create_connection",
                        "dns_resolution",
                    )
                )
                for variant in (baseline, current)
            ),
        ),
        (
            "baseline_revision_isolated",
            not baseline["tool_heavy"]["governor"].get("available"),
        ),
        (
            "fresh_current_under_one_percent",
            current["fresh"]["under_one_percent"],
        ),
        (
            "fresh_current_smaller_than_baseline",
            current["fresh"]["active_input_tokens_estimate"]
            < baseline["fresh"]["active_input_tokens_estimate"],
        ),
        (
            "current_raw_result_cap_below_10k",
            current["tool_heavy"]["raw_output"]["per_result_cap_bytes"] < 10_000,
        ),
        (
            "current_governor_model_cap_12",
            current["tool_heavy"]["governor"].get("available")
            and current["tool_heavy"]["governor"]["model"]["admitted"] == 12,
        ),
        (
            "current_governor_tool_cap_20",
            current["tool_heavy"]["governor"].get("available")
            and current["tool_heavy"]["governor"]["tool"]["admitted"] == 20,
        ),
        (
            "logical_fixture_at_least_350k",
            all(
                variant["logical_350k"]["fixture"][
                    "logical_history_tokens_estimate"
                ]
                >= LOGICAL_HISTORY_TARGET_TOKENS
                for variant in (baseline, current)
            ),
        ),
        (
            "current_compaction_armed_below_272k",
            current["logical_350k"][
                "earliest_threshold_below_observed_272k_ceiling"
            ],
        ),
    ]
    return [
        {"id": check_id, "passed": bool(passed)} for check_id, passed in checks
    ]


def run_benchmark(
    *,
    repo: Path,
    baseline_ref: str = DEFAULT_BASELINE_REF,
    current_ref: str = "HEAD",
    workspace_parent: Path | None = None,
) -> dict[str, Any]:
    repo = repo.resolve()
    baseline_revision = _resolve_revision(repo, baseline_ref)
    current_revision = _resolve_revision(repo, current_ref)
    parent = workspace_parent.resolve() if workspace_parent else None
    if parent is not None:
        parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix="hermes-v32-offline-bench-",
        dir=str(parent) if parent else None,
    ) as workspace_text:
        workspace = Path(workspace_text).resolve()
        baseline_source = workspace / "baseline-source"
        current_source = workspace / "current-source"
        _extract_revision(repo, baseline_revision, baseline_source)
        _extract_revision(repo, current_revision, current_source)
        baseline = _run_source_probe(
            source_root=baseline_source,
            profile_root=workspace / "baseline-profile",
            variant="baseline",
            revision=baseline_revision,
        )
        current = _run_source_probe(
            source_root=current_source,
            profile_root=workspace / "current-profile",
            variant="current",
            revision=current_revision,
        )

    report = {
        "schema_version": SCHEMA_VERSION,
        "benchmark": "hermes-v32-offline-token-context-governor",
        "methodology": {
            "offline": True,
            "network_guard": "IPv4/IPv6 socket connect denied in both probes",
            "source_isolation": "git archive per revision into separate TemporaryDirectory roots",
            "profile_isolation": "empty HERMES_HOME/HOME/APPDATA per revision",
            "tool_availability": "all selected Telegram check_fn probes forced true; external plugin discovery disabled; no handler executed",
            "token_numbers": "static estimates from each revision's Hermes rough estimator; not provider billing/usage",
            "context_window_tokens": CONTEXT_WINDOW_TOKENS,
            "live_provider_proof": False,
        },
        "source": {
            "baseline_ref": baseline_ref,
            "baseline_revision": baseline_revision,
            "baseline_commit_time": _revision_time(repo, baseline_revision),
            "current_ref": current_ref,
            "current_revision": current_revision,
            "current_commit_time": _revision_time(repo, current_revision),
        },
        "variants": {"baseline": baseline, "current": current},
        "deltas": _build_deltas(baseline, current),
        "limitations": [
            "No provider/model request, quota lookup, or native/local compaction execution occurred.",
            "Token values are static preflight estimates, not tokenizer-exact provider usage.",
            "Tool availability is forced true to compare a constant worst-case Telegram catalog; this is not an installed-user capability inventory.",
            "The 350K scenario reports which gates are due, not runtime ordering or summary quality.",
            "The simple-answer no-tool-loop behavior is covered by mocked regression tests, not inferred from this provider-free harness.",
        ],
    }
    report["acceptance_checks"] = validate_report(report)
    return report


def _fmt_int(value: Any) -> str:
    return "—" if value is None else f"{int(value):,}"


def _fmt_pct(value: Any) -> str:
    return "—" if value is None else f"{float(value):.4f}%"


def render_markdown(report: dict[str, Any]) -> str:
    baseline = report["variants"]["baseline"]
    current = report["variants"]["current"]
    source = report["source"]
    lines = [
        "# Hermes v32 offline benchmark evidence",
        "",
        f"Baseline: `{source['baseline_revision']}` (`{source['baseline_ref']}`)  ",
        f"Current source under test: `{source['current_revision']}` (`{source['current_ref']}`)",
        "",
        "> All token values below are **static estimates** from Hermes' own rough preflight estimator. No model, provider, quota endpoint, or network was called.",
        "",
        "## Summary",
        "",
        "| Scenario | Baseline | Current |",
        "|---|---:|---:|",
        (
            "| Fresh active input | "
            f"{_fmt_int(baseline['fresh']['active_input_tokens_estimate'])} "
            f"({_fmt_pct(baseline['fresh']['active_context_percent'])}) | "
            f"{_fmt_int(current['fresh']['active_input_tokens_estimate'])} "
            f"({_fmt_pct(current['fresh']['active_context_percent'])}) |"
        ),
        (
            "| 10-turn Q&A active input | "
            f"{_fmt_int(baseline['ten_turn_qa']['active_input_tokens_estimate'])} | "
            f"{_fmt_int(current['ten_turn_qa']['active_input_tokens_estimate'])} |"
        ),
        (
            "| Active / granted tool schemas | "
            f"{baseline['schema']['active_tool_count']} / {baseline['schema']['raw_tool_count']} | "
            f"{current['schema']['active_tool_count']} / {current['schema']['raw_tool_count']} |"
        ),
        (
            "| Active schema bytes | "
            f"{_fmt_int(baseline['schema']['active_schema_bytes'])} | "
            f"{_fmt_int(current['schema']['active_schema_bytes'])} |"
        ),
        (
            "| Tool-heavy retained raw bytes | "
            f"{_fmt_int(baseline['tool_heavy']['raw_output']['retained_raw_bytes'])} | "
            f"{_fmt_int(current['tool_heavy']['raw_output']['retained_raw_bytes'])} |"
        ),
        (
            "| Per-result / per-turn raw cap | "
            f"{_fmt_int(baseline['tool_heavy']['raw_output']['per_result_cap_bytes'])} / "
            f"{_fmt_int(baseline['tool_heavy']['raw_output']['per_turn_cap_bytes'])} B | "
            f"{_fmt_int(current['tool_heavy']['raw_output']['per_result_cap_bytes'])} / "
            f"{_fmt_int(current['tool_heavy']['raw_output']['per_turn_cap_bytes'])} B |"
        ),
        (
            "| Governor model/tool admitted | "
            f"{baseline['tool_heavy']['governor']['model']['admitted']} / "
            f"{baseline['tool_heavy']['governor']['tool']['admitted']} "
            f"({'active' if baseline['tool_heavy']['governor']['available'] else 'counterfactual; unavailable'}) | "
            f"{current['tool_heavy']['governor']['model']['admitted']} / "
            f"{current['tool_heavy']['governor']['tool']['admitted']} |"
        ),
        (
            "| Native / local compaction threshold | "
            f"{_fmt_int(baseline['logical_350k']['native_compact_threshold_tokens'])} / "
            f"{_fmt_int(baseline['logical_350k']['effective_local_threshold_tokens'])} | "
            f"{_fmt_int(current['logical_350k']['native_compact_threshold_tokens'])} / "
            f"{_fmt_int(current['logical_350k']['effective_local_threshold_tokens'])} |"
        ),
        "",
        "## Scenario notes",
        "",
        "- Fresh and 10-turn rows include the built empty-profile system prompt, conversation, and model-visible tool schemas.",
        f"- Tool-heavy fixture: {TOOL_RESULT_COUNT} ASCII results × {TOOL_RESULT_BYTES:,} bytes; spill writes are captured in memory.",
        f"- Governor fixture: {MODEL_ATTEMPTS_PLANNED} model attempts and {TOOL_CALLS_PLANNED} tool calls are simulated independently.",
        (
            "- Logical-history estimate: baseline "
            f"{_fmt_int(baseline['logical_350k']['fixture']['logical_history_tokens_estimate'])}; "
            "current "
            f"{_fmt_int(current['logical_350k']['fixture']['logical_history_tokens_estimate'])} tokens."
        ),
        f"- Baseline planning decision: `{baseline['logical_350k']['planning_decision']}`.",
        f"- Current planning decision: `{current['logical_350k']['planning_decision']}`.",
        "",
        "## Acceptance checks",
        "",
    ]
    for check in report["acceptance_checks"]:
        lines.append(f"- {'PASS' if check['passed'] else 'FAIL'} — `{check['id']}`")
    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {item}" for item in report["limitations"])
    lines.extend(
        [
            "",
            "## Reproduce",
            "",
            "```powershell",
            "& .\\.venv\\Scripts\\python.exe scripts\\benchmark_v32_offline.py "
            f"--baseline-ref {source['baseline_revision']} "
            f"--current-ref {source['current_revision']} --format markdown",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-ref", default=DEFAULT_BASELINE_REF)
    parser.add_argument("--current-ref", default="HEAD")
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    parser.add_argument(
        "--workspace-parent",
        type=Path,
        help="Optional parent for the automatically removed isolated workspace.",
    )
    parser.add_argument("--_probe-source", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--_variant", help=argparse.SUPPRESS)
    parser.add_argument("--_revision", help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args._probe_source:
        payload = _probe_source(
            args._probe_source,
            args._variant or "unknown",
            args._revision or "unknown",
        )
        print(_PROBE_SENTINEL + json.dumps(payload, ensure_ascii=False, sort_keys=True))
        return 0

    report = run_benchmark(
        repo=_repo_root(),
        baseline_ref=args.baseline_ref,
        current_ref=args.current_ref,
        workspace_parent=args.workspace_parent,
    )
    if args.format == "markdown":
        print(render_markdown(report), end="")
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
