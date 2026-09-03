# Local Stable repair slice, 2026-09-03

Authority: Product Owner approved repairing Luna/provider selection, tab-plus
session creation, image-aware Advisor review and About identity. Test separately
before replacing the existing local Stable. No public installer distribution.
Owner separately approved the source repair branch push and two neutral Codex
probes on 2026-09-03. Source snapshot `643343c3...` is now verified on the fork.

Base: dc14f34b4f4ed1354f2c31513b9bd5c15d42cdca (installed exp11).
Rollback: full pre-exp11 dev10 backup, plus preserve the current exp11 artifact.

## Current step

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
