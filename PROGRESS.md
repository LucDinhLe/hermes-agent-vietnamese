# Progress — Hermes Vietnamese V33

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
- Identity migration was rewritten and accepted by independent audit as dormant
  source only. Installer identity, app ID, executable, protocol and data roots
  remain the upstream values.
- Windows x64 CI validates focused Vietnamese UI/migration gates independently,
  records diagnostic `releaseMode: false`, runs the known-red full upstream
  suites without hiding failures, builds once and never publishes.

### Evidence so far

- Shell contract suite: 21/21 PASS.
- Edition boundary: PASS — 11 overlay files, two active patches, no path outside
  `apps/desktop/`.
- Live official engine-update dry-run: PASS; exact annotated tag object and
  peeled commit match the lock, and both patches apply cleanly.
- Dormant migration: 28/28 PASS by the writer and 28/28 independently; high-risk
  fault subset 7/7 independently. Final library SHA-256:
  `C793564E827A80112476A4619208271A2CB4FBA1F091D776BCC2DD8B81E30593`.
- Earlier exact materialization evidence: desktop typecheck PASS, focused
  Vietnamese UI/support 11/11 PASS, bundled upstream plugin contracts 625/625
  PASS, focused lint clean.
- Full renderer gate remains NOT GREEN on this Windows `vi-VN` host: the
  single-worker failed-file rerun produced 161 passes and four baseline failures.
- Full Electron gate remains NOT GREEN: 1,903 tests passed, 50 failed and six
  skipped; most failures are unchanged upstream POSIX/Windows assumptions. This
  is recorded as baseline evidence, not a waiver.

### Still blocked or pending

- A fresh materialization from the first clean local shell commit, exact install,
  typecheck/focused tests/build and provenance verification are the next gate.
- The GitHub workflow exists but has not run because this local shell has no
  remote and no public action is authorized.
- Migration activation needs a real native cross-process lease provider,
  Windows reparse verifier, read-only SQLite verifier, two-process tests,
  disposable-profile lifecycle and rollback rehearsal.
- Claude bridge remains RED because upstream lacks a provider-neutral external
  process seam. Notify-only updater and corrected VNĐ display remain pending;
  VNĐ is deferred to V33.1.
- Upstream Node lock installation reports two high-severity dependency
  advisories. They have not been force-fixed or hidden.

Current decision: **SOURCE IMPLEMENTED / GATES PARTIAL — NOT A RELEASE
CANDIDATE**.
