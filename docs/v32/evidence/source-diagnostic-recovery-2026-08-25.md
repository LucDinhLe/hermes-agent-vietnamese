# V32 source diagnostic recovery checkpoint

Date: 2026-08-25 (Asia/Saigon)

Status: source recovery complete; immutable full-suite and candidate build
remain pending.

## Frozen implementation state

- Branch: `feat/v32-token-context-ux`
- Source-fix commit: `6626f46b7`
- Candidate version: `0.32.0-vi.1`
- Candidate tag label: `vi-v0.32.0-1`
- Release class: `community-prerelease`
- Exceptional candidate build retry: **0 of 1 used**
- Provider/network calls: none; all runtime checks used mocks or local loopback.

The exceptional retry must not be used until the final source commit passes the
full Python suite, exact pinned-Node desktop gates, prebuild validation and the
offline v32 benchmark.

## Diagnostic origin

The first full Python diagnostic ran from a git archive without `.git` metadata.
It completed with 33,773 passed, 36 failed and 330 skipped tests. The failures
were treated as diagnostic input, not as a release decision. Every failing or
timed-out file was classified and rerun after fixing the product or the test
harness cause.

Product fixes closed by `6626f46b7`:

- cold `GoalManager` database bootstrap no longer blocks the gateway event loop
  or loses a successful `/goal` write;
- goal/loop database boundary checks run through the gateway executor;
- shared relay metrics acquire SQLite's writer lock before concurrent UPSERTs;
- command transcription uses a bounded first-byte startup grace, then restores
  the caller's exact idle timeout after every chunk;
- voice environment detection uses the single patchable WSL predicate.

Harness fixes replace scheduler-sensitive wall-clock guesses with deterministic
barriers, events, operation counts or outer hang watchdogs. Windows update tests
also isolate gateway discovery, backup and pause/resume hooks from the host.

## Canonical recovery receipts

All Python commands used the repository wrapper through Git Bash.

### Update isolation

- `tests/hermes_cli/test_cmd_update.py`: 35 passed, 0 failed.
- `tests/hermes_cli/test_update_yes_flag.py`: 6 passed, 0 failed in the focused
  collection.
- A targeted post-run check found 27 stale Python launcher stubs whose resolved
  executable was exactly the v32 repository `.venv`; those exact PIDs were
  stopped. Re-running the fixed regression left 0 matching processes. No v31
  process or real Hermes profile was touched.

### Diagnostic recovery collection

- Files: 30
- Passed: 1,690
- Failed: 0
- Skipped: 9
- Initial duration: 677.8 seconds with 12 workers

The runner reported one first-attempt flake in
`test_profile_scoped_agent_build_starts_mcp_discovery_in_profile_home` before
its automatic file retry. That result was not accepted as green. The test now
isolates unrelated post-build hooks and joins the exact build thread before
removing its session, preventing a timed-out thread from leaking into the next
test.

### Flake closure

- Both affected profile-scoped build regressions passed repeatedly after the
  fix.
- `tests/test_tui_gateway_server.py` then ran with
  `HERMES_TEST_FILE_RETRIES=0`: 589 passed, 0 failed in 183.0 seconds.
- Ruff passed on every changed Python file.
- `git diff --check` passed.

## Previously green source gates still requiring exact-final-SHA rerun

- Renderer Vitest: 548 files, 4,943 tests passed.
- Electron Vitest: 121 files passed, 1 skipped; 1,548 tests passed, 12 skipped.
- Renderer, Electron and E2E typechecks: passed.
- Standard lint: passed with the repository's existing warnings.
- Exact Windows source E2E: session-tab `+` and v32 UX evidence passed alone
  and together; Messaging back navigation preserved the draft and the context
  meter showed separate context/quota/API-equivalent fields.
- Offline v32 benchmark and the >350k logical-context continuation receipt:
  passed at the earlier implementation checkpoint.

## Continuation state

1. Commit the unpublished v32 candidate metadata and this checkpoint.
2. Create a clean clone that retains `.git`, checked out at the final commit.
3. Run the complete Python suite with a 900-second per-file watchdog and no
   accepted flaky retry.
4. Rerun exact pinned-Node renderer, Electron, E2E, typecheck, lint, prebuild,
   offline benchmark and >300k continuity gates on the same commit.
5. Only after all source gates are green, obtain explicit approval before
   pushing this public repository branch.
6. Use the one exceptional Windows x64 candidate build retry on that frozen
   commit, then verify exact-byte packaged smoke and isolated lifecycle.

Windows Sandbox and Hyper-V were not available on the host at this checkpoint.
Lifecycle acceptance remains required in a disposable Windows Sandbox or VM;
host installation is not an allowed substitute.
