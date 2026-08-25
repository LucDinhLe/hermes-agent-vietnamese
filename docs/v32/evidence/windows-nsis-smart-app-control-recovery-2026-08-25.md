# v32 Windows NSIS Smart App Control recovery — 2026-08-25

## Continuation state

- Branch: `feat/v32-token-context-ux`
- Attempted source commit: `a606d80a4a6a01e4fe91cd3ed373b2c962a7d6f0`
- Version/tag mapping: `vi-v0.32.0-1` -> `0.32.0-vi.1`
- Runtime used: Node `26.5.1`, npm `11.17.0`
- The owner-authorized exceptional candidate build was consumed by this attempt.
- No second build or retry has been started.
- No immutable candidate, private draft, tag, release, merge, or Latest mutation was produced.

## Failure boundary

The bundled application, resident Python/Node payload, native Windows x64 modules,
and the 7-Zip NSIS application archive completed. Electron-builder then generated
its temporary unsigned NSIS bootstrap and attempted to execute that bootstrap to
materialize the uninstaller. Windows rejected that process creation as
`spawn UNKNOWN`.

The 359,429-byte file below is a temporary uninstaller-generation bootstrap, not
a completed installer and not a candidate:

| Derived output | Size | SHA-256 |
| --- | ---: | --- |
| `Hermes-0.32.0-vi.1-win-x64.exe` | 359,429 | `13989F80759D424ED50A48BF9C431874C2C041DEFE3F88A3C4D910198ED5C74F` |
| `hermes-0.32.0-vi.1-x64.nsis.7z` | 340,411,186 | `A6AED10A8774D5AB1390B80E28A297E9FEB96F93E0FEDBD6D0B932B775EC4515` |

Any pre-existing blockmap or `latest.yml` beside these files is stale diagnostic
output and must not be admitted to candidate evidence. The next authorized local
candidate build purges derived package-input/output roots before rebuilding.

## Root-cause evidence

Windows Code Integrity recorded the rejection at `2026-08-25 10:39:31 +07:00`:

- Event `3033`, record `739534`: the temporary Hermes NSIS executable did not
  meet the Enterprise signing level requirements.
- Event `3077`, record `739536`: the same executable violated Code Integrity
  policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`.
- Event `3118`, record `739538`: Smart App Control block details.
- Defender reported no malware/threat detection for the path or time window.

This distinguishes an unsigned generated-binary execution policy failure from a
source build failure, dependency failure, malformed PE, or provider/runtime error.

## Recovery implemented

`apps/desktop/scripts/patch-electron-builder-windows-nsis.mjs` patches the locked
electron-builder `26.15.3` NSIS target during `prebuilder`. On Windows only, it
uses electron-builder's bundled `UninstallerReader` to extract the exact
uninstaller payload from the temporary bootstrap without executing unsigned
generated code. Non-Windows behavior is unchanged.

The patch:

- checks the exact dependency source shape and fails closed on drift;
- contains an exact idempotency marker and rejects forged/incomplete markers;
- runs automatically after every clean `npm ci` and before electron-builder;
- is a mandatory pre-candidate workflow regression.

The reader was exercised against the failed attempt's real bootstrap and
successfully extracted a 254,225-byte uninstaller with SHA-256
`D54B6D1B32E91DB2EAFE54435FB6D196D8BAFE4C3A46B9441EFAA9CE4AABB395`.
This diagnostic extraction did not start another build and did not turn the
failed attempt into a candidate.

## Gates after the fix

- Windows/macOS electron-builder patch regressions: `10/10` passed.
- Release workflow contract suite: `44/44` passed.
- Release/provenance/evidence Node suite: `48/48` passed.
- `git diff --check`: passed.
- A second candidate build remains intentionally not run pending a new explicit
  owner authorization bound to the post-fix commit.

