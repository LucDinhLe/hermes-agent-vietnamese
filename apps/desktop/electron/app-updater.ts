// app-updater.ts — electron-updater integration for bundled desktop installs.
//
// Bundled installs update through GitHub Releases: electron-updater reads
// latest*.yml from the release that the desktop-bundled-release workflow
// attached, downloads the new installer, and applies it. The swapped-in app
// carries the new runtime in its own resources (resident mode), so there is
// no post-update install step at all.
//
// Source installs never reach this module. The callers gate on the install
// manifest first and fall through to the git-based update path.
//
// The decision helpers are pure so vitest covers them. The impure wrapper
// at the bottom lazy-loads electron-updater, because the module must not
// cost anything on thin builds.

import type { AppUpdater } from 'electron-updater'

const COMMUNITY_RELEASE_DOWNLOAD_ROOT =
  'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download'

export const COMMUNITY_RELEASES_API_URL =
  'https://api.github.com/repos/LucDinhLe/hermes-agent-vietnamese/releases?per_page=100'

interface CommunityVersion {
  key: [number, number, number, number]
  version: string
}

export interface CommunityUpdateRelease {
  feedUrl: string
  tag: string
  version: string
}

export interface UpdaterGateFacts {
  stampHasPayload: boolean
  installMode: string | null // from .hermes-install.json; null = no manifest
  isPackaged: boolean
}

/**
 * True when this launch must use electron-updater for app updates.
 *
 * All three conditions are necessary:
 * - the build carries payloads (a thin build has no matching feed artifacts),
 * - the checkout opted into desktop management (installMode bundled) — an
 *   ejected or source checkout keeps the git update path,
 * - the app is packaged (dev runs have no app-update.yml).
 */
export function shouldUseAppUpdater(facts: UpdaterGateFacts): boolean {
  return facts.stampHasPayload === true && facts.installMode === 'bundled' && facts.isPackaged === true
}

