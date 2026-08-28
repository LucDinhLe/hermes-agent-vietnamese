# Fable V33 salvage ledger

Source bundle head: `1d738227cde4e14c1fc5759eb5ea36197159f7d1`
Required base: `2b47cf5824bdd032c7c965afcff374dd6990888c`

| Commit | Decision | V33 treatment |
| --- | --- | --- |
| `7c9b0e7` decisions | Rewrite | Preserve notify-only and identity intent; replace weak migration and fork-freeze wording with the composite-shell contract. |
| `09882c9` updater | Port helpers, rewrite flow | Add persistent cache, bounded fetch, install-stamp version authority, real artifact SHA-256, and packaged integration gates. |
| `fea4d52` Claude bridge | Rewrite | Fail closed on auth and `system/init`; buffer output until accepted init; do not add the unowned environment bypass. |
| `6a44a11` identity | Rewrite | Reuse identity constants only after safe staged migration and rollback gates pass. Never copy a live SQLite tree into the final root. |
| `7d91dda` documentation | Rewrite facts | Reuse validator shape; remove unproven machine and duration claims. |
| `e2deea4` VNĐ | Port pure helper after correction | Remove double approximation and any claim that a threshold is user-configured unless Settings owns it. |
| `10cf20b` support/rollback | Port support helper; reject rollback change | Handle clipboard/link failures and architecture. Do not set a rollback tag before a real rehearsal. |
| `1d73822` progress | Reject | Replace stale release claims and destructive recovery guidance with current evidence. |

The source authorship remains recorded here even when code is rewritten rather
than cherry-picked.

## V33 implementation outcome

- Identity migration was rewritten from first principles and independently
  passed 28/28 adversarial tests. It is materialized only as an inert library;
  installer identity and data roots remain unchanged until native providers and
  machine lifecycle gates exist.
- The support-report concept was ported into the bundled Vietnamese plugin with
  clipboard/link failure handling and redaction tests.
- Claude was not ported. The exact missing provider-neutral engine seam and its
  fail-closed contract are recorded in `CLAUDE-BRIDGE-RED-SEAM.md`.
- The Fable updater flow was not accepted. V33 currently automates immutable
  engine-tag updates and provenance; community notify-only remains a separate
  feature requiring persistent cache, install-stamp authority and packaged
  integration evidence.
- VNĐ display correction stays deferred to V33.1. The unproven rollback-tag
  change remains rejected until a real rollback rehearsal.
