# V33 decisions

## D-001 — Upstream is the engine authority

V33 starts from the exact annotated upstream tag and commit in
`engine.lock.json`. A moving branch is never a release input. The upstream
checkout is treated as read-only; the Vietnamese edition is materialized into a
disposable worktree.

## D-002 — Vietnamese product code is an edition overlay

Product-owned UI and features live in the bundled `hermes-vietnamese` desktop
plugin. The full Vietnamese core translation lives in one overlay file. Any
unavoidable edit to upstream-owned files must be allowlisted and recorded in
`patches/series.json` with a retirement condition and focused tests.

## D-003 — AI for Boss is not part of this repository

AI for Boss continues to use OpenClaw as its engine. No Hermes engine code is
transferred to it by this V33 work.

## D-004 — Identity split stays fail-closed until migration is proven

The future V33 identity is reserved in `edition.json`, but activation remains
blocked until the migration implementation stops the engine, checks capacity,
creates a recoverable snapshot, copies into staging, verifies SQLite and file
integrity, and promotes atomically. A copied marker may only be written after
successful promotion.

## D-005 — Fable is a component source, not an installable candidate

The eight-commit Fable bundle is not applied wholesale. Each reusable helper or
test is ported with provenance; migration, updater, Claude bridge, rollback, and
stale progress claims are rewritten or rejected according to
`docs/FABLE-SALVAGE.md`.

## D-006 — Automation follows an immutable tag, never upstream `main`

`npm run engine:update` is the maintenance entry point. It verifies an
annotated tag object and its commit, reads the engine/desktop versions from the
exact tree, proves every active core patch still applies, and only then updates
the lock and patch provenance. It also verifies that the official NousResearch
remote currently advertises the same tag object and peeled commit. A fork-only,
local-only or moved tag is rejected. A failed verification leaves the current
lock authoritative and blocks materialization.

## D-007 — Claude bridge remains absent while the generic seam is missing

The locked engine has provider-name-specific process ownership for Copilot and
does not let an edition plugin create or stream an external-process model
client. V33 will not expose a Claude option that can silently fall through to
another transport. `docs/CLAUDE-BRIDGE-RED-SEAM.md` defines the smallest
provider-neutral upstream seam and its fail-closed acceptance contract.

## D-008 — Migration code may ship dormant; identity may not activate

The migration library and adversarial tests may be materialized for continued
verification, but the desktop entry point, installer identity, app ID,
executable, protocol and data root remain unchanged. Activation requires a
real OS-backed cross-process lease covering both data roots and migration state,
held by a native non-expiring/non-transferable handle until explicit release or
process death, Windows reparse-point protection, a read-only SQLite verifier,
two-process writer tests, disposable-profile lifecycle tests and a rollback
rehearsal.

## D-009 — CI validates; it never promotes

The Windows workflow may materialize, test, build and upload evidence. Its
diagnostic build still runs after a non-cancellation test failure so compilation
evidence is not lost; that condition does not waive or mask the failed job. The
workflow always records `releaseMode: false`, overrides the upstream build stamp
by removing CI shell variables so it resolves the materialized engine worktree,
and checks that dirty-local engine stamp against the edition receipt. Focused
Vietnamese UI and dormant-migration suites run independently of the known-red
full upstream suites after dependency installation succeeds.
It does not publish an installer, create a tag or alter a release. Promotion
remains a separate owner decision after every candidate gate is green.

## D-010 — Engine hotfixes use an exact-path lane, never the overlay lane

The Vietnamese overlay remains desktop-only. A P0 engine fix may enter V33 only
as an `engine-hotfix` ledger entry whose every changed file is listed exactly
in `edition.json.enginePatchAllowedPaths`; directory globs are forbidden. The
receipt records the patch kind and digest. This lane currently carries the
interactive-turn reliability fix prompted by the V32.1-18 incident and must be
retired when upstream ships equivalent behavior and regression coverage.

## D-011 — Foreground budgets adapt without a classifier model call

V33 treats a model round as a scarce foreground resource. High-confidence
simple questions receive at most 4 rounds, ordinary turns 12, and only explicit
multi-step, attachment, synthesized or active-goal work receives up to 30.
Existing `agent.max_turns` and `HERMES_TUI_MAX_TURNS` values may tighten those
tiers but cannot expand them; background and CLI jobs keep their independent
limits. Classification uses request structure and durable goal state only, so
the safety mechanism never consumes an extra model call or mutates the cached
system prompt.

## D-012 — An upstream baseline is an exact comparator, not a blanket waiver

Windows CI runs the full Electron suite in the materialized Vietnamese tree
between two control runs of the untouched locked upstream tree, using the same
runner and Node major. A failing V33 suite is accepted only when every parsed
failing test is present in the union of the two complete pristine-upstream
controls. A candidate-only test, an incomplete log, an unparseable failure, a
dirty upstream tree or a broken upstream comparison fails closed. All raw logs
and the machine-readable comparison are retained with the immutable build
evidence. This classification can clear an edition-regression gate; it does
not prove installer, lifecycle, signing or release readiness.

## D-013 — Staging bytes are immutable but not automatically releasable

The edition technical version is the electron-builder/NSIS package version;
the upstream desktop package version is never allowed to leak into a Vietnamese
installer. A manual staging workflow may create and retain one unsigned Windows
x64 candidate from one clean remote-reachable commit, then exercise that exact
byte stream only in a disposable hosted VM. Staging remains non-public and
must list every unproved release gate. A green installer lifecycle does not
waive real gateway bootstrap, real session, safe-tool, signing, or owner
promotion gates.
