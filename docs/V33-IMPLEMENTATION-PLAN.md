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
   CLI, and TUI prefixes are forbidden to the edition overlay. A P0 engine
   hotfix uses a separate exact-file ledger lane with tests and retirement rule.
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
  support plugin, two edition-seam patches, one exact-path P0 engine hotfix,
  embedded provenance receipt and boundary tests.
- The V32.1-18 turn failure is addressed in the V33 materialization: prompt
  guidance scales tool use to the task, while a deterministic gateway budget
  uses 4 model rounds for high-confidence simple questions, 12 for ordinary
  turns and up to 30 for explicit multi-step, attachment, synthesized or
  active-goal work. No classifier model call is added. Legacy
  `agent.max_turns: 500` cannot bypass the tiers; smaller configured/operator
  ceilings still win, and turn settlement cannot be skipped by setup/cleanup
  errors.
- The locked upstream desktop transport already recovers boundedly from socket
  resets. A narrow edition seam tags the observed 60-second timeout as
  `ETIMEDOUT`, enabling safe GET retry without ever replaying a sent POST.
- Slice 2 has only the dormant migration library/test accepted. Independent
  identity, installer wiring and activation remain blocked by native lease,
  reparse, SQLite, lifecycle and rollback gates.
- Slice 3 is RED because the locked upstream engine lacks a provider-neutral
  external-process seam. No fake Claude option is exposed.
- Slice 4 notify-only/VNĐ/distribution work is pending; VNĐ is explicitly
  deferred to V33.1.
- Slice 5 has partial source evidence. Full UI and Electron suites are not green
  on this Windows host, so any successful local build is diagnostic only and
  must not be promoted.
