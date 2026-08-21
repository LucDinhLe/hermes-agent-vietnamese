# Hermes Vietnamese v31.0 — Agents working brief

Status: approved product direction, implementation in progress
Candidate contract: `vi-v0.31.0-1` / app version `0.31.0-vi.1`
Release class: community prerelease until signing and real-machine smoke satisfy the stable policy

## Outcome

Hermes Vietnamese v31 replaces the fragile legacy profile pane with a permanent Agents entry in each session header. People can see the lead Agent, invite several collaborating Agents at session or project scope, search by capability, and reopen a stable Agents management page at any time. The Advisor, context meter, cost estimate, thinking progress, and right panel remain intact.

## Product decisions already locked

- Display name is **Hermes Vietnamese**.
- User-facing profile terminology is **Agent / Agents**; Vietnamese explanatory copy uses **Agent cộng tác**.
- Selecting an Agent adds or invites a collaborator. It never changes the lead Agent silently.
- The legacy left-side profile tab/pane is removed. Agents management is a stable route, not a dismissible pane.
- A session and a project may each retain more than one collaborating Agent.
- English and Vietnamese locales are complete for create, edit, clone, capability, skill, tool, MCP, model, credential-sharing, routine, status, error, menu, and tooltip surfaces.
- Credential-sharing copy explains permission and cost impact. Existing defaults remain unchanged.
- Product UI and guidance use the single term **menu** for contextual actions.

## Compatibility boundary

These internal contracts remain unchanged unless a test proves a migration is both necessary and reversible:

- plugin ID `hermes-bots`;
- existing storage keys and `ui_meta` fields;
- existing and legacy Agent profile directories and profile identifiers;
- canonical session, group-chat, routine, and cron data;
- IPC, protocol, updater, app ID, executable name, and installed data root;
- legacy `Bot Chat` persisted titles and other wire-level values.

New collaboration membership data is additive and versioned. A missing or malformed record must fall back to an empty collaborator list without modifying legacy data.

## Implementation shape

1. Remove the legacy profile-pane registration and its dismissed-pane recovery dependency.
2. Add an Agents control beside context/cost and Advisor in the per-session header. It shows lead and invited Agents, role/model/capabilities, status, search/filter, session/project scope, removal, and a stable **Quản lý Agents** entry.
3. Register a full-page Agents management route that reuses the existing profile, group, capability, and routine behavior while localizing every visible string.
4. Keep cross-connection routing and existing mention dispatch. Invitations use profile routes and additive membership metadata; they do not foreground or replace the lead profile.
5. Add a separate, explicit lead-change action only if its semantics and migration tests are complete. It is not required for the first candidate.

## Version model

- Product version: `31.0`.
- Technical/app base: `0.31.0`.
- Candidate: `vi-v0.31.0-1`, app SemVer `0.31.0-vi.1`.
- Upstream Hermes Agent version: `0.20.4`, displayed as a separate provenance field.
- Installed identity and bootstrap/resident-runtime markers remain compatible with `0.20.4-vi.39`.
- Updater ordering must prove `0.31.0-vi.1 > 0.20.4-vi.39` on every supported feed target.

## Acceptance gates

- Unit/component/integration coverage for the Agents header, dropdown, search/filter, session/project multi-Agent membership, management entry, and responsive layout with the right panel.
- Backward-compatibility fixtures for legacy profiles, sessions, groups, routines, install markers, and the vi39 update path.
- i18n audit proves the covered Agent management surfaces contain no unlocalized display strings or legacy contextual-menu wording.
- Regression gates prove Advisor planning/final checks, model selection, context/cost meters, thinking progress, sessions, and the right panel still work.
- Repository typecheck, lint, tests, bundled package verification, and release-policy gates pass.
- Six native artifacts are built where supported. Each artifact is labeled honestly as real-machine smoke or build-only.
- Windows x64 exact-artifact smoke, upgrade from `0.20.4-vi.39`, SHA-256 reproduction, local/GitHub byte comparison, repair, retention, and rollback evidence are recorded before public promotion.

## Release boundary

The workflow may create and publish `vi-v0.31.0-1` as a public community prerelease after the pilot gates pass. It must not rewrite `vi-v0.20.4-39`, move the stable/Latest contract, or claim stable status. Stable promotion remains blocked until platform signing/notarization and required real-machine smoke are complete.
