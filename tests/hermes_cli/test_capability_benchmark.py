from __future__ import annotations

from pathlib import Path
import socket

from hermes_cli.capability_benchmark import run_capability_benchmark


def _skill(root: Path, category: str, name: str, description: str) -> None:
    skill_dir = root / category / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        "---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        "platforms: [linux, macos, windows]\n"
        "---\n"
        f"# {name}\n",
        encoding="utf-8",
    )


def test_exact_scope_benchmark_is_offline_bounded_and_receipt_stable(tmp_path):
    home = tmp_path / "isolated-hermes-home"
    skills_dir = home / "skills"
    names = [
        "codebase-inspection",
        "systematic-debugging",
        "test-driven-development",
        "github-code-review",
        "document-to-action-items",
        "grounded-citations",
        "session-librarian",
        "obsidian",
        "pdf",
        "docx",
    ]
    for index, name in enumerate(names):
        _skill(
            skills_dir,
            "software-development" if index < 4 else "documents",
            name,
            f"Deterministic description for {name} and offline benchmark evidence.",
        )

    calls = {"main": 0, "tool": 0, "subagent": 0, "background_review": 0}

    def mock_main_response(prompt: str) -> str:
        calls["main"] += 1
        return f"echo: {prompt}"

    report = run_capability_benchmark(
        skills_dir=skills_dir,
        parent_skills=names[:6],
        session_skills=names[:6],
        child_skills=names[1:5],
        simple_prompt="Xin chao",
        main_responder=mock_main_response,
        activity_counters=calls,
    )

    scopes = report["skill_scopes"]
    assert report["methodology"] == {
        "offline": True,
        "provider_calls": 0,
        "network_calls": 0,
        "process_calls": 0,
        "token_measurement": "Hermes rough preflight estimate",
    }
    assert scopes["full_catalog"]["skill_count"] == len(names)
    assert scopes["parent"]["skill_count"] == 6
    assert scopes["session"]["skill_count"] == 6
    assert scopes["child"]["skill_count"] == 4
    assert 3 <= scopes["parent"]["skill_count"] <= 8
    assert 3 <= scopes["child"]["skill_count"] <= 8
    assert scopes["full_catalog"]["chars"] > scopes["parent"]["chars"]
    assert scopes["parent"]["chars"] == scopes["session"]["chars"]
    assert scopes["parent"]["tokens_estimate"] == scopes["session"]["tokens_estimate"]
    assert scopes["parent"]["selection_hash"] == scopes["session"]["selection_hash"]
    assert scopes["parent"]["selection_hash"] != scopes["child"]["selection_hash"]

    assert report["simple_prompt"] == {
        "prompt": "Xin chao",
        "response": "echo: Xin chao",
        "main_responses": 1,
        "tool_calls": 0,
        "subagent_calls": 0,
        "background_reviews": 0,
    }
    assert calls == {"main": 1, "tool": 0, "subagent": 0, "background_review": 0}


def test_benchmark_rejects_out_of_range_task_receipts(tmp_path):
    skills_dir = tmp_path / "home" / "skills"
    for name in ("one", "two", "three"):
        _skill(skills_dir, "test", name, name)

    try:
        run_capability_benchmark(
            skills_dir=skills_dir,
            parent_skills=("one", "two"),
            session_skills=("one", "two"),
            child_skills=("one", "two", "three"),
            simple_prompt="hello",
            main_responder=lambda _prompt: "hello",
        )
    except ValueError as exc:
        assert "parent_skills must contain 3-8" in str(exc)
    else:
        raise AssertionError("benchmark accepted an undersized parent receipt")


def test_benchmark_blocks_raw_network_from_the_mock_boundary(tmp_path):
    skills_dir = tmp_path / "home" / "skills"
    for name in ("one", "two", "three"):
        _skill(skills_dir, "test", name, name)

    def network_attempt(_prompt: str) -> str:
        with socket.socket() as client:
            client.connect(("127.0.0.1", 9))
        return "unreachable"

    try:
        run_capability_benchmark(
            skills_dir=skills_dir,
            parent_skills=("one", "two", "three"),
            session_skills=("one", "two", "three"),
            child_skills=("one", "two", "three"),
            simple_prompt="hello",
            main_responder=network_attempt,
        )
    except RuntimeError as exc:
        assert "blocked network access" in str(exc)
    else:
        raise AssertionError("benchmark allowed raw socket access")
