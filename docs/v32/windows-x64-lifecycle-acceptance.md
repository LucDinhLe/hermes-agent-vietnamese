# Windows x64 packaged lifecycle acceptance

This harness is the destructive, post-build acceptance gate for the exact
Hermes Vietnamese v32 NSIS candidate. It is intentionally fail-closed: an
unsupported host, a dirty or mismatched checkout, a wrong installer hash, an
incomplete lifecycle, or a missing receipt is a failure. There is no host-mode
fallback and no required phase can be reported as skipped.

## Safety boundary

The runner hashes and stages the three installer inputs and accepts exactly two
disposable boundaries:

- local `WindowsSandbox.exe`, where the host never launches Hermes,
  Playwright, an installer, or an uninstaller; or
- the repository's `windows-2025` GitHub-hosted runner, where the complete
  machine is a GitHub-provisioned ephemeral VM and the lifecycle script is the
  only workload after checkout, dependency staging, and artifact download.

There is no workstation-host mode and no self-hosted-runner fallback.

The generated Windows Sandbox configuration has networking, clipboard, GPU,
audio/video input, and printer redirection disabled. Installer inputs, a frozen
tracked-source snapshot, and the supplied Node runtime are mapped read-only.
Only a new evidence directory is writable. The live repository is never
mapped: the runner extracts `git archive <harness-commit>`, physically copies
only the link-free `@playwright/test`, `playwright`, and `playwright-core`
package trees beneath its `node_modules`, rejects every link/junction, and
fingerprints the complete snapshot before and after the run. Ignored `.env`,
MCP/Codex config, keys, logs, and private workspace files therefore cannot
enter the guest through the source mapping.

The GitHub-hosted lane enforces `GITHUB_ACTIONS=true`,
`RUNNER_ENVIRONMENT=github-hosted`, `RUNNER_OS=Windows`, x64, Node 26+, and a
reported hypervisor/virtual-machine model. Before it starts the lifecycle, the
host process removes credential-shaped variables plus Git/SSH/npm credential
channels. The guest creates outbound block rules for both `Internet` and
`LocalSubnet` scopes for all three installers, `Hermes.exe`, and every resident
Node/Python/Codex executable under the installed app. Loopback remains
available only for the mock-provider test. Those rules remain active until the
ephemeral VM is discarded.

Both lanes additionally require all of the following before an installer is
allowed to run:

