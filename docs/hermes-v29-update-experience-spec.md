# Hermes Vietnamese v29 update experience

## Objective

Make every packaged Hermes Vietnamese release after v28 discoverable and installable from inside Hermes without presenting the assisted first-install wizard again. Preserve the installed application identity, user data, credentials, conversations, schedules, configuration, and onboarding state across the update.

## Inputs

- Current packaged app version, for example `0.20.4-vi.34`.
- Public GitHub Releases records from `LucDinhLe/hermes-agent-vietnamese`.
- Immutable normalized installers produced by the Vietnamese release workflow.
- Community release tag in the form `vi-vX.Y.Z-N`.

## Output

- A platform-specific `latest*.yml` update manifest attached to every candidate and public release.
- An in-app check that selects the newest published community release containing the manifest required by the running platform.
- A full-installer download whose SHA-512 is verified by `electron-updater`.
- A silent install handoff followed by relaunch.
- An About screen that identifies the upstream project/publisher, Vietnamese community maintainer, MIT license, and community update channel.

## Rules

1. Community tags remain immutable and keep the public `vi-vX.Y.Z-N` format.
2. Update manifests use the valid SemVer app version `X.Y.Z-vi.N`.
3. Draft releases are never offered to installed applications. Published prereleases are eligible for the Vietnamese community channel.
4. The resolver must ignore a release that lacks the update manifest for the running platform and architecture.
5. The generic update feed must be pinned to the selected immutable release URL. It must never resolve installer bytes from a moving branch.
6. Differential download stays disabled. The downloaded installer must be the exact normalized candidate byte covered by release checksums and runtime smoke evidence.
7. Windows update installation uses silent mode and forces relaunch. A user-initiated fresh/manual install remains assisted.
8. `appId`, product name, executable name, shortcut name, and uninstall identity remain stable. Package metadata may add accurate attribution and MIT license information without changing upgrade identity.
9. Updating must not clear `%APPDATA%/Hermes`, `~/.hermes`, credentials, conversation data, schedules, settings, or the persisted onboarding marker.
10. The About screen must not render `unknown` branch/commit placeholders for packaged app-updater installs.

## Platform manifests

- Windows x64 and arm64: `latest.yml`, containing both normalized NSIS installers so the updater can select the current architecture.
- macOS Intel and Apple Silicon: `latest-mac.yml`, containing both normalized ZIP files. The Apple Silicon URL carries an `arm64` fragment used only for architecture selection; the fragment is not sent to GitHub and the verified ZIP bytes remain unchanged.
- Linux x64: `latest-linux.yml`, containing the normalized x64 AppImage.
- Linux arm64: `latest-linux-arm64.yml`, containing the normalized arm64 AppImage.

## Edge cases and failure behavior

- GitHub API unavailable: show a reachable-server error and keep the running app untouched.
- No newer eligible release: report that the app is current and do not reconfigure/download an installer.
- Newer release missing this platform's manifest: skip it and consider the next eligible published release.
- Manifest or installer hash mismatch: abort the download/install; do not close the running app.
- Installer launch or elevation failure: report failure; preserve the current installation and data.
- A locally newer build must never be downgraded automatically.

## Acceptance gates

- Unit tests cover community tag/version ordering, draft filtering, platform manifest filtering, exact release feed URL selection, silent install flags, and renderer update status.
- Artifact tests verify all four manifests, normalized artifact names, SHA-512 values, sizes, and deterministic output.
- Workflow contract verifies manifest generation occurs before the combined SHA-256 manifest and draft upload.
- Distribution contract verifies stable Windows upgrade identity and MIT package metadata.
- Existing onboarding persistence and packaged-runtime-refresh tests remain green.
- Exact candidate artifacts pass install, update-from-v28, relaunch, configuration/conversation persistence, uninstall, and rollback smoke before promotion.

## Exclusions

- Code-signing identity is not invented in application metadata. Windows Publisher becomes verified only after a valid Authenticode signing gate succeeds.
- v28 cannot acquire this updater fix from itself. The first fixed release requires one final manual update from v28; later eligible releases use the in-app flow.
