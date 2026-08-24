#!/bin/bash
# Transactional virtual-environment cutover for scripts/install.sh.
#
# The journal is persisted before the first rename. Until the dependency/import
# probe records COMMITTED, the pre-existing venv (or its recorded absence) is
# authoritative. Every later state is recoverable from the journal plus the
# direct-child paths it names; inconsistent layouts fail closed.

_HERMES_VENV_TXN_MAGIC="HERMES_VENV_TRANSACTION_V2"

_hermes_venv_log_error() {
    if command -v log_error >/dev/null 2>&1; then
        log_error "$*"
    else
        printf 'Hermes venv transaction: %s\n' "$*" >&2
    fi
}

_hermes_venv_prepare_root() {
    local requested_root="${INSTALL_DIR:-}"
    if [ -z "$requested_root" ]; then
        _hermes_venv_log_error "INSTALL_DIR is empty"
        return 1
    fi
    if ! _HERMES_VENV_INSTALL_ROOT="$(CDPATH= cd "$requested_root" 2>/dev/null && pwd -P)"; then
        _hermes_venv_log_error "INSTALL_DIR is not an accessible directory: $requested_root"
        return 1
    fi
    case "$_HERMES_VENV_INSTALL_ROOT" in
        ""|/|.)
            _hermes_venv_log_error "refusing unsafe INSTALL_DIR: $_HERMES_VENV_INSTALL_ROOT"
            return 1
            ;;
    esac
}

_hermes_venv_marker_path() {
    printf '%s/venv.pending-backup' "$_HERMES_VENV_INSTALL_ROOT"
}

_hermes_venv_path_exists() {
    [ -e "$1" ] || [ -L "$1" ]
}

_hermes_venv_validate_backup_name() {
    case "$1" in
        NONE) return 0 ;;
        venv.stale.?*)
            case "$1" in
                *[!A-Za-z0-9._-]*|*/*) return 1 ;;
                *) return 0 ;;
            esac
            ;;
        *) return 1 ;;
    esac
}

_hermes_venv_validate_candidate_name() {
    case "$1" in
        venv.new.?*)
            case "$1" in
                *[!A-Za-z0-9._-]*|*/*) return 1 ;;
                *) return 0 ;;
            esac
            ;;
        *) return 1 ;;
    esac
}