- the portable Node runtime matches `v26.5.1`, `win32/x64`, and the
  `win-x64/node.exe` SHA-256 from the official
  [signed SHASUMS256](https://nodejs.org/dist/v26.5.1/SHASUMS256.txt.asc):
  `b48b0224081224cda1f49374e2fc63d143041ade51754f0cc6608fe8510ba29e`;
- the three offline test packages `@playwright/test`, `playwright`, and
  `playwright-core` match both package-lock version/integrity and the exact
  post-`npm ci` file-tree fingerprint;
- any changed dependency byte stops the harness before the guest mapping; the
  verified fingerprints are sealed into `host-launch.json`;

- the expected isolated account/profile, matching HKCU SID, a virtualized
  machine boundary, and no foreign interactive user hive (`WDAGUtilityAccount`
  specifically for Windows Sandbox; the current GitHub runner account for the
  hosted VM);
- no pre-existing Hermes process or Hermes product/uninstall registration;
- either no active network adapter (Sandbox) or verified product-scoped
  Internet/LAN firewall rules (GitHub-hosted VM);
- no credential-shaped environment variable after scrubbing;
- the exact expected size and SHA-256 for all three staged NSIS files.

If neither approved boundary is present, the command exits non-zero. Never run
`guest.ps1` directly on a workstation. Its mode is sealed into the manifest;
Sandbox powers itself off, while the hosted lane relies on GitHub's mandatory
post-job VM destruction.

## Pinned inputs

The harness fixes these product lanes in code:

- candidate: `vi-v0.32.0-1`, source commit
  `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`;
- update source: `vi-v0.31.0-7`, commit
  `70b2418fdb2b35a714d4a813c6894cdbbec0a370`, 340,302,846 bytes, SHA-256
  `cca0f3c0255e5e8736676a4d7ccb52c6e1b75eb73b94b8d1c3ca5dc91e57e840`;
- rollback target: `vi-v0.20.4-39`, commit
  `d270974d2651e72f169fffe34c955eeae7977458`, 340,105,286 bytes, SHA-256
  `e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31`.

The v31 identity is the baseline supplied by the v32 task and repeated in the
v32 release plan. The vi39 identity is independently recorded in
`release-v31-audit/pilot-release-evidence.json`; the exact published-asset
receipts under
`release-v31-audit/vi-v0.31.0-7/pilot-evidence/exact7-upgrade-vi39-a/`
record the same commit/hash plus the byte size and product display version.
These values are constants in the harness, not labels derived from CLI input.

Supply the published or independently recorded SHA-256 for every installer.
The three files must be distinct byte streams. Candidate provenance stays
locked to the immutable build commit above. The descriptor separately records
`harnessCommit`, because post-build validation fixes may change tests without
changing or relabeling candidate bytes. Repository `HEAD` must equal that
harness commit and the checkout must be completely clean, including untracked
files. Before mapping the checkout, the runner also uses the release builder's
ignored-input probe to reject local `.env` files and ignored source shadows
that ordinary `git status` cannot see. The same
HEAD/status/ignored-input guard runs again after receipt verification and
before the runner can write PASS; the frozen mapped snapshot also must retain
its exact file count and tree hash.

The evidence root itself may not be a symlink or junction. Before creating the
isolated manifest, canonical real paths are compared against the checkout,
Node runtime, installer directories, home/temp roots, and staged input; aliases
or overlaps fail before any writable mapping is opened.

The Node directory must contain a pinned Windows x64 Node 26-or-newer
`node.exe`. Playwright dependencies must already be present in the clean
checkout. The run is offline and must not install dependencies.

## Run after the one candidate build

Choose a new evidence directory outside the checkout and the Node runtime. From
the clean harness checkout, run the local Sandbox lane:

```powershell
& 'C:\pinned\node-26-x64\node.exe' scripts/windows-lifecycle-acceptance/run.mjs `
  --candidate 'D:\release-inputs\Hermes-0.32.0-vi.1-win-x64.exe' `
  --candidate-sha256 '<64-lowercase-hex>' `
  --candidate-commit '81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f' `
  --harness-commit '<current-clean-HEAD-40-lowercase-hex>' `
  --previous 'D:\release-inputs\Hermes-vi-v0.31.0-7-win-x64.exe' `
  --previous-sha256 'cca0f3c0255e5e8736676a4d7ccb52c6e1b75eb73b94b8d1c3ca5dc91e57e840' `
  --rollback 'D:\release-inputs\Hermes-vi-v0.20.4-39-win-x64.exe' `
  --rollback-sha256 'e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31' `
  --node-runtime-dir 'C:\pinned\node-26-x64' `
  --evidence-dir 'D:\hermes-evidence\v32-lifecycle-001'
```

The hosted lane is dispatched only through
`.github/workflows/runtime-smoke-vietnamese.yml` with tag `vi-v0.32.0-1`,
release class `community-prerelease`, and the exact candidate SHA-256. It uses
the dispatched branch SHA as `harnessCommit`, downloads the candidate from the
private draft plus the two pinned public rollback inputs, and uploads the full
evidence tree even on a fail-closed result.

The default timeout is 90 minutes. `--timeout-minutes` accepts 15 through 240.
Keep the Sandbox window open until it powers itself off and the host reports a
passed receipt. The GitHub-hosted lane is non-interactive and ends only after
the validated receipt or a hard failure/timeout.

## Required lifecycle

One successful run proves all of these operations inside the same disposable
guest:

1. Fresh candidate install from the exact NSIS bytes.
2. A real empty-profile onboarding screen, without pre-seeding mock provider
   configuration.
3. The existing exact-packaged v32 mock acceptance: installed resident runtime,
   loopback-only mock gateway, session persistence and relaunch, physical new
   session pointer behavior, Messaging Back with draft preservation, context
   meter, and `/compress` compaction.
4. A safe real tool-call loop against the local mock (`todo` calls only).
5. Exact v31 install, persisted session/data seed, and exact v32 full-NSIS
   in-place upgrade, followed by candidate provenance and data verification.
6. A recoverable repair fixture: quarantine the closed installation's critical
   `resources/app.asar`, record the original hash/size and assert the install is
   unhealthy, then use the user-facing package recovery path (re-run the same
   exact v32 NSIS). The restored component must match its original bytes before
   candidate provenance, chat continuity, a new turn, and data sentinels pass.
7. The installed app's Settings > About **keep data** uninstall control,
   registry/app removal, preserved profile sentinels, reinstall, and session
   recovery.
8. The installed app's Settings > About **delete data** uninstall control,
   with both `HERMES_HOME` and Electron user data removed.
9. Exact v32 reinstall followed by exact `vi-v0.20.4-39` in-place rollback and
   launch against a fresh rollback profile. The closed v32 profile is retained
   and fingerprinted before and after, rather than opened with the older schema.
10. Final uninstall plus zero residual Hermes/lifecycle processes, app files,
    and product registry keys.

Community prerelease update feeds are disabled by release policy. Therefore the
v31-to-v32 gate above proves the offline product-supported full-NSIS in-place
upgrade path; it deliberately sets `updateFeedClaimed: false`. It does **not**
claim that an in-app feed updater was exercised.

## Evidence and interpretation

`lifecycle-result.json` is accepted only when every required gate is `passed`,
the guest identity/isolation claims are exact, and all installer records match
the host descriptor. The guest receipt contains a relative path, byte size, and
SHA-256 for every guest-produced evidence file. The host recomputes the exact
file set and hashes, then writes `host-validation.json` with:

- the receipt SHA-256;
- a canonical evidence-manifest SHA-256;
- the host's expected-descriptor and launch-record SHA-256 values;
- the verified evidence file count and passed gate names.

This detects partial, stale, or post-receipt evidence changes during validation.
It is an integrity seal, not a third-party signature: archive the evidence on
write-once storage or sign the host validation record if later custodial
tampering is in scope.

A green offline unit test or syntax check does not pass the release lifecycle
gate. Only a host-validated `status: passed` receipt from an actual disposable
Sandbox/VM run against the supplied exact installers does.

## Offline development checks

These checks do not launch Sandbox, Hermes, or any installer:

```powershell
& 'C:\pinned\node-26-x64\node.exe' --test `
  scripts/windows-lifecycle-acceptance/policy.test.mjs

$errors = $null
$tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path 'scripts/windows-lifecycle-acceptance/guest.ps1'),
  [ref]$tokens,
  [ref]$errors
) | Out-Null
if ($errors.Count -ne 0) { throw ($errors | Out-String) }
```

The unit tests cover exact artifact binding, candidate/harness commit
separation, fail-closed support for both approved VM modes, the read-only/
writable Sandbox mapping boundary, and rejection of missing/skipped gates or
malformed evidence manifests.
