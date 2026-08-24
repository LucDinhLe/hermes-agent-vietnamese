from __future__ import annotations

import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile

import pytest


ROOT = Path(__file__).resolve().parents[1]
TRANSACTION_HELPER = ROOT / "scripts" / "lib" / "venv-transaction.sh"


def _bash_path(path: Path) -> str:
    posix = path.as_posix()
    if os.name == "nt" and path.drive:
        return f"/{path.drive[0].lower()}{posix[2:]}"
    return posix


def _bash() -> str:
    executable = shutil.which("bash")
    if executable is None and os.name == "nt":
        git_bash = (
            Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
            / "Git"
            / "bin"
            / "bash.exe"
        )
        if git_bash.is_file():
            executable = str(git_bash)
    if executable is None:
        pytest.skip("bash is unavailable on this host")
    return executable


def _run_transaction_script(body: str) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory(prefix=".venv-transaction-") as temp_dir:
        install_dir = Path(temp_dir) / "install"
        install_dir.mkdir()
        child_env = os.environ.copy()
        if os.name == "nt":
            child_env["HERMES_TEST_INSTALL_NATIVE"] = str(install_dir)
            child_env["HERMES_TEST_HELPER_NATIVE"] = str(TRANSACTION_HELPER)
            install_assignment = 'INSTALL_DIR="$(cygpath -u "$HERMES_TEST_INSTALL_NATIVE")"'
            helper_source = '. "$(cygpath -u "$HERMES_TEST_HELPER_NATIVE")"'
        else:
            install_assignment = f"INSTALL_DIR={shlex.quote(_bash_path(install_dir))}"
            helper_source = f". {shlex.quote(_bash_path(TRANSACTION_HELPER))}"
        script = f"""
set -eu
{install_assignment}
{helper_source}

# These tests verify state-machine ordering, not the host's sync utility. The
# ordering-specific case below counts calls to this override explicitly.
sync() {{ :; }}

make_python() {{
  target="$1"
  label="$2"
  mkdir -p "$target/bin"
  printf '#!/bin/sh\nprintf "%%s\\n" "%s"\n' "$label" > "$target/bin/python"
  chmod +x "$target/bin/python"
}}

write_journal() {{
  phase="$1"
  backup="$2"
  candidate="$3"
  failed="$4"
  printf '%s\n%s\n%s\n%s\n%s\n' \\
    'HERMES_VENV_TRANSACTION_V2' "$phase" "$backup" "$candidate" "$failed" \\
    > "$INSTALL_DIR/venv.pending-backup"
}}

assert_no_transaction_paths() {{
  test ! -e "$INSTALL_DIR/venv.pending-backup"
  test "$(find "$INSTALL_DIR" -maxdepth 1 -name 'venv.stale.*' | wc -l | tr -d ' ')" = 0
  test "$(find "$INSTALL_DIR" -maxdepth 1 -name 'venv.new.*' | wc -l | tr -d ' ')" = 0
  test "$(find "$INSTALL_DIR" -maxdepth 1 -name 'venv.failed.*' | wc -l | tr -d ' ')" = 0
}}

{body}
"""
        return subprocess.run(
            [_bash(), "-c", script],
            check=False,
            capture_output=True,
            text=True,
            env=child_env,
        )


