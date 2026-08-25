"""Tests for search_files auto-multiline routing on \\n patterns."""

import json
import shutil

import pytest

from tools.file_tools import search_tool


@pytest.fixture
def proj(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    d = tmp_path / "proj"
    d.mkdir()
    (d / "mod.py").write_text(
        "def setup():\n    init_db()\n    return True\n\n"
        "def teardown():\n    close_db()\n"
    )
    return d


class TestAutoMultiline:
    @pytest.fixture(autouse=True)
    def _require_rg(self):
        if shutil.which("rg") is None:
            pytest.skip("auto-multiline search requires ripgrep")

    def test_newline_regex_matches_across_lines(self, proj):
        r = json.loads(search_tool(r"def setup\(\):\n    init_db\(\)", path=str(proj), task_id="t-ml"))
        assert "error" not in r
        assert r["total_count"] >= 1
        assert "multiline" in r.get("warning", "")

    def test_literal_newline_in_pattern_matches(self, proj):
        # A raw newline in the pattern (not the \n escape) also routes to
        # multiline mode. Keep the pattern free of regex metachars.
        r = json.loads(search_tool("return True\n\ndef teardown", path=str(proj), task_id="t-ml"))
        assert "error" not in r
        assert r["total_count"] >= 1

    def test_newline_regex_matches_explicit_crlf_file(self, proj):
        from tools.file_tools import _get_file_ops

        crlf_file = proj / "windows.py"
        crlf_file.write_bytes(b"def windows():\r\n    boot()\r\n")
        operations = _get_file_ops(task_id="t-ml-crlf")
        executed = []
        real_exec = operations._exec

        def recording_exec(command, *args, **kwargs):
            result = real_exec(command, *args, **kwargs)
            executed.append((command, result.exit_code, result.stdout))
            return result

        operations._exec = recording_exec

        try:
            result = operations.search(
                r"def windows\(\):\n    boot\(\)",
                path=str(proj),
                target="content",
            )
        finally:
            operations._exec = real_exec

        assert result.error is None
        search_command = next(
            command
            for command, _code, _out in executed
            if command.startswith("set -o pipefail; rg ")
        )
        assert r"\r?\n" in search_command, search_command
        assert result.total_count >= 1, executed
        assert "multiline" in (result.warning or "")

    def test_plain_pattern_unaffected(self, proj):
        r = json.loads(search_tool("init_db", path=str(proj), task_id="t-ml"))
        assert r["total_count"] == 1
        assert "multiline" not in r.get("warning", "")

    def test_escaped_backslash_n_stays_literal(self, proj):
        # \\n = literal backslash+n search, not a newline: no multiline mode.
        from tools.file_tools import _get_file_ops

        (proj / "strings.py").write_text('SEP = "a\\\\nb"\n')
        operations = _get_file_ops(task_id="t-ml-literal")
        executed = []
        real_exec = operations._exec

        def recording_exec(command, *args, **kwargs):
            result = real_exec(command, *args, **kwargs)
            executed.append((command, result.exit_code, result.stdout))
            return result

        operations._exec = recording_exec
        try:
            result = operations.search(
                r"a\\nb",
                path=str(proj),
                target="content",
            )
        finally:
            operations._exec = real_exec

        search_command = next(
            command
            for command, _code, _out in executed
            if command.startswith("set -o pipefail; rg ")
        )
        assert result.error is None, search_command
        assert "multiline" not in (result.warning or "")

    def test_multiline_zero_match_is_clean(self, proj):
        r = json.loads(search_tool(r"def missing\(\):\n    nope\(\)", path=str(proj), task_id="t-ml"))
        assert "error" not in r
        assert r["total_count"] == 0
