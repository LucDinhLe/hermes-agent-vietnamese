// bundled-runtime.ts: decision logic for the bundled desktop runtime.
// This module finds payloads, decides marker-tag invalidation, and decides
// silent adoption for pristine legacy checkouts. Marker-tag invalidation
// tells us when an app update forces offline re-materialization.
//
// Design: .hermes/plans/2026-08-05_desktop-bundled-payloads-channels-eject.md
// (§1.4 adoption, §4.3 bundled update flow).
//
// All functions in this file are pure, and the callers inject the
// dependencies. Thus vitest covers the whole decision surface. The impure
// executors live in main.ts and bootstrap-runner.

import fs from 'node:fs'
import path from 'node:path'

// ─── payload discovery ──────────────────────────────────────────────────────

export interface PayloadInfo {
  dir: string
  tag: string | null
  schemaVersion: number | null
  items: Record<string, { status: string }>
}

/**
 * Resolve the agent-payload directory that ships in the resources of the
 * packaged app. Returns null for thin builds (a stub manifest with
 * thin:true), for dev runs (no resourcesPath), and for unreadable manifests.
 * Every caller treats null as "behave exactly like the current network
 * bootstrap".
 */
export function resolvePayload(
  resourcesPath: string | null | undefined,
  readFile: (p: string) => string = p => fs.readFileSync(p, 'utf8')
): PayloadInfo | null {
  if (!resourcesPath) {
    return null
  }

  const dir = path.join(resourcesPath, 'agent-payload')

  let parsed

  try {
    parsed = JSON.parse(readFile(path.join(dir, 'manifest.json')))
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || parsed.thin === true) {
    return null
  }

  const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {}
  const hasAny = Object.values(items).some((v: any) => v && v.status === 'staged')

  if (!hasAny) {
    return null
  }

  return {
    dir,
    tag: typeof parsed.tag === 'string' ? parsed.tag : null,
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : null,
    items
  }
}

// ─── resident runtime (plan: 2026-08-07_resources-resident-bundled-runtime) ──

// The payload items a resident launch requires — all of them. uv never
// installs the runtime (site-packages ships prebuilt), but runtime lazy
// installs for plugins are a mandatory feature, and uv is what installs
// them into the writable overlay. A payload without uv is an incomplete
// artifact, not a degraded one.
export const RESIDENT_RUNTIME_ITEMS = ['repo', 'uv', 'python', 'site-packages', 'node'] as const

export interface ResidentDecision {
  resident: boolean
  reason: string
}

/**
 * Decide whether this launch runs the backend directly out of the payload
 * in resources (resident) instead of a checkout at ~/.hermes/hermes-agent.
 *
 * Resident is the default for a complete schema-2 payload. The checkout
 * wins only when the user demonstrably owns it:
 * - its manifest says installMode:source (an eject, or a deliberate
 *   install.sh run — both write that manifest), or
 * - it exists with NO manifest and NO desktop-written bootstrap marker,
 *   which is the pre-manifest curl|bash cohort. CLI-first users keep
 *   their install; the desktop never silently shadows it.
 *
 * A pre-manifest checkout WITH a desktop marker (old desktop installs)
 * and a phase-1 bundled checkout (manifest installMode:bundled) both go
 * resident: their materialized trees were desktop-managed anyway, and
 * nothing is deleted — the preference is reversible by eject.
 */
export function decideResidentRuntime(facts: {
  payload: PayloadInfo | null
  checkoutExists: boolean
  checkoutManifest: { installMode?: string } | null
  markerSaysDesktop: boolean
}): ResidentDecision {
  const { payload, checkoutExists, checkoutManifest, markerSaysDesktop } = facts

  if (!payload) {
    return { resident: false, reason: 'thin build (no payload)' }
  }

  if ((payload.schemaVersion ?? 0) < 2) {
    return { resident: false, reason: 'payload predates the resident layout' }
  }

  const missing = RESIDENT_RUNTIME_ITEMS.filter((item) => payload.items[item]?.status !== 'staged')

  if (missing.length > 0) {
    return { resident: false, reason: `payload incomplete (missing: ${missing.join(', ')})` }
  }

  if (checkoutManifest && checkoutManifest.installMode === 'source') {
    return { resident: false, reason: 'checkout at the active root is source-managed' }
  }

  if (checkoutExists && !checkoutManifest && !markerSaysDesktop) {
    return { resident: false, reason: 'legacy checkout without desktop provenance (CLI-first user)' }
  }

  return { resident: true, reason: 'complete resident payload' }
}

