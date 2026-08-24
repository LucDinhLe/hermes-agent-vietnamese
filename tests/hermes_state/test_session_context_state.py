"""Durable, privacy-safe context recovery state."""

import sqlite3

import pytest

from hermes_state import SCHEMA_VERSION, SessionDB


def test_context_state_survives_database_relaunch(tmp_path):
    path = tmp_path / "state.db"
    db = SessionDB(path)
    db.create_session("session", source="desktop")

    db.update_session_context_state(
        "session",
        effective_context_tokens=900_000,
        effective_context_source="codex_live",
        active_context_tokens=207_500,
        logical_history_tokens=360_000,
        compaction_delta=2,
        native_compaction_downgraded=True,
    )
    db.record_session_failure(
        "session",
        kind="rate_limit",
        code="insufficient_quota",
        reset_at=2_000_000_000,
    )
    db.close()

    reopened = SessionDB(path)
    try:
        state = reopened.get_session_context_state("session")
    finally:
        reopened.close()

    assert state == {
        "effective_context_tokens": 900_000,
        "effective_context_source": "codex_live",
        "active_context_tokens": 207_500,
        "logical_history_tokens": 360_000,
        "compaction_count": 2,
        "native_compaction_downgraded": True,
        "last_failure": {
            "kind": "rate_limit",
            "code": "insufficient_quota",
            "reset_at": 2_000_000_000.0,
        },
    }


def test_context_state_updates_are_monotonic_and_failure_can_clear(tmp_path):
    db = SessionDB(tmp_path / "state.db")
    try:
        db.create_session("session", source="desktop")
        db.update_session_context_state(
            "session",
            logical_history_tokens=400_000,
            compaction_delta=1,
            native_compaction_downgraded=True,
        )
        db.update_session_context_state(
            "session",
            logical_history_tokens=350_000,
            compaction_delta=2,
            native_compaction_downgraded=False,
        )
        db.record_session_failure(
            "session", kind="context_overflow", code="context_length_exceeded"
        )
        db.clear_session_failure("session")

        state = db.get_session_context_state("session")
    finally:
        db.close()

    assert state["logical_history_tokens"] == 400_000
    assert state["compaction_count"] == 3
    assert state["native_compaction_downgraded"] is True
    assert state["last_failure"] is None


@pytest.mark.parametrize(
    ("kind", "code"),
    [
        ("provider said user prompt contents", "rate_limit_exceeded"),
        ("rate_limit", "raw body: bearer abc123"),
    ],
)
def test_failure_state_rejects_raw_or_unrecognized_text(tmp_path, kind, code):
    db = SessionDB(tmp_path / "state.db")
    try:
        db.create_session("session", source="desktop")
        with pytest.raises(ValueError):
            db.record_session_failure("session", kind=kind, code=code)
        state = db.get_session_context_state("session")
    finally:
        db.close()

    assert state["last_failure"] is None


def test_v26_database_reconciles_context_columns_on_reopen(tmp_path):
    path = tmp_path / "state.db"
    db = SessionDB(path)
    db.create_session("legacy", source="desktop")
    db.close()

    added_columns = (
        "effective_context_tokens",
        "effective_context_source",
        "active_context_tokens",
        "logical_history_tokens",
        "context_compaction_count",
        "native_compaction_downgraded",
        "last_failure_kind",
        "last_failure_code",
        "last_failure_reset_at",
    )
    conn = sqlite3.connect(path)
    try:
        for column in added_columns:
            conn.execute(f'ALTER TABLE sessions DROP COLUMN "{column}"')
        conn.execute("UPDATE schema_version SET version = 26")
        conn.commit()
    finally:
        conn.close()

    reopened = SessionDB(path)
    try:
        live_columns = {
            row[1]
            for row in reopened._conn.execute("PRAGMA table_info(sessions)").fetchall()
        }
        version = reopened._conn.execute(
            "SELECT version FROM schema_version"
        ).fetchone()[0]
        state = reopened.get_session_context_state("legacy")
    finally:
        reopened.close()

    assert set(added_columns) <= live_columns
    assert version == SCHEMA_VERSION == 27
    assert state["logical_history_tokens"] == 0
    assert state["compaction_count"] == 0
    assert state["native_compaction_downgraded"] is False
    assert state["last_failure"] is None
