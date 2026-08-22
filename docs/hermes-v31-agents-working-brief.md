# Hermes Vietnamese v31.0 — Agents working brief

Status: fourth successor candidate preparation in progress; `vi-v0.31.0-1` through `vi-v0.31.0-4` remain immutable, private, and are not promotable
Candidate contract: `vi-v0.31.0-5` / app version `0.31.0-vi.5`; all four prior tags, drafts, assets, and evidence sets remain preserved and unchanged
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
- Candidate: `vi-v0.31.0-5`, app SemVer `0.31.0-vi.5`.
- Upstream Hermes Agent version: `0.20.4`, displayed as a separate provenance field.
- Installed identity and bootstrap/resident-runtime markers remain compatible with `0.20.4-vi.39`.
- Updater ordering must prove `0.31.0-vi.5 > 0.31.0-vi.4 > 0.31.0-vi.3 > 0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39` on every supported feed target.

## Acceptance gates

- Unit/component/integration coverage for the Agents header, dropdown, search/filter, session/project multi-Agent membership, management entry, and responsive layout with the right panel.
- Backward-compatibility fixtures for legacy profiles, sessions, groups, routines, install markers, and the vi39 update path.
- i18n audit proves the covered Agent management surfaces contain no unlocalized display strings or legacy contextual-menu wording.
- Regression gates prove Advisor planning/final checks, model selection, context/cost meters, thinking progress, sessions, and the right panel still work.
- Repository typecheck, lint, tests, bundled package verification, and release-policy gates pass.
- Six native artifacts are built where supported. Each artifact is labeled honestly as real-machine smoke or build-only.
- Windows x64 exact-artifact smoke, upgrade from `0.20.4-vi.39`, SHA-256 reproduction, local/GitHub byte comparison, repair, retention, and rollback evidence are recorded before public promotion.

## Release boundary

The workflow may create and publish `vi-v0.31.0-5` as a public community prerelease after the pilot gates pass. It must leave the tagged/draft `vi-v0.31.0-1` through `vi-v0.31.0-4` candidates untouched, must not rewrite `vi-v0.20.4-39`, move the stable/Latest contract, or claim stable status. Stable promotion remains blocked until platform signing/notarization and required real-machine smoke are complete.

## Post-candidate header delta

The first exact-byte Windows smoke exposed that the gateway control was too far from the session-scoped collaboration controls. The next candidate therefore uses one fixed, left-to-right header contract:

1. **Gateway** — the leftmost control in the session header. Its status and actions belong to the exact `connectionId + profile` that owns that chat or tile.
2. **Agents** — lead and collaborator membership for that exact session/project.
3. **Context** — current context/cost meter for that exact session.
4. **Advisor** — model and enablement controls for that exact session.

The Gateway trigger reuses the existing gateway status/menu behavior instead of creating a second lifecycle implementation. Logs, health, doctor, restart, stop, or any stronger stop action must be routed to the captured chat owner or fail closed when that owner cannot be proven. A background tile must never act on the ambient/foreground gateway. Destructive lifecycle actions remain visibly distinct and require the same confirmation/safety semantics as their existing implementation.

Acceptance for this delta requires a behavior test that proves the exact DOM order `Gateway -> Agents -> Context -> Advisor`, a narrow-pane regression, and same-profile cross-source routing tests for every gateway mutation exposed by the menu. The tagged `vi-v0.31.0-1` draft is preserved unchanged; after these gates pass, release preparation continues as the new immutable candidate `vi-v0.31.0-2` rather than moving or rebuilding the old tag.

## Successor Connector delta

Exact-byte smoke of `vi-v0.31.0-2` on Chrome 151 found that a website could create and use cookies while the extension's default `cookies.getAll({ url, storeId })` query returned an empty list; a cookie created through the extension API was visible. The successor must use the Chromium partition query contract explicitly so the preview observes both partitioned and unpartitioned cookies, normalizes an absent or `null` partition key as unpartitioned, counts a real partition-key object as unsupported, and transfers only live unpartitioned cookies.

