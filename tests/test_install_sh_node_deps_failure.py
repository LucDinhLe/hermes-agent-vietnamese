"""Behavioral coverage for required Node dependency installation."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")
    path.chmod(0o755)


def _run_node_deps_stage(
    tmp_path: Path,
    *,
    fail_directory: str | None,
    stale_node_stage: bool = False,
) -> tuple[subprocess.CompletedProcess[str], Path, list[str]]:
    install_dir = tmp_path / "install"
    tui_dir = install_dir / "ui-tui"
    bin_dir = tmp_path / "bin"
    hermes_home = tmp_path / "home"
    managed_bin = hermes_home / "bin"
    npm_calls = tmp_path / "npm-calls"

    tui_dir.mkdir(parents=True)
    bin_dir.mkdir()
    managed_bin.mkdir(parents=True)
    (install_dir / "package.json").write_text(
        '{"name":"installer-regression-probe","private":true}\n',
        encoding="utf-8",
    )
    (tui_dir / "package.json").write_text(
        '{"name":"tui-regression-probe","private":true}\n',
        encoding="utf-8",
    )
    stale_stage_dir = install_dir / "node_modules" / ".ink-stale123"
    if stale_node_stage:
        package_dir = install_dir / "node_modules" / "ink"
        package_dir.mkdir(parents=True)
        (package_dir / "package.json").write_text("{}\n", encoding="utf-8")
        stale_stage_dir.mkdir(parents=True)
        (stale_stage_dir / "partial-package").write_text("partial\n", encoding="utf-8")
        unrelated_stage_dir = install_dir / "node_modules" / ".ghost-stale123"
        unrelated_stage_dir.mkdir()
        (unrelated_stage_dir / "keep").write_text("keep\n", encoding="utf-8")
        keep_dir = install_dir / "node_modules" / ".bin"
        keep_dir.mkdir()
        (keep_dir / "keep").write_text("keep\n", encoding="utf-8")
    _write_executable(bin_dir / "node", "#!/bin/sh\necho v26.0.0\n")
    _write_executable(
        bin_dir / "npm",
        """#!/bin/sh
if [ "${1:-}" = "--version" ]; then
    echo 12.0.0
    exit 0
fi
printf '%s\\n' "$PWD" >> "$NPM_CALLS"
if [ -n "${NPM_STALE_DIRECTORY:-}" ] && [ -e "$NPM_STALE_DIRECTORY" ]; then
    echo "stale npm rename directory was not removed" >&2
    exit 66
fi
if [ -n "${NPM_FAIL_DIRECTORY:-}" ] && [ "$PWD" = "$NPM_FAIL_DIRECTORY" ]; then
    echo "simulated npm lifecycle failure" >&2
    exit 37
fi
exit 0
""",
    )
    _write_executable(managed_bin / "uv", "#!/bin/sh\necho 'uv probe'\n")

    env = os.environ.copy()
    env.update(
        {
            "HERMES_HOME": str(hermes_home),
            "HERMES_INSTALL_DIR": str(install_dir),
            "NPM_CALLS": str(npm_calls),
            "NPM_FAIL_DIRECTORY": fail_directory or "",
            "NPM_STALE_DIRECTORY": str(stale_stage_dir) if stale_node_stage else "",
            "PATH": f"{bin_dir}:{env['PATH']}",
        }
    )
    proc = subprocess.run(
        [
            "bash",
            str(INSTALL_SH),
            "--stage",
            "node-deps",
            "--json",
            "--skip-browser",
            "--skip-computer-use",
        ],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert npm_calls.is_file(), f"installer did not invoke npm:\n{proc.stdout}\n{proc.stderr}"
    calls = npm_calls.read_text(encoding="utf-8").splitlines()
    return proc, install_dir, calls


def _stage_result(proc: subprocess.CompletedProcess[str]) -> dict[str, object]:
    return json.loads(proc.stdout.splitlines()[-1])


@pytest.mark.linux_only
def test_root_node_dependency_failure_is_fatal(tmp_path: Path) -> None:
    install_dir = tmp_path / "install"
    proc, actual_install_dir, calls = _run_node_deps_stage(
        tmp_path,
        fail_directory=str(install_dir),
    )

    assert actual_install_dir == install_dir
    assert proc.returncode != 0
    assert _stage_result(proc) == {
        "ok": False,
        "stage": "node-deps",
        "skipped": False,
        "reason": "exit code 1",
    }
    assert calls == [str(install_dir)]
    assert "Node.js dependencies installed" not in proc.stdout
    assert "TUI dependencies installed" not in proc.stdout
    assert not (install_dir / "node_modules").exists()


@pytest.mark.linux_only
def test_tui_dependencies_are_part_of_the_scoped_root_install(tmp_path: Path) -> None:
    install_dir = tmp_path / "install"
    tui_dir = install_dir / "ui-tui"
    proc, _, calls = _run_node_deps_stage(
        tmp_path,
        fail_directory=str(tui_dir),
    )

    assert proc.returncode == 0, proc.stderr
    assert _stage_result(proc)["ok"] is True
    assert calls == [str(install_dir)]
    assert "Node.js dependencies installed" in proc.stdout
    assert "TUI dependencies installed" in proc.stdout


@pytest.mark.linux_only
def test_node_dependency_success_remains_successful(tmp_path: Path) -> None:
    proc, install_dir, calls = _run_node_deps_stage(
        tmp_path,
        fail_directory=None,
    )

    assert proc.returncode == 0, proc.stderr
    assert _stage_result(proc) == {
        "ok": True,
        "stage": "node-deps",
        "skipped": False,
    }
    assert calls == [str(install_dir)]
    assert "Node.js dependencies installed" in proc.stdout
    assert "TUI dependencies installed" in proc.stdout


@pytest.mark.linux_only
def test_stale_npm_rename_directory_is_cleaned_before_install(tmp_path: Path) -> None:
    proc, install_dir, calls = _run_node_deps_stage(
        tmp_path,
        fail_directory=None,
        stale_node_stage=True,
    )

    assert proc.returncode == 0, proc.stderr
    assert _stage_result(proc)["ok"] is True
    assert calls == [str(install_dir)]
    assert not (install_dir / "node_modules" / ".ink-stale123").exists()
    assert (install_dir / "node_modules" / ".ghost-stale123" / "keep").is_file()
    assert (install_dir / "node_modules" / ".bin" / "keep").is_file()


def test_node_dependency_install_excludes_desktop_workspace() -> None:
    text = INSTALL_SH.read_text(encoding="utf-8")

    assert "--workspace ui-tui --workspace web --include-workspace-root" in text
    assert "--workspace apps/desktop" not in text
    assert "npm install --silent" not in text
    assert "npm install --loglevel=warn" in text
