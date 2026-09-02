"""Core-facing request builders for plan and final review checkpoints."""

from types import SimpleNamespace

from agent.review_checkpoints import (
    bounded_review_evidence,
    bounded_review_user_context,
    create_review_checkpoint_runtime,
    review_final_checkpoint,
    review_tool_checkpoint,
)
from agent.review_runner import ReviewResult


def _runtime(calls, *, enabled=True):
    def run(request):
        calls.append(request)
        return ReviewResult(
            checkpoint_id=request.checkpoint_id,
            status="completed",
            verdict="PASS",
        )

    return create_review_checkpoint_runtime(
        session_id="session-1",
        provider="openai-codex",
        model="gpt-review",
        enabled=enabled,
        run_review_fn=run,
    )


def _agent(runtime):
    return SimpleNamespace(
        review_checkpoint_runtime=runtime,
        provider="openai-codex",
        model="gpt-economy",
    )


def _tool(name, arguments):
    return SimpleNamespace(
        function=SimpleNamespace(name=name, arguments=arguments)
    )


def test_tool_checkpoint_sends_names_effects_and_argument_keys_not_values():
    calls = []
    decision = review_tool_checkpoint(
        _agent(_runtime(calls)),
        turn_id="turn-1",
        attempt=0,
        user_message="Update the file",
        assistant_content="I will inspect then update it.",
        tool_calls=[
            _tool("read_file", '{"path":"C:/private/secret.txt"}'),
            _tool("write_file", '{"path":"C:/private/secret.txt","content":"secret"}'),
        ],
    )

    assert decision.action == "continue"
    request = calls[0]
    assert request.phase == "plan"
    assert request.checkpoint_id == "turn-1:plan:0"
    assert request.provider == "openai-codex"
    assert request.model == "gpt-review"
    assert request.main_model == "gpt-economy"
    assert request.candidate["actions"] == [
        {
            "tool": "read_file",
            "effect": "read",
            "argument_keys": ["path"],
            "redacted_arguments": {},
        },
        {
            "tool": "write_file",
            "effect": "state_change",
            "argument_keys": ["content", "path"],
            "redacted_arguments": {},
        },
    ]
    assert "C:/private" not in str(request.candidate)
    assert '"secret"' not in str(request.candidate)


def test_read_only_plan_skips_reviewer_call():
    calls = []
    decision = review_tool_checkpoint(
        _agent(_runtime(calls)),
        turn_id="turn-1",
        attempt=0,
        user_message="Inspect only",
        assistant_content="I will inspect.",
        tool_calls=[_tool("read_file", '{"path":"README.md"}')],
    )

    assert decision.action == "continue"
    assert decision.reason == "read_only_plan"
    assert calls == []


def test_final_checkpoint_holds_bounded_candidate_and_evidence():
    calls = []
    decision = review_final_checkpoint(
        _agent(_runtime(calls)),
        turn_id="turn-1",
        attempt=1,
        user_message="Finish the task",
        final_response="Completed safely.",
        evidence=["36 tests passed"],
    )

    assert decision.action == "continue"
    request = calls[0]
    assert request.phase == "final"
    assert request.attempt == 1
    assert request.candidate == {
        "summary": "Completed safely.",
        "evidence": ["36 tests passed"],
    }


def test_final_review_keeps_multimodal_objective_and_recent_attachment_context():
    calls = []
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,aGVsbG8="}}
    earlier = [{"type": "text", "text": "lỗi trong ảnh này là gì?"}, image]
    review_final_checkpoint(
        _agent(_runtime(calls)), turn_id="image-turn", attempt=0,
        user_message=[{"type": "text", "text": "ảnh ở trên đó"}],
        final_response="Lỗi model.",
        messages=[{"role": "user", "content": earlier},
                  {"role": "assistant", "content": "private assistant reasoning"}],
    )
    request = calls[0]
    assert request.objective == "ảnh ở trên đó"
    assert request.image_parts == (image,)
    assert request.candidate["user_context"] == ["lỗi trong ảnh này là gì?", "ảnh ở trên đó"]
    assert "private assistant reasoning" not in str(request.candidate)


def test_review_retains_image_reference_without_reading_arbitrary_files():
    calls = []
    review_final_checkpoint(
        _agent(_runtime(calls)), turn_id="refs", attempt=0,
        user_message='lỗi gì?\n@image:"C:/uploads/error.png"', final_response="Lỗi model.",
        messages=[],
    )
    assert '@image:' in calls[0].candidate["user_context"][0]
    assert any("already attached" in c for c in calls[0].constraints)


def test_review_context_bounds_images_and_preserves_chronology_without_synthetic_feedback():
    def image(number):
        return {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{number}"}}
    messages = [
        {"role": "user", "content": [{"type": "text", "text": "older"}, image(1), image(2)]},
        {"role": "user", "content": [{"type": "text", "text": "newer"}, image(3), image(4), image(5)]},
        {"role": "user", "content": "review feedback", "_review_revision_synthetic": True},
    ]
    texts, images = bounded_review_user_context(messages, "compare")
    assert texts == ["older", "newer", "compare"]
    assert images == (image(1), image(3), image(4), image(5))


def test_bounded_evidence_uses_recent_tool_results_not_full_history():
    messages = [{"role": "user", "content": "private prompt"}]
    messages.extend(
        {"role": "tool", "name": "read_file", "content": f"proof-{index}"}
        for index in range(25)
    )

    evidence = bounded_review_evidence(messages)

    assert len(evidence) == 20
    assert evidence[0] == "read_file: proof-5"
    assert evidence[-1] == "read_file: proof-24"
    assert "private prompt" not in str(evidence)


def test_disabled_runtime_is_zero_call_noop_at_both_seams():
    calls = []
    agent = _agent(_runtime(calls, enabled=False))

    plan = review_tool_checkpoint(
        agent,
        turn_id="turn-1",
        attempt=0,
        user_message="Do it",
        assistant_content="",
        tool_calls=[_tool("write_file", "{}")],
    )
    final = review_final_checkpoint(
        agent,
        turn_id="turn-1",
        attempt=0,
        user_message="Do it",
        final_response="Done",
    )

    assert plan.action == "continue"
    assert final.action == "continue"
    assert calls == []
