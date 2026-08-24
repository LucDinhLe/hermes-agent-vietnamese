"""Offline regression checks for scripts/benchmark_v32_offline.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import re


def _load_harness():
    path = Path(__file__).with_name("benchmark_v32_offline.py")
    spec = importlib.util.spec_from_file_location("benchmark_v32_offline", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_offline_before_after_report_is_complete_and_self_consistent(tmp_path):
    harness = _load_harness()
    repo = Path(__file__).resolve().parents[1]

    report = harness.run_benchmark(
        repo=repo,
        baseline_ref="3cce675ce",
        current_ref="HEAD",
        workspace_parent=tmp_path,
    )

    baseline = report["variants"]["baseline"]
    current = report["variants"]["current"]
    checks = {item["id"]: item["passed"] for item in report["acceptance_checks"]}

    assert report["methodology"]["offline"] is True
    assert baseline["probe_contract"]["provider_calls"] == 0
    assert current["probe_contract"]["provider_calls"] == 0
    network_keys = (
        "socket_connect",
        "socket_connect_ex",
        "create_connection",
        "dns_resolution",
    )
    assert not any(
        baseline["probe_contract"]["network_and_subprocess_attempts"][key]
        for key in network_keys
    )
    assert not any(
        current["probe_contract"]["network_and_subprocess_attempts"][key]
        for key in network_keys
    )
    assert baseline["probe_contract"]["network_and_subprocess_attempts"]["subprocess"] >= 0
    assert current["probe_contract"]["network_and_subprocess_attempts"]["subprocess"] >= 0
    assert baseline["probe_contract"]["external_plugin_discovery"] == "disabled"
    assert current["probe_contract"]["external_plugin_discovery"] == "disabled"
    assert baseline["tool_heavy"]["governor"]["available"] is False
    assert baseline["tool_heavy"]["governor"]["measurement_kind"] == "static_counterfactual"
    assert baseline["tool_heavy"]["governor"]["model"]["admitted"] == 14
    assert baseline["tool_heavy"]["governor"]["tool"]["admitted"] == 25
    assert baseline["schema"]["raw_tool_count"] > 0
    assert current["schema"]["raw_tool_count"] > 0
    assert current["schema"]["active_tool_count"] < current["schema"]["raw_tool_count"]
    assert re.fullmatch(r"[0-9a-f]{64}", baseline["config"]["sha256"])
    assert re.fullmatch(r"[0-9a-f]{64}", current["config"]["sha256"])
    assert baseline["config"]["sha256"] != current["config"]["sha256"]
    assert current["fresh"]["active_input_tokens_estimate"] < baseline["fresh"]["active_input_tokens_estimate"]
    assert current["ten_turn_qa"]["active_input_tokens_estimate"] < baseline["ten_turn_qa"]["active_input_tokens_estimate"]

    raw_current = current["tool_heavy"]["raw_output"]
    raw_baseline = baseline["tool_heavy"]["raw_output"]
    assert raw_current["per_result_cap_bytes"] < 10_000
    assert raw_current["retained_raw_bytes"] == 24 * 1024
    assert raw_current["fully_inline_raw_bytes"] == 0
    assert raw_current["retained_raw_bytes"] < raw_baseline["retained_raw_bytes"]
    assert raw_current["all_inline_results_below_10k"] is True

    governor = current["tool_heavy"]["governor"]
    assert governor["available"] is True
    assert governor["model"]["warning_crossing_totals"] == [6]
    assert governor["model"]["admitted"] == 12
    assert governor["model"]["first_pause_attempt"] == 13
    assert governor["tool"]["warning_crossing_totals"] == [8]
    assert governor["tool"]["admitted"] == 20
    assert governor["tool"]["first_pause_attempt"] == 21

    logical = current["logical_350k"]
    assert logical["fixture"]["logical_history_tokens_estimate"] >= 350_000
    assert logical["native_compact_threshold_tokens"] == 190_000
    assert logical["effective_local_threshold_tokens"] == 208_000
    assert logical["native_due_at_fixture"] is True
    assert logical["local_due_at_fixture"] is True
    assert checks["network_free"] is True
    assert checks["baseline_revision_isolated"] is True
    assert checks["fresh_current_under_one_percent"] is True
    assert checks["current_raw_result_cap_below_10k"] is True
    assert checks["current_governor_model_cap_12"] is True
    assert checks["current_governor_tool_cap_20"] is True
    assert checks["logical_fixture_at_least_350k"] is True
    assert checks["current_compaction_armed_below_272k"] is True

    rendered = harness.render_markdown(report)

    assert "static estimates" in rendered
    assert "No model, provider, quota endpoint, or network was called" in rendered
    assert "Logical-history estimate" in rendered
    assert "## Limitations" in rendered
    assert f"--current-ref {report['source']['current_revision']}" in rendered

    baseline_turns = baseline["ten_turn_qa"]["cumulative_turns"]
    current_turns = current["ten_turn_qa"]["cumulative_turns"]
    assert [row["turn"] for row in baseline_turns] == list(range(1, 11))
    assert [row["turn"] for row in current_turns] == list(range(1, 11))
    assert all(row["delta_from_prior_turn_tokens_estimate"] > 0 for row in baseline_turns)
    assert all(row["delta_from_prior_turn_tokens_estimate"] > 0 for row in current_turns)