/**
 * Locate the payload CPython binary. The install directory is
 * patch-versioned (python/cpython-3.11.15-<triple>/...), so this scans
 * rather than hardcoding, and it verifies the binary exists.
 */
export function findResidentPython(
  payloadDir: string,
  platform: NodeJS.Platform = process.platform,
  fsImpl: Pick<typeof fs, 'readdirSync' | 'existsSync'> = fs
): string | null {
  const pythonRoot = path.join(payloadDir, 'python')

  let entries: string[]

  try {
    entries = fsImpl.readdirSync(pythonRoot)
  } catch {
    return null
  }

  // Prefer the patch-versioned real directory over the minor alias so the
  // resolved path is stable across launches (the alias is a symlink).
  for (const entry of entries.filter((name) => name.startsWith('cpython-')).sort().reverse()) {
    const candidate =
      platform === 'win32'
        ? path.join(pythonRoot, entry, 'python.exe')
        : path.join(pythonRoot, entry, 'bin', 'python3')

    if (fsImpl.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

// ─── update channel ─────────────────────────────────────────────────────────

/**
 * The update channel of a checkout. Mirrors the resolution in
 * hermes_cli/install_manifest.py: a bundled install is always stable, a
 * source manifest carries its own channel, and a missing or unreadable
 * manifest means main. The channel decides what the version pill compares
 * against. The install mode decides only the apply mechanism.
 */
export function resolveChannel(
  manifest: { installMode?: string; channel?: string } | null | undefined
): 'stable' | 'main' {
  if (manifest?.installMode === 'bundled') {
    return 'stable'
  }

  return manifest?.channel === 'stable' ? 'stable' : 'main'
}

/**
 * Pick the newest final release tag (vX.Y.Z, no prerelease suffix) from
 * `git ls-remote --tags` output. Numeric ordering, so v0.10.0 > v0.9.0.
 * Returns null when the output has no final release tag.
 *
 * A peeled entry (`refs/tags/v1.2.3^{}`) resolves the commit that an
 * annotated tag points at. It wins over the unpeeled line of the same tag.
 */
export function latestReleaseFromLsRemote(output: string): { tag: string; sha: string } | null {
  const versions = new Map<string, { key: [number, number, number]; sha: string; peeled: boolean }>()

  for (const line of output.split('\n')) {
    // The major component is capped at three digits: the historical CalVer
    // tags (v2026.7.20) would win every numeric sort. This mirrors
    // _RELEASE_TAG_RE in hermes_cli/update_cmd.py and _SEMVER_TAG_RE in
    // scripts/write_install_stamp.py.
    const m = line.match(/^([0-9a-f]{40})\trefs\/tags\/(v(?:0|[1-9]\d{0,2})\.\d+\.\d+)(\^\{\})?$/)

    if (!m) {
      continue
    }

    const [, sha, tag, peel] = m
    const existing = versions.get(tag)

    if (!existing || (peel && !existing.peeled)) {
      const [major, minor, patch] = tag.slice(1).split('.').map(Number)

      versions.set(tag, { key: [major, minor, patch], sha, peeled: Boolean(peel) })
    }
  }

  let best: { tag: string; sha: string; key: [number, number, number] } | null = null

  for (const [tag, { key, sha }] of versions) {
    const newer =
      !best ||
      key[0] > best.key[0] ||
      (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2])))

    if (newer) {
      best = { tag, sha, key }
    }
  }

  return best ? { tag: best.tag, sha: best.sha } : null
}