This delta does not widen permissions, change the pairing protocol, persist cookie values in the extension, or weaken partition isolation. Acceptance requires deterministic extension, import, and pairing regressions before draft creation plus isolated Chrome and Edge exact-artifact smoke covering metadata-only preview, import, persistence, revocation, and redaction. `vi-v0.31.0-2` remains immutable and its artifacts or evidence cannot be reused for `vi-v0.31.0-3`.

## Third successor Connector permission delta

Exact-artifact smoke of `vi-v0.31.0-3` on Chrome 151 proved that the partition-aware query alone was insufficient. The extension derived its optional host permission from `URL.origin`, retaining the fixture's explicit port and granting only the current scheme. Chromium returned zero cookies until the permission was expressed without a port. The successor therefore requests exactly `http://<hostname>/*` and `https://<hostname>/*`, keeps the explicit `{ partitionKey: {} }` query, and revokes both current patterns plus the legacy origin-with-port pattern that an older candidate may have left behind.

The permission remains limited to the exact hostname selected by the user. It does not use `<all_urls>`, a subdomain wildcard, or inferred eTLD+1 scope. A parent-domain cookie viewed from a subdomain may therefore remain outside the result under Chromium's permission checks; this is an explicit limitation, not evidence that the parent cookie does not exist. Acceptance requires behavior tests for both schemes, non-default ports, IPv6, partial grants, and legacy-grant revocation, followed by exact-artifact Chrome and Edge smoke on isolated HTTP and HTTPS fixtures. `vi-v0.31.0-3` remains immutable and none of its artifacts or evidence may be reused for `vi-v0.31.0-4`.

## Fourth successor Gateway convergence and staging delta

Exact-artifact Windows smoke of `vi-v0.31.0-4` reproduced a live stop-to-start transition in which the replacement backend reached a new running PID and `overall=ok`, while the open Gateway menu remained **Stopped**, left **Start** enabled, and kept **Stop** disabled for more than 45 seconds. The screenshot and NO-GO result reject `-4`; its tag, draft, assets, hashes, and evidence remain private and immutable.

The lifecycle action can complete before the replacement gateway has published the PID, lock, and runtime state read by `/api/status`. Candidate `-4` refreshed status only once after the action, so a valid transient stopped snapshot could remain forever. Candidate `-5` polls status sequentially only while the exact-owner menu is open. Every request keeps the captured `connectionId + profile`; the next poll is scheduled only after the previous request settles; polling stops when the menu closes, the owner changes, or the component unmounts. Existing request IDs and owner generations continue to strand late replies. The fix does not restart a gateway by itself, change lifecycle ownership, or require a manual health check.

Acceptance must prove old running PID → successful restart action → transient stopped snapshot → new running PID, after which the UI converges to **Running**, shows the replacement PID, and enables **Stop** without clicking **Check health**. Every status request must remain bound to the original owner, and no overlapping requests may accumulate.

Run `32589995695` built all six `-4` native artifacts. Attempts 1 and 2 received `HTTP 403: Resource not accessible by integration` when the Actions token called `gh release create`; attempt 3 succeeded after a ref at the candidate commit was restored, creating the immutable private 30-asset `-4` draft. The candidate workflow had already fetched and verified the exact tag, bound checkout HEAD to its peeled commit, and required a clean worktree. Candidate `-5` hardens staging by checking out the verified output tag, fetching that tag again, and requiring both the stage HEAD and freshly resolved tag commit to equal the verify-job commit before metadata generation or release creation. It keeps `--verify-tag` while removing the redundant `--target` argument, so draft creation relies on the verified tag instead of an auxiliary ref at the same commit. Contract tests must lock the stage-specific guard before creation and prove that no staging release command asks GitHub to create or retarget a tag. Staging remains draft-only; promotion and its exact-byte evidence gates remain separate, and the `-4` draft remains private and immutable.
