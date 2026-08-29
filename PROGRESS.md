# Progress — Hermes Vietnamese V33

## 2026-08-29 — V33 dev.3/dev.4 Windows x64 staging lane

### Implemented

- Advanced the edition through `0.33.0-dev.4`; electron-builder now receives that
  edition version instead of the unrelated upstream desktop version `0.17.0`.
  This prevents Windows from classifying V33 as older than V32.1-18.
- Added a V33-branch-scoped Windows x64 staging workflow. It materializes from a
  clean remote-reachable shell commit in release mode, builds once, packages
  one unsigned NSIS candidate without rebuilding, hashes it once, and never
  creates a tag, release, update feed, or Latest promotion.
- Added a disposable GitHub-hosted Windows lifecycle for the exact installer:
  fresh install, real installed renderer launch, same-profile restart,
  V32.1-18 in-place update, protected-profile rollback to V32.1-18, and final
  uninstall/registry cleanup. Product binaries are denied Internet and local
  subnet egress during the lifecycle.
- The staging receipt explicitly retains three missing public-release gates:
  real gateway bootstrap, a real chat session, and a safe tool call. The
  current workflow can therefore produce staging evidence but cannot silently
  declare the candidate eligible for Latest.
- The first remote dev.3 lifecycle stopped before opening the app because the
  harness parameter `$Home` collided with PowerShell's read-only `$HOME`.
  Installer build, payload, provenance and checksum had already passed. The
  harness now uses `$HermesHome`, has a regression assertion forbidding the
  reserved name, and the replacement byte stream advances to dev.4.

### Evidence before remote validation

- Shell contracts: 39/39 PASS; edition verification PASS with 11 overlay files
  and four active patches.
- Installed-smoke JavaScript and lifecycle PowerShell parse successfully;
  whitespace validation passes.
- Public V32.1-18 Windows x64 transition fixture is pinned to SHA-256
  `565e1313162505999238b9c3b4f1422ec37256a1da153bae5149b5795c83c5ac`.

Current decision: **GO FOR REMOTE STAGING BUILD AND INSTALLER LIFECYCLE; NO-GO
PUBLIC LATEST UNTIL THE THREE REAL RUNTIME GATES ARE IMPLEMENTED AND PASS**.

## 2026-08-29 — Same-runner Electron baseline gate

### Implemented

- Replaced the single known-red Electron step with three captured runs on the
  same `windows-2025` job and Node 26: untouched locked upstream before V33,
  the materialized V33 tree, and untouched upstream again after V33.
- Added a fail-closed comparator. V33 passes this regression gate only when its
  Electron suite is green or every parsed V33 failure is reproduced by the
  union of both complete pristine-upstream controls. Candidate-only tests,
  missing summaries, unparseable failures, upstream drift and broken evidence
  remain RED.
- The workflow retains both raw logs and a machine-readable comparison beside
  the immutable edition receipt and install stamp. It still builds diagnostic
  evidence and never publishes.

### Evidence before remote validation

- Shell contracts including six comparator regression cases: 33/33 PASS.
- Edition verification: PASS with 11 overlay files and four active patches.
- PowerShell preserves the native exit code through the CI log-capture
  pipeline (`cmd /c exit 7` observed as `7`).
- Prior dev.2 run `33201386174` remained RED only at Electron: 126 files and
  1,926 tests passed; nine files and 38 tests failed. Typecheck, lint, focused
  Vietnamese tests, migration, plugins, full renderer, immutable verification,
  diagnostic build, provenance and evidence upload all passed.
- The first exact comparator run `33229829315` correctly failed closed. V33
  reported 41 failures while the single upstream control reported 38; the
  three additional timing-sensitive tests were the same two `backend-claim`
  cases and one `update-handoff-marker` case already observed in the older
  upstream-baseline run and absent in the immediately preceding dev.2 run.
  Two bracketing controls are now required to capture that demonstrated
  temporal variance without introducing a static allowlist.

Current decision: **GO FOR SAME-RUNNER CI VALIDATION; NO-GO PUBLIC RELEASE OR
USER INSTALL**.

