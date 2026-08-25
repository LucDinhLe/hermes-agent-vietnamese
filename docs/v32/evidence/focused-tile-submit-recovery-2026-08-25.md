# V32 focused-session submit recovery checkpoint

Date: 2026-08-25 (Asia/Saigon)

Status: product fix committed and desktop source gates passed; no final
candidate exists. A new candidate build requires fresh owner approval.

## Decision log

1. The one exceptional candidate build authorized from
   `a606d80a4a6a01e4fe91cd3ed373b2c962a7d6f0` was consumed. It failed while
   electron-builder executed its temporary unsigned NSIS bootstrap, which
   Windows Smart App Control blocked. No complete installer was produced.
2. Commit `cf707ead088fc50cfb3d0b47e8f2edf802c1ad0f` replaced that blocked
   bootstrap execution with electron-builder's NSIS uninstaller reader. Its
   node-level regressions pass, but this recovery has not been exercised by a
   second candidate build because no further build is authorized.
3. Diagnostic packaged testing then exposed a second product defect: a fresh
   focused session tile created an optimistic sidebar row, but its provider
   turn was silently aborted before `prompt.submit`.
4. The product defect and its regression coverage are committed at
   `218a007ea914d698e1706cd08ca8c56688f6dcc4`. This commit is source-ready but
   is not a candidate and must not inherit the hashes of the superseded
   diagnostic installer.

No tag, draft release, merge, public release, GitHub Latest mutation, signing,
live provider call, host-profile install, or real-user-profile mutation was
performed.

## Product root cause and fix

The shared submit drift guard correctly rejects a turn when its composer moves
to a different session while the request is being prepared. Primary chat uses
a lineage-root composer key. A session tile uses a source-qualified key of the
form `sessionTileIdentity(owner, lineageRoot)`.

The tile passed the source-qualified key as `composerScope`, but the guard
recomputed only the bare lineage-root key. Those two namespaces could never be
equal, so every fresh tile turn false-positive-aborted after the optimistic row
was created and before the gateway received `prompt.submit`.

The shared submit hook now accepts a composer-scope resolver seam. Primary chat
retains the stable lineage-root resolver; session tiles inject an owner-aware
resolver. The guard therefore still catches real route drift while accepting a
turn that remains in the same focused tile.

Regression coverage:

- `apps/desktop/src/app/chat/session-tile-actions.test.ts` proves an exact
  source-qualified tile scope reaches `prompt.submit` with the intended
  runtime and text.
- `apps/desktop/e2e/v32-ux-evidence.spec.ts` physically clicks `+`, waits for
  the new tile backend, physically clicks Send, requires the prompt and mock
  reply inside that tile's visible chat surface, opens Messaging, clicks Back,
  and proves both the exact tile transcript and its unsent draft survive.
- `apps/desktop/e2e/v32-packaged-smoke.spec.ts` now applies the same strict
  active-surface assertions for the future exact candidate, including relaunch
  and compaction checks.

## Test-runner regression found while closing the gate

The Electron Vitest project matched the Windows NSIS patch's `node:test` file
because both used a `*.test.mjs` suffix. Its five node tests passed, but Vitest
then correctly failed the file as a zero-Vitest-suite input. The Vitest project
now excludes both builder patch node suites, while the release workflow keeps
running them explicitly. `release-workflow-contract.test.mjs` locks this
separation so a future patch suite cannot silently poison the full gate.

## Exact receipts for product commit `218a007e`

All app runs used a disposable `HERMES_HOME`, disposable Electron user data,
credential stripping, and the local mock inference server.

