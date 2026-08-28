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

- Shell contract suite: 25/25 PASS.
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
- Full renderer gate remains NOT GREEN on this Windows `vi-VN` host: the
  single-worker failed-file rerun produced 161 passes and four baseline failures.
- Full Electron gate remains NOT GREEN: 1,903 tests passed, 50 failed and six
  skipped; most failures are unchanged upstream POSIX/Windows assumptions. This
  is recorded as baseline evidence, not a waiver.

### Still blocked or pending

- The GitHub workflow exists but has not run because this local shell has no
  remote and no public action is authorized.
- Migration activation needs a real native cross-process lease provider,
  Windows reparse verifier, read-only SQLite verifier, two-process tests,
  disposable-profile lifecycle and rollback rehearsal.
- Claude bridge remains RED because upstream lacks a provider-neutral external
  process seam. Notify-only updater and corrected VNĐ display remain pending;
  VNĐ is deferred to V33.1.
- The successful build is diagnostic output only. No packaged installer,
  isolated-machine smoke, upgrade/downgrade lifecycle, rollback rehearsal,
  signing, published/fetchable shell source, or CI run exists yet.

Current decision: **GO FOR BUILD-ONLY DEVELOPER PREVIEW; NO-GO RELEASE
CANDIDATE OR HOST LAUNCH**.
