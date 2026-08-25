# v32 Windows x64 lifecycle technical GO — 2026-08-25

## Workflow receipt

| Field                     | Exact value                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| GitHub run                | `32865922889`                                                             |
| Job                       | `97861054039`                                                             |
| Conclusion                | `success`                                                                 |
| Duration                  | 43m33s                                                                    |
| Harness commit            | `08bee81cfa5f55bfc36069b5c9733d9a0d59c8e0`                                |
| Internal lifecycle run ID | `9763b975-b6ad-4b8e-a669-b65cdaeac42b`                                    |
| Action artifact ID        | `9571795233`                                                              |
| Action artifact name      | `v32-windows-lifecycle-32865922889-1`                                     |
| Action artifact size      | `6694622` byte                                                            |
| Action artifact digest    | `sha256:cfbe3edfccfca083693f70b82f7ad356cf7db71f464a1505aac25f4d7cd582d4` |
| Receipt SHA-256           | `c60b8870a26bb72b16a8aafcc863db2be300fe4451505f98c9ea5b19a2874641`        |
| Host validation SHA-256   | `c789707f24e5a65b27230777a23f735075da642697f238787437b521b1029555`        |
| Evidence manifest SHA-256 | `c3f30a372b2ba975fd15c7d0005b28fe51e115853ab36ebed94c9df83d164311`        |

Run URL:
`https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/32865922889`.

## Candidate bound to the receipt

| Field        | Exact value                                                        |
| ------------ | ------------------------------------------------------------------ |
| Tag          | `vi-v0.32.0-1`                                                     |
| Commit       | `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`                         |
| Version      | `0.32.0-vi.1`                                                      |
| File         | `Hermes-Vietnamese-Windows-x64-Setup.exe`                          |
| Size         | `341176379` byte                                                   |
| SHA-256      | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |
| Authenticode | `NotSigned`                                                        |

The exact candidate, v31 input and vi39 rollback input were independently
hashed before any installer ran. Product outbound access to Internet and local
subnet was blocked; only the loopback mock endpoint was available.

## Host validation

The downloaded archive contains all 60 guest evidence members named by
`lifecycle-result.json`. Eleven are hidden Playwright `.last-run.json` receipts.
Every member was rechecked locally for exact relative path, byte size and
SHA-256; all matched. `host-validation.json` also matched the receipt hash and
the exact 19 required gate names.

Passed gates:

1. `isolatedGuest`
2. `noCredentialInheritance`
3. `exactInputs`
4. `networkIsolation`
5. `freshInstall`
6. `onboarding`
7. `packagedMockRuntime`
8. `packagedSessionRelaunch`
9. `uxMessagingBack`
10. `uxNewSessionPointer`
11. `uxContextMeter`
12. `compaction`
13. `safeTool`
14. `v31ToV32Update`
15. `repair`
16. `uninstallKeepData`
17. `uninstallDeleteData`
18. `rollbackVi39`
19. `noResidualProcesses`

Final residue check recorded `guestProcessCount=0` and
`productRegistryPresent=false`.

## Archive regression closure

Run `32860690986` had already passed product lifecycle but exposed that
`actions/upload-artifact` omitted hidden files covered by the guest manifest.
Commit `08bee81cf` added `include-hidden-files: true` plus a workflow contract
test. Run `32865922889` repeated the full gate against the unchanged candidate
and proved the downloaded archive is complete.

## Decision

The exact Windows x64 candidate is technical GO for private staging and an
owner-approved public community prerelease. Signing, merge and publication
remain separate external actions; no stable/final claim is made.

## Private staging seal

Private draft release `376211316` remains `draft=true`, `prerelease=true` and
contains exactly four files:

|    Asset ID | File                                      |      Size | SHA-256                                                            |
| ----------: | ----------------------------------------- | --------: | ------------------------------------------------------------------ |
| `528808235` | `Hermes-Vietnamese-Windows-x64-Setup.exe` | 341176379 | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |
| `529456147` | `candidate-provenance.json`               |       401 | `333bf17b57762172423754f89d737179a13234e3996ab92c23e19855769a1dfe` |
| `529456146` | `SHA256SUMS.txt`                          |       198 | `1fb94a77e6b2a7da0622fbdc17e6fbb92dbebd37096ed3e24c7965fd177790f4` |
| `529456145` | `pilot-release-evidence.json`             |      2268 | `2b892a2415961a767dcac82c1c923a8d16e3247c89e64a96c18ddb85f39f8476` |

`validate-v32-promotion.mjs` passed against a fresh download of all four private
draft assets, the GitHub run API, the action artifact digest and the complete
locally downloaded lifecycle tree. The downloaded installer again hashed to
`efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac`.
No public mutation was performed.