| Gate | Receipt |
| --- | --- |
| Focused submit/context regressions | 5 files passed; 164 tests passed |
| Physical pointer E2E | 1 passed; focused tile send, reply, Messaging Back, draft and context meter verified |
| Renderer production source build | 15,058 modules transformed; passed |
| Desktop UI Vitest | 549 files passed; 4,948 tests passed; 0 failed |
| Electron/platform Vitest | 122 files passed, 1 skipped; 1,555 tests passed, 12 skipped; 0 failed |
| Combined Desktop Vitest | 671 files passed, 1 skipped; 6,503 tests passed, 12 skipped; 0 failed |
| Canonical Python tree | Byte-identical to gated commit `a606d80a`; 3,082 files, 34,863 passed, 368 skipped, 0 failed |
| Windows NSIS node regression | 5 passed; 0 failed |
| Release/Vitest contract regression | 12 passed; 0 failed |
| Desktop typecheck | Passed |
| Desktop lint | 0 errors; 169 repository-baseline warnings |
| Diff hygiene | `git diff --check` passed |

The first Electron/platform run after adding the NSIS patch test is recorded as
a genuine intermediate gate failure: 122 files and 1,554 tests passed, but
Vitest rejected the separate `node:test` file as a suite with zero Vitest
tests. The root cause was fixed, regression coverage was added, and the entire
platform gate then passed. No test, assertion, timeout, or coverage was
weakened.

### Rejected Python revalidation lanes

A fresh canonical command was attempted after the desktop-only fix, but the
Codex sandbox token was not a valid Windows certification host: it identified
itself as `pytest-of-unknown`, had no symlink privilege or access to the real
user home, and Git Bash/Windows path tests consequently produced a growing set
of false failures. The run was stopped after the common environment signature
was established. A four-file probe under the real Windows account was also
rejected before test execution because the sandbox-owned repository and temp
base denied that account write access.

Neither rejected lane is counted as a source gate. Git proves that the complete
Python product/test/runner tree is unchanged from the already canonical-gated
commit:

```text
git diff --quiet a606d80a4a6a01e4fe91cd3ed373b2c962a7d6f0..HEAD -- \
  '*.py' 'tests/**/*.py' 'scripts/run_tests.sh' 'scripts/run_tests_parallel.py'
exit 0
```

The accepted canonical receipt therefore remains the exact receipt for the
unchanged Python tree. The late commits change only desktop TypeScript/E2E,
release JavaScript/workflow and evidence; those changed surfaces were rerun in
their native gates above. Do not weaken or alter unrelated Python tests to make
the restricted sandbox impersonate a Windows certification account.

## Candidate boundary

The old diagnostic installer is superseded and cannot verify this source fix:

| Field | Superseded diagnostic value |
| --- | --- |
| Version | `0.32.0-vi.1` |
| Runtime/source stamp | `6c9cefe83925405f0a74116af42618ed94186729` |
| Size | `341157326` bytes |
| SHA-256 | `19ea81daad306a46145ee70996b2fb46b0dfac8592d95df387c2429e2cbe0b93` |
| Disposition | Diagnostic only; never stage or promote |

The incomplete NSIS bootstrap and extracted uninstaller from the failed build
are diagnostic fragments, not candidates. They must never be named, staged,
or promoted as the v32 installer.

## Continuation state

1. Commit this checkpoint and push `feat/v32-token-context-ux` to the already
   owner-approved public GitHub branch.
2. Ask the owner for exactly one fresh confirmation to build a replacement
   Windows x64 candidate from the new exact pushed SHA. Do not build before
   that confirmation.
3. On approval, build once using pinned Node 26, record exact commit, version,
   artifact, byte size and SHA-256, and run exact-byte packaged provenance plus
   packaged E2E in the isolated mock profile.
4. Run fresh install, update from v31, relaunch, persistence, repair, uninstall
   and rollback to `vi-v0.20.4-39` in an isolated Windows environment. Never
   substitute the host Hermes profile or install the candidate on the host.
5. Only after every lifecycle receipt passes, preserve the accepted bytes in
   private immutable staging. Merge, public release and GitHub Latest remain
   separate owner-approval actions.

Until steps 2-5 pass, the decision remains source-ready / candidate absent,
not technical GO.
