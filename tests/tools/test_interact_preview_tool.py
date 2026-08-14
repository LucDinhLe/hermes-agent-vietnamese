"""Tests for the shared Desktop preview interaction bridge."""

import json

from tools import interact_preview_tool as ip
from tools.registry import registry


def test_lives_in_desktop_ui_toolset():
    entry = registry.get_entry("interact_preview")

    assert entry is not None
    assert entry.toolset == "desktop_ui"


def test_requires_desktop_callback():
    result = json.loads(ip.interact_preview_tool(action="reload", callback=None))

    assert "desktop" in result["error"]


def test_validates_action_arguments():
    assert "ref" in json.loads(ip.interact_preview_tool(action="click", callback=lambda **_: "{}"))["error"]
    assert "text" in json.loads(
        ip.interact_preview_tool(action="type", ref="@p1", callback=lambda **_: "{}")
    )["error"]
    assert "key" in json.loads(ip.interact_preview_tool(action="press", callback=lambda **_: "{}"))["error"]
    assert "action" in json.loads(ip.interact_preview_tool(action="launch", callback=lambda **_: "{}"))["error"]


def test_forwards_normalized_payload_and_json_result():
    seen = {}

    def callback(**kwargs):
        seen.update(kwargs)
        return json.dumps({"ok": True, "action": kwargs["action"]})

    result = json.loads(
        ip.interact_preview_tool(
            action="type",
            ref="p3",
            text="xin chao",
            callback=callback,
        )
    )

    assert seen == {"action": "type", "ref": "@p3", "text": "xin chao"}
    assert result == {"ok": True, "action": "type"}


def test_scroll_defaults_and_clamps_delta():
    seen = {}

    ip.interact_preview_tool(action="scroll", delta_y=99999, callback=lambda **kw: seen.update(kw) or "{}")

    assert seen == {"action": "scroll", "delta_y": 5000}


def test_callback_failure_is_reported():
    def boom(**_kwargs):
        raise RuntimeError("renderer disappeared")

    result = json.loads(ip.interact_preview_tool(action="reload", callback=boom))

    assert "renderer disappeared" in result["error"]
