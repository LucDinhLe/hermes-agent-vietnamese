from types import SimpleNamespace

import pytest

from agent.advisor import (
    batch_requires_review,
    build_plan_packet,
    enforce_availability_policy,
    parse_decision,
    review_packet,
    settings_from_config,
    withheld_tool_result,
)


def _tool(name: str, arguments: str = "{}"):
    return SimpleNamespace(
        id=f"call-{name}",
        function=SimpleNamespace(name=name, arguments=arguments),
    )


def _response(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def test_advisor_is_default_off_and_revision_budget_is_bounded():
    assert settings_from_config({}).enabled is False
    assert settings_from_config({"advisor": {"enabled": True, "max_revisions": 99}}).max_revisions == 4
    assert settings_from_config({"advisor": {"enabled": True, "max_revisions": 0}}).max_revisions == 1


def test_advisor_is_a_canonical_auxiliary_model_slot():
    from hermes_cli.config import DEFAULT_CONFIG
    from hermes_cli.main import _AUX_TASKS
    from hermes_cli.web_server import _AUX_TASK_SLOTS

    assert DEFAULT_CONFIG["advisor"]["enabled"] is False
    assert DEFAULT_CONFIG["advisor"]["max_revisions"] == 2
    assert DEFAULT_CONFIG["auxiliary"]["advisor"]["provider"] == "auto"
    assert "advisor" in {key for key, _label, _description in _AUX_TASKS}
    assert "advisor" in _AUX_TASK_SLOTS


def test_only_material_or_unknown_tools_require_a_plan_checkpoint():
    assert batch_requires_review([_tool("read_file")]) is False
    assert batch_requires_review([_tool("read_file"), _tool("patch")]) is True
    assert batch_requires_review([_tool("plugin_may_mutate")]) is True


def test_plan_packet_uses_redacted_arguments_not_raw_secret():
    packet = build_plan_packet(
        objective="update the app",
        assistant_text="I will save the configuration",
        tool_calls=[_tool("terminal", '{"command":"deploy","api_key":"super-secret"}')],
    )

    serialized = str(packet)
    assert "super-secret" not in serialized
    assert packet["proposed_actions"][0]["tool"] == "terminal"
    assert packet["proposed_actions"][0]["argument_keys"] == ["api_key", "command"]


def test_review_call_has_no_tools_and_parses_compact_verdict():
    seen = {}

    def fake_call(**kwargs):
        seen.update(kwargs)
        return _response('{"verdict":"REVISE","summary":"Missing test evidence","feedback":"Run the focused test and report its result."}')

    decision = review_packet({"checkpoint": "final"}, call_fn=fake_call)

    assert decision.verdict == "REVISE"
    assert seen["task"] == "advisor"
    assert seen["tools"] is None
    assert "chain-of-thought" in seen["messages"][0]["content"]


def test_review_failure_is_fail_open_without_exposing_exception_text():
    def broken_call(**_kwargs):
        raise RuntimeError("token=private")

    decision = review_packet({"checkpoint": "plan"}, call_fn=broken_call)

    assert decision.passes is True
    assert decision.available is False
    assert decision.error == "RuntimeError"
    assert "private" not in decision.summary


def test_required_advisor_blocks_when_unavailable():
    unavailable = review_packet(
        {"checkpoint": "plan"},
        call_fn=lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("offline")),
    )
    required = enforce_availability_policy(
        unavailable,
        settings_from_config({"advisor": {"enabled": True, "fail_open": False}}),
    )

    assert required.verdict == "BLOCK"
    assert required.available is False


def test_non_pass_verdict_requires_actionable_feedback():
    with pytest.raises(ValueError, match="requires feedback"):
        parse_decision('{"verdict":"BLOCK","summary":"unsafe","feedback":""}')


def test_withheld_result_keeps_feedback_structured_for_working_model():
    decision = parse_decision(
        '{"verdict":"ASK_USER","summary":"Target unclear","feedback":"Ask which environment to change."}'
    )
    result = withheld_tool_result(decision)

    assert '"withheld_by": "advisor"' in result
    assert "Ask which environment" in result
