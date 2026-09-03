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
- C1 source 04983abde69d88748541e3c88900fced4adcb500 was pushed, built and
  staged as a draft (not Latest). Installer SHA256:
  f96a6c30c549cb4680b908e2ba72784b174180569dd27970a5dcd87f2b151595.
- Hosted exact NSIS install passed; run33777916585 timed out at app startup.
  Diagnostic run33779375271 preserves that artifact and timeout while gathering
  startup progress and logs. No gateway/session acceptance has passed for C1.

## C1 NO-GO and C2 uninstall correction

The portable runtime deliberately has no legacy hermes-agent/venv. Source audit
found the GUI uninstall summary and executor still depended on that old Python.
The portable branch now uses the exact sibling NSIS uninstaller and OS-supplied
PowerShell, not a Python interpreter inside the tree being removed. Legacy and
non-Windows uninstall behavior is unchanged.

Release rule: validate uninstall discovery against the actual installed runtime
layout, not merely old-venv mocks. Require actual GUI keep-data/full cleanup,
reinstall and persisted-history checks on the frozen installed artifact. Unit
tests alone are insufficient. Parse generated cleanup scripts with the native
shell without executing deletion in source tests; reject unsafe modes, broad
paths and linked targets. Preserve user data if Windows uninstall fails.

Recovery runbook: never patch C1 bytes. Build a separate C2 only after source
repairs and checks; rerun the complete installed lifecycle. Owner's installed d14
and backups remain unchanged. For a failed cleanup, retain the generated
hermes-uninstall-*.log in OS temp and report the failure instead of deleting more.

Current correction evidence: 86 focused tests passed, including six portable
uninstall cases and a Windows PowerShell syntax-only parse. Electron typecheck
and scoped lint passed. Real C2 install/uninstall acceptance remains pending.

Installed run33780535935 isolated the startup exception: runtime payload inventory
differs from the manifest before materialization. The frozen NSIS archive itself
has exactly14842 manifest files, no extras/missing entries. Add an installed-file
inventory gate before Electron launch; retain its missing/extra paths. Runtime
errors now name bounded missing/unexpected file lists instead of only saying
"inventory mismatch". A regression removes one file and injects another.

Separate native Node-only materialization took7m19.912s; this is not gateway
acceptance and not the cause of the early CI inventory failure. Investigate the
startup cost independently. Neither an increased timeout nor suppressed integrity
checks can turn C1 into an accepted candidate.

## C2 source correction and freeze

Run33781663838 identified exactly four missing ARM64 launcher templates from
pip/distlib and setuptools. They are present in the frozen 7z archive but absent
after NSIS extraction on Windows x64. These are not required runtime libraries
for this x64 product. Exclude only these four explicit paths during preparation
and staging, before generating the new exact inventory. The unchanged clean
preparation cache may be reused: verify every cached file hash first and record
the excluded template paths in the runtime manifest. Never omit an actual x64
interpreter/library or ignore missing files during startup verification.

Retain the exact installed-file gate as a permanent prerequisite to UI smoke.
The C2 source also avoids a duplicate full hash pass immediately after atomically
renaming an already fully verified fresh runtime tree; existing runtimes still
get full tamper/inventory checks at every launch. A regression proves one fresh
verification and another at relaunch. 88 focused tests and two distribution
policy tests passed. C1 remains rejected; C2 must be built in a separate output
directory and staged separately before actual installed acceptance.

## C2 NO-GO: preserve the existing Windows installation scope

Run33788510633 passed exact C2 fresh installation, offline chat/tools/relaunch,
and real history creation/relaunch in the previous public vi-v0.32.1-18.
Upgrading that per-user installation with C2 exited the isolated installation
directory: C2 forced perMachine=true. The pinned electron-builder assisted NSIS
template consequently uses HKLM instead of detecting the existing HKCU location.

C3 uses assisted NSIS with perMachine=false, enabling the builder's existing
HKCU/HKLM detection and preserving both scope and installation directory on
upgrade. Do not work around the defect by forcing /D or /allusers on upgrade.
For new installations the user can choose scope; existing all-user installs
remain all-user. A static policy regression prevents restoring the forced mode.

Permanent acceptance rule: run the whole installed lifecycle independently for
both /currentuser and /allusers baselines. Explicit scope and /D are allowed only
for each fresh installation. Upgrade and repair must use /S alone and retain
the registration hive, installation path and user database. Keep the path guard;
record mismatched registration metadata before stopping, never follow a changed
path to delete files. Do not publish C2. Preserve its bytes/evidence and stage a
new immutable C3, with all affected exact-installer gates rerun.
