"""Configurable byte budgets for tool result persistence.

Per-tool resolution: pinned > config overrides > registry > default.

The public field/constant names retain their historical ``*_CHARS`` spelling
for compatibility, but v32 interprets every numeric value as a UTF-8 byte cap.
"""

from dataclasses import dataclass, field
from typing import Dict

# No tool is exempt from the parent-context cap. ``read_file`` used to be
# pinned to infinity to avoid a persist->read->persist loop, but that let one
# paginated recovery read inject an arbitrarily large artifact straight back
# into the model request. Recovery is now by bounded offset/limit reads.
PINNED_THRESHOLDS: Dict[str, float] = {}

# Keep one result below 10 KiB after UTF-8 encoding. The 9,500-byte cap leaves
# room for role/tool-call framing in the parent request. A turn can carry at
# most four such results before aggregate spill enforcement tightens it.
DEFAULT_RESULT_SIZE_CHARS: int = 9_500
DEFAULT_TURN_BUDGET_CHARS: int = 38_000
DEFAULT_PREVIEW_SIZE_CHARS: int = 1_024


@dataclass(frozen=True)
class BudgetConfig:
    """Immutable budget constants for the 3-layer tool result persistence system.

    Layer 2 (per-result): resolve_threshold(tool_name) -> threshold in bytes.
    Layer 3 (per-turn):   turn_budget -> aggregate UTF-8 byte budget across all tool
                          results in a single assistant turn.
    Preview:              preview_size -> inline UTF-8 byte budget after persistence.
    """

    default_result_size: int = DEFAULT_RESULT_SIZE_CHARS
    turn_budget: int = DEFAULT_TURN_BUDGET_CHARS
    preview_size: int = DEFAULT_PREVIEW_SIZE_CHARS
    tool_overrides: Dict[str, int] = field(default_factory=dict)

    def resolve_threshold(self, tool_name: str) -> int | float:
        """Resolve the persistence threshold for a tool.

        Priority: pinned -> tool_overrides -> registry per-tool -> default.

        The registry per-tool value is capped at ``default_result_size`` so a
        context-scaled budget actually constrains tools that register a large
        legacy ``max_result_size_chars`` value. It also prevents registry or
        user overrides from bypassing v32's parent-context ceiling.
        """
        if tool_name in PINNED_THRESHOLDS:
            return PINNED_THRESHOLDS[tool_name]
        if tool_name in self.tool_overrides:
            override = self.tool_overrides[tool_name]
            if override == float("inf"):
                return self.default_result_size
            return min(override, self.default_result_size)
        from tools.registry import registry
        registry_value = registry.get_max_result_size(tool_name, default=self.default_result_size)
        if registry_value == float("inf"):
            return self.default_result_size
        return min(registry_value, self.default_result_size)


# Default v32 parent-context budget.
DEFAULT_BUDGET = BudgetConfig()


# Conservative token-to-byte estimate used when scaling for small contexts.
# window. Deliberately conservative (a smaller divisor = more chars per token =
# a larger char budget) would UNDER-protect small models, so we use the same
# rough 4-chars-per-token ratio the estimator uses (agent/model_metadata.py).
_CHARS_PER_TOKEN: int = 4

# Fraction of a model's context window we allow a SINGLE tool result to occupy
# before persisting/truncating it, and the fraction the WHOLE turn's tool
# output may occupy. Tool output is not the only thing in the window (system
# prompt, tool schemas, conversation history, the model's own reply all
# compete), so these stay well under 1.0.
_PER_RESULT_WINDOW_FRACTION: float = 0.15
_PER_TURN_WINDOW_FRACTION: float = 0.30

# Floor so even a tiny-but-admitted model still gets a usable preview/result
# rather than a 0-char budget.
_MIN_RESULT_SIZE_CHARS: int = 4_096
_MIN_TURN_BUDGET_CHARS: int = 16_000


def budget_for_context_window(context_length: int | None) -> BudgetConfig:
    """Return a BudgetConfig scaled to the active model's context window.

    V32's fixed ceiling is already safe for large-context models. Scaling still
    shrinks the budget for unusually small local contexts so one tool result
    cannot dominate their request (#23767).

    The proportional value is clamped to the v32 defaults as a hard cap and
    floored so a usable preview always survives.
    """
    if not context_length or context_length <= 0:
        return DEFAULT_BUDGET

    window_chars = context_length * _CHARS_PER_TOKEN
    per_result = int(window_chars * _PER_RESULT_WINDOW_FRACTION)
    per_turn = int(window_chars * _PER_TURN_WINDOW_FRACTION)

    # Clamp: never exceed v32's cap; never drop below a usable floor.
    per_result = max(_MIN_RESULT_SIZE_CHARS, min(per_result, DEFAULT_RESULT_SIZE_CHARS))
    per_turn = max(_MIN_TURN_BUDGET_CHARS, min(per_turn, DEFAULT_TURN_BUDGET_CHARS))

    return BudgetConfig(
        default_result_size=per_result,
        turn_budget=per_turn,
        preview_size=DEFAULT_PREVIEW_SIZE_CHARS,
    )