def test_transaction_helper_has_valid_bash_syntax() -> None:
    completed = subprocess.run(
        [_bash(), "-n", str(TRANSACTION_HELPER)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize(
    ("phase", "layout"),
    [
        ("PREPARED", "before-live-move"),
        ("PREPARED", "after-live-move"),
        ("BACKED_UP", "before-candidate-move"),
        ("BACKED_UP", "after-candidate-move"),
        ("ACTIVATED", "awaiting-probe"),
        ("ROLLING_BACK", "before-quarantine"),
        ("ROLLING_BACK", "after-quarantine"),
        ("ROLLING_BACK", "after-restore"),
    ],
)
def test_interrupted_cutover_restores_last_known_good(
    phase: str,
    layout: str,
) -> None:
    setup_by_layout = {
        "before-live-move": """
make_python "$INSTALL_DIR/venv" old
make_python "$INSTALL_DIR/venv.new.txn" new
""",
        "after-live-move": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv.new.txn" new
""",
        "before-candidate-move": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv.new.txn" new
""",
        "after-candidate-move": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv" new
""",
        "awaiting-probe": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv" new
""",
        "before-quarantine": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv" new
""",
        "after-quarantine": """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv.failed.txn" new
""",
        "after-restore": """
make_python "$INSTALL_DIR/venv" old
make_python "$INSTALL_DIR/venv.failed.txn" new
""",
    }
    failed = "venv.failed.txn" if phase == "ROLLING_BACK" else "NONE"
    completed = _run_transaction_script(
        f"""
{setup_by_layout[layout]}
write_journal {phase} venv.stale.txn venv.new.txn {failed}
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = old
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize(
    ("phase", "layout"),
    [
        ("PREPARED", "candidate"),
        ("BACKED_UP", "candidate"),
        ("BACKED_UP", "activated"),
        ("ACTIVATED", "activated"),
        ("ROLLING_BACK", "quarantined"),
    ],
)
def test_interrupted_first_install_restores_recorded_absence(
    phase: str,
    layout: str,
) -> None:
    setup_by_layout = {
        "candidate": 'make_python "$INSTALL_DIR/venv.new.txn" new',
        "activated": 'make_python "$INSTALL_DIR/venv" new',
        "quarantined": 'make_python "$INSTALL_DIR/venv.failed.txn" new',
    }
    failed = "venv.failed.txn" if phase == "ROLLING_BACK" else "NONE"
    completed = _run_transaction_script(
        f"""
{setup_by_layout[layout]}
write_journal {phase} NONE venv.new.txn {failed}
hermes_venv_restore_pending
test ! -e "$INSTALL_DIR/venv"
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize("backup_present", [True, False])
def test_interrupted_commit_keeps_validated_candidate(backup_present: bool) -> None:
    backup = (
        'make_python "$INSTALL_DIR/venv.stale.txn" old'
        if backup_present
        else ""
    )
    completed = _run_transaction_script(
        f"""
make_python "$INSTALL_DIR/venv" committed
{backup}
write_journal COMMITTED venv.stale.txn venv.new.txn NONE
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = committed
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


def test_interrupted_first_install_commit_keeps_validated_candidate() -> None:
    completed = _run_transaction_script(
        """
make_python "$INSTALL_DIR/venv" committed
write_journal COMMITTED NONE venv.new.txn NONE
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = committed
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize("backup", ["venv.stale.txn", "NONE"])
def test_legacy_one_line_marker_rolls_back(backup: str) -> None:
    old_setup = (
        'make_python "$INSTALL_DIR/venv.stale.txn" old'
        if backup != "NONE"
        else ""
    )
    final_assertion = (
        'test "$("$INSTALL_DIR/venv/bin/python")" = old'
        if backup != "NONE"
        else 'test ! -e "$INSTALL_DIR/venv"'
    )
    completed = _run_transaction_script(
        f"""
{old_setup}
make_python "$INSTALL_DIR/venv" new
printf '%s\n' {backup} > "$INSTALL_DIR/venv.pending-backup"
hermes_venv_restore_pending
{final_assertion}
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


def test_cutover_and_commit_persist_decisions_before_path_mutation() -> None:
    completed = _run_transaction_script(
        """
make_python "$INSTALL_DIR/venv" old
make_python "$INSTALL_DIR/venv.new.order" new

SYNC_COUNT=0
sync() { SYNC_COUNT=$((SYNC_COUNT + 1)); }
mv() {
  if [ "$1" = "$INSTALL_DIR/venv" ]; then
    _hermes_venv_read_journal
    test "$_HERMES_VENV_TXN_PHASE" = PREPARED
    test "$SYNC_COUNT" -ge 2
  elif [ "$1" = "$INSTALL_DIR/venv.new.order" ]; then
    _hermes_venv_read_journal
    test "$_HERMES_VENV_TXN_PHASE" = BACKED_UP
    test "$SYNC_COUNT" -ge 5
  fi
  command mv "$@"
}
rm() {
  for target in "$@"; do
    case "$target" in
      "$INSTALL_DIR"/venv.stale.*)
        _hermes_venv_read_journal
        test "$_HERMES_VENV_TXN_PHASE" = COMMITTED
        test "$SYNC_COUNT" -ge 9
        ;;
    esac
  done
  command rm "$@"
}

hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.order"
_hermes_venv_read_journal
test "$_HERMES_VENV_TXN_PHASE" = ACTIVATED
test "$("$INSTALL_DIR/venv/bin/python")" = new
hermes_venv_commit_pending
test "$("$INSTALL_DIR/venv/bin/python")" = new
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


def test_transaction_helper_rolls_back_and_commits_only_after_explicit_decision() -> None:
    completed = _run_transaction_script(
        """
make_python "$INSTALL_DIR/venv" old
make_python "$INSTALL_DIR/venv.new.rollback" new
hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.rollback"
test "$("$INSTALL_DIR/venv/bin/python")" = new
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = old
assert_no_transaction_paths

make_python "$INSTALL_DIR/venv.new.commit" committed
hermes_venv_cutover_candidate "$INSTALL_DIR/venv.new.commit"
test "$("$INSTALL_DIR/venv/bin/python")" = committed
hermes_venv_commit_pending
test "$("$INSTALL_DIR/venv/bin/python")" = committed
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


def test_commit_rejects_interpreter_that_retains_candidate_prefix() -> None:
    completed = _run_transaction_script(
        """
make_python "$INSTALL_DIR/venv.stale.txn" old
make_python "$INSTALL_DIR/venv" new
printf '#!/bin/sh\nif [ "${1:-}" = "-c" ]; then exit 9; fi\nprintf "new\\n"\n' \
  > "$INSTALL_DIR/venv/bin/python"
chmod +x "$INSTALL_DIR/venv/bin/python"
write_journal ACTIVATED venv.stale.txn venv.new.txn NONE
if hermes_venv_commit_pending; then
  echo 'prefix-mismatched interpreter unexpectedly committed' >&2
  exit 1
fi
_hermes_venv_read_journal
test "$_HERMES_VENV_TXN_PHASE" = ACTIVATED
test -e "$INSTALL_DIR/venv.stale.txn"
hermes_venv_restore_pending
test "$("$INSTALL_DIR/venv/bin/python")" = old
assert_no_transaction_paths
"""
    )
    assert completed.returncode == 0, completed.stderr


@pytest.mark.parametrize(
    "journal",
    [
        "garbage\n",
        "HERMES_VENV_TRANSACTION_V2\nACTIVATED\n../../outside\nvenv.new.txn\nNONE\n",
        "HERMES_VENV_TRANSACTION_V2\nUNKNOWN\nvenv.stale.txn\nvenv.new.txn\nNONE\n",
    ],
)
def test_invalid_journal_fails_closed_without_moving_paths(journal: str) -> None:
    completed = _run_transaction_script(
        f"""
make_python "$INSTALL_DIR/venv" new
make_python "$INSTALL_DIR/venv.stale.txn" old
printf %s {shlex.quote(journal)} > "$INSTALL_DIR/venv.pending-backup"
if hermes_venv_restore_pending; then
  echo 'invalid journal unexpectedly recovered' >&2
  exit 1
fi
test "$("$INSTALL_DIR/venv/bin/python")" = new
test "$("$INSTALL_DIR/venv.stale.txn/bin/python")" = old
test -e "$INSTALL_DIR/venv.pending-backup"
"""
    )
    assert completed.returncode == 0, completed.stderr


def test_inconsistent_layout_and_nested_candidate_fail_closed() -> None:
    completed = _run_transaction_script(
        """
make_python "$INSTALL_DIR/venv" new
write_journal ACTIVATED venv.stale.missing venv.new.txn NONE
if hermes_venv_restore_pending; then
  echo 'missing last-known-good backup unexpectedly recovered' >&2
  exit 1
fi
test "$("$INSTALL_DIR/venv/bin/python")" = new
test -e "$INSTALL_DIR/venv.pending-backup"

rm "$INSTALL_DIR/venv.pending-backup"
make_python "$INSTALL_DIR/nested/venv.new.escape" nested
if hermes_venv_cutover_candidate "$INSTALL_DIR/nested/venv.new.escape"; then
  echo 'nested candidate unexpectedly accepted' >&2
  exit 1
fi
test "$("$INSTALL_DIR/venv/bin/python")" = new
test "$("$INSTALL_DIR/nested/venv.new.escape/bin/python")" = nested
"""
    )
    assert completed.returncode == 0, completed.stderr
