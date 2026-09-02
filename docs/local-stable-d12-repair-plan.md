# Local Stable repair slice, 2026-09-03

Authority: Product Owner approved repairing Luna/provider selection, tab-plus
session creation, image-aware Advisor review and About identity. Test separately
before replacing the existing local Stable. No public distribution or push.

Base: dc14f34b4f4ed1354f2c31513b9bd5c15d42cdca (installed exp11).
Rollback: full pre-exp11 dev10 backup, plus preserve the current exp11 artifact.

## Current step

1. **Source checks complete:** reproduce each failure with deterministic tests and record
   the actual cause. Preserve model/provider pairing, exact session ownership,
   image context and immutable runtime provenance.
2. Focused repairs implemented. No unrelated features or dependency upgrades.
3. Source verification: 173 Python tests, 92 UI tests, 32 Electron tests, five
   identity/surface checks, typecheck and scoped lint. Packaged/live checks remain separate.
4. **Paused for authority:** publish only the repair source branch after owner
   approval; the release skill requires reachable source. Then update version
   and source provenance and freeze a new unsigned Windows x64 candidate, with hashes.
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

## Authority / acceptance boundaries

- Owner approved source repairs, isolated tests and eventual local installation.
- No source push or public release has occurred. Asked separately for source-branch push.
- Live Codex probes were rejected before launch by auto-review: it requires
  explicit approval of the neutral arithmetic prompt and project logo image.
  Asked owner; no indirect retry and no live probe ran.
- Current application, runtime, private profile and previous rollback remain unchanged.
- Do not build with the current exp11 metadata. Bump to a fresh candidate and
  point experimentalEngineHead at this repair commit only after source authority.
