# Claude Code bridge: RED seam

## Decision

The Claude Pro/Max bridge is **RED** for engine `v2026.8.27`, exact commit
`5fc308a70719a83cccdbba4c0e39c23f5a8239d5`. Do not materialize the bridge
from the Fable bundle and do not simulate it with a model-provider plugin or a
runtime monkeypatch. The Vietnamese edition may expose this capability only
after the generic upstream seam below exists and the fail-closed contract has
passed with sanitized real Claude Code fixtures.

This is a missing engine extension seam, not an edition-overlay defect.

## Evidence from the locked upstream

The observations below are tied to the exact commit above rather than to a
moving branch:

- `providers/base.py:1-10` explicitly defines `ProviderProfile` as declarative
  and says profiles do not own client construction, credential rotation, or
  streaming. Consequently, adding a `claude-code` profile can advertise a
  provider but cannot create or drive the Claude Code process.
- The locked commit has no
  `plugins/model-providers/claude-code/{__init__.py,plugin.yaml}`. The equivalent
  files in the Fable component only instantiate a `ProviderProfile`; they do
  not supply the missing runtime ownership.
- `hermes_cli/auth.py:7263-7290` presents a generic-looking external-process
  status function, but it hard-codes `HERMES_COPILOT_ACP_COMMAND`,
  `COPILOT_CLI_PATH`, `HERMES_COPILOT_ACP_ARGS`, the `copilot` executable, and
  `--acp --stdio`.
- `hermes_cli/auth.py:7310-7311` dispatches external-process status only when
  the provider name is exactly `copilot-acp`. Lines `7486-7523` likewise resolve
  every external-process provider as Copilot and return the Copilot sentinel
  API key.
- `hermes_cli/runtime_provider.py:2158-2169` enters the external-process runtime
  path only for `provider == "copilot-acp"`.
- `agent/agent_runtime_helpers.py:2601-2611` constructs a process client only
  for Copilot, using `CopilotACPClient`; all other providers continue into the
  existing native/OpenAI-compatible client paths.
- `hermes_cli/main.py:4142-4164` dispatches model setup by provider name and has
  a dedicated `_model_flow_copilot_acp` branch rather than a common
  external-process flow derived from a profile.

Therefore a profile-only Claude addition cannot connect authentication,
credential resolution, model setup, client construction, and streaming. A
fake plugin would appear selectable while failing or falling through to an
unrelated transport at runtime.

## Smallest generic upstream seam

Implement this as an upstream engine change with provider-neutral tests, not
as a Vietnamese-edition exception:

1. Add default hooks to `ProviderProfile`:
   `external_process_status()`, `resolve_external_process_credentials()`, and
   `create_client()`. Defaults must decline safely so existing providers keep
   their current behavior.
2. In `hermes_cli/auth.py`, discover profiles whose `auth_type` is
   `external_process` and delegate status and credential resolution to those
   hooks. Remove the assumption that every such profile is Copilot.
3. In `hermes_cli/runtime_provider.py`, select the external-process path by
   `auth_type`, then return the provider-owned, validated runtime details; do
   not branch on a Claude or Copilot name.
4. In `agent/agent_runtime_helpers.py`, ask the resolved profile's
   `create_client()` hook for a client before falling through to the generic
   OpenAI-compatible constructor. Preserve the current Copilot behavior
   through its own profile/adapter.
5. Replace the provider-name-only setup branch with a common external-process
   setup flow that uses the profile's status/credential hooks and
   `fallback_models`.

The seam is acceptable only when a second external-process provider can be
implemented without adding another provider-name condition to these shared
files.

## Approved Claude fail-closed contract

### Preflight

Treat Claude Code as authenticated only when one bounded preflight returns all
of the following:

- process exit code is `0`;
- parsed output is a JSON object;
- `loggedIn` is exactly `true`;
- `authMethod` is exactly `claude.ai`;
- `apiProvider` is exactly `firstParty`.

`subscriptionType` is diagnostic metadata only. It must not be required for
authorization because valid observed output may leave it empty. Malformed,
partial, timed-out, or contradictory output is unauthenticated.

### Stream state machine

The only accepted progression is:

```text
WAIT_INIT -> SAFE_INIT -> SUCCESS_RESULT
```

- `WAIT_INIT`: buffer output and expose none of it to the Hermes conversation.
- `SAFE_INIT`: enter only after a valid `system/init` event whose
  `apiKeySource` is exactly `none`.
- `SUCCESS_RESULT`: finish only after a terminal successful result following
  `SAFE_INIT`.

The total pre-init buffer is capped at **256 KiB**. Crossing the cap aborts the
turn; it must never switch to pass-through behavior.

Reject the run when any of these occurs:

- unsafe or missing `system/init`;
- a result arrives before safe init;
- the stream ends without an explicit successful result;
- a result reports `is_error`;
- any event reports `overage: true`;
- JSON is malformed, required fields are absent, ordering is invalid, or the
  process exits unsuccessfully.

There is no environment-variable bypass for preflight, init validation, buffer
limits, or terminal-result validation. User-facing failures must be generic;
logs and support output must not expose raw stdout/stderr, tokens, account
identifiers, local paths, or the rejected event payload.

## Gate to leave RED

RED may change only after all of the following are evidenced on the locked
engine (or a newly locked upstream tag):

- provider-neutral seam tests cover at least Copilot and Claude without new
  provider-name branches;
- sanitized real fixtures cover valid login/init/result plus every rejection
  case above;
- unit and integration tests prove no content is emitted before `SAFE_INIT`,
  the 256 KiB cap is enforced, and every invalid lifecycle fails closed;
- source gates, build gate, packaged smoke, disposable-profile lifecycle, and
  rollback rehearsal are green.

Until then, Claude bridge remains absent from the materialized Vietnamese
edition. This document records the exact missing seam; it is not an
implementation or a release claim.