Next smallest step: push this clean CI-only checkpoint, require the comparator
to finish on the exact remote commit, then inspect its retained JSON evidence.

## 2026-08-29 — V33 dev.2 adaptive foreground budget

### Implemented

- Bumped the shell and Vietnamese product metadata to `0.33.0-dev.2` because
  the engine-hotfix patch changes candidate bytes.
- Replaced the fixed foreground ceiling with deterministic per-turn tiers:
  high-confidence simple questions use at most 4 model rounds, ordinary turns
  12, and explicit multi-step, attachment, synthesized or active `/goal` work
  up to 30. No auxiliary model call is spent on classification.
- Existing `agent.max_turns` and `HERMES_TUI_MAX_TURNS` values now act as
  tighter ceilings only. Background/CLI jobs retain their independent limits.
- The prior proportional-effort prompt guidance, exception-proof turn
  settlement and verb-safe desktop timeout recovery remain in the same two
  auditable patch-ledger entries.

### Evidence

- Shell contracts: 27/27 PASS; edition verification PASS with 11 overlay files
  and four active patches.
- Exact locked-engine materialization at `.work/candidate-dev2-r8`: 25 staged
  allowlisted paths, 24 file digests verified, receipt SHA-256
  `6449b28c038d2e971098bc295b31b60eedac5fe0d9f1ef16e23f8a0239f9b459`.
- The functional source was committed as
  `cf794d6e5d2b8607502bb60ddd44fc9556ea0667` and rematerialized from a clean
  shell at `.work/candidate-dev2-cf794d6`: the same 25 paths and 24 digests
  passed with receipt SHA-256
  `f04bafeba42b4dac7a5f283dc0737e2f877e1914fc768c9eae870e5503643e02`.
- Exact materialized source tests through `scripts/run_tests.sh`: prompt builder
  and turn settlement 84 PASS / 1 SKIP; adaptive/config/gateway selection 29
  PASS. The high-confidence fixtures include `chào em`, `mấy giờ rồi`, and the
  reported Hermes/Claude capability question at 4 rounds; explicit repair,
  review, build and active-goal fixtures receive 30.
- A full unrelated `tests/test_tui_gateway_server.py` run again stalled in the
  Windows harness after the other two files completed, matching the previously
  recorded local harness behavior. The selected gateway paths completed green;
  no installed Hermes process or real profile was touched.
- Diff whitespace and changed-file secret scans PASS.

Current decision: **GO FOR CLEAN DEV.2 SOURCE CANDIDATE AND CI VALIDATION;
NO-GO PUBLIC LATEST OR USER INSTALL UNTIL BUILD/LIFECYCLE GATES PASS**.

The first push attempt was blocked before any bytes left the machine because
external Git egress requires explicit owner approval. Next smallest step: after
that approval, push the current clean V33 branch and run the Windows validation
workflow. Public tagging/promotion remains a separate owner decision.

## 2026-08-28 — Fetchable source and first Windows CI

### Remote source

- The standalone shell is now fetchable from the public branch
  `v33/composite-shell` in `LucDinhLe/hermes-agent-vietnamese`. The exact CI
  candidate is `3d4e4c502adbe6dab318c24618d54ac8e7b73570`; the local branch is clean
  and tracks the same remote commit.
- Remote `main` remains unchanged at the V32.1 commit
  `2b47cf5824bdd032c7c965afcff374dd6990888c`. No merge, force-push, PR, tag,
  release or installer publication was performed.
- Before the authoritative run, all GitHub Actions were pinned to immutable
  commit SHAs, the shell package/lock/workflow were aligned to upstream Node
  26, checkout credentials were disabled after fetch, and the focused
  Vietnamese UI suite was constrained to one worker. Local contracts are
  27/27 PASS and edition verification remains PASS.

### Authoritative Windows CI

- Run `33183070842` on `windows-2025` completed in 17m18s at exact shell commit
  `3d4e4c502adbe6dab318c24618d54ac8e7b73570`. Its job conclusion is RED because
  exactly one step failed: the full upstream Electron platform suite.
