"""Regression: public managed installs must not depend on GitHub SSH trust.

Older installers tried SSH before HTTPS, so a successful first clone retained
an SSH ``origin``. A later non-interactive desktop update could then fail with
``Host key verification failed`` before bootstrap started. Both platform
installers now repair only the official repo to anonymous HTTPS while leaving
forks and custom remotes alone.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"
INSTALL_PS1 = REPO_ROOT / "scripts" / "install.ps1"
PUBLIC_HTTPS = "https://github.com/LucDinhLe/hermes-agent-vietnamese.git"


def _bash_executable() -> str | None:
    discovered = shutil.which("bash")
    if discovered:
        return discovered
    git_bash = Path("C:/Program Files/Git/bin/bash.exe")
    return str(git_bash) if git_bash.exists() else None


def _function(text: str, name: str, next_name: str | None = None) -> str:
    end = rf"(?=^\s*{re.escape(next_name)}\(\) \{{)" if next_name else r"\Z"
    match = re.search(
        rf"^{re.escape(name)}\(\) \{{.*?^\}}\n{end}",
        text,
        re.MULTILINE | re.DOTALL,
    )
    assert match is not None, f"{name} function not found"
    return match.group(0)


def _shell_helper_source() -> str:
    text = INSTALL_SH.read_text(encoding="utf-8")
    detector = _function(
        text, "is_official_ssh_remote", "use_public_https_origin_for_managed_install"
    )
    repair = _function(
        text, "use_public_https_origin_for_managed_install", "clone_repo"
    )
    return detector + "\n" + repair


@pytest.mark.skipif(
    shutil.which("git") is None or _bash_executable() is None,
    reason="needs git and bash",
)
@pytest.mark.live_system_guard_bypass  # operates only on the tmp_path checkout
@pytest.mark.parametrize(
    "remote",
    [
        "git@github.com:LucDinhLe/hermes-agent-vietnamese.git",
        "git@github.com:lucdinhle/hermes-agent-vietnamese",
        "ssh://git@github.com/LucDinhLe/hermes-agent-vietnamese.git",
    ],
)
def test_install_sh_repairs_official_ssh_origin(tmp_path: Path, remote: str) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "remote", "add", "origin", remote], cwd=repo, check=True)

    script = "\n".join([
        "set -e",
        f'REPO_URL_HTTPS="{PUBLIC_HTTPS}"',
        'log_info() { printf "%s\\n" "$*"; }',
        _shell_helper_source(),
        f'cd "{repo.as_posix()}"',
        "use_public_https_origin_for_managed_install",
        "git remote get-url origin",
    ])
    result = subprocess.run(
        [_bash_executable(), "-c", script],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.splitlines()[-1] == PUBLIC_HTTPS
    assert "Switching the public Hermes update remote" in result.stdout


@pytest.mark.skipif(
    shutil.which("git") is None or _bash_executable() is None,
    reason="needs git and bash",
)
@pytest.mark.live_system_guard_bypass  # operates only on the tmp_path checkout
def test_install_sh_preserves_custom_origin(tmp_path: Path) -> None:
    custom = "git@github.com:another-owner/hermes-agent-vietnamese.git"
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "remote", "add", "origin", custom], cwd=repo, check=True)

    script = "\n".join([
        "set -e",
        f'REPO_URL_HTTPS="{PUBLIC_HTTPS}"',
        'log_info() { printf "%s\\n" "$*"; }',
        _shell_helper_source(),
        f'cd "{repo.as_posix()}"',
        "use_public_https_origin_for_managed_install",
        "git remote get-url origin",
    ])
    result = subprocess.run(
        [_bash_executable(), "-c", script],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == custom


def test_install_ps1_has_equivalent_scoped_repair() -> None:
    text = INSTALL_PS1.read_text(encoding="utf-8")
    detector = re.search(
        r"function Test-OfficialSshRemote \{(?P<body>.*?)^\}",
        text,
        re.MULTILINE | re.DOTALL,
    )
    repair = re.search(
        r"function Use-PublicHttpsOriginForManagedInstall \{(?P<body>.*?)^\}",
        text,
        re.MULTILINE | re.DOTALL,
    )
    assert detector is not None and repair is not None

    detector_body = detector["body"]
    repair_body = repair["body"]
    assert "git@github.com:LucDinhLe/hermes-agent-vietnamese" in detector_body
    assert "ssh://git@github.com/LucDinhLe/hermes-agent-vietnamese" in detector_body
    assert "remote get-url origin" in repair_body
    assert "Test-OfficialSshRemote $originUrl" in repair_body
    assert "remote set-url origin $RepoUrlHttps" in repair_body


def test_repair_happens_before_autostash_and_fetch_on_both_platforms() -> None:
    shell = INSTALL_SH.read_text(encoding="utf-8")
    shell_update = shell[
        shell.index('log_info "Existing installation found, updating..."') :
    ]
    assert shell_update.index(
        "use_public_https_origin_for_managed_install"
    ) < shell_update.index("git status --porcelain")
    assert shell_update.index(
        "use_public_https_origin_for_managed_install"
    ) < shell_update.index('git fetch "${branch_fetch_args[@]}" origin "$BRANCH"')

    powershell = INSTALL_PS1.read_text(encoding="utf-8")
    ps_update = powershell[
        powershell.index('Write-Info "Existing installation found, updating..."') :
    ]
    assert ps_update.index("Use-PublicHttpsOriginForManagedInstall") < ps_update.index(
        "status --porcelain"
    )
    assert ps_update.index("Use-PublicHttpsOriginForManagedInstall") < ps_update.index(
        "@branchFetchArgs"
    )


def test_shallow_repository_fetches_are_bounded_on_both_platforms() -> None:
    shell = INSTALL_SH.read_text(encoding="utf-8")
    assert 'git rev-parse --is-shallow-repository' in shell
    assert 'branch_fetch_args=(--depth 64)' in shell
    assert 'pin_fetch_args=(--depth 64)' in shell

    powershell = INSTALL_PS1.read_text(encoding="utf-8")
    assert 'rev-parse --is-shallow-repository' in powershell
    assert '$branchFetchArgs += @("--depth", "64")' in powershell
    assert '$commitFetchArgs += @("--depth", "64")' in powershell
    assert '$pinFetchArgs += @("--depth", "64")' in powershell


def test_fresh_clone_prefers_public_https_on_both_platforms() -> None:
    shell = INSTALL_SH.read_text(encoding="utf-8")
    shell_fresh = shell[shell.index('log_info "Trying HTTPS clone..."') :]
    assert shell_fresh.index('"$REPO_URL_HTTPS"') < shell_fresh.index('"$REPO_URL_SSH"')

    powershell = INSTALL_PS1.read_text(encoding="utf-8")
    ps_fresh = powershell[powershell.index('Write-Info "Trying HTTPS clone..."') :]
    assert ps_fresh.index("$RepoUrlHttps") < ps_fresh.index("$RepoUrlSsh")
