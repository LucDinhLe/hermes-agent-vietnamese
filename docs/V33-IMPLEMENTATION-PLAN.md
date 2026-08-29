# Hermes Vietnamese V33 implementation plan

## Objective

Ship the complete upstream Hermes feature set on the exact locked engine while
making Vietnamese UI, community features, first-run configuration, and
installer identity independently maintainable.

## Proven boundary

The V32.1 fork and upstream V33 tag diverge by 366 versus 2,180 commits. A trial
merge produced 156 unresolved paths, including 116 under `apps/desktop`.
Therefore V33 is rebuilt from upstream and materialized through this repository;
the V32.1 fork remains read-only evidence and a component source.

## Gates

1. Engine lock: tag object and exact commit resolve; moving branches are refused.
2. Boundary: every materialized change is allowlisted; Python engine, gateway,
   CLI, and TUI prefixes are forbidden without exception. V33 does not patch,
   tune, budget, wrap, or replace upstream Hermes behavior.
3. Source: shell contracts, locale tests, plugin tests, typecheck, lint, and
   focused upstream suites pass.
4. Build: one clean materialized tree produces the desktop artifact; receipt
   binds engine commit, shell commit, overlay digest, and patch digests.
5. Packaged smoke: install/launch/first-run/chat/relaunch/uninstall on a disposable
   profile. Never use a real Hermes profile.
6. Migration/rollback: only after quiesced snapshot/staging/verify/atomic-promote
   tests and a real rollback rehearsal may the new identity or rollback tag be
   activated.

## Delivery slices

- Slice 1: composite materializer, Vietnamese locale registration, bundled
  Vietnamese product/support plugin, boundary and receipt tests.
- Slice 2: safe identity migration and independent installer identity.
- Slice 3: fail-closed Claude Pro/Max bridge with sanitized real fixtures.
- Slice 4: read-only community update notification, corrected VNĐ formatting,
  and initial-user distribution files using upstream `distribution_owned`.
- Slice 5: full native build and lifecycle gates, then candidate review. Public
  promotion is a separate owner decision.

## Status on 2026-08-29

- Slice 1 is implemented: immutable engine lock, one-command live-verified tag
  update, disposable materializer, typed Vietnamese locale, bundled product and
  support plugin, two Desktop/distribution seam patches, embedded provenance
  receipt and boundary tests.
- Dev.8 removes the downstream model-round budget, prompt guidance, title
  override, transport timeout change and resident-runtime override. Those
  dev.2–dev.7 experiments are retained only in Git history and must not be
  materialized. Upstream Hermes owns all agent, gateway, bootstrap and runtime
  behavior.
- Slice 2 has only the dormant migration library/test accepted. Independent
  identity, installer wiring and activation remain blocked by native lease,
  reparse, SQLite, lifecycle and rollback gates.
- Slice 3 is RED because the locked upstream engine lacks a provider-neutral
  external-process seam. No fake Claude option is exposed.
- Slice 4 now owns the manual Hermes Vietnamese installer channel, product/core
  identity split, and the Files/Browser shared right rail. VNĐ remains
  explicitly deferred to V33.1.
- Slice 5 has a clean remote Windows x64 dev.8 package and green isolated
  install/update/rollback/uninstall UI lifecycle. Exact runtime run
  `33248898045` then proved the `v2026.8.27` upstream checkout and backend were
  healthy but its renderer remained at 94% after a 45-second wait expired
  during the 13-minute first-run bootstrap. Dev.8 is NO-GO. Dev.9 rolls only
  the immutable upstream lock back to official tag `v2026.8.19`; it must repeat
  source, lifecycle, bootstrap, chat and safe-tool gates before promotion.
  Real-profile testing subsequently made dev.9 NO-GO for distribution; dev.10
  repairs only Desktop/distribution surfaces and must repeat clean CI plus the
  reused-profile transition gate.