_hermes_venv_validate_failed_name() {
    case "$1" in
        venv.failed.?*)
            case "$1" in
                *[!A-Za-z0-9._-]*|*/*) return 1 ;;
                *) return 0 ;;
            esac
            ;;
        *) return 1 ;;
    esac
}

_hermes_venv_sync() {
    if ! command -v sync >/dev/null 2>&1; then
        _hermes_venv_log_error "sync is unavailable; refusing an unjournaled venv mutation"
        return 1
    fi
    if ! sync; then
        _hermes_venv_log_error "failed to flush the venv transaction to durable storage"
        return 1
    fi
}

# Sets _HERMES_VENV_TXN_{FORMAT,PHASE,BACKUP,CANDIDATE,FAILED}.
# A one-line marker from v32's first implementation is accepted as an
# ACTIVATED transaction so upgrades can still roll it back.
_hermes_venv_read_journal() {
    local marker first phase backup candidate failed extra
    _hermes_venv_prepare_root || return 1
    marker="$(_hermes_venv_marker_path)"
    if [ ! -f "$marker" ] || [ -L "$marker" ]; then
        return 1
    fi

    first=""
    phase=""
    backup=""
    candidate=""
    failed=""
    extra=""
    {
        IFS= read -r first || return 1
        if [ "$first" = "$_HERMES_VENV_TXN_MAGIC" ]; then
            IFS= read -r phase || return 1
            IFS= read -r backup || return 1
            IFS= read -r candidate || return 1
            IFS= read -r failed || return 1
            if IFS= read -r extra || [ -n "$extra" ]; then
                return 1
            fi
        else
            backup="$first"
            if IFS= read -r extra || [ -n "$extra" ]; then
                return 1
            fi
            _hermes_venv_validate_backup_name "$backup" || return 1
            _HERMES_VENV_TXN_FORMAT="legacy"
            _HERMES_VENV_TXN_PHASE="ACTIVATED"
            _HERMES_VENV_TXN_BACKUP="$backup"
            _HERMES_VENV_TXN_CANDIDATE="NONE"
            _HERMES_VENV_TXN_FAILED="NONE"
            return 0
        fi
    } < "$marker"

    case "$phase" in
        PREPARED|BACKED_UP|ACTIVATED|ROLLING_BACK|COMMITTED) ;;
        *) return 1 ;;
    esac
    _hermes_venv_validate_backup_name "$backup" || return 1
    if [ "$candidate" = "NONE" ]; then
        # Only a migrated one-line legacy marker can lack the candidate name,
        # and it is immediately converted into a resumable rollback journal.
        [ "$phase" = "ROLLING_BACK" ] || return 1
    else
        _hermes_venv_validate_candidate_name "$candidate" || return 1
    fi
    if [ "$phase" = "ROLLING_BACK" ]; then
        _hermes_venv_validate_failed_name "$failed" || return 1
    elif [ "$failed" != "NONE" ]; then
        return 1
    fi

    _HERMES_VENV_TXN_FORMAT="v2"
    _HERMES_VENV_TXN_PHASE="$phase"
    _HERMES_VENV_TXN_BACKUP="$backup"
    _HERMES_VENV_TXN_CANDIDATE="$candidate"
    _HERMES_VENV_TXN_FAILED="$failed"
}

_hermes_venv_write_journal() {
    local phase="$1" backup="$2" candidate="$3" failed="$4"
    local marker marker_tmp
    _hermes_venv_prepare_root || return 1
    case "$phase" in
        PREPARED|BACKED_UP|ACTIVATED|COMMITTED)
            [ "$failed" = "NONE" ] || return 1
            ;;
        ROLLING_BACK)
            _hermes_venv_validate_failed_name "$failed" || return 1
            ;;
        *) return 1 ;;
    esac
    _hermes_venv_validate_backup_name "$backup" || return 1
    if [ "$candidate" = "NONE" ]; then
        [ "$phase" = "ROLLING_BACK" ] || return 1
    else
        _hermes_venv_validate_candidate_name "$candidate" || return 1
    fi

    marker="$(_hermes_venv_marker_path)"
    marker_tmp="$marker.tmp.$$.$phase"
    if ! (
        umask 077
        set -C
        printf '%s\n%s\n%s\n%s\n%s\n' \
            "$_HERMES_VENV_TXN_MAGIC" "$phase" "$backup" "$candidate" "$failed" \
            > "$marker_tmp"
    ); then
        _hermes_venv_log_error "failed to create the venv transaction journal temp file"
        return 1
    fi
    if ! _hermes_venv_sync; then
        rm -f "$marker_tmp"
        return 1
    fi
    if ! mv "$marker_tmp" "$marker"; then
        rm -f "$marker_tmp"
        _hermes_venv_log_error "failed to publish the venv transaction journal"
        return 1
    fi
    # This is the ordering barrier: callers cannot mutate live/candidate/backup
    # paths until the journal rename itself is durable.
    _hermes_venv_sync
}

_hermes_venv_remove_journal() {
    local marker
    _hermes_venv_prepare_root || return 1
    marker="$(_hermes_venv_marker_path)"
    if [ -L "$marker" ]; then
        _hermes_venv_log_error "refusing to remove a symlinked venv transaction journal"
        return 1
    fi
    rm -f "$marker" || return 1
    _hermes_venv_sync
}

_hermes_venv_safe_remove() {
    local target="$1"
    case "$target" in
        "$_HERMES_VENV_INSTALL_ROOT"/venv.stale.?*|"$_HERMES_VENV_INSTALL_ROOT"/venv.failed.?*)
            rm -rf "$target" || return 1
            _hermes_venv_sync
            ;;
        *)
            _hermes_venv_log_error "refusing to remove unexpected path: $target"
            return 1
            ;;
    esac
}

_hermes_venv_fail_layout() {
    _hermes_venv_log_error \
        "venv transaction layout is inconsistent for phase $_HERMES_VENV_TXN_PHASE; preserving journal and all paths"
    return 1
}

_hermes_venv_resume_rollback() {
    local live_path backup_path candidate_path failed_path
    [ "$_HERMES_VENV_TXN_PHASE" = "ROLLING_BACK" ] || return 1

    live_path="$_HERMES_VENV_INSTALL_ROOT/venv"
    failed_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_FAILED"
    backup_path=""
    candidate_path=""
    if [ "$_HERMES_VENV_TXN_BACKUP" != "NONE" ]; then
        backup_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_BACKUP"
    fi
    if [ "$_HERMES_VENV_TXN_CANDIDATE" != "NONE" ]; then
        candidate_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_CANDIDATE"
    fi

    if [ -z "$backup_path" ]; then
        # There was no active venv before this transaction. Recovery therefore
        # removes either the unactivated candidate or the activated live venv.
        if _hermes_venv_path_exists "$live_path" && \
                { [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path" || \
                  _hermes_venv_path_exists "$failed_path"; }; then
            _hermes_venv_fail_layout
            return 1
        fi
        if _hermes_venv_path_exists "$live_path"; then
            if ! mv "$live_path" "$failed_path"; then
                return 1
            fi
            _hermes_venv_sync || return 1
        elif [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path"; then
            if _hermes_venv_path_exists "$failed_path"; then
                _hermes_venv_fail_layout
                return 1
            fi
            if ! mv "$candidate_path" "$failed_path"; then
                return 1
            fi
            _hermes_venv_sync || return 1
        elif ! _hermes_venv_path_exists "$failed_path"; then
            _hermes_venv_fail_layout
            return 1
        fi

        if _hermes_venv_path_exists "$live_path" || \
                { [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path"; } || \
                ! _hermes_venv_path_exists "$failed_path"; then
            _hermes_venv_fail_layout
            return 1
        fi
        # Removing the journal is the rollback commit point. The quarantine is
        # inert and may be cleaned only after that decision is durable.
        _hermes_venv_remove_journal || return 1
        _hermes_venv_safe_remove "$failed_path"
        return
    fi

    # With a prior live venv, exactly one copy of it must be identifiable as
    # either backup_path or the restored live_path throughout rollback.
    if _hermes_venv_path_exists "$backup_path"; then
        if [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path"; then
            if _hermes_venv_path_exists "$live_path" || _hermes_venv_path_exists "$failed_path"; then
                _hermes_venv_fail_layout
                return 1
            fi
            mv "$backup_path" "$live_path" || return 1
            _hermes_venv_sync || return 1
        else
            if _hermes_venv_path_exists "$live_path"; then
                if _hermes_venv_path_exists "$failed_path"; then
                    _hermes_venv_fail_layout
                    return 1
                fi
                mv "$live_path" "$failed_path" || return 1
                _hermes_venv_sync || return 1
            elif ! _hermes_venv_path_exists "$failed_path"; then
                _hermes_venv_fail_layout
                return 1
            fi
            mv "$backup_path" "$live_path" || return 1
            _hermes_venv_sync || return 1
        fi
    fi

    if [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path"; then
        if ! _hermes_venv_path_exists "$live_path" || \
                _hermes_venv_path_exists "$backup_path" || \
                _hermes_venv_path_exists "$failed_path"; then
            _hermes_venv_fail_layout
            return 1
        fi
        mv "$candidate_path" "$failed_path" || return 1
        _hermes_venv_sync || return 1
    fi

    if ! _hermes_venv_path_exists "$live_path" || \
            _hermes_venv_path_exists "$backup_path" || \
            { [ -n "$candidate_path" ] && _hermes_venv_path_exists "$candidate_path"; } || \
            ! _hermes_venv_path_exists "$failed_path"; then
        _hermes_venv_fail_layout
        return 1
    fi

    _hermes_venv_remove_journal || return 1
    _hermes_venv_safe_remove "$failed_path"
}

_hermes_venv_python_matches_live_prefix() {
    local live_path="$_HERMES_VENV_INSTALL_ROOT/venv"
    [ -x "$live_path/bin/python" ] || return 1
    # install.sh installs dependencies only after activation, through this
    # interpreter (`python -m pip` on Termux or uv with VIRTUAL_ENV elsewhere),
    # so generated console entrypoints receive the live prefix. The user-facing
    # `hermes` shim also execs this interpreter directly; no activation script
    # created under the temporary candidate path is part of the product path.
    "$live_path/bin/python" -c \
        'import os, sys; raise SystemExit(0 if os.path.realpath(sys.prefix) == os.path.realpath(sys.argv[1]) else 1)' \
        "$live_path"
}

_hermes_venv_finalize_committed() {
    local backup_path candidate_path
    [ "$_HERMES_VENV_TXN_PHASE" = "COMMITTED" ] || return 1
    candidate_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_CANDIDATE"

    if ! _hermes_venv_python_matches_live_prefix; then
        _hermes_venv_log_error "committed venv interpreter does not resolve to the live venv prefix"
        return 1
    fi
    if _hermes_venv_path_exists "$candidate_path"; then
        _hermes_venv_fail_layout
        return 1
    fi
    if [ "$_HERMES_VENV_TXN_BACKUP" != "NONE" ]; then
        backup_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_BACKUP"
        if _hermes_venv_path_exists "$backup_path"; then
            _hermes_venv_safe_remove "$backup_path" || return 1
        fi
    fi
    _hermes_venv_remove_journal
}

hermes_venv_restore_pending() {
    local marker stamp failed_name failed_path
    _hermes_venv_prepare_root || return 1
    marker="$(_hermes_venv_marker_path)"
    if ! _hermes_venv_path_exists "$marker"; then
        return 0
    fi
    if ! _hermes_venv_read_journal; then
        _hermes_venv_log_error "invalid pending venv transaction journal: $marker"
        return 1
    fi

    if [ "$_HERMES_VENV_TXN_PHASE" = "COMMITTED" ]; then
        _hermes_venv_finalize_committed
        return
    fi
    if [ "$_HERMES_VENV_TXN_PHASE" != "ROLLING_BACK" ]; then
        stamp="$(date +%Y%m%d%H%M%S)-$$"
        failed_name="venv.failed.rollback-$stamp"
        failed_path="$_HERMES_VENV_INSTALL_ROOT/$failed_name"
        if _hermes_venv_path_exists "$failed_path"; then
            _hermes_venv_log_error "rollback quarantine path already exists: $failed_path"
            return 1
        fi
        # Persist rollback intent before moving either the replacement or the
        # last-known-good copy. Recovery can resume every following rename.
        _hermes_venv_write_journal \
            "ROLLING_BACK" "$_HERMES_VENV_TXN_BACKUP" \
            "$_HERMES_VENV_TXN_CANDIDATE" "$failed_name" || return 1
        _hermes_venv_read_journal || return 1
    fi
    _hermes_venv_resume_rollback
}

hermes_venv_cutover_candidate() {
    local candidate="$1" candidate_name candidate_parent live_path marker
    local backup_name backup_path stamp
    _hermes_venv_prepare_root || return 1
    live_path="$_HERMES_VENV_INSTALL_ROOT/venv"
    marker="$(_hermes_venv_marker_path)"

    candidate_name="${candidate##*/}"
    _hermes_venv_validate_candidate_name "$candidate_name" || {
        _hermes_venv_log_error "candidate must have a safe venv.new.* name"
        return 1
    }
    candidate_parent="${candidate%/*}"
    if [ "$candidate_parent" = "$candidate" ] || \
            ! candidate_parent="$(CDPATH= cd "$candidate_parent" 2>/dev/null && pwd -P)" || \
            [ "$candidate_parent" != "$_HERMES_VENV_INSTALL_ROOT" ]; then
        _hermes_venv_log_error "candidate must be a direct venv.new.* child of INSTALL_DIR"
        return 1
    fi
    candidate="$_HERMES_VENV_INSTALL_ROOT/$candidate_name"
    if [ ! -x "$candidate/bin/python" ]; then
        _hermes_venv_log_error "candidate interpreter is missing or not executable: $candidate/bin/python"
        return 1
    fi

    # An interrupted prior attempt must be resolved before a new cutover.
    if _hermes_venv_path_exists "$marker"; then
        hermes_venv_restore_pending || return 1
    fi
    if _hermes_venv_path_exists "$marker"; then
        _hermes_venv_log_error "prior venv transaction journal still exists after recovery"
        return 1
    fi
    if [ ! -x "$candidate/bin/python" ]; then
        _hermes_venv_log_error "candidate disappeared while recovering the prior transaction"
        return 1
    fi

    stamp="$(date +%Y%m%d%H%M%S)-$$"
    backup_name="NONE"
    backup_path=""
    if _hermes_venv_path_exists "$live_path"; then
        backup_name="venv.stale.$stamp"
        backup_path="$_HERMES_VENV_INSTALL_ROOT/$backup_name"
        if _hermes_venv_path_exists "$backup_path"; then
            _hermes_venv_log_error "venv backup path already exists: $backup_path"
            return 1
        fi
    fi

    # PREPARED is durable before the first destructive rename. If the process
    # stops anywhere below, restore_pending still knows which path held the
    # previous active venv and which path is the unvalidated replacement.
    _hermes_venv_write_journal "PREPARED" "$backup_name" "$candidate_name" "NONE" || return 1

    if [ -n "$backup_path" ]; then
        mv "$live_path" "$backup_path" || return 1
        _hermes_venv_sync || return 1
    fi
    _hermes_venv_write_journal "BACKED_UP" "$backup_name" "$candidate_name" "NONE" || return 1

    if _hermes_venv_path_exists "$live_path"; then
        _hermes_venv_log_error "live venv unexpectedly exists before candidate activation"
        return 1
    fi
    mv "$candidate" "$live_path" || return 1
    _hermes_venv_sync || return 1
    _hermes_venv_write_journal "ACTIVATED" "$backup_name" "$candidate_name" "NONE"
}

