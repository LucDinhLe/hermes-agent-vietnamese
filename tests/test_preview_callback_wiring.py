"""Regression coverage for desktop preview callback wiring."""

import ast
from pathlib import Path


def test_aiagent_forwards_interact_preview_callback():
    tree = ast.parse(Path("run_agent.py").read_text(encoding="utf-8"))
    aiagent = next(
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "AIAgent"
    )
    init = next(
        node for node in aiagent.body if isinstance(node, ast.FunctionDef) and node.name == "__init__"
    )

    assert "interact_preview_callback" in {arg.arg for arg in init.args.args}

    forwarded = [
        keyword
        for node in ast.walk(init)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "init_agent"
        for keyword in node.keywords
        if keyword.arg == "interact_preview_callback"
    ]
    assert len(forwarded) == 1
    assert isinstance(forwarded[0].value, ast.Name)
    assert forwarded[0].value.id == "interact_preview_callback"
