import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  RELEASE_PLATFORMS,
  REQUIRED_RUNTIME_GATES,
  V31_RUNTIME_GATES,
  validateReleaseEvidence
} from './validate-release-evidence.mjs'

const manifestSha = 'f'.repeat(64)
const commit = 'a'.repeat(40)
const checksumText = RELEASE_PLATFORMS.map(
  (platform, index) =>
    `${String(index + 1)
      .repeat(64)
      .slice(0, 64)}  ${platform}.bin`
).join('\n')

function validEvidence() {
  return {
    schemaVersion: 1,
    releaseClass: 'stable',
    tag: 'vi-v0.20.0-15',
    commit,
    sha256sumsSha256: manifestSha,
    platforms: Object.fromEntries(
      RELEASE_PLATFORMS.map((platform, index) => [
        platform,
        {
          decision: 'GO',
          machine: `machine-${platform}`,
          osVersion: 'test-os',
          arch: platform.endsWith('arm64') ? 'arm64' : 'x64',
          artifact: `${platform}.bin`,
          sha256: String(index + 1)
            .repeat(64)
            .slice(0, 64),
          gates: Object.fromEntries(REQUIRED_RUNTIME_GATES.map(gate => [gate, true])),
          logs: [`${platform}.log`],
          screenshots: [`${platform}.png`],
          signing: platform.startsWith('windows-')
            ? {
                installerAuthenticode: 'Valid',
                installedAppAuthenticode: 'Valid',
                installerPublisher: 'Hermes Release Test Publisher',
                installedAppPublisher: 'Hermes Release Test Publisher'
              }
            : platform.startsWith('macos-')
              ? { developerId: true, notarized: true, stapled: true }
              : { sha256: true }
        }
      ])
    )
  }
}

function validV31Evidence() {
  const evidence = validEvidence()
  evidence.tag = 'vi-v0.31.0-1'
  for (const record of Object.values(evidence.platforms)) {
    for (const gate of V31_RUNTIME_GATES) record.gates[gate] = true
  }
  return evidence
}

test('accepts complete exact-artifact evidence for all advertised platforms', () => {
  assert.doesNotThrow(() =>
    validateReleaseEvidence(validEvidence(), checksumText, {
      tag: 'vi-v0.20.0-15',
      commit,
      sha256sumsSha256: manifestSha
    })
  )
})

test('accepts unsigned evidence only for an explicitly warned community prerelease', () => {
  const community = validEvidence()
  community.releaseClass = 'community-prerelease'
  for (const [platform, record] of Object.entries(community.platforms)) {
    if (platform.startsWith('windows-')) {
      record.signing = {
        installerAuthenticode: 'NotSigned',
        installedAppAuthenticode: 'NotSigned',
        userWarningVerified: true
      }
    } else if (platform.startsWith('macos-')) {
      record.signing = {
        developerId: false,
        notarized: false,
        stapled: false,
        userWarningVerified: true
      }
    }
  }
  assert.doesNotThrow(() =>
    validateReleaseEvidence(community, checksumText, {
      tag: 'vi-v0.20.0-15',
      commit,
      sha256sumsSha256: manifestSha,
      releaseClass: 'community-prerelease'
    })
  )

  community.platforms['windows-x64'].signing.userWarningVerified = false
  assert.throws(() => validateReleaseEvidence(community, checksumText), /warning behavior/)
})

test('accepts a signed Windows community prerelease with matching publisher evidence', () => {
  const community = validEvidence()
  community.releaseClass = 'community-prerelease'
  for (const [platform, record] of Object.entries(community.platforms)) {
    if (platform.startsWith('windows-')) {
      record.signing = {
        installerAuthenticode: 'Valid',
        installedAppAuthenticode: 'Valid',
        installerPublisher: 'Hermes Vietnamese Community',
        installedAppPublisher: 'Hermes Vietnamese Community'
      }
    } else if (platform.startsWith('macos-')) {
      record.signing = {
        developerId: false,
        notarized: false,
        stapled: false,
        userWarningVerified: true
      }
    }
  }

  assert.equal(validateReleaseEvidence(community, checksumText, { releaseClass: 'community-prerelease' }), community)
  community.platforms['windows-x64'].signing.installedAppPublisher = 'Unexpected Publisher'
  assert.throws(() => validateReleaseEvidence(community, checksumText), /publisher evidence does not match/)
})

test('never accepts unsigned evidence as stable', () => {
  const unsignedStable = validEvidence()
  unsignedStable.platforms['windows-x64'].signing.installerAuthenticode = 'NotSigned'
  assert.throws(() => validateReleaseEvidence(unsignedStable, checksumText), /Authenticode/)
})

test('one missing platform or runtime gate makes the release NO-GO', () => {
  const missingPlatform = validEvidence()
  delete missingPlatform.platforms['macos-arm64']
  assert.throws(() => validateReleaseEvidence(missingPlatform, checksumText), /macos-arm64/)

  const missingGate = validEvidence()
  missingGate.platforms['windows-x64'].gates.updateFromPrevious = false
  assert.throws(() => validateReleaseEvidence(missingGate, checksumText), /updateFromPrevious/)
})

test('v31 requires the vi39 upgrade and Agents gates while older evidence stays valid', () => {
  assert.doesNotThrow(() => validateReleaseEvidence(validEvidence(), checksumText))
  assert.doesNotThrow(() => validateReleaseEvidence(validV31Evidence(), checksumText, { tag: 'vi-v0.31.0-1' }))

  for (const gate of V31_RUNTIME_GATES) {
    const missingGate = validV31Evidence()
    delete missingGate.platforms['windows-x64'].gates[gate]
    assert.throws(() => validateReleaseEvidence(missingGate, checksumText), new RegExp(gate))
  }
})

test('rejects evidence produced for another source commit', () => {
  assert.throws(
    () =>
      validateReleaseEvidence(validEvidence(), checksumText, {
        tag: 'vi-v0.20.0-15',
        commit: 'b'.repeat(40),
        sha256sumsSha256: manifestSha
      }),
    /commit mismatch/
  )
})

test('rejects unsigned Windows, unnotarized macOS, or a mismatched artifact hash', () => {
  const unsigned = validEvidence()
  unsigned.platforms['windows-x64'].signing.installerAuthenticode = 'NotSigned'
  assert.throws(() => validateReleaseEvidence(unsigned, checksumText), /Authenticode/)

  const unsignedInstalledApp = validEvidence()
  unsignedInstalledApp.platforms['windows-x64'].signing.installedAppAuthenticode = 'NotSigned'
  assert.throws(() => validateReleaseEvidence(unsignedInstalledApp, checksumText), /Hermes\.exe Authenticode/)

  const publisherMismatch = validEvidence()
  publisherMismatch.platforms['windows-x64'].signing.installedAppPublisher = 'Unexpected Publisher'
  assert.throws(() => validateReleaseEvidence(publisherMismatch, checksumText), /publisher evidence does not match/)

  const mac = validEvidence()
  mac.platforms['macos-arm64'].signing.stapled = false
  assert.throws(() => validateReleaseEvidence(mac, checksumText), /stapling/)

  const bytes = validEvidence()
  bytes.platforms['linux-x64'].sha256 = '0'.repeat(64)
  assert.throws(() => validateReleaseEvidence(bytes, checksumText), /SHA-256/)
})
