# Hermes Vietnamese 2026.9.2

Owner authorized continuing the exact d14 product into a working public installer
and Latest release. One version everywhere:2026.9.2 (year.month.monthly-update).
Next2026.9.3; new month2026.10.1. No zero padding or display-only renaming.

Baseline:7087998fca6e25967a88feffb1beafc400f26b3a, engine repair643343c3.
Keep Luna/Advisor/tab-plus/first-send fixes and stable app identity/data paths.
Do not modify the installed owner app/profile. Existing harness-only diff is
our d14 acceptance correction and must be preserved.

## Current step: source and distribution preparation

1. Add tested calendar-version candidate identity, shared by build and verifier;
   preserve legacy candidate compatibility and path/commit/hash validation.
2. Bundle a clean, pinned Windows x64 Python/dependency environment. No copying
   owner profile or installed dependencies into a public package. Fresh startup
   must use that verified bundle, not download a remote install script or borrow
   the machine's existing venv. Optional installs must not mutate sealed files.
3. Update product/package/composition metadata and release provenance truthfully.
   Verify source remote before freeze; keep public gates closed while incomplete.
4. Build a new candidate once; preserve d14 immutable installer. Test exact NSIS
   install into isolated directory/profile, cold boot, new tabs/first send, safe
   tool, close/reopen/persistence, update, repair/uninstall/reinstall and rollback.
5. Stage same bytes, verify hashes, promote GitHub Latest only after gates pass.
   Windows x64 is the verified target for this slice; do not imply other builds.

Known d14 failure: voice-related lazy dependency installation mutates sealed
.venv on a lean fixture, causing next-launch inventory rejection. Existing
installed-dependency path passed; it is not a clean-machine distribution proof.

Release engineering rulebook/community-release documents are absent in this
materialized repo but were located and read in the parent v32.1 integrated
checkout. That contract requires native builds, immutable artifacts, lifecycle
acceptance and truthful unsigned community-pilot limitations. The old six-target
contract must not be claimed satisfied by this Windows-only preparation.
Owner explicitly approved the unsigned Windows x64 Latest release on 2026-09-03.
No further signing approval is needed. Native build host is Node 26.7.0.
Promotion remains gated on exact-installer acceptance, not signing.

The native pilot records the actual public branch/commit verified with live
git ls-remote, clean materialized source, engine ancestry, host OS/architecture
and Node version in the hashed install stamp. Historical edition receipt remains
unchanged and releaseMode=false; this build is local, never represented as CI.
Both build-time and startup validators enforce this explicit native pilot path.
It does not claim completion of the historical six-platform release contract.
No automatic update feed is published for the unsigned pilot.

## Evidence

- Baseline source status verified: only d14 packaged E2E harness corrections dirty.
- Existing artifact source7087998fc and installed acceptance recorded in the
  outer project's evidence/local-stable-d14-install-20260903.md.
- Calendar candidate identity and bootstrap/integrity regression: 58/58 passed
  under Node 26.7.0; product/version surfaces: 5/5 passed.
- Clean Python preparation downloaded CPython 3.12.10 through hash-pinned uv
  0.12.5, exported uv.lock, and installed 80 hash-verified wheels. No owner
  dependencies or profiles were copied. Final prepared inventory: 10,975 files;
  generated absolute-path console launchers excluded. Prefix manifest SHA256:
  8526a8c9cd170a0a83af2615e7b3f9cdb1a5ae3b7008bf30be687bcad3f64f19.
- Relocated clean Python imports (SSL, SQLite, provider SDKs, voice, Windows
  native modules) and tui_gateway.server import passed. These are import probes,
  not exact-installer gateway/session acceptance.
- Optional dependencies now use the existing durable-target mechanism outside
  the sealed runtime. Fresh bundled materialization uses no bootstrap script,
  ambient Python, old venv, Git or package-registry access.
- Renderer, Electron and E2E typechecks passed; final Electron/E2E rechecks and
  scoped lint passed. Complete Python inventory/native/import verification passed
  and all 10,975 files remained identical after the import probes.
- No new build, install, source push, tag, upload or public release yet.
