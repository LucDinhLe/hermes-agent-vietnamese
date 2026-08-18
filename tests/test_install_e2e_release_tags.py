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
    # WindowsApps exposes a WSL launcher named bash.exe even when no distro is
    # installed; prefer the repository-compatible Git Bash on Windows.
    windows_git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if os.name == "nt" and windows_git_bash.exists():
        return str(windows_git_bash)
    found = shutil.which("bash")
    if found:
        return found
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


def _pick(
    tmp_path: Path,
    tags: list[str],
    count: int = 5,
    exclude: str | None = None,
    published_tags: list[str] | None = None,
) -> list[str]:
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

    args = [
        _bash(),
        _git_bash_path(PICKER),
        "--count",
        str(count),
        "--repo",
        _git_bash_path(repo),
    ]
    if exclude is not None:
        args.extend(["--exclude", exclude])
    if published_tags is not None:
        published_file = tmp_path / "published-tags.txt"
        published_file.write_text(
            "".join(f"{tag}\n" for tag in published_tags), encoding="utf-8"
        )
        args.extend(["--published-tags-file", _git_bash_path(published_file)])

    result = subprocess.run(
        args,
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


def test_current_candidate_is_excluded_from_update_from_matrix(tmp_path: Path):
    picked = _pick(
        tmp_path,
        ["vi-v0.20.0-12", "vi-v0.20.0-14", "vi-v0.20.0-15"],
        exclude="vi-v0.20.0-15",
    )

    assert picked == ["vi-v0.20.0-12", "vi-v0.20.0-14"]


def test_drafts_and_failed_candidates_are_not_update_sources(tmp_path: Path):
    picked = _pick(
        tmp_path,
        [
            "vi-v0.20.0-14",
            "vi-v0.20.0-25",
            "vi-v0.20.0-27",
            "vi-v0.20.4-31",
        ],
        published_tags=["vi-v0.20.0-14", "vi-v0.20.0-25"],
    )

    assert picked == ["vi-v0.20.0-14", "vi-v0.20.0-25"]


def test_workflow_triggers_fork_tags_and_has_diagnostic_job():
    workflow = (REPO_ROOT / ".github" / "workflows" / "install-e2e.yml").read_text(
        encoding="utf-8"
    )

    assert "- 'vi-v*'" in workflow
    assert "diagnostics:" in workflow
    assert "needs: diagnostics" in workflow
    assert "inputs['tag-count']" in workflow
    assert "inputs.tag-count" not in workflow
    assert '--exclude "$EXCLUDE_TAG"' in workflow
    assert "select(.draft == false)" in workflow
    assert '--published-tags-file "$published_tags_file"' in workflow

    reusable = (REPO_ROOT / ".github" / "workflows" / "install-e2e-run.yml").read_text(
        encoding="utf-8"
    )
    assert "HERMES_DEV_SANDBOX_UPSTREAM:" in reusable
    assert "github.com/${{ github.repository }}.git" in reusable


def test_installer_rerun_keeps_https_git_fetches_inside_fake_remote():
    stage2 = (
        REPO_ROOT / "scripts" / "sandbox" / "stage2-run.sh"
    ).read_text(encoding="utf-8")

    assert "--setenv GIT_CONFIG_COUNT 1" in stage2
    assert "--setenv GIT_CONFIG_KEY_0 'url.git@github.com:.insteadOf'" in stage2
    assert "--setenv GIT_CONFIG_VALUE_0 'https://github.com/'" in stage2
    assert '"${git_env[@]}"' in stage2
