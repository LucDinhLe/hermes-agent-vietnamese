from __future__ import annotations

import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile

import pytest


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "scripts" / "install.sh"
TRANSACTION_HELPER = ROOT / "scripts" / "lib" / "venv-transaction.sh"


def _bash_path(path: Path) -> str:
    posix = path.as_posix()
    if os.name == "nt" and path.drive:
        return f"/{path.drive[0].lower()}{posix[2:]}"
    return posix


def test_installer_never_deletes_the_active_venv_before_replacement() -> None:
    source = INSTALLER.read_text(encoding="utf-8")

    assert 'local candidate="$INSTALL_DIR/venv.new.' in source
    assert 'hermes_venv_cutover_candidate "$candidate"' in source
    assert "hermes_venv_commit_pending" in source
    assert "hermes_venv_restore_pending" in source
    assert "rm -rf venv" not in source
    assert 'rm -rf "$INSTALL_DIR/venv"' not in source


def test_transaction_helper_rolls_back_and_commits_only_after_explicit_decision() -> None:
    if os.name == "nt":
        pytest.skip("transaction execution is gated on native POSIX release runners")
    bash = shutil.which("bash")
    if bash is None:
        pytest.skip("bash is unavailable on this host")

    with tempfile.TemporaryDirectory(prefix=".venv-transaction-", dir=ROOT) as temp_dir:
        install_dir = Path(temp_dir) / "install"
        install_dir.mkdir()
        helper = _bash_path(TRANSACTION_HELPER)
        install = _bash_path(install_dir)
        script = f"""
set -eu
INSTALL_DIR={shlex.quote(install)}
. {shlex.quote(helper)}

make_python() {{
  target="$1"
  label="$2"
  mkdir -p "$target/bin"
  printf '#!/bin/sh\nprintf "%%s\\n" "%s"\n' "$label" > "$target/bin/python"
  chmod +x "$target/bin/python"
}}

make_python "$INSTALL_DIR/venv" old
make_python "$INSTALL_DIR/venv.new.rollback" new
hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.rollback"
test "$("$INSTALL_DIR/venv/bin/python")" = new
test -f "$INSTALL_DIR/venv.pending-backup"
test "$(find "$INSTALL_DIR" -maxdepth 1 -type d -name 'venv.stale.*' | wc -l | tr -d ' ')" = 1
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = old
test ! -e "$INSTALL_DIR/venv.pending-backup"

make_python "$INSTALL_DIR/venv.new.commit" committed
hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.commit"
test "$("$INSTALL_DIR/venv/bin/python")" = committed
test -f "$INSTALL_DIR/venv.pending-backup"
hermes_venv_commit_pending
test "$("$INSTALL_DIR/venv/bin/python")" = committed
test ! -e "$INSTALL_DIR/venv.pending-backup"
test "$(find "$INSTALL_DIR" -maxdepth 1 -type d -name 'venv.stale.*' | wc -l | tr -d ' ')" = 0

make_python "$INSTALL_DIR/venv.new.invalid" invalid
rm "$INSTALL_DIR/venv.new.invalid/bin/python"
if hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.invalid"; then
  echo 'invalid candidate unexpectedly cut over' >&2
  exit 1
fi
test "$("$INSTALL_DIR/venv/bin/python")" = committed
"""

        completed = subprocess.run(
            [bash, "-c", script],
            check=False,
            capture_output=True,
            text=True,
        )
        assert completed.returncode == 0, completed.stderr