hermes_venv_commit_pending() {
    local marker backup_path candidate_path
    _hermes_venv_prepare_root || return 1
    marker="$(_hermes_venv_marker_path)"
    if ! _hermes_venv_path_exists "$marker"; then
        return 0
    fi
    if ! _hermes_venv_read_journal; then
        _hermes_venv_log_error "invalid pending venv commit journal: $marker"
        return 1
    fi
    if [ "$_HERMES_VENV_TXN_PHASE" = "COMMITTED" ]; then
        _hermes_venv_finalize_committed
        return
    fi
    if [ "$_HERMES_VENV_TXN_PHASE" != "ACTIVATED" ]; then
        _hermes_venv_log_error \
            "refusing to commit venv transaction in phase $_HERMES_VENV_TXN_PHASE"
        return 1
    fi
    if ! _hermes_venv_python_matches_live_prefix; then
        _hermes_venv_log_error "refusing to commit a venv whose interpreter prefix is not the live venv path"
        return 1
    fi
    if [ "$_HERMES_VENV_TXN_CANDIDATE" != "NONE" ]; then
        candidate_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_CANDIDATE"
        if _hermes_venv_path_exists "$candidate_path"; then
            _hermes_venv_fail_layout
            return 1
        fi
    fi
    if [ "$_HERMES_VENV_TXN_BACKUP" != "NONE" ]; then
        backup_path="$_HERMES_VENV_INSTALL_ROOT/$_HERMES_VENV_TXN_BACKUP"
        if ! _hermes_venv_path_exists "$backup_path"; then
            _hermes_venv_log_error "pending venv backup is missing: $backup_path"
            return 1
        fi
    fi

    # Persist the successful probe decision before deleting the rollback copy.
    # A crash from this point onward resumes cleanup and never rolls the healthy
    # replacement back merely because stale cleanup was interrupted.
    if [ "$_HERMES_VENV_TXN_CANDIDATE" = "NONE" ]; then
        _hermes_venv_log_error "legacy venv journals cannot record a durable commit decision"
        return 1
    fi
    _hermes_venv_write_journal \
        "COMMITTED" "$_HERMES_VENV_TXN_BACKUP" \
        "$_HERMES_VENV_TXN_CANDIDATE" "NONE" || return 1
    _hermes_venv_read_journal || return 1
    _hermes_venv_finalize_committed
}