export function releaseTagForAppVersion(version: string): string {
  const community = /^(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-vi\.(0|[1-9]\d*)$/.exec(version)

  return community
    ? `vi-v${community[1]}.${community[2]}.${community[3]}-${community[4]}`
    : `v${version}`
}

function parseCommunityReleaseTag(tag: string): CommunityVersion | null {
  const match = /^vi-v(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-(0|[1-9]\d*)$/.exec(tag)

  if (!match) {
    return null
  }

  const [, major, minor, patch, iteration] = match

  return {
    key: [Number(major), Number(minor), Number(patch), Number(iteration)],
    version: `${major}.${minor}.${patch}-vi.${iteration}`
  }
}

function parseInstalledVersion(version: string): CommunityVersion | null {
  const community = /^(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-vi\.(0|[1-9]\d*)$/.exec(version)

  if (community) {
    const [, major, minor, patch, iteration] = community

    return {
      key: [Number(major), Number(minor), Number(patch), Number(iteration)],
      version
    }
  }

  const upstream = /^(0|[1-9]\d{0,2})\.(\d+)\.(\d+)$/.exec(version)

  if (!upstream) {
    return null
  }

  const [, major, minor, patch] = upstream

  return { key: [Number(major), Number(minor), Number(patch), -1], version }
}

function compareVersionKeys(left: CommunityVersion['key'], right: CommunityVersion['key']): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }

  return 0
}

export function communityUpdateMetadataName(platform: string, arch: string): string | null {
  if (platform === 'win32') {
    return 'latest.yml'
  }

  if (platform === 'darwin') {
    return 'latest-mac.yml'
  }

  if (platform === 'linux') {
    return arch === 'arm64' ? 'latest-linux-arm64.yml' : arch === 'x64' ? 'latest-linux.yml' : null
  }

  return null
}

export function communityReleaseFeedUrl(tag: string): string {
  if (!parseCommunityReleaseTag(tag)) {
    throw new Error(`Invalid Hermes Vietnamese release tag: ${tag}`)
  }

  return `${COMMUNITY_RELEASE_DOWNLOAD_ROOT}/${tag}`
}

export function configureCommunityReleaseFeed(
  updater: Pick<AppUpdater, 'setFeedURL'>,
  release: Pick<CommunityUpdateRelease, 'feedUrl'>
): void {
  updater.setFeedURL({ provider: 'generic', url: release.feedUrl, channel: 'latest' })
}

/**
 * Select a published community release that can update this exact platform.
 *
 * GitHub's provider cannot order the public `vi-vX.Y.Z-N` tags because that
 * spelling is intentionally not SemVer. We therefore use the Releases API as
 * an index, then pin electron-updater's generic feed to one immutable release.
 */
export function selectCommunityUpdateRelease(
  releases: unknown,
  currentVersion: string,
  platform = process.platform,
  arch = process.arch
): CommunityUpdateRelease | null {
  if (!Array.isArray(releases)) {
    return null
  }

  const current = parseInstalledVersion(currentVersion)
  const metadataName = communityUpdateMetadataName(platform, arch)

  if (!current || !metadataName) {
    return null
  }

  let best: CommunityUpdateRelease & { key: CommunityVersion['key'] } | null = null

  for (const value of releases) {
    if (!value || typeof value !== 'object' || (value as { draft?: unknown }).draft === true) {
      continue
    }

    const release = value as { assets?: unknown; tag_name?: unknown }
    const tag = typeof release.tag_name === 'string' ? release.tag_name : ''
    const parsed = parseCommunityReleaseTag(tag)

    const assetNames = Array.isArray(release.assets)
      ? release.assets
          .map(asset =>
            asset && typeof asset === 'object' && typeof (asset as { name?: unknown }).name === 'string'
              ? (asset as { name: string }).name
              : null
          )
          .filter((name): name is string => name !== null)
      : []

    if (!parsed || !assetNames.includes(metadataName) || compareVersionKeys(parsed.key, current.key) <= 0) {
      continue
    }

    if (!best || compareVersionKeys(parsed.key, best.key) > 0) {
      best = {
        feedUrl: communityReleaseFeedUrl(tag),
        key: parsed.key,
        tag,
        version: parsed.version
      }
    }
  }

  return best ? { feedUrl: best.feedUrl, tag: best.tag, version: best.version } : null
}

/**
 * Map an electron-updater check result to the renderer's update-check shape
 * (the shape hermes:updates:check already returns for the git path). The
 * renderer then needs no new states: `updateAvailable` plus `mechanism`
 * drive the existing UI.
 */
export function describeFeedCheck(
  current: string,
  info: { version?: string } | null | undefined,
  isUpdateAvailable?: boolean
): {
  supported: true
  mechanism: 'app-updater'
  channel: 'stable'
  currentVersion: string
  latestVersion: string | null
  latestTag: string | null
  targetSha: string | null
  updateAvailable: boolean
  fetchedAt: number
} {
  const latest = info && typeof info.version === 'string' ? info.version : null
  const latestTag = latest ? releaseTagForAppVersion(latest) : null
  const updateAvailable = isUpdateAvailable ?? (latest !== null && latest !== current)

  return {
    supported: true,
    mechanism: 'app-updater',
    // Bundled installs are locked to the stable channel; saying so here
    // lets every renderer surface pick release vocabulary without a
    // separate probe of the install manifest.
    channel: 'stable',
    currentVersion: current,
    latestVersion: latest,
    latestTag,
    // The renderer's ambient update notification keys on targetSha. For an
    // immutable packaged release the tag is the stable target identity.
    targetSha: updateAvailable ? latestTag : null,
    // Prefer electron-updater's own semver verdict: a plain string compare
    // would offer a locally-newer dev build a downgrade.
    updateAvailable,
    fetchedAt: Date.now()
  }
}

// ── impure wrapper ──────────────────────────────────────────────────────────

let cachedUpdater: AppUpdater | null = null

type ConfigurableAutoUpdater = Pick<
  AppUpdater,
  'allowPrerelease' | 'autoDownload' | 'autoInstallOnAppQuit' | 'disableDifferentialDownload'
>

/**
 * Apply the release-safety settings shared by every packaged desktop update.
 *
 * Full installers are deliberate. Reconstructing a large NSIS/AppImage update
 * from old and new blocks creates bytes that were never uploaded, hashed, or
 * smoke-tested by the release workflow. Downloading the complete asset keeps
 * the updater on the exact candidate bytes that passed promotion.
 */
export function configureAutoUpdater(updater: ConfigurableAutoUpdater): void {
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.disableDifferentialDownload = true
  // Community revision numbers are encoded as SemVer prerelease components
  // (0.20.0-vi.15), and community candidates may also be published as GitHub
  // prereleases. Without this flag electron-updater filters that feed out.
  updater.allowPrerelease = true
}

/**
 * Start the already-downloaded installer silently and force a relaunch.
 * Download progress is already visible inside Hermes; `/S` prevents the
 * assisted NSIS first-install pages from appearing again during an update.
 * `beforeInstall` lets main.ts disarm its normal quit guard first.
 */
export function beginAppUpdateInstall(
  updater: Pick<AppUpdater, 'quitAndInstall'>,
  beforeInstall?: () => void
): void {
  beforeInstall?.()
  updater.quitAndInstall(true, true)
}

/**
 * Lazy singleton for electron-updater's autoUpdater. The require sits inside
 * the function so thin builds and tests never pay for the module load.
 * autoDownload stays off: the renderer asks the user before the download
 * starts (same consent model as the git path).
 */
export function getAutoUpdater(): AppUpdater {
  if (cachedUpdater) {
    return cachedUpdater
  }

  const { autoUpdater } = require('electron-updater') as { autoUpdater: AppUpdater }

  configureAutoUpdater(autoUpdater)
  cachedUpdater = autoUpdater

  return autoUpdater
}

/** Check the newest eligible immutable community release feed. */
export async function checkAppUpdate(
  currentVersion: string,
  releases: unknown,
  platform = process.platform,
  arch = process.arch
): Promise<ReturnType<typeof describeFeedCheck>> {
  const selected = selectCommunityUpdateRelease(releases, currentVersion, platform, arch)

  if (!selected) {
    return describeFeedCheck(currentVersion, { version: currentVersion }, false)
  }

  const updater = getAutoUpdater()
  configureCommunityReleaseFeed(updater, selected)
  const result = await updater.checkForUpdates()

  return describeFeedCheck(currentVersion, result?.updateInfo, result?.isUpdateAvailable)
}

/**
 * Download the update, then quit and install. `onProgress` receives percent
 * values from electron-updater's download events. The returned promise
 * resolves after the download; quitAndInstall exits the process.
 */
export async function applyAppUpdate(
  onProgress?: (percent: number) => void,
  beforeInstall?: () => void
): Promise<{ ok: true }> {
  const updater = getAutoUpdater()
  const handler = onProgress ? (p: { percent: number }) => onProgress(p.percent) : null

  if (handler) {
    updater.on('download-progress', handler)
  }

  // The listener must come off on failure too: the updater is a process-wide
  // singleton, and a retry after a failed download would stack a second
  // listener that fires ghost progress events.
  try {
    await updater.downloadUpdate()
  } finally {
    if (handler) {
      updater.removeListener('download-progress', handler)
    }
  }

  beginAppUpdateInstall(updater, beforeInstall)

  return { ok: true }
}
