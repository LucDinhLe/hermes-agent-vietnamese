#!/usr/bin/env python3
"""Interact with the live in-app Browser pane in Hermes Desktop."""

import json
from typing import Callable, Optional

from tools.registry import registry, tool_error


_ACTIONS = {"click", "type", "press", "scroll", "back", "forward", "reload"}


def interact_preview_tool(
    action: str,
    ref: str = "",
    text: Optional[str] = None,
    key: str = "",
    delta_y: Optional[int] = None,
    callback: Optional[Callable] = None,
) -> str:
    """Dispatch one interaction to the Browser pane the user is viewing."""
    if callback is None:
        return tool_error("interact_preview is only available in the Hermes desktop app.")

    normalized_action = str(action or "").strip().lower()
    if normalized_action not in _ACTIONS:
        return tool_error(f"action must be one of: {', '.join(sorted(_ACTIONS))}.")

    payload = {"action": normalized_action}

    if normalized_action in {"click", "type"}:
        normalized_ref = str(ref or "").strip()
        if normalized_ref and not normalized_ref.startswith("@"):
            normalized_ref = f"@{normalized_ref}"
        if not normalized_ref:
            return tool_error("ref is required for click and type. Read the preview first to get current refs.")
        payload["ref"] = normalized_ref

    if normalized_action == "type":
        if text is None:
            return tool_error("text is required for type. Use an empty string to clear the field.")
        payload["text"] = str(text)

    if normalized_action == "press":
        normalized_key = str(key or "").strip()
        if not normalized_key:
            return tool_error("key is required for press.")
        payload["key"] = normalized_key[:64]

    if normalized_action == "scroll":
        try:
            amount = 600 if delta_y is None else int(delta_y)
        except (TypeError, ValueError):
            return tool_error("delta_y must be an integer.")
        payload["delta_y"] = max(-5000, min(5000, amount))

    try:
        raw = callback(**payload)
    except Exception as exc:
        return tool_error(f"Failed to interact with the Browser pane: {exc}")

    if not raw:
        return tool_error("The Browser pane did not answer, or the interaction timed out.")

    try:
        return json.dumps(json.loads(raw), ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps({"message": str(raw)}, ensure_ascii=False)


INTERACT_PREVIEW_SCHEMA = {
    "name": "interact_preview",
    "description": (
        "Interact with the same in-app Browser page the Hermes Desktop user is viewing. "
        "Call read_preview first to get current element refs such as @p1. Supported actions: "
        "click(ref), type(ref,text), press(key), scroll(delta_y), back, forward, reload. "
        "Refs become stale after navigation or major page changes, so read again before the next "
        "interaction. Password fields cannot be filled by this tool. Do not use for payments, "
        "deletions, submissions, or other consequential actions without explicit user approval."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": sorted(_ACTIONS)},
            "ref": {"type": "string", "description": "Current element ref from read_preview, e.g. @p1."},
            "text": {"type": "string", "description": "Replacement text for the type action."},
            "key": {"type": "string", "description": "Key for the press action, e.g. Enter or Escape."},
            "delta_y": {"type": "integer", "description": "Vertical pixels for scroll; positive moves down."},
        },
        "required": ["action"],
    },
}


registry.register(
    name="interact_preview",
    toolset="desktop_ui",
    schema=INTERACT_PREVIEW_SCHEMA,
    handler=lambda args, **kw: interact_preview_tool(
        action=args.get("action", ""),
        ref=args.get("ref", ""),
        text=args.get("text"),
        key=args.get("key", ""),
        delta_y=args.get("delta_y"),
        callback=kw.get("callback"),
    ),
    emoji="🖱️",
)
