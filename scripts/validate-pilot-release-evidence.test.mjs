import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'

import {
  BUILD_ONLY_PILOT_TARGETS,
  PILOT_WINDOWS_GATES,
  parsePilotAssetNamesJson,
  requiredPilotWindowsGatesForTag,
  validatePilotAssetInventory,
  validatePilotReleaseEvidence
} from './validate-pilot-release-evidence.mjs'
import { V31_RUNTIME_GATES } from './validate-release-evidence.mjs'

const tag = 'vi-v0.31.0-1'
const commit = 'a'.repeat(40)
const stagingRunId = '12345'
const targets = ['windows-x64', ...BUILD_ONLY_PILOT_TARGETS]
const artifacts = Object.fromEntries(targets.map((target, index) => [target, `${target}-${index}.bin`]))
const hashes = Object.fromEntries(
  targets.map((target, index) => [
    target,
    String(index + 1)
      .repeat(64)
      .slice(0, 64)
  ])
)
const targetManifest = 'SHA256SUMS-win32-x64.txt'
const targetManifestHash = 'f'.repeat(64)
const checksumBytes = Buffer.from(
  [
    ...targets.map(target => `${hashes[target]}  ${artifacts[target]}`),
    `${targetManifestHash}  ${targetManifest}`
  ].join('\n') + '\n'
)
const manifestSha = crypto.createHash('sha256').update(checksumBytes).digest('hex')
const validAssetNames = [...Object.values(artifacts), targetManifest, 'SHA256SUMS.txt', 'pilot-release-evidence.json']

function validFixture() {
  const identity = { tag, commit, releaseClass: 'community-prerelease' }
  return {
    expected: { tag, commit, manifestSha, stagingRunId },
    provenance: { ...identity, runId: Number(stagingRunId) },
    evidence: {
      ...identity,
      policy: 'community-pilot',
      sha256sumsSha256: manifestSha,
      platforms: {
        'windows-x64': {
          artifact: artifacts['windows-x64'],
          decision: 'PILOT-GO',
          gates: Object.fromEntries([...PILOT_WINDOWS_GATES, ...V31_RUNTIME_GATES].map(gate => [gate, true])),
          limitations: ['unsigned community candidate'],
          sha256: hashes['windows-x64']
        },
        ...Object.fromEntries(
          BUILD_ONLY_PILOT_TARGETS.map(target => [
            target,
            {
              artifact: artifacts[target],
              decision: 'BUILD-ONLY-PILOT',
              realMachineSmoke: false,
              sha256: hashes[target]
            }
          ])
        )
      }
    }
  }
}

test('accepts a v31 pilot only with exact Windows smoke, Agents gates, and honest build-only targets', () => {
  const fixture = validFixture()
  assert.doesNotThrow(() =>
    validatePilotReleaseEvidence(fixture.evidence, fixture.provenance, checksumBytes, fixture.expected)
  )
})

test('v32.1 successors require the sealed project/session lifecycle gates', () => {
  const gates = requiredPilotWindowsGatesForTag('vi-v0.32.1-18')
  assert.ok(gates.includes('projectSessionSafety'))
  assert.ok(gates.includes('v32ToV321Update'))
  assert.ok(gates.includes('noResidualProcesses'))
  assert.ok(!gates.includes('updateFromV25'))
})

test('rejects a missing v31 Agents gate', () => {
  const fixture = validFixture()
  delete fixture.evidence.platforms['windows-x64'].gates.agentsSessionProjectPersistence
  assert.throws(
    () => validatePilotReleaseEvidence(fixture.evidence, fixture.provenance, checksumBytes, fixture.expected),
    /agentsSessionProjectPersistence/
  )
})

test('rejects a target presented as build-only without disclosing missing real-machine smoke', () => {
  const fixture = validFixture()
  fixture.evidence.platforms['macos-arm64'].realMachineSmoke = true
  assert.throws(
    () => validatePilotReleaseEvidence(fixture.evidence, fixture.provenance, checksumBytes, fixture.expected),
    /must disclose/
  )
})

test('rejects provenance, staging-run, manifest, or artifact byte mismatches', () => {
  const wrongCommit = validFixture()
  wrongCommit.provenance.commit = 'b'.repeat(40)
  assert.throws(
    () =>
      validatePilotReleaseEvidence(wrongCommit.evidence, wrongCommit.provenance, checksumBytes, wrongCommit.expected),
    /provenance commit/
  )

  const wrongRun = validFixture()
  wrongRun.provenance.runId = 999
  assert.throws(
    () => validatePilotReleaseEvidence(wrongRun.evidence, wrongRun.provenance, checksumBytes, wrongRun.expected),
    /staging run/
  )

  const wrongManifest = validFixture()
  wrongManifest.expected.manifestSha = 'f'.repeat(64)
  assert.throws(
    () =>
      validatePilotReleaseEvidence(
        wrongManifest.evidence,
        wrongManifest.provenance,
        checksumBytes,
        wrongManifest.expected
      ),
    /manifest digest/
  )

  const wrongArtifact = validFixture()
  wrongArtifact.evidence.platforms['linux-x64'].sha256 = '0'.repeat(64)
  assert.throws(
    () =>
      validatePilotReleaseEvidence(
        wrongArtifact.evidence,
        wrongArtifact.provenance,
        checksumBytes,
        wrongArtifact.expected
      ),
    /linux-x64 byte/
  )
})

test('allows only manifest files, the manifest itself, and pilot evidence in the public asset inventory', () => {
  assert.deepEqual(validatePilotAssetInventory(validAssetNames, checksumBytes), [...validAssetNames].sort())
  assert.throws(
    () => validatePilotAssetInventory([...validAssetNames, 'unreviewed-installer.exe'], checksumBytes),
    /asset inventory/
  )
  assert.throws(
    () =>
      validatePilotAssetInventory(
        validAssetNames.filter(name => name !== artifacts['linux-arm64']),
        checksumBytes
      ),
    /asset inventory/
  )

  const nestedManifest = Buffer.from(`${'a'.repeat(64)}  nested/unreviewed.exe\n`)
  assert.throws(
    () =>
      validatePilotAssetInventory(
        ['nested/unreviewed.exe', 'SHA256SUMS.txt', 'pilot-release-evidence.json'],
        nestedManifest
      ),
    /not a filename/
  )
})

test('accepts an explicit GitHub asset-name inventory and rejects malformed metadata', () => {
  const encoded = JSON.stringify(validAssetNames)
  assert.deepEqual(parsePilotAssetNamesJson(encoded), validAssetNames)
  assert.throws(() => parsePilotAssetNamesJson('{'), /JSON/)
  assert.throws(() => parsePilotAssetNamesJson({ assets: validAssetNames }), /array of non-empty filenames/)
  assert.throws(() => parsePilotAssetNamesJson([...validAssetNames, ' padded ']), /array of non-empty filenames/)
})
