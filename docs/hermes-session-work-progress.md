# Hermes session work progress

## Objective

Show a compact, transient explanation of the active agent loop inside each
conversation. The row tells the user what Hermes is doing and the operational
reason for that step. It must explicitly surface the Advisor plan checkpoint
before state-changing work and the Advisor final checkpoint before delivery.

## Product contract

- Progress belongs to one runtime session. A primary conversation and every
  tiled conversation keep independent state.
- Progress appears only while that turn is live and disappears on completion,
  interruption, failure, or runtime teardown.
- There is no separate progress or thinking toggle.
- Advisor progress is sourced from structured core events, not inferred by
  parsing English status strings.
- The visible reason describes the purpose of a workflow step. It must not
  expose, reconstruct, or claim to show private chain-of-thought.
- The two required Advisor checkpoints are:
  - `plan`: verify objective alignment, constraints, authorization, and the
    proposed actions before mutations run.
  - `final`: compare the candidate result and available evidence with the
    original objective before the answer is delivered.
- A materially changed approach may use the existing `recovery` checkpoint and
  is presented as another plan review.
- Advisor revision, unavailable, failed, and unresolved outcomes remain visible
  until the next real workflow event or the turn ends.

## Event contract

The agent emits `advisor.progress` with a small redacted payload:

```json
{
  "checkpoint": "plan|recovery|final",
  "state": "reviewing|passed|revision_requested|unavailable|failed|unresolved",
  "summary": "optional compact Advisor finding"
}
```

The Desktop also projects existing message, reasoning, and tool lifecycle
events into generic work phases. These phrases are deterministic UI copy. They
explain the purpose of the phase without exposing model reasoning.

## Acceptance evidence

- A test proves plan and final Advisor events are emitted in loop order.
- A gateway test proves only the Advisor event is bridged and its session id is
  preserved.
- Desktop tests prove two sessions cannot overwrite one another and terminal
  events clear only their own progress.
- A component test proves both the action and the reason are visible.
- Targeted Python tests, UI tests, typecheck, lint, and formatting pass.

## Rollback

Remove the `advisor.progress` bridge and Desktop `work-progress` projection.
The existing Advisor enforcement and text lifecycle statuses continue to work
unchanged.
