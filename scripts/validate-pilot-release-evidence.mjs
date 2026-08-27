import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateReleaseAssetInventory } from './release-asset-inventory.mjs'
import { V31_RUNTIME_GATES, parseChecksumManifest, requiredRuntimeGatesForTag } from './validate-release-evidence.mjs'
import { REQUIRED_LIFECYCLE_GATES } from './windows-lifecycle-acceptance/policy.mjs'

export const PILOT_WINDOWS_GATES = Object.freeze([
  'exactBytes',
  'freshInstall',
  'firstRunWithoutDeveloperTools',
  'bundledRuntime',
  'gateway',
  'onboarding',
  'sessionCreate',
  'sessionRename',
  'sessionTabs',
  'browserTabs',
  'rightPanelResize',
  'connectorChromeIsolated',
  'connectorEdgeIsolated',
  'connectorConsentPreview',
  'connectorRevoke',
  'connectorPersistence',
  'connectorRedaction',
  'reasoningSummaryEnabled',
  'reasoningSummaryDisabledZeroCalls',
  'reasoningOriginalPreserved',
  'advisorDisabledZeroCalls',
  'advisorPlanCheckpoint',
  'advisorRecoveryCheckpoint',
  'advisorFinalCheckpoint',
  'advisorReadOnly',
  'advisorRevisionBounded',
  'advisorModelPersistence',
  'advisorSessionScoped',
  'advisorPaneIsolation',
  'advisorProgressPlan',
  'advisorProgressFinal',
  'workProgressActionReason',
  'contextUsagePerSession',
  'legacyMarkerResidentUpgrade',
  'projectPins',
  'projectPinOrdering',
  'projectsOverview',
  'usageAnalytics',
  'rightPanelDefault',
  'scheduledJobsVietnamese',
  'persistenceAfterRestart',
  'safeTool',
  'updateFromV25',
  'updateFromV28',
  'repair',
  'uninstallKeepData',
  'uninstallDeleteData',
  'rollback'
])

export const BUILD_ONLY_PILOT_TARGETS = Object.freeze([
  'windows-arm64',
  'macos-arm64',
  'macos-x64',
  'linux-x64',
  'linux-arm64'
])

export function requiredPilotWindowsGatesForTag(tag) {
  if (/^vi-v0\.32\.1-(1[7-9]|[2-9]\d*)$/.test(String(tag))) {
    return REQUIRED_LIFECYCLE_GATES
  }
  const requiresV31 = requiredRuntimeGatesForTag(tag).includes(V31_RUNTIME_GATES[0])
  return requiresV31 ? [...PILOT_WINDOWS_GATES, ...V31_RUNTIME_GATES] : PILOT_WINDOWS_GATES
}

function requireMatchingIdentity(record, expected, label) {
  for (const key of ['tag', 'commit', 'releaseClass']) {
    if (record?.[key] !== expected[key]) throw new Error(`${label} ${key} mismatch`)
  }
}

export function validatePilotAssetInventory(assetNames, checksumBytes) {
  validateReleaseAssetInventory(assetNames, checksumBytes, 'pilot-release-evidence.json')
  return [...assetNames].sort()
}

export function parsePilotAssetNamesJson(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(parsed) || parsed.some(name => typeof name !== 'string' || name.trim() !== name || !name)) {
    throw new Error('pilot asset names JSON must be an array of non-empty filenames')
  }
  return parsed
}

export function validatePilotReleaseEvidence(evidence, provenance, checksumBytes, expected) {
  const checksumBuffer = Buffer.isBuffer(checksumBytes) ? checksumBytes : Buffer.from(checksumBytes)
  const manifestSha = crypto.createHash('sha256').update(checksumBuffer).digest('hex')
  const identity = {
    tag: expected.tag,
    commit: expected.commit,
    releaseClass: 'community-prerelease'
  }

  requiredRuntimeGatesForTag(identity.tag)
  if (!/^[0-9a-f]{40}$/.test(identity.commit ?? '')) throw new Error('candidate commit must be a full Git SHA')
  if (!/^[0-9a-f]{64}$/.test(expected.manifestSha ?? '')) throw new Error('manifest digest must be SHA-256')
  requireMatchingIdentity(provenance, identity, 'provenance')
  requireMatchingIdentity(evidence, identity, 'evidence')
  if (String(provenance.runId) !== String(expected.stagingRunId)) throw new Error('staging run mismatch')
  if (evidence.policy !== 'community-pilot') throw new Error('pilot policy mismatch')
  if (evidence.sha256sumsSha256 !== expected.manifestSha || manifestSha !== expected.manifestSha) {
    throw new Error('manifest digest mismatch')
  }

  const checksums = parseChecksumManifest(checksumBuffer.toString('utf8'))
  const windows = evidence.platforms?.['windows-x64']
  if (windows?.decision !== 'PILOT-GO') throw new Error('windows-x64 is not PILOT-GO')
  if (!windows.artifact || checksums.get(windows.artifact) !== windows.sha256) {
    throw new Error('windows-x64 byte mismatch')
  }
  const windowsGates = requiredPilotWindowsGatesForTag(identity.tag)
  for (const gate of windowsGates) {
    if (windows.gates?.[gate] !== true) throw new Error(`windows-x64 missing ${gate}`)
  }
  if (!Array.isArray(windows.limitations)) {
    throw new Error('windows-x64 pilot limitations must be an array')
  }

  for (const target of BUILD_ONLY_PILOT_TARGETS) {
    const record = evidence.platforms?.[target]
    if (record?.decision !== 'BUILD-ONLY-PILOT') throw new Error(`${target} status is not build-only pilot`)
    if (record.realMachineSmoke !== false) throw new Error(`${target} must disclose missing real-machine smoke`)
    if (!record.artifact || checksums.get(record.artifact) !== record.sha256) {
      throw new Error(`${target} byte mismatch`)
    }
  }

  return evidence
}

function main() {
  const [evidencePath, provenancePath, checksumPath, tag, commit, manifestSha, stagingRunId, assetNamesPath] =
    process.argv.slice(2)
  if (!evidencePath || !provenancePath || !checksumPath || !tag || !commit || !manifestSha || !stagingRunId) {
    throw new Error(
      'usage: validate-pilot-release-evidence.mjs <evidence.json> <provenance.json> <SHA256SUMS.txt> <tag> <commit> <manifest-sha256> <staging-run-id> [asset-names.json]'
    )
  }
  const evidence = JSON.parse(fs.readFileSync(path.resolve(evidencePath), 'utf8'))
  const provenance = JSON.parse(fs.readFileSync(path.resolve(provenancePath), 'utf8'))
  const resolvedChecksumPath = path.resolve(checksumPath)
  const checksumBytes = fs.readFileSync(resolvedChecksumPath)
  let assetNames
  if (assetNamesPath) {
    assetNames = parsePilotAssetNamesJson(fs.readFileSync(path.resolve(assetNamesPath), 'utf8'))
  } else {
    const assetEntries = fs.readdirSync(path.dirname(resolvedChecksumPath), { withFileTypes: true })
    if (assetEntries.some(entry => !entry.isFile())) throw new Error('pilot release inventory must contain files only')
    assetNames = assetEntries.map(entry => entry.name)
  }
  validatePilotAssetInventory(assetNames, checksumBytes)
  validatePilotReleaseEvidence(evidence, provenance, checksumBytes, {
    tag,
    commit,
    manifestSha,
    stagingRunId
  })
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