- Exact engine checkout, Node 26, shell contracts, materialization, locked
  dependency install, Desktop typecheck, lint, focused Vietnamese UI, dormant
  migration, bundled plugins, the full renderer suite, immutable-input check,
  diagnostic build, receipt/stamp verification and evidence upload all PASS.
- Full renderer PASS on the hosted runner after 11m21s. The local four-failure
  `vi-VN` result therefore did not reproduce in the canonical CI locale.
- Full Electron summary: 124 files passed, 11 failed and one skipped; 1,923
  tests passed, 40 failed and five skipped. The failures are concentrated in
  upstream Windows/POSIX path, SSH, symlink/chmod, generated-file and timing
  assumptions; they remain a blocking gate until compared against the exact
  untouched upstream tag on the same runner.
- Evidence artifact `9691094896`,
  `v33-windows-x64-evidence-3d4e4c502adbe6dab318c24618d54ac8e7b73570`,
  is 1,997 bytes and has GitHub artifact digest
  `sha256:1a13c5f7e071a091650621aba8517b40dcd8ee8549314067bd174be16092c346`.
  It contains exactly `edition-receipt.json` (SHA-256
  `cebf323c47b4a5141c51a6dbc4b5f4936a9640cb3e67359668c616135589d89b`)
  and `install-stamp.json` (SHA-256
  `54278b7459ce96b25ce1c9866e778fddb3358487d33c3e1e66799806060c4e4f`).
  The receipt records `releaseMode: false`, exact engine `5fc308a70719`, exact
  clean shell `3d4e4c502adb`, 11 overlays, two patches and 17 allowlisted changed
  paths. The install stamp remains `dirty/local`, as required for a diagnostic
  materialized build rather than a release artifact.
- Runs `33182571961` and `33182960277` were cancelled by concurrency after
  their configurations were superseded. They are not product failures and are
  retained as process evidence.

Current decision remains: **GO FOR BUILD-ONLY DEVELOPER PREVIEW; NO-GO RELEASE
CANDIDATE, INSTALLER OR HOST LAUNCH**.

Next smallest step: run the identical full Electron suite against the untouched
locked upstream tag on the same Windows runner, then classify each of the 11
failed files as upstream baseline or edition-induced before changing code or
waiving any gate.

## 2026-08-28 — Composite shell implemented

### Locked inputs

- Official upstream annotated tag `v2026.8.27` is pinned to tag object
  `fcebd62163497e77e5de00d26d2ed86cb4ef8761` and commit
  `5fc308a70719a83cccdbba4c0e39c23f5a8239d5` (Hermes Agent `0.20.6`, desktop
  `0.17.0`). The tag is unsigned; no signature claim is made.
- The V32.1 checkout remains untouched. A trial merge in an isolated audit clone
  produced 156 conflicts, including 116 desktop paths, and was aborted cleanly.
- The eight-commit Fable bundle remains unapplied wholesale. Its bundle, patch
  and guide SHA-256 values and per-component decisions are recorded in the
  salvage ledger.

### Implemented

- Standalone Vietnamese shell repository: no Hermes Python engine fork is
  tracked here. All ownership is constrained to `apps/desktop/`.
- Disposable materializer verifies the exact tag object/commit, applies two
  active patch-ledger entries, copies 11 overlay files, hashes every copied file,
  applies presentation-only branding, rejects concurrent source drift and emits
  an immutable edition receipt.
- `engine:update` verifies the official live remote tag object plus peeled
  commit, proves every active patch against a temporary exact worktree, and
  updates lock, patch provenance and user-visible engine metadata together.
- Vietnamese locale was rebased as typed source; the bundled
  `hermes-vietnamese` plugin owns product/support/community UI and emits a
  redacted support report.
- The receipt is packaged beside the upstream install stamp. A provenance
  verifier binds engine commit, shell commit, changed-path ledger, overlay file
  hashes and patch hashes for both diagnostic and candidate flows.
- Materialized-tree verification now derives its expected paths from the signed
  contract instead of trusting the receipt, rejects untracked non-ignored files,
  and proves each overlay digest. Packaged verification binds the exact
  pre-build receipt SHA and rechecks the live shell commit/clean state.
