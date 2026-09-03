# Local Stable repair slice, 2026-09-03

Authority: Product Owner approved repairing Luna/provider selection, tab-plus
session creation, image-aware Advisor review and About identity. Test separately
before replacing the existing local Stable. No public installer distribution.
Owner separately approved the source repair branch push and two neutral Codex
probes on 2026-09-03. Source snapshot `643343c3...` is now verified on the fork.

Base: dc14f34b4f4ed1354f2c31513b9bd5c15d42cdca (installed exp11).
Rollback: full pre-exp11 dev10 backup, plus preserve the current exp11 artifact.

## Current step

### Reopened local acceptance: tab-plus, 2026-09-03

The installed d12 passed startup but failed the actual tab-plus interaction.
Owner explicitly requested finishing this repair. Keep d12 and the pre-d12
backup unchanged; do not patch installed bytes. Scope this follow-up to new-tab
ownership and real tab creation, without model/provider or user-data changes.

1. Reproduce the resolved-descriptor vs primary-pool owner mismatch with a
   regression that checks visible tiles, not just the create RPC.
2. Repair the captured creation owner while preserving explicit local/remote
   identity, async intent and provisional first-send ownership.
3. Exercise actual pane registration/focus and repeated plus clicks; run routing,
   provisional lifecycle and type checks. Freeze a new candidate only when green.
4. Test the packaged plus -> editable tab -> first send -> reopen lifecycle in
   an isolated profile, then replace local Stable and verify the installed plus.
   Public distribution remains out of scope.

Root cause confirmed: on the primary socket, activeGatewayConnectionId() is
null while the resolved Electron descriptor is `local` (or a named primary
remote). wiring activates that resolved owner's tile bucket. session.create
used null and saveTilesForOwner therefore persisted the new tile without
publishing it to the visible list. Both local and named-primary regression
cases failed with an empty visible list before the repair and passed afterward.
The repaired create captures the resolved identity for the primary transport,
while preserving explicit secondary routes and frozen ownership across awaits.
100 focused UI/routing/provisional tests passed, including the real TreeGroup
plus button through paneMirror and tree adoption: three clicks, three distinct
focused tiles with editable test content. Renderer and E2E typechecks passed.
New candidate d13/exp13 retains the unchanged engine source `643343c3...`.
These are source/integration results, not packaged lifecycle acceptance yet.

1. **Source checks complete:** reproduce each failure with deterministic tests and record
   the actual cause. Preserve model/provider pairing, exact session ownership,
   image context and immutable runtime provenance.
2. Focused repairs implemented. No unrelated features or dependency upgrades.
3. Source verification: 173 Python tests, 92 UI tests, 32 Electron tests, five
   identity/surface checks, typecheck and scoped lint. Packaged/live checks remain separate.
4. **Candidate preparation:** source push and the two live probes passed.
   Freeze unsigned Windows x64 `0.33.0-dev.12-advisor-exp.12` from a clean,
   remote-reachable metadata commit; engine source is `643343c3...`. Record hashes.
5. Isolated packaged acceptance: Luna request, plus/new tab -> first send ->
   persisted history -> relaunch, Advisor image question, About with old Git
   checkout retained. Do not use successful boot as the feature acceptance.
6. Only after acceptance, preserve current install/data backup, replace local
   Stable, verify installed hashes and real startup, and hand off honestly.

## Known evidence

- Luna was sent to api.anthropic.com as gpt-5-6-luna. Reproduced permissive
  native-provider validation and destructive dot normalization. Both fixed;
  explicit Codex selection preserves the pair. The historical source of the
  stale config itself is not proven. No silent provider fallback was added.
- Advisor's review packet omits user images and history; ASK_USER replaces
  the held main answer. Must ground image review and avoid redundant requests.
- Plus omitted its focused tab anchor across async creation; regression reproduced
  then fixed. Real packaged interaction remains a required acceptance gate.
- About resolves a Git-biased update root, selecting old 0.20.0 checkout instead
  of the verified candidate; its Experimental recovery wording is stale.

No existing artifact may be patched in place. Python diagnostics use -B.

## d14 follow-up: provisional composer first-send guard

The frozen d13 packaged app opens three distinct editable tabs via the real
plus button. Its first send fails: the shared drift guard compares the real
draft composer scope with null because the provisional tile has no durable
DB row yet. Reproduced with the actual tile action/shared submit pipeline:
`composer:draft-local-stable->null`, false return, no prompt.submit.

Add an explicit provisional draft-scope seam without inventing a durable id
or weakening cross-session protection. Durable lineage-root resolution stays
unchanged. Correct draft scope sends once through the captured owner and
promotes after DB confirmation; another draft scope must still reject.
192 focused tests passed including existing durable scope/lineage coverage.

d13 is NO-GO for installation, and its immutable bytes remain preserved.
Freeze d14 only from clean remote-reachable source. The same packaged harness
must pass plus x3, first send with local mock inference, and restored history
on relaunch before any replacement of the user's current d12 installation.

## Authority / acceptance boundaries

- Owner approved source repairs, isolated tests and eventual local installation.
- Owner approved the source branch push. After auditing all six previously
  unpublished commits and 356 blobs, the repair source snapshot was pushed;
  GitHub returned the exact expected hash. No tags/releases/installer upload.
- Owner approved both live payloads. Luna on exact `openai-codex` / `gpt-5.6-luna`
  passed neutral arithmetic; Sol on `gpt-5.6-sol` corrected the deliberately wrong
  project-logo answer. No private material, fallback or tools were used.
- These backend probes do not substitute for packaged UI/lifecycle acceptance.
- Current application, runtime, private profile and previous rollback remain unchanged.
- New candidate metadata is d12/exp12; experimentalEngineHead identifies the
  tested source repair. Keep exp11 installer bytes intact for rollback.
