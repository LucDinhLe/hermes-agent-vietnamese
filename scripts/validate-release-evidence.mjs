import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RELEASE_PLATFORMS = Object.freeze([
  'windows-x64',
  'windows-arm64',
  'macos-arm64',
  'macos-x64',
  'linux-x64',
  'linux-arm64'
])

export const REQUIRED_RUNTIME_GATES = Object.freeze([
  'architecture',
  'residentRuntime',
  'firstRunWithoutDeveloperTools',
  'gateway',
  'onboarding',
  'sessionCreate',
  'safeTool',
  'persistenceAfterRestart',
  'updateFromPrevious',
  'repair',
  'uninstallKeepData',
  'uninstallDeleteData',
  'rollback'
])

export const V31_RUNTIME_GATES = Object.freeze([
  'updateFromV39',
  'agentsPersistentEntry',
  'agentsNoLeftPane',
  'agentsRosterSearch',
  'agentsMultiInvite',
  'agentsLeadUnchanged',
  'agentsManagementEntry',
  'agentsLegacyProfiles',
  'agentsSessionProjectPersistence',
  'agentsGroupRoutineCompatibility',
  'agentsVietnameseEnglish',
  'agentsResponsiveRightPanel',
  'agentsAdvisorContextCostPreserved',
  'agentsNoRightClickPhrase'
])

export const RELEASE_CLASSES = Object.freeze(['community-prerelease', 'stable'])

export function requiredRuntimeGatesForTag(tag) {
  const match = /^vi-v(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-(0|[1-9]\d*)$/.exec(String(tag))
  if (!match) throw new Error(`evidence tag is invalid: ${tag}`)
  const version = match.slice(1, 4).map(Number)
  const requiresV31Gates =
    version[0] > 0 || version[1] > 31 || (version[1] === 31 && version[2] >= 0)

  return requiresV31Gates ? [...REQUIRED_RUNTIME_GATES, ...V31_RUNTIME_GATES] : REQUIRED_RUNTIME_GATES
}

export function parseChecksumManifest(text) {
  const entries = new Map()
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue
    const match = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line)
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`)
    entries.set(match[2], match[1])
  }
  return entries
}

export function validateReleaseEvidence(evidence, checksumText, expected = {}) {
  if (!evidence || evidence.schemaVersion !== 1) throw new Error('release evidence must use schemaVersion 1')
  const requiredRuntimeGates = requiredRuntimeGatesForTag(evidence.tag)
  if (expected.tag && evidence.tag !== expected.tag) throw new Error(`evidence tag mismatch: ${evidence.tag}`)
  if (!/^[0-9a-f]{40}$/.test(evidence.commit ?? '')) throw new Error('evidence commit must be a full Git SHA')
  if (expected.commit && evidence.commit !== expected.commit) {
    throw new Error(`evidence commit mismatch: ${evidence.commit}`)
  }
  if (expected.sha256sumsSha256 && evidence.sha256sumsSha256 !== expected.sha256sumsSha256) {
    throw new Error('evidence SHA256SUMS digest does not match the promoted manifest')
  }
  if (!RELEASE_CLASSES.includes(evidence.releaseClass)) {
    throw new Error(`unsupported release class: ${evidence.releaseClass}`)
  }
  if (expected.releaseClass && evidence.releaseClass !== expected.releaseClass) {
    throw new Error(`evidence release class mismatch: ${evidence.releaseClass}`)
  }
  const checksums = parseChecksumManifest(checksumText)

  for (const platform of RELEASE_PLATFORMS) {
    const record = evidence.platforms?.[platform]
    if (!record || record.decision !== 'GO') throw new Error(`${platform}: decision is not GO`)
    if (!record.machine || !record.osVersion || !record.arch)
      throw new Error(`${platform}: machine evidence is incomplete`)
    if (!record.artifact || checksums.get(record.artifact) !== record.sha256) {
      throw new Error(`${platform}: artifact SHA-256 is absent from or disagrees with SHA256SUMS.txt`)
    }
    for (const gate of requiredRuntimeGates) {
      if (record.gates?.[gate] !== true) throw new Error(`${platform}: missing runtime gate ${gate}`)
    }
    if (!Array.isArray(record.logs) || record.logs.length === 0) throw new Error(`${platform}: no logs recorded`)
    if (!Array.isArray(record.screenshots) || record.screenshots.length === 0)
      throw new Error(`${platform}: no screenshots recorded`)

    if (platform.startsWith('windows-') && evidence.releaseClass === 'stable') {
      if (record.signing?.installerAuthenticode !== 'Valid') {
        throw new Error(`${platform}: installer Authenticode is not Valid`)
      }
      if (record.signing?.installedAppAuthenticode !== 'Valid') {
        throw new Error(`${platform}: installed Hermes.exe Authenticode is not Valid`)
      }
      const installerPublisher = String(record.signing?.installerPublisher ?? '').trim()
      const installedAppPublisher = String(record.signing?.installedAppPublisher ?? '').trim()
      if (!installerPublisher || installerPublisher !== installedAppPublisher) {
        throw new Error(`${platform}: installer and installed Hermes.exe publisher evidence does not match`)
      }
    }
    if (platform.startsWith('windows-') && evidence.releaseClass === 'community-prerelease') {
      if (
        record.signing?.installerAuthenticode !== 'NotSigned' ||
        record.signing?.installedAppAuthenticode !== 'NotSigned'
      ) {
        throw new Error(`${platform}: community prerelease must explicitly record unsigned Windows binaries`)
      }
      if (record.signing?.userWarningVerified !== true) {
        throw new Error(`${platform}: unsigned Windows warning behavior was not verified`)
      }
    }
    if (
      platform.startsWith('macos-') &&
      evidence.releaseClass === 'stable' &&
      !(record.signing?.developerId === true && record.signing?.notarized === true && record.signing?.stapled === true)
    ) {
      throw new Error(`${platform}: Developer ID/notarization/stapling evidence is incomplete`)
    }
    if (platform.startsWith('macos-') && evidence.releaseClass === 'community-prerelease') {
      if (
        record.signing?.developerId !== false ||
        record.signing?.notarized !== false ||
        record.signing?.stapled !== false
      ) {
        throw new Error(`${platform}: community prerelease must explicitly record missing Apple trust artifacts`)
      }
      if (record.signing?.userWarningVerified !== true) {
        throw new Error(`${platform}: unsigned macOS warning behavior was not verified`)
      }
    }
  }
  return evidence
}

function main() {
  const [evidencePath, checksumPath, tag, commit, manifestSha, releaseClass] = process.argv.slice(2)
  if (!evidencePath || !checksumPath || !tag || !commit || !manifestSha || !releaseClass) {
    throw new Error(
      'usage: validate-release-evidence.mjs <evidence.json> <SHA256SUMS.txt> <tag> <commit> <manifest-sha256> <release-class>'
    )
  }
  const evidence = JSON.parse(fs.readFileSync(path.resolve(evidencePath), 'utf8'))
  validateReleaseEvidence(evidence, fs.readFileSync(path.resolve(checksumPath), 'utf8'), {
    tag,
    commit,
    sha256sumsSha256: manifestSha,
    releaseClass
  })
  process.stdout.write(JSON.stringify(evidence, null, 2) + '\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