- Product metadata now lives inside the bundled plugin boundary as its single
  source of truth. Upstream lint therefore enforces the same isolation as any
  separately distributed plugin; updater and verifier read that canonical file.
- Identity migration was rewritten and accepted by independent audit as dormant
  source only. Installer identity, app ID, executable, protocol and data roots
  remain the upstream values.
- Windows x64 CI validates focused Vietnamese UI/migration gates independently,
  records diagnostic `releaseMode: false`, runs the known-red full upstream
  suites without hiding failures, builds once and never publishes.

### Evidence

- Shell contract suite: 27/27 PASS.
- Edition boundary: PASS — 11 overlay files, two active patches, no path outside
  `apps/desktop/`.
- Live official engine-update dry-run: PASS; exact annotated tag object and
  peeled commit match the lock, and both patches apply cleanly.
- Dormant migration: 28/28 PASS by the writer and 28/28 independently; high-risk
  fault subset 7/7 independently. Final library SHA-256:
  `C793564E827A80112476A4619208271A2CB4FBA1F091D776BCC2DD8B81E30593`.
- Fresh clean diagnostic materialization from shell commit
  `ea2955d85b1af5dd6aadc47470f2e85973f16cc4`: 17 allowlisted changed paths and
  16 materialized-file SHA-256 values verified. The pre/post-build receipt is
  `3ae52c021df3da1a83c7d4a670bcb27a25f0b85f7f19830e2c586c4e1fe8b346`.
- Exact locked install outside the restricted agent sandbox: 1,337 packages;
  required `get-windows` and `node-pty` native payloads present. Two upstream
  high-severity dependency advisories remain recorded and were not force-fixed.
- Desktop typecheck PASS. Full desktop lint PASS with zero errors and 123
  upstream warnings. Focused Vietnamese UI/support 11/11 PASS on a one-worker
  rerun after a concurrent resource-starved run started no workers. Dormant
  migration 28/28 PASS. Bundled upstream plugin contracts 625/625 PASS.
- Diagnostic build PASS: 15,164 renderer modules, Electron main/preload bundles,
  both native payloads and `assert-dist-built`. Final provenance verification
  binds engine `5fc308a70719`, shell `ea2955d85b1a`, receipt above, and install
  stamp SHA-256
  `59b6c3f0cbfbe571b0424b77dc6a1f5b01ff64d339475491ab5d2dc260cdee60`.
- Build output hashes: `dist/index.html`
  `95c91842dce9c25f0e292d8f2edc2a33eebfb465f8c0a8886fa380265ac2b8c7`,
  `dist/electron-main.mjs`
  `bf54d93450102268de71d5b53a97dde794f657ea5cb595c54f3f702503f08598`,
  and `dist/electron-preload.js`
  `3bb63898ad03dcfac5518981e70b8bfda0e7b043775651ed5ead07d1778d1b17`.
- Full renderer remains locally NOT GREEN on this Windows `vi-VN` host: the
  single-worker failed-file rerun produced 161 passes and four baseline
  failures. The same full gate PASS on canonical Windows CI.
- Full Electron remains NOT GREEN. Local evidence is 1,903 passed, 50 failed
  and six skipped; canonical Windows CI is 1,923 passed, 40 failed and five
  skipped. This is recorded as blocking baseline evidence, not a waiver.

### Still blocked or pending

- The fetchable-source gate is now met. Authoritative Windows run `33183070842`
  is RED only at the full Electron platform suite; diagnostic build/provenance
  evidence still completed successfully.
- Migration activation needs a real native cross-process lease provider,
  Windows reparse verifier, read-only SQLite verifier, two-process tests,
  disposable-profile lifecycle and rollback rehearsal.
- Claude bridge remains RED because upstream lacks a provider-neutral external
  process seam. Notify-only updater and corrected VNĐ display remain pending;
  VNĐ is deferred to V33.1.
- The successful build remains diagnostic output only. No packaged installer,
  isolated-machine smoke, upgrade/downgrade lifecycle, rollback rehearsal or
  signing exists yet.

Current decision: **GO FOR BUILD-ONLY DEVELOPER PREVIEW; NO-GO RELEASE
CANDIDATE OR HOST LAUNCH**.
