# Building the Desktop Installers

This document tells you how the bundled desktop installers are built, and how
to build and test one on your machine. For the app architecture, read
`AGENTS.md` in this directory.

## What a bundle is

A bundled installer contains the full Hermes runtime. The user installs one
file and gets everything. Nothing downloads at first launch.

The installer contains:

- The Electron app (the chat surface).
- The agent source tree at the release tag, without `.git`.
- `uv` and a CPython interpreter for the target architecture.
- A ready `site-packages` tree, built from the lockfile.
- A Node runtime and the prebuilt JS surfaces (ui-tui, dashboard SPA).
- A build stamp (`.hermes_build_info.json`) that records the tag, the commit,
  and the distribution (`desktop-app`).

The app runs the backend directly from its own resources. This is the
"embedded" install axis. See the plan in
`.hermes/plans/202607_resources-resident-bundled-runtime.md`.

## The installer for each platform

| Platform | Artifact | Notes |
|---|---|---|
| Windows | NSIS `.exe` | One-click, per-user, no install screens. Signed with Azure Trusted Signing. |
| Windows | `.msi` | For fleet deployment through IT tools. |
| macOS | `.dmg` | Signed and notarized when the `APPLE_*` and `CSC_*` secrets are set. |
| Linux | unpacked / AppImage | Unsigned. |

Each artifact ships with a blockmap and a `latest*.yml` file. electron-updater
uses these files for differential updates.

## How the build works

One script drives the whole build:

```
node scripts/build-bundled-desktop.mjs --tag=vX.Y.Z
```

The script always runs every step:

1. **Gate the toolchain.** The host `node` and `npm` must satisfy
   `package.json` engines. `uv --version` must print a build triple. The
   payload embeds these exact host versions, so gate == embed.
2. **Build the JS surfaces.** ui-tui (with hermes-ink) and the dashboard SPA.
3. **Build the desktop app.** `npm run build` in `apps/desktop`: vite,
   electron-main bundle, native deps, then payload staging.
4. **Stage the agent payload** (`scripts/stage-agent-payloads.mjs`). This step
   snapshots the repo at the tag with `git archive`, copies the prebuilt JS
   surfaces in, installs CPython and `site-packages` with `uv`, downloads a
   Node dist, and writes `manifest.json` plus the build stamp. Each staged
   binary must prove the target architecture in its own version banner. A
   wrong-architecture binary fails the build.
5. **Package with electron-builder.** NSIS on Windows, DMG on macOS.

Payload staging stays dormant unless `HERMES_DESKTOP_BUNDLED=1` is set. The
build script sets it. A normal `npm run dev` or `npm run pack` without the
script does not stage payloads.

## Code signing (Windows)

Signing turns on when the `AZURE_SIGN_*` environment variables are set:

```
AZURE_SIGN_ENDPOINT     https://cus.codesigning.azure.net
AZURE_SIGN_ACCOUNT      codesign2
AZURE_SIGN_PROFILE      hermesagent
AZURE_SIGN_PUBLISHER    CN=Nous Research Inc., ...
AZURE_CLIENT_ID         (the OIDC app id)
```

`electron-builder.config.cjs` reads these variables and composes the
`win.sign` configuration itself. Do not pass the values as `-c` arguments:
the publisher name contains spaces, and spaces do not survive the cmd.exe
hops between npm and the builder on Windows. Without the variables, the
build produces unsigned artifacts. Forks and local builds work unsigned.

The release workflow authenticates the signing dlib as a **workload
identity**: it mints the job's GitHub OIDC token into a file (reminted
every 4 minutes — the tokens live only minutes and signing runs for the
better part of an hour) and points `AZURE_FEDERATED_TOKEN_FILE`,
`AZURE_CLIENT_ID`, and `AZURE_TENANT_ID` at it, with
`AZURE_TOKEN_CREDENTIALS=prod` restricting the chain to
Environment → WorkloadIdentity → ManagedIdentity. EnvironmentCredential
fails instantly (no secret), WorkloadIdentityCredential redeems the token
file in-process, and ManagedIdentityCredential is never reached. The
dev-tool credentials (AzureCli & co.) all spawn subprocesses, which wedged
the x64-emulated signtool on the windows-11-arm runner for 35+ minutes;
the managed-identity probe hangs on GitHub-hosted runners (they are Azure
VMs whose IMDS endpoint answers but never grants a token).
`win.sign.additionalMetadata.ExcludeCredentials` cannot express any of
this: electron-builder's v27 schema types it as a string while the dlib
requires a JSON list.

Authentication uses the Azure credential chain: OIDC federated login in CI,
or an `az login` session on a dev machine. There is no signing secret.

## Code signing + notarization (macOS)

electron-builder's builtin notarization runs when the `APPLE_API_KEY` /
`APPLE_API_KEY_ID` / `APPLE_API_ISSUER` env vars are set and the app is
signed with the Developer ID certificate from `CSC_LINK`. `APPLE_API_KEY`
must be a **path to the `.p8`** App Store Connect key: the value travels
verbatim from the env var into `notarytool --key`, which takes a file
path (no decode, no temp file anywhere in the chain — raw PEM content
dies with `Invalid option`, base64 content is a nonexistent path). The
release workflow keeps the raw `.p8` content in the `APPLE_API_KEY_P8`
secret and writes it to a runner-temp file whose path becomes
`APPLE_API_KEY`. Without the variables, the build skips notarization
(and stays unsigned without `CSC_LINK`), so forks and local builds work.

## Where builds run

- **CI:** `.github/workflows/desktop-bundled-release.yml`. A push of a
  `vX.Y.Z` tag builds all targets on a per-OS runner matrix. The signing
  variables live in the `release-signing` environment. Its deployment policy
  admits only `main` and `v*` tags.
- **Local:** any machine with `git`, `npm`, `tar`, and an official `uv`
  0.12+. Wheels resolve natively per host, so build on the architecture you
  target.

## Build and test locally

To build a full bundle:

```
# Linux (from the repo root; this worktree needs the devshell)
nix develop -c node scripts/build-bundled-desktop.mjs --tag=v0.20.0

# macOS (do not use nix develop on a Mac — it compiles for hours)
nix shell nixpkgs#nodejs_22 nixpkgs#uv --command \
  node scripts/build-bundled-desktop.mjs --tag=v0.20.0
```

The tag must point at a commit in the local repo, because staging runs
`git archive` against it. After a force-push, run `git tag -f v0.20.0` first.

Artifacts land in `apps/desktop/release/`.

To check the payload of a built artifact:

```
RES=<unpacked-app>/resources/agent-payload
cat $RES/manifest.json          # schemaVersion, tag, commit
$RES/python/cpython-*/bin/python3 -c 'import hermes_cli'
```

For app development without payloads, use the normal fast paths:

```
npm run dev     # dev server + electron
npm run pack    # unpacked, unsigned build in release/<platform>-unpacked
npm run check   # lint + tests + pack
```

## Known machine setup (Windows)

A Windows build machine needs:

- Official `uv` 0.12+ and Node on `PATH` for the target architecture.
- A .NET SDK on `PATH`. The TrustedSigning PowerShell module installs its
  `sign` CLI with it. CAUTION: Do not set `DOTNET_ROOT` to an arm64 SDK. The
  Azure signing dlib runs inside x64 `signtool.exe`, and that combination
  fails with exit code 3.
- PowerShell execution policy `RemoteSigned` for the current user.
- For source-built wheels on arm64: MSVC arm64 build tools and a static
  OpenSSL (`OPENSSL_DIR`, `OPENSSL_STATIC=1`).
