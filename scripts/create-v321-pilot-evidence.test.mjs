import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'

import { createV321PilotEvidence } from './create-v321-pilot-evidence.mjs'
import {
  REQUIRED_LIFECYCLE_GATES,
  ROLLBACK_COMMIT,
  ROLLBACK_SHA256,
  ROLLBACK_SIZE,
  V32_SOURCE_COMMIT,
  V32_SOURCE_SHA256,
  V32_SOURCE_SIZE
} from './windows-lifecycle-acceptance/policy.mjs'

const tag = 'vi-v0.32.1-18'
const commit = 'a'.repeat(40)
const harnessCommit = 'b'.repeat(40)
const runId = '12345678-1234-1234-1234-123456789abc'
const artifacts = {
  'windows-x64': 'Hermes-Vietnamese-Windows-x64-Setup.exe',
  'windows-arm64': 'Hermes-Vietnamese-Windows-arm64-Setup.exe',
  'macos-arm64': 'Hermes-Vietnamese-macOS-Apple-Silicon.dmg',
  'macos-x64': 'Hermes-Vietnamese-macOS-Intel.dmg',
  'linux-x64': 'Hermes-Vietnamese-Linux-x64.AppImage',
  'linux-arm64': 'Hermes-Vietnamese-Linux-arm64.AppImage'
}
const hashes = Object.fromEntries(Object.keys(artifacts).map((target, index) => [target, `${index + 1}`.repeat(64)]))
const checksumBytes = Buffer.from(
  Object.keys(artifacts)
    .map(target => `${hashes[target]}  ${artifacts[target]}`)
    .join('\n') + '\n'
)
const manifestSha = crypto.createHash('sha256').update(checksumBytes).digest('hex')

function lifecycleFixture() {
  const gates = Object.fromEntries(
    REQUIRED_LIFECYCLE_GATES.map(name => [
      name,
      {
        detail:
          name === 'v32ToV321Update' || name === 'rollbackVi39'
            ? { sameRegisteredInstallDir: true }
            : name === 'networkIsolation'
              ? { firewallRuleCount: 6, mode: 'product-firewall', scopes: ['Internet', 'LocalSubnet'] }
              : {},
        evidence: [`${name}.log`],
        status: 'passed'
      }
    ])
  )
  const candidate = {
    commit,
    fileName: artifacts['windows-x64'],
    sha256: hashes['windows-x64'],
    size: 340_000_000,
    tag
  }
  const previous = {
    commit: V32_SOURCE_COMMIT,
    fileName: artifacts['windows-x64'],
    identitySource: 'immutable-public-v32',
    sha256: V32_SOURCE_SHA256,
    size: V32_SOURCE_SIZE,
    tag: 'vi-v0.32.0-1'
  }
  const rollback = {
    commit: ROLLBACK_COMMIT,
    fileName: artifacts['windows-x64'],
    identitySource: 'verified-v31-release-audit',
    sha256: ROLLBACK_SHA256,
    size: ROLLBACK_SIZE,
    tag: 'vi-v0.20.4-39'
  }
  return {
    artifacts: { candidate, previous, rollback },
    evidenceManifest: REQUIRED_LIFECYCLE_GATES.map(name => ({
      path: `${name}.log`,
      sha256: 'f'.repeat(64),
      size: 100
    })),
    gates,
    harnessCommit,
    isolation: {
      ephemeralVm: true,
      firewallRuleCount: 8,
      guestUser: 'runneradmin',
      hostRegistryReachable: false,
      hypervisorBoundary: true,
      mechanism: 'github-hosted-ephemeral-vm',
      networkMode: 'product-firewall',
      productOutboundBlocked: true,
      registryProbe: {
        currentHiveMatchesGuestSid: true,
        foreignInteractiveUserHiveCount: 0,
        kind: 'github-hosted-ephemeral-vm',
        volatileProfileIsCurrentRunner: true
      }
    },
    runId,
    schemaVersion: 1,
    status: 'passed'
  }
}

test('creates v32.1 pilot evidence from the sealed Windows lifecycle receipt', () => {
  const evidence = createV321PilotEvidence({
    checksumBytes,
    manifestSha,
    provenance: { commit, releaseClass: 'community-prerelease', runId: 42, tag },
    receipt: lifecycleFixture()
  })
  assert.equal(evidence.platforms['windows-x64'].decision, 'PILOT-GO')
  assert.equal(evidence.platforms['windows-x64'].gates.projectSessionSafety, true)
  assert.equal(evidence.platforms['macos-arm64'].decision, 'BUILD-ONLY-PILOT')
  assert.equal(evidence.platforms['linux-arm64'].realMachineSmoke, false)
})

test('rejects a staged byte that differs from the sealed lifecycle receipt', () => {
  const receipt = lifecycleFixture()
  receipt.artifacts.candidate.sha256 = '0'.repeat(64)
  assert.throws(
    () =>
      createV321PilotEvidence({
        checksumBytes,
        manifestSha,
        provenance: { commit, releaseClass: 'community-prerelease', runId: 42, tag },
        receipt
      }),
    /sealed Windows lifecycle byte|candidate\.sha256/
  )
})
