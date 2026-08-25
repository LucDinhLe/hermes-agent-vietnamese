# v32 Windows x64 pre-package dry run — 2026-08-25

## Continuation state

- Branch: `feat/v32-token-context-ux`
- Source commit exercised: `daa8aad5a686fc9391558acca2c3e44f22f96c74`
- Version/tag mapping: `vi-v0.32.0-1` -> `0.32.0-vi.1`
- Runtime: pinned Node `26.5.1`
- Result: the complete source, renderer, native dependency, resident runtime,
  and bundled payload path passed; packaging was intentionally disabled.
- No installer, blockmap, update feed, immutable candidate, private draft,
  tag, release, merge, signing, or Latest mutation was produced.

The owner-authorized candidate attempt bound to the preceding checkpoint was
consumed before packaging. A replacement packaging run has not been started
and requires a fresh owner confirmation bound to the next exact pushed SHA.

## Rejected candidate attempt

The local-candidate command first failed while purging
`apps/desktop/build/agent-payload`. That derived directory had inherited an
ACL containing `Everyone: Deny DeleteSubdirectoriesAndFiles`, so the restricted
runner could not remove it. The target was resolved and checked to be the exact
derived build directory, no process held it, and an elevated literal-path
removal cleared only that directory.

The same attempt then reached `npm ci` but the UI-TUI esbuild step could not
read a required parent path under the restricted runner. The identical source
UI-TUI build passed immediately in the normal Windows user lane. This proves a
runner/filesystem boundary, not a UI-TUI source defect. The attempt stopped
before payload assembly and before electron-builder; it produced no candidate.

## Interrupted-output recovery

Inspection after the stopped attempt found a stale 359,429-byte NSIS fragment
under `apps/desktop/release`. The local-candidate purge contract covered build
inputs and other outputs but did not include that electron-builder output root.
That omission could allow a later process to mistake an interrupted fragment,
blockmap, or update feed for current output.

Commit `daa8aad5a686fc9391558acca2c3e44f22f96c74` adds
`apps/desktop/release` to the mandatory derived-output purge list and locks the
root in regression coverage. Receipts after the fix:

- local candidate derived-output purge: 3/3 passed;
- release/provenance/evidence Node suite: 54/54 passed;
- stale `apps/desktop/release` tree: absent after the dry run.

The stale fragment was derived output only and is not a candidate. It must
never be staged, hashed as an accepted artifact, or promoted.

## Exact pre-package receipt

The following local-candidate pipeline was exercised under the normal Windows
user with the pinned runtime, exact release metadata, and packaging disabled:

```text
node scripts/build-bundled-desktop.mjs \
  --tag=vi-v0.32.0-1 \
  --release-class=community-prerelease \
  --local-candidate \
  --commit=daa8aad5a686fc9391558acca2c3e44f22f96c74 \
  --no-package
```

Result: exit 0.

| Stage | Receipt |
| --- | --- |
| Derived-output purge | 8 roots purged, including `apps/desktop/release` |
| Locked dependencies | `npm ci` passed |
| UI-TUI | production build passed |
| Web application | production build passed; 2,219 modules transformed |
| Bundled Node | Node 26.5.1 downloaded; SHA-256 `c432c996b95cbf7568f13a0fbb37526de84a27e3a5c520c3be15f05a9a168212` verified |
| Desktop renderer | production build passed; 15,058 modules transformed |
| Electron entrypoints | main and preload builds passed |
| Native Windows dependencies | `node-pty` and `get-windows` staged |
| Resident Python | Python 3.11.16 staged |
| Resident package set | 64 exact packages staged |
| Resident Node | payload runtime staged |
| Payload provenance | manifest written with the exact tag, class, and commit |
| Distribution assertion | `assert-dist-built` passed |
| electron-builder | intentionally not invoked by `--no-package` |

This receipt eliminates all known pre-package failures without consuming
another packaging attempt. It does not verify the Windows installer, packaged
runtime, install/update lifecycle, isolated relaunch/persistence, repair,
uninstall, rollback, private staging, signing, or public promotion.

## Next authorized action

After this evidence is committed and pushed, the next action is exactly one
Windows x64 local-candidate packaging build from that new full SHA, using the
pinned Node 26 runtime and no live provider. On success, admission requires the
complete installer's exact commit, version, byte size and SHA-256, followed by
exact-byte packaged provenance/E2E and the isolated Windows lifecycle matrix.

Rollback remains `vi-v0.20.4-39`. Public release, GitHub Latest, merge, signing
with a real credential, live quota use, or installation outside the isolated
smoke environment remain outside this authorization.
