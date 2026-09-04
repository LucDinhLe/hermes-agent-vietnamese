import fs from 'node:fs'
import path from 'node:path'

const RELEASE_CLASSES = new Set(['community-prerelease', 'stable'])
const FULL_COMMIT_RE = /^[0-9a-f]{40}$/
const VI_RELEASE_TAG_RE = /^vi-v(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-(0|[1-9]\d*)$/
// Kênh composite (04/09/2026): tag lịch vYYYY.M.D[-thunghiem.N], appVersion = tag bỏ 'v'
const CALVER_RELEASE_TAG_RE = /^v(\d{4}\.\d{1,2}\.\d{1,3}(?:-thunghiem\.\d{1,4})?)$/

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

function parseJsonFile(file, label) {
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing ${label}: ${file}`)
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function expectedBundledProvenanceFromEnv(env = process.env) {
  const tag = requiredString(env.HERMES_PAYLOAD_TAG, 'HERMES_PAYLOAD_TAG')
  const commit = requiredString(env.HERMES_PAYLOAD_GIT_REF, 'HERMES_PAYLOAD_GIT_REF')
  const releaseClass = requiredString(env.HERMES_RELEASE_CLASS, 'HERMES_RELEASE_CLASS')

  if (!VI_RELEASE_TAG_RE.test(tag) && !CALVER_RELEASE_TAG_RE.test(tag)) {
    throw new Error(`HERMES_PAYLOAD_TAG must be vi-vX.Y.Z-N or vYYYY.M.D[-thunghiem.N], got: ${tag}`)
  }
  if (!FULL_COMMIT_RE.test(commit)) {
    throw new Error('HERMES_PAYLOAD_GIT_REF must be the full lowercase 40-character commit SHA')
  }
  if (!RELEASE_CLASSES.has(releaseClass)) {
    throw new Error(
      `HERMES_RELEASE_CLASS must be community-prerelease|stable, got: ${releaseClass}`
    )
  }

  return Object.freeze({ commit, releaseClass, tag })
}

export function expectedBundledUpdatePolicy(releaseClass) {
  if (!RELEASE_CLASSES.has(releaseClass)) {
    throw new Error(`unsupported bundled release class: ${releaseClass}`)
  }
  const updateFeedEnabled = releaseClass === 'stable'
  return Object.freeze({
    releaseClass,
    updateChannel: updateFeedEnabled ? 'stable' : 'community-prerelease',
    updateFeedEnabled
  })
}

export function validateBundledProvenance({ expected, manifest, stamp }) {
  if (!expected || !stamp || !manifest) {
    throw new Error('expected provenance, install stamp and resident manifest are all required')
  }
  if (stamp.payload !== true) {
    throw new Error('install-stamp.json must identify a resident payload')
  }
  if (manifest.schemaVersion !== 2 || manifest.thin === true) {
    throw new Error('resident payload manifest must be a complete schema-2 payload')
  }

  for (const [label, actual] of [
    ['expected tag', expected.tag],
    ['install-stamp tag', stamp.tag],
    ['resident manifest tag', manifest.tag]
  ]) {
    if (!VI_RELEASE_TAG_RE.test(String(actual || ''))) {
      throw new Error(`${label} is not a valid Vietnamese release tag: ${actual ?? '(missing)'}`)
    }
  }
  for (const [label, actual] of [
    ['expected commit', expected.commit],
    ['install-stamp commit', stamp.commit],
    ['resident manifest commit', manifest.commit]
  ]) {
    if (!FULL_COMMIT_RE.test(String(actual || ''))) {
      throw new Error(`${label} must be a full lowercase 40-character commit SHA`)
    }
  }

  const policy = expectedBundledUpdatePolicy(expected.releaseClass)
  const surfaces = [
    ['install-stamp.json', stamp],
    ['resident manifest', manifest]
  ]
  for (const [label, surface] of surfaces) {
    if (surface.tag !== expected.tag) {
      throw new Error(`${label} tag mismatch; expected ${expected.tag}, got ${surface.tag}`)
    }
    if (surface.commit !== expected.commit) {
      throw new Error(`${label} commit mismatch; expected ${expected.commit}, got ${surface.commit}`)
    }
    for (const field of ['releaseClass', 'updateChannel', 'updateFeedEnabled']) {
      if (surface[field] !== policy[field]) {
        throw new Error(
          `${label} ${field} mismatch; expected ${String(policy[field])}, got ${String(surface[field])}`
        )
      }
    }
  }

  return Object.freeze({ ...expected, ...policy })
}

export function readAndValidateBundledProvenance({ expected, resourcesPath }) {
  const stampPath = path.join(resourcesPath, 'install-stamp.json')
  const manifestPath = path.join(resourcesPath, 'agent-payload', 'manifest.json')
  const stamp = parseJsonFile(stampPath, 'install-stamp.json')
  const manifest = parseJsonFile(manifestPath, 'resident payload manifest')
  const provenance = validateBundledProvenance({ expected, manifest, stamp })
  return Object.freeze({ manifest, provenance, stamp })
}

export function appVersionFromVietnameseTag(tag) {
  const calver = CALVER_RELEASE_TAG_RE.exec(String(tag || ''))
  if (calver) {
    return calver[1]
  }
  const match = VI_RELEASE_TAG_RE.exec(String(tag || ''))
  if (!match) {
    throw new Error(`release tag must be vi-vX.Y.Z-N or vYYYY.M.D[-thunghiem.N], got: ${tag}`)
  }
  return `${match[1]}.${match[2]}.${match[3]}-vi.${match[4]}`
}

export function expectedDistributionArtifactName({ arch, platform, tag }) {
  if (!['arm64', 'x64'].includes(arch)) {
    throw new Error(`unsupported packaged architecture: ${arch}`)
  }
  const version = appVersionFromVietnameseTag(tag)
  if (platform === 'win32') return `Hermes-${version}-win-${arch}.exe`
  if (platform === 'darwin') return `Hermes-${version}-mac-${arch}.dmg`
  if (platform === 'linux') {
    const artifactArch = arch === 'x64' ? 'x86_64' : 'arm64'
    return `Hermes-${version}-linux-${artifactArch}.AppImage`
  }
  throw new Error(`unsupported packaged platform: ${platform}`)
}

export function validateExpectedDistributionArtifact({
  arch,
  desktopRoot,
  expectedPath,
  platform,
  tag
}) {
  const rawPath = requiredString(expectedPath, 'HERMES_DESKTOP_EXPECTED_ARTIFACT')
  const releaseRoot = path.resolve(desktopRoot, 'release')
  const artifactPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(desktopRoot, rawPath)
  if (path.dirname(artifactPath) !== releaseRoot) {
    throw new Error(`expected distribution artifact must be a direct child of ${releaseRoot}`)
  }
  const expectedName = expectedDistributionArtifactName({ arch, platform, tag })
  if (path.basename(artifactPath) !== expectedName) {
    throw new Error(
      `distribution artifact name mismatch; expected ${expectedName}, got ${path.basename(artifactPath)}`
    )
  }
  if (!fs.statSync(artifactPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing expected distribution artifact: ${artifactPath}`)
  }
  return artifactPath
}
