"""Behavior contract for release tags sampled by install/update E2E."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
PICKER = REPO_ROOT / "scripts" / "sandbox" / "pick-release-tags.sh"


def _bash() -> str:
    found = shutil.which("bash")
    if found:
        return found
    windows_git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if windows_git_bash.exists():
        return str(windows_git_bash)
    pytest.skip("bash is required to exercise the release-tag picker")


def _git_bash_path(path: Path) -> str:
    """Translate a Windows path for Git Bash; leave POSIX paths unchanged."""
    resolved = path.resolve()
    if resolved.drive:
        drive = resolved.drive.rstrip(":").lower()
        tail = resolved.as_posix().split(":", 1)[1]
        return f"/{drive}{tail}"
    return resolved.as_posix()


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", f"safe.directory={repo.as_posix()}", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    )


def _pick(tmp_path: Path, tags: list[str], count: int = 5) -> list[str]:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "config", "user.name", "E2E Contract")
    _git(repo, "config", "user.email", "e2e-contract@example.invalid")
    (repo / "README").write_text("fixture\n", encoding="utf-8")
    _git(repo, "add", "README")
    _git(repo, "commit", "-m", "fixture")
    for tag in tags:
        _git(repo, "tag", tag)

    env = os.environ.copy()
    git_usr_bin = Path(r"C:\Program Files\Git\usr\bin")
    if git_usr_bin.exists():
        env["PATH"] = os.pathsep.join([str(git_usr_bin), env.get("PATH", "")])

    result = subprocess.run(
        [
            _bash(),
            _git_bash_path(PICKER),
            "--count",
            str(count),
            "--repo",
            _git_bash_path(repo),
        ],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_fork_release_tags_take_precedence_when_present(tmp_path: Path):
    picked = _pick(
        tmp_path,
        [
            "v2026.8.1",
            "v2026.8.2",
            "vi-v0.20.0-12",
            "vi-v0.20.0-13",
            "vi-v0.20.0-14",
        ],
    )

    assert picked == ["vi-v0.20.0-12", "vi-v0.20.0-13", "vi-v0.20.0-14"]


def test_upstream_release_tags_remain_supported(tmp_path: Path):
    picked = _pick(tmp_path, ["backup/test", "v2026.7.9", "v2026.8.1", "v2026.8.2"])

    assert picked == ["v2026.7.9", "v2026.8.1", "v2026.8.2"]


def test_count_one_selects_newest_fork_release(tmp_path: Path):
    picked = _pick(tmp_path, ["vi-v0.20.0-9", "vi-v0.20.0-14"], count=1)

    assert picked == ["vi-v0.20.0-14"]


def test_workflow_triggers_fork_tags_and_has_diagnostic_job():
    workflow = (REPO_ROOT / ".github" / "workflows" / "install-e2e.yml").read_text(
        encoding="utf-8"
    )

    assert "- 'vi-v*'" in workflow
    assert "diagnostics:" in workflow
    assert "needs: diagnostics" in workflow
    assert "inputs['tag-count']" in workflow
    assert "inputs.tag-count" not in workflow
