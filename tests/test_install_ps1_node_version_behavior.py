"""Native Windows behavior contract for install.ps1's Node postcondition."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
INSTALLER = REPO_ROOT / "scripts" / "install.ps1"


def _probe(version: str, sandbox: Path) -> dict:
    powershell = shutil.which("powershell.exe") or shutil.which("pwsh.exe")
    assert powershell, "Windows PowerShell is required on the windows_only lane"
    env = {
        **os.environ,
        "HERMES_HOME": str(sandbox / "hermes-home"),
        "LOCALAPPDATA": str(sandbox / "local-app-data"),
        "USERPROFILE": str(sandbox / "profile"),
    }
    result = subprocess.run(
        [
            powershell,
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(INSTALLER),
            "-CheckNodeVersion",
            version,
        ],
        cwd=sandbox,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    assert lines, "install.ps1 produced no Node policy result"
    return json.loads(lines[-1])


@pytest.mark.windows_only
@pytest.mark.parametrize(
    ("version", "accepted"),
    [("v25.9.0", False), ("v26.0.0", True), ("v27.1.2", True), ("garbage", False)],
)
def test_node_postcondition_executes_version_and_path_policy(
    version: str, accepted: bool, tmp_path: Path
) -> None:
    result = _probe(version, tmp_path)
    assert result == {
        "accepted": accepted,
        "ensured_path": accepted,
        "version": version,
    }
