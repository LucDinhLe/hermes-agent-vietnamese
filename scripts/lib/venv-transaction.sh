#!/bin/bash
# Transactional virtual-environment cutover for scripts/install.sh.
#
# A replacement is built under venv.new.* first. The last known-good venv is
# renamed, never deleted, until dependency installation and an import probe
# succeed. A marker bridges the desktop bootstrap's separate `venv` and
# `python-deps` processes and makes rollback deterministic after interruption.

_hermes_venv_log_error() {
    if command -v log_error >/dev/null 2>&1; then
        log_error "$*"
    else
        printf 'Hermes venv transaction: %s\n' "$*" >&2
    fi
}

_hermes_venv_marker_path() {
    printf '%s/venv.pending-backup' "$INSTALL_DIR"
}

_hermes_venv_validate_backup_name() {
    case "$1" in
        NONE) return 0 ;;
        venv.stale.*)
            case "$1" in
                *[!A-Za-z0-9._-]*|*/*) return 1 ;;
                *) return 0 ;;
            esac
            ;;
        *) return 1 ;;
    esac
}

_hermes_venv_read_marker() {
    local marker value line_count
    marker="$(_hermes_venv_marker_path)"
    [ -f "$marker" ] || return 1
    line_count="$(wc -l < "$marker" 2>/dev/null)" || return 1
    [ "$line_count" = "1" ] || return 1
    IFS= read -r value < "$marker" || return 1
    _hermes_venv_validate_backup_name "$value" || return 1
    printf '%s' "$value"
}

_hermes_venv_safe_remove() {
    local target="$1"
    case "$target" in
        "$INSTALL_DIR"/venv.stale.*|"$INSTALL_DIR"/venv.failed.*)
            rm -rf "$target"
            ;;
        *)
            _hermes_venv_log_error "refusing to remove unexpected path: $target"
            return 1
            ;;
    esac
}

hermes_venv_restore_pending() {
    local marker backup_name backup_path live_path failed_path stamp
    marker="$(_hermes_venv_marker_path)"
    [ -e "$marker" ] || return 0

    if ! backup_name="$(_hermes_venv_read_marker)"; then
        _hermes_venv_log_error "invalid pending rollback marker: $marker"
        return 1
    fi

    live_path="$INSTALL_DIR/venv"
    stamp="$(date +%Y%m%d%H%M%S)-$$"
    failed_path="$INSTALL_DIR/venv.failed.$stamp"
    if [ -e "$failed_path" ]; then
        _hermes_venv_log_error "rollback quarantine path already exists: $failed_path"
        return 1
    fi

    if [ "$backup_name" = "NONE" ]; then
        if [ -e "$live_path" ]; then
            mv "$live_path" "$failed_path" || return 1
        fi
        rm -f "$marker"
        if [ -e "$failed_path" ]; then
            _hermes_venv_safe_remove "$failed_path"
        fi
        return 0
    fi

    backup_path="$INSTALL_DIR/$backup_name"
    if [ ! -d "$backup_path" ]; then
        _hermes_venv_log_error "pending venv backup is missing: $backup_path"
        return 1
    fi

    if [ -e "$live_path" ]; then
        mv "$live_path" "$failed_path" || return 1
    fi
    if ! mv "$backup_path" "$live_path"; then
        if [ -e "$failed_path" ] && [ ! -e "$live_path" ]; then
            mv "$failed_path" "$live_path" || true
        fi
        _hermes_venv_log_error "failed to restore last known-good venv"
        return 1
    fi

    rm -f "$marker"
    if [ -e "$failed_path" ]; then
        _hermes_venv_safe_remove "$failed_path"
    fi
}

hermes_venv_cutover_candidate() {
    local candidate="$1" candidate_name live_path marker marker_tmp backup_name backup_path stamp
    live_path="$INSTALL_DIR/venv"
    marker="$(_hermes_venv_marker_path)"

    case "$candidate" in
        "$INSTALL_DIR"/venv.new.*) ;;
        *)
            _hermes_venv_log_error "candidate must be a direct venv.new.* child of INSTALL_DIR"
            return 1
            ;;
    esac
    candidate_name="${candidate##*/}"
    case "$candidate_name" in
        venv.new.*) ;;
        *) return 1 ;;
    esac
    if [ ! -x "$candidate/bin/python" ]; then
        _hermes_venv_log_error "candidate interpreter is missing or not executable: $candidate/bin/python"
        return 1
    fi

    # An interrupted prior attempt must be rolled back before a new cutover.
    if [ -e "$marker" ]; then
        hermes_venv_restore_pending || return 1
    fi

    stamp="$(date +%Y%m%d%H%M%S)-$$"
    backup_name="NONE"
    backup_path=""
    if [ -e "$live_path" ]; then
        backup_name="venv.stale.$stamp"
        backup_path="$INSTALL_DIR/$backup_name"
        [ ! -e "$backup_path" ] || {
            _hermes_venv_log_error "venv backup path already exists: $backup_path"
            return 1
        }
        mv "$live_path" "$backup_path" || return 1
    fi

    if ! mv "$candidate" "$live_path"; then
        if [ -n "$backup_path" ] && [ ! -e "$live_path" ]; then
            mv "$backup_path" "$live_path" || true
        fi
        _hermes_venv_log_error "failed to activate the prepared venv candidate"
        return 1
    fi

    marker_tmp="$marker.tmp.$$"
    if ! printf '%s\n' "$backup_name" > "$marker_tmp" || ! mv "$marker_tmp" "$marker"; then
        rm -f "$marker_tmp"
        # Roll back before deleting the failed replacement.
        local failed_path="$INSTALL_DIR/venv.failed.marker-$stamp"
        mv "$live_path" "$failed_path" || true
        if [ -n "$backup_path" ] && [ ! -e "$live_path" ]; then
            mv "$backup_path" "$live_path" || true
        fi
        if [ -e "$failed_path" ]; then
            _hermes_venv_safe_remove "$failed_path" || true
        fi
        _hermes_venv_log_error "failed to persist the pending venv rollback marker"
        return 1
    fi
}

hermes_venv_commit_pending() {
    local marker backup_name backup_path
    marker="$(_hermes_venv_marker_path)"
    [ -e "$marker" ] || return 0

    if ! backup_name="$(_hermes_venv_read_marker)"; then
        _hermes_venv_log_error "invalid pending commit marker: $marker"
        return 1
    fi
    if [ ! -x "$INSTALL_DIR/venv/bin/python" ]; then
        _hermes_venv_log_error "refusing to commit a venv without an executable interpreter"
        return 1
    fi

    if [ "$backup_name" != "NONE" ]; then
        backup_path="$INSTALL_DIR/$backup_name"
        [ -d "$backup_path" ] || {
            _hermes_venv_log_error "pending venv backup is missing: $backup_path"
            return 1
        }
    fi
    # Removing the marker is the commit point. If cleanup is interrupted after
    # this line, the validated active venv remains authoritative and only an
    # inert venv.stale.* directory is left behind; it can never be restored over
    # the good replacement by a later setup run.
    rm -f "$marker"
    if [ "$backup_name" != "NONE" ]; then
        _hermes_venv_safe_remove "$backup_path" || return 1
    fi
}
