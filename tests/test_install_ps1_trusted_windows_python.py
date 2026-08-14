"""Windows bootstrap must avoid unsigned uv-managed Python executables.

Enterprise Application Control can allow the Hermes desktop shell while
blocking the unsigned ``python.exe`` distributed by python-build-standalone.
The installer therefore provisions or reuses a Python Software Foundation
signed CPython 3.12 interpreter and gives its exact path to ``uv venv``.
"""

from pathlib import Path

import pytest


INSTALL_PS1 = Path(__file__).resolve().parents[1] / "scripts" / "install.ps1"


@pytest.fixture(scope="module")
def source() -> str:
    return INSTALL_PS1.read_text(encoding="utf-8")


def _function_body(source: str, name: str) -> str:
    start = source.index(f"function {name}")
    brace = source.index("{", start)
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[brace : index + 1]
    raise AssertionError(f"unterminated function body for {name}")


def test_official_python_download_is_pinned_and_publisher_checked(source: str):
    installer = _function_body(source, "Install-WindowsOfficialPython")
    assert "python.org" in installer
    assert "Get-FileHash" in installer and "SHA256" in installer
    assert "Get-AuthenticodeSignature" in installer
    assert "Python Software Foundation" in installer


def test_registered_python_with_missing_files_is_repaired(source: str):
    installer = _function_body(source, "Install-WindowsOfficialPython")
    first_resolve = installer.index("$trustedPython = Resolve-TrustedWindowsPython")
    repair = installer.index('$repairArguments = @("/repair") + $arguments')
    second_resolve = installer.index("$trustedPython = Resolve-TrustedWindowsPython", repair)
    assert first_resolve < repair < second_resolve
    assert "Official Python repair exited with code" in installer


def test_existing_trusted_python_is_reused_across_stage_processes(source: str):
    resolver = _function_body(source, "Resolve-TrustedWindowsPython")
    assert "trusted-python-path.txt" in source
    assert "Get-Content -LiteralPath $marker" in resolver
    assert "PythonCore\\$WindowsOfficialPythonMinor\\InstallPath" in resolver
    assert "Get-Command $commandName -All" in resolver
    assert "Set-Content -LiteralPath $marker" in resolver


def test_windows_venv_uses_exact_trusted_interpreter_path(source: str):
    install_venv = _function_body(source, "Install-Venv")
    resolve_at = install_venv.index("Resolve-TrustedWindowsPython")
    assign_at = install_venv.index("$script:PythonVersion = $trustedPython")
    create_at = install_venv.index("Creating virtual environment with Python")
    assert resolve_at < assign_at < create_at
    assert "& $UvCmd venv venv --python $PythonVersion" in install_venv


def test_windows_python_stage_never_falls_back_to_uv_managed_python(source: str):
    test_python = _function_body(source, "Test-Python")
    windows_branch = test_python.split('if ($env:OS -eq "Windows_NT")', 1)[1]
    assert "Install-WindowsOfficialPython" in windows_branch
    assert "return $false" in windows_branch


def test_windows_stage_reports_the_actual_official_python_version(source: str):
    assert '$PythonStageVersion = if ($env:OS -eq "Windows_NT")' in source
    assert 'Title = "Verifying Python $PythonStageVersion"' in source
    assert 'throw "Python $PythonStageVersion not available"' in source
