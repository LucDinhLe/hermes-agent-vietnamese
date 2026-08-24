#!/usr/bin/env python3
"""Measure the model-visible lean tool schema without calling a provider.

The benchmark imports only built-in tool registrations, bypasses availability
probes and dynamic provider configuration, and measures static JSON schemas.
It is safe to run in CI without credentials or network access.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Standalone runs must not inherit the operator's config, plugins, or
# credentials. Keep the temporary directory alive until process exit; Python
# removes it automatically. Importing ``measure`` from an already-isolated
# test process does not alter that process's profile.
_BENCHMARK_HOME = None
if __name__ == "__main__":
    _BENCHMARK_HOME = tempfile.TemporaryDirectory(prefix="hermes-lean-schema-")
    os.environ["HERMES_HOME"] = _BENCHMARK_HOME.name

from tools.registry import discover_builtin_tools, registry  # noqa: E402
from tools.tool_search import (  # noqa: E402
    TOOL_PROFILE_FULL,
    TOOL_PROFILE_LEAN,
    ToolSearchConfig,
    assemble_tool_defs,
    estimate_tokens_from_schemas,
)
from toolsets import resolve_toolset  # noqa: E402


DEFAULT_CONTEXT_LENGTH = 1_050_000


def _registered_static_schemas(toolset: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Return registered schemas without running check functions or providers."""
    discover_builtin_tools()
    definitions: list[dict[str, Any]] = []
    missing: list[str] = []
    for name in sorted(set(resolve_toolset(toolset, include_registry=False))):
        schema = registry.get_schema(name)
        if schema is None:
            missing.append(name)
            continue
        definitions.append(
            {
                "type": "function",
                "function": {**schema, "name": name},
            }
        )
    return definitions, missing


def measure(toolset: str = "hermes-telegram", context_length: int = DEFAULT_CONTEXT_LENGTH) -> dict[str, Any]:
    raw, missing = _registered_static_schemas(toolset)
    config = ToolSearchConfig.from_raw({"enabled": "on", "listing": "off"})
    lean = assemble_tool_defs(
        raw,
        context_length=context_length,
        config=config,
        profile=TOOL_PROFILE_LEAN,
    )
    full = assemble_tool_defs(
        raw,
        context_length=context_length,
        config=config,
        profile=TOOL_PROFILE_FULL,
    )
    raw_tokens = estimate_tokens_from_schemas(raw)
    lean_tokens = estimate_tokens_from_schemas(lean.tool_defs)
    full_tokens = estimate_tokens_from_schemas(full.tool_defs)
    return {
        "toolset": toolset,
        "context_length": context_length,
        "measurement": "static_registered_tool_schemas_only",
        "raw": {"count": len(raw), "estimated_tokens": raw_tokens},
        "lean": {
            "count": len(lean.tool_defs),
            "deferred_count": lean.deferred_count,
            "estimated_tokens": lean_tokens,
            "percent_of_context": round(100 * lean_tokens / context_length, 6),
        },
        "full": {
            "count": len(full.tool_defs),
            "deferred_count": full.deferred_count,
            "estimated_tokens": full_tokens,
            "percent_of_context": round(100 * full_tokens / context_length, 6),
        },
        "missing_optional_registrations": missing,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--toolset", default="hermes-telegram")
    parser.add_argument("--context-length", type=int, default=DEFAULT_CONTEXT_LENGTH)
    args = parser.parse_args()
    if args.context_length <= 0:
        parser.error("--context-length must be positive")
    result = measure(args.toolset, args.context_length)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
