import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REQUIRED_LIFECYCLE_GATES,
  ROLLBACK_COMMIT,
  ROLLBACK_SHA256,
  ROLLBACK_SIZE,
  V31_SOURCE_COMMIT,
  V31_SOURCE_SHA256,
  V31_SOURCE_SIZE,
  WINDOWS_LIFECYCLE_NODE_SHA256,
  WINDOWS_LIFECYCLE_NODE_VERSION,
  assertSupportedWindowsSandboxHost,
  buildWindowsSandboxConfig,
  validateLifecycleDescriptor,
  validateLifecycleReceipt
} from './policy.mjs'

const candidate = {
  commit: 'a'.repeat(40),
  fileName: 'Hermes-0.32.0-vi.1-win-x64.exe',
  sha256: '1'.repeat(64),
  size: 320_000_000,
  tag: 'vi-v0.32.0-1'
}
const previous = {
  commit: V31_SOURCE_COMMIT,
  fileName: 'Hermes-Vietnamese-Windows-x64-Setup.exe',
  identitySource: 'v32-task-baseline',
  sha256: V31_SOURCE_SHA256,
  size: V31_SOURCE_SIZE,
  tag: 'vi-v0.31.0-7'
}
const rollback = {
  commit: ROLLBACK_COMMIT,
  fileName: 'Hermes-v39.exe',
  identitySource: 'verified-v31-release-audit',
  sha256: ROLLBACK_SHA256,
  size: ROLLBACK_SIZE,
  tag: 'vi-v0.20.4-39'
}
const descriptor = {
  candidate,
  previous,
  releaseClass: 'community-prerelease',
  rollback,
  runId: '12345678-1234-1234-1234-123456789abc',
  schemaVersion: 1
}

test('descriptor binds the three exact lifecycle installers and rejects byte reuse', () => {
  const validated = validateLifecycleDescriptor(descriptor)
  assert.equal(validated.candidate.commit, candidate.commit)
  assert.equal(validated.previous.tag, 'vi-v0.31.0-7')
  assert.equal(validated.rollback.tag, 'vi-v0.20.4-39')

  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, candidate: { ...candidate, sha256: previous.sha256 } }),
    /three distinct byte streams/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, previous: { ...previous, sha256: '2'.repeat(64) } }),
    /pinned vi-v0\.31\.0-7/
  )
  assert.throws(
    () => validateLifecycleDescriptor({ ...descriptor, rollback: { ...rollback, tag: 'vi-v0.20.4-40' } }),
    /must be vi-v0\.20\.4-39/
  )
})

test('host gate never degrades an unsupported machine into a skipped acceptance', () => {
  assert.equal(WINDOWS_LIFECYCLE_NODE_VERSION, 'v26.5.1')
  assert.equal(WINDOWS_LIFECYCLE_NODE_SHA256, 'b48b0224081224cda1f49374e2fc63d143041ade51754f0cc6608fe8510ba29e')
  assert.equal(
    assertSupportedWindowsSandboxHost({
      arch: 'x64',
      nodeVersion: 'v26.5.1',
      platform: 'win32',
      sandboxExecutableExists: true
    }),
    true
  )
  assert.throws(
    () =>
      assertSupportedWindowsSandboxHost({
        arch: 'x64',
        nodeVersion: 'v26.5.1',
        platform: 'win32',
        sandboxExecutableExists: false
      }),
    /cannot run safely/
  )
  assert.throws(
    () =>
      assertSupportedWindowsSandboxHost({
        arch: 'arm64',
        nodeVersion: 'v26.5.1',
        platform: 'win32',
        sandboxExecutableExists: true
      }),
    /requires win32\/x64/
  )
})

test('sandbox configuration disables host-facing channels and maps only evidence writable', () => {
  const xml = buildWindowsSandboxConfig({
    evidenceDir: 'C:\\Evidence & Results',
    inputDir: 'C:\\Input',
    nodeRuntimeDir: 'C:\\Node26',
    repoSnapshotDir: 'C:\\TrackedRepo'
  })

  assert.match(xml, /<Networking>Disable<\/Networking>/)
  assert.match(xml, /<ClipboardRedirection>Disable<\/ClipboardRedirection>/)
  assert.match(xml, /<ProtectedClient>Enable<\/ProtectedClient>/)
  assert.match(xml, /C:\\Evidence &amp; Results/)
  assert.equal((xml.match(/<ReadOnly>true<\/ReadOnly>/g) || []).length, 3)
  assert.equal((xml.match(/<ReadOnly>false<\/ReadOnly>/g) || []).length, 1)
  assert.match(xml, /WDAGUtilityAccount\\Desktop|C:\\HermesHarness/)
})

test('receipt validation requires every gate and exact artifact identity', () => {
  const gates = Object.fromEntries(
    REQUIRED_LIFECYCLE_GATES.map(name => [
      name,
      {
        detail: name === 'v31ToV32Update' || name === 'rollbackVi39' ? { sameRegisteredInstallDir: true } : {},
        evidence: [`${name}.log`],
        status: 'passed'
      }
    ])
  )
  const receipt = {
    artifacts: { candidate, previous, rollback },
    evidenceManifest: REQUIRED_LIFECYCLE_GATES.map(name => ({
      path: `${name}.log`,
      sha256: '5'.repeat(64),
      size: 1234
    })),
    gates,
    isolation: {
      guestUser: 'WDAGUtilityAccount',
      hostRegistryReachable: false,
      mechanism: 'windows-sandbox',
      networkDisabled: true,
      registryProbe: {
        currentHiveMatchesGuestSid: true,
        foreignInteractiveUserHiveCount: 0,
        kind: 'loaded-user-hives-and-volatile-profile',
        volatileProfileIsDisposableGuest: true
      }
    },
    runId: descriptor.runId,
    schemaVersion: 1,
    status: 'passed'
  }

  assert.equal(validateLifecycleReceipt(receipt, descriptor).receipt, receipt)
  assert.throws(
    () => validateLifecycleReceipt({ ...receipt, gates: { ...gates, repair: { status: 'skipped' } } }, descriptor),
    /repair is not passed/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          gates: {
            ...gates,
            rollbackVi39: { ...gates.rollbackVi39, detail: { sameRegisteredInstallDir: false } }
          }
        },
        descriptor
      ),
    /rollbackVi39 did not prove an in-place/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          artifacts: { ...receipt.artifacts, candidate: { ...candidate, sha256: '4'.repeat(64) } }
        },
        descriptor
      ),
    /candidate\.sha256 mismatch/
  )
  assert.throws(
    () => validateLifecycleReceipt({ ...receipt, evidenceManifest: [] }, descriptor),
    /non-empty evidence manifest/
  )
  assert.throws(
    () =>
      validateLifecycleReceipt(
        {
          ...receipt,
          evidenceManifest: [{ path: '../host.txt', sha256: '5'.repeat(64), size: 1234 }]
        },
        descriptor
      ),
    /normalized relative evidence path/
  )
})
