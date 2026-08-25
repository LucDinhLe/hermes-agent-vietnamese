# v32 Windows x64 candidate acceptance — 2026-08-25

## Candidate identity

| Field | Exact value |
| --- | --- |
| Source commit embedded in candidate | `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f` |
| Branch | `feat/v32-token-context-ux` |
| Tag/package label | `vi-v0.32.0-1` |
| Electron version | `0.32.0-vi.1` |
| Platform/architecture | Windows x64 |
| Release class | `community-prerelease` |
| Installer | `Hermes-0.32.0-vi.1-win-x64.exe` |
| Installer size | `341176379` bytes |
| Installer SHA-256 | `EFC3D863A37882C669D571456711264E2AA4F60B66BF9E67FF2441CE491CEEAC` |
| Authenticode | `NotSigned` |
| Blockmap size | `328354` bytes |
| Blockmap SHA-256 | `926D342EBF98C4DD2797B390325C127A282EE2600852659D14D81FDE746CEF70` |
| `latest.yml` size | `363` bytes |
| `latest.yml` SHA-256 | `BA5499B534CE0EF124A82BE196AA451A208ADA78C24880758C60BD57C398B23F` |

The complete local-candidate build exited `0`. It was the single packaging run
authorized for this source commit. No second installer build or rebuild was
started. The release output root had been purged before the run, so these files
cannot be inherited fragments from an interrupted builder.

No tag, signing credential, GitHub draft/release, private staging asset,
merge, public release, or Latest mutation was created by this run.

## Exact-byte provenance admission

The completed NSIS installer was extracted without installing. Admission
validated both provenance surfaces, the packaged `Hermes.exe` PE architecture,
and the resident Node PE architecture:

```text
[verify-windows-nsis] exact embedded payload:
vi-v0.32.0-1
81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f
community-prerelease
(341176379 bytes)
```

The tuple exactly matches the build authorization. The old diagnostic
installer and the failed 359,429-byte NSIS bootstrap remain superseded and are
not members of this candidate artifact set.

## Exact packaged smoke

The future candidate binary from the build's `win-unpacked` application was
bound to the same expected tag, commit, and release class before Electron was
launched. The run used one Playwright worker, the local mock inference server,
a disposable `HERMES_HOME`, disposable Electron user data, and stripped host
credentials. No live provider or real Hermes profile was used.

Final accepted receipt:

```text
1 passed (55.2s)
v32 exact packaged candidate › runs resident gateway, preserves state,
proves the three UX fixes, and compacts
```

The run proved:

- the resident gateway and mock provider chain return a visible reply;
- the `+` button is activated by a physical pointer click;
- a newly focused session tile submits exactly one provider turn and shows the
  prompt/reply in that tile;
- Messaging exposes a visible Back action, returns to the exact focused tile,
  and preserves its unsent draft;
- the same candidate relaunches against the same disposable profile and
  restores both the focused transcript and draft;
- manual compaction completes, the session accepts a subsequent turn, and the
  context meter reports one compaction;
- the context panel visibly separates system/background, conversation, turn
  budget, provider quota availability, and API-equivalent cost.

Exact explicit screenshot receipts:

| Screenshot | Size | SHA-256 |
| --- | ---: | --- |
| `packaged-v32-ux.png` | 835900 | `8411B6A3E116D0211F435CAB3D701F43961A474E3968F9A5C31EC320E578DFE6` |
| `packaged-v32-compaction.png` | 981652 | `AA911BE7D9F45BBB86906C64D146457F761B6F5EED589FD7BF92454A6282B88C` |

## Intermediate packaged-smoke failure and regression

The first accepted-byte runs completed every product assertion and wrote both
explicit screenshots, but the Playwright worker-level trace/screenshot
recorder retained two Electron transports across the required relaunch and
consumed the 240-second hook timeout after the test body. Phase logging proved
that application close, mock close, and sandbox cleanup all completed. This
was a validation-harness failure, not a candidate behavior failure.

Commit `527efe6484555cee4cef3c14066fcf3fee6c5648` disables only the generic
worker-level recorder for this multi-application spec. The two explicit
acceptance screenshots and every product assertion remain mandatory. A release
contract locks both the bounded recorder configuration and the two explicit
screenshot calls.

Post-fix receipts:

- desktop TypeScript typecheck: passed;
- release workflow contract: 13/13 passed;
- exact packaged candidate acceptance: 1/1 passed in 55.2 seconds;
- candidate installer size and SHA-256 after the harness fix: unchanged.

The validation-harness commit is intentionally newer than the immutable
candidate source commit. It changes only E2E evidence collection and its
contract test; it is not inside the already-built candidate. Promotion and
lifecycle evidence must continue to identify the candidate by embedded commit
`81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`, not by the later harness HEAD.

## Remaining gates

This is an admitted unsigned Windows x64 candidate, not technical GO yet.
Remaining required work:

1. Run fresh install, update from v31, relaunch, persistence, repair,
   uninstall, and rollback to `vi-v0.20.4-39` in a disposable Windows runner
   or VM. Host-profile installation is not an acceptable substitute.
2. Preserve the accepted installer byte in private immutable staging only
   after the lifecycle matrix passes.
3. Obtain real signing credentials or an explicit signing action before a
   stable public Latest promotion; signing produces a new exact byte that must
   be re-hashed and re-admitted.
4. Merge, public release, and GitHub Latest remain separate owner-approval
   actions.
