"""Regression coverage for shared SQLite transaction-boundary retries."""

from __future__ import annotations

import sqlite3

import pytest

from hermes_cli import sqlite_util


class _BoundaryConnection:
    def __init__(self, *, busy_begins: int = 0, busy_commits: int = 0) -> None:
        self.busy_begins = busy_begins
        self.busy_commits = busy_commits
        self.statements: list[str] = []

    def execute(self, sql: str) -> None:
        self.statements.append(sql)
        if sql == "BEGIN IMMEDIATE" and self.busy_begins:
            self.busy_begins -= 1
            raise sqlite3.OperationalError("database is locked")
        if sql == "COMMIT" and self.busy_commits:
            self.busy_commits -= 1
            raise sqlite3.OperationalError("database is busy")


def test_write_txn_retries_boundaries_without_replaying_body(monkeypatch):
    connection = _BoundaryConnection(busy_begins=2, busy_commits=1)
    sleeps: list[float] = []
    monkeypatch.setattr(sqlite_util.time, "sleep", sleeps.append)
    monkeypatch.setattr(sqlite_util.random, "uniform", lambda _low, _high: 0.02)
    body_calls = 0

    with sqlite_util.write_txn(connection):
        body_calls += 1

    assert body_calls == 1
    assert connection.statements == [
        "BEGIN IMMEDIATE",
        "BEGIN IMMEDIATE",
        "BEGIN IMMEDIATE",
        "COMMIT",
        "COMMIT",
    ]
    assert sleeps == [0.02, 0.02, 0.02]


def test_write_txn_does_not_retry_non_busy_errors(monkeypatch):
    class BrokenConnection:
        def execute(self, _sql: str) -> None:
            raise sqlite3.OperationalError("disk I/O error")

    sleeps: list[float] = []
    monkeypatch.setattr(sqlite_util.time, "sleep", sleeps.append)

    with pytest.raises(sqlite3.OperationalError, match="disk I/O error"):
        with sqlite_util.write_txn(BrokenConnection()):
            pytest.fail("transaction body must not run")

    assert sleeps == []
