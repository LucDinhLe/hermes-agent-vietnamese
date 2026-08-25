# V32 packaged-smoke UX-002 recovery checkpoint

Date: 2026-08-25 (Asia/Saigon)

Status: source fix complete and fully gated; replacement candidate build needs
fresh owner approval.

## Decision

The first exact packaged run was accepted as diagnostic evidence, not as the
final v32 candidate. It exposed a real UX-002 defect when Messaging covered a
focused session tile: Back returned to the primary session and the visible
tile-owned draft appeared to be lost. The source cause is fixed by
`db17dd541c61c5f54dd273ebb066c86543c69b1b`.

The existing installer remains byte-for-byte intact, but it predates this fix
and therefore cannot receive technical GO or be staged as the final candidate.
No tag, GitHub draft release, merge, public release, or Latest change has been
made.

## Diagnostic candidate identity

| Field | Value |
| --- | --- |
| Version | `0.32.0-vi.1` |
| Candidate label | `vi-v0.32.0-1` |
| Runtime/source stamp | `6c9cefe83925405f0a74116af42618ed94186729` |
| Installer | `Hermes-0.32.0-vi.1-win-x64.exe` |
| Size | `341157326` bytes |
| SHA-256 | `19ea81daad306a46145ee70996b2fb46b0dfac8592d95df387c2429e2cbe0b93` |
| Authenticode | Not signed |
| Disposition | Superseded diagnostic candidate; do not stage or promote |

The candidate-build allowance used for this diagnostic artifact is exhausted.
Do not run another source or candidate build without a new explicit owner
approval. Typecheck, lint, unit/integration tests, read-only provenance checks,
and documentation do not consume another build.

## Root causes and fixes

### Completion accounting in the packaged harness

One simple user prompt legitimately produced one main agent request and one
background title-generation request. The old packaged assertion counted both
requests by repeated user text and misreported a tool loop. The mock server now
classifies every completion as `agent`, `title_generation`, or `auxiliary` from
the request contract. The packaged assertion measures the main-agent count
relative to its baseline and retains all auxiliary traffic for evidence.

Regression coverage:

- `apps/desktop/scripts/mock-completion-classification.test.mjs`
- `apps/desktop/e2e/v32-packaged-smoke.spec.ts`

### Messaging Back from a focused session tile

Messaging previously navigated using only the primary selected session. A
focused tile owns a separate, owner-scoped composer key, and the page covers
that tile without unmounting it. Back therefore selected the wrong surface and
left the visible draft behind under the tile key.

The fixed flow synchronously flushes the active composer, resolves the exact
focused tile and its durable lineage root, moves the authoritative draft over
any stale primary snapshot, and navigates back to that exact session.

Regression coverage:

- `apps/desktop/src/store/composer.test.ts`
- `apps/desktop/src/app/messaging/return-to-session.test.ts`
- `apps/desktop/src/app/messaging/index.test.tsx`
- `apps/desktop/e2e/v32-ux-evidence.spec.ts`, upgraded to a physical multi-tab
  setup so primary-only coverage cannot mask the defect again.

## Final source receipts for the recovery commit

All checks used local dependencies and mocks. There were no live provider calls,
quota consumption, host-profile installs, signing operations, or public release
mutations.

| Gate | Receipt |
| --- | --- |
| Desktop typecheck | Passed |
| Desktop lint | Passed: 0 errors, 169 repository-baseline warnings |
| Focused recovery tests | 31 passed, 0 failed |
| Full Desktop Vitest | 671 files passed, 1 skipped; 6501 tests passed, 12 skipped; 0 failed |
| Full-suite command | `npx vitest run --reporter=default --maxWorkers=6` |
| Full-suite duration | 678.87 seconds |
| Diff hygiene | `git diff --check` passed |

The first unrestricted 22-worker full-suite attempt was not accepted: two
unrelated CPU-starved tests exceeded their existing 30/60-second budgets. Both
passed together in isolation (9/9), and the complete unmodified 672-file suite
then passed with six workers. No timeout was raised, test was removed, or
coverage was weakened.

## Continuation state

1. Push the recovery and this checkpoint to the already approved public branch
   `feat/v32-token-context-ux`.
2. Obtain one explicit owner approval for a replacement Windows x64 candidate
   build from the new exact branch tip. The old bytes cannot verify UX-002.
3. Build once, record commit/version/size/SHA-256, and run exact-byte packaged
   provenance plus packaged v32 E2E in the isolated mock profile.
4. Run fresh install, v31 update, relaunch, persistence, repair, both uninstall
   modes, and rollback to `vi-v0.20.4-39` inside a disposable Windows x64
   Sandbox or equivalent VM. Windows Sandbox and Hyper-V are absent on this
   host; never substitute a host install.
5. Only after every lifecycle receipt passes, create private immutable staging.
   Merge, public release, and GitHub Latest remain owner-approval actions.
