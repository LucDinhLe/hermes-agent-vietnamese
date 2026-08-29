# Locked upstream baseline on the Vietnamese Windows host

## Scope

This record separates edition regressions from behavior already present in the
locked Hermes engine. It is evidence for triage, not a waiver that turns a
failed gate green.

- Engine tag: `v2026.8.27`
- Engine commit: `5fc308a70719a83cccdbba4c0e39c23f5a8239d5`
- Host: Windows, default `Intl` locale `vi-VN`
- Node.js: `v24.18.0`
- npm: `11.17.0`

## Results observed on 2026-08-28

- Desktop typecheck: PASS.
- Desktop ESLint: PASS with zero errors and 123 warnings in locked-upstream
  files. Focused edition lint is clean.
- Bundled upstream plugin contract suite: 625/625 PASS.
- Focused Vietnamese locale, plugin, and support suites: 11/11 PASS.
- Focused dormant migration suite at final library SHA
  `C793564E827A80112476A4619208271A2CB4FBA1F091D776BCC2DD8B81E30593`
  and test SHA
  `906C13AC371A73332042B523768836378478E4988BE3124456B269BDD27E26F2`:
  28/28 PASS in the writer gate and 28/28 PASS in an independent audit; the
  seven high-risk fault cases also passed 7/7 independently. The library is
  accepted only as inert source. Activation remains RED until a real OS-backed,
  non-expiring/non-transferable cross-process lease, Windows reparse verifier,
  read-only SQLite verifier, two-process writer tests and lifecycle/rollback
  rehearsal exist.
- Full UI suite: NOT GREEN. The first parallel run developed unrelated timeout
  cascades and was stopped. A single-worker rerun of the six files that had
  failed produced 161 passes and four failures:
  - `renderRpcResult ... formats calls / input / output / total with thousands separators`;
  - `clampForDisplay ... reports the omitted count`;
  - `BillingSettings ... rejects auto-refill amounts outside the billing bounds`;
  - `BillingSettings ... disables buy controls while polling and renders the settled outcome`.

The first two failures are deterministic locale assumptions in locked upstream:
production calls `toLocaleString()` without a locale, while the tests require
English comma grouping. This host correctly produces `1.234.567` for `vi-VN`.
The billing file also contains host-locale currency formatting and timing/state
assertions that fail on this host.

- Full Electron platform suite: NOT GREEN — 121 files passed, 14 failed and
  one skipped; 1,903 tests passed, 50 failed and six skipped. Most failures are
  deterministic locked-upstream assumptions on this Windows host: POSIX file
  modes, `/bin/sh`, forward-slash paths, macOS/Linux path simulation, symlink
  permission, and process/temp cleanup behavior. Three edition migration cases
  exceeded the suite-wide five-second timeout under parallel contention; the
  superseded focused migration suite passed 19/19 in a single process; the
  final hardened suite later passed 28/28. The
  timeout distinction is evidence for triage, not a green full-suite gate.

`git diff --exit-code HEAD -- <failed paths>` passed for every failed UI path
and every failed Electron path except the newly added migration source/test.
Thus the pre-existing failures are in files unchanged by the Vietnamese
edition. This supports classifying them as locked-upstream/host baseline
observations; it does not prove that every full-suite timeout is an upstream
defect.

## Policy

Do not edit upstream production code or weaken tests merely to hide this
baseline. Edition-owned gates must remain green. A distributable candidate
still requires either a clean full source gate on a supported deterministic
test locale or an upstream fix with its own evidence.

The canonical Windows workflow now performs same-runner bracketing controls
rather than relying on this historical host observation. It runs pristine
locked upstream before and after the materialized V33 tree, records all three
complete raw logs, parses individual failing test identities, and rejects any
V33 failure absent from both upstream controls. Missing summaries, unparseable
failures and upstream source drift are blocking. This comparison is a narrow
regression classifier, not permission to ignore upstream defects or advance a
diagnostic build to release status.
