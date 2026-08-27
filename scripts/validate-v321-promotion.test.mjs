import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import {
  REQUIRED_LIFECYCLE_GATES,
  ROLLBACK_COMMIT,
  ROLLBACK_SHA256,
  ROLLBACK_SIZE,
  ROLLBACK_TAG,
  V32_SOURCE_COMMIT,
  V32_SOURCE_SHA256,
  V32_SOURCE_SIZE,
  V32_SOURCE_TAG
} from './windows-lifecycle-acceptance/policy.mjs'
import { V321_IDENTITY, validateV321PromotionBundle } from './validate-v321-promotion.mjs'

const candidateCommit = 'a'.repeat(40)
const harnessCommit = 'd'.repeat(40)
const stagingRunId = '12345'
const lifecycleRunId = '67890'

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function artifactRecord({ commit, identitySource, sha256: digest, size, tag }) {
  return {
    commit,
    fileName: V321_IDENTITY.artifact,
    ...(identitySource ? { identitySource } : {}),
    sha256: digest,
    size,
    tag
  }
}

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-v321-promotion-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  const candidateDir = path.join(root, 'candidate')
  const lifecycleDir = path.join(root, 'lifecycle')
  fs.mkdirSync(candidateDir)
  fs.mkdirSync(lifecycleDir)

  const installer = Buffer.from('signed-v321-windows-installer')
  const candidate = { commit: candidateCommit, sha256: sha256(installer), size: installer.length }
  fs.writeFileSync(path.join(candidateDir, V321_IDENTITY.artifact), installer)
  fs.writeFileSync(path.join(candidateDir, 'SHA256SUMS-win32-x64.txt'), 'platform manifest\n')
  fs.writeFileSync(
    path.join(candidateDir, 'signing-windows-x64.txt'),
    'authenticode_status=NotSigned\nsigner_present=false\n'
  )
  fs.writeFileSync(
    path.join(candidateDir, 'candidate-provenance.json'),
    `${JSON.stringify({
      commit: candidateCommit,
      releaseClass: V321_IDENTITY.releaseClass,
      runId: Number(stagingRunId),
      tag: V321_IDENTITY.tag
    })}\n`
  )
  const manifestFiles = [
    V321_IDENTITY.artifact,
    'SHA256SUMS-win32-x64.txt',
    'signing-windows-x64.txt',
    'candidate-provenance.json'
  ]
  const manifest = `${manifestFiles
    .map(name => `${sha256(fs.readFileSync(path.join(candidateDir, name)))}  ${name}`)
    .join('\n')}\n`
  fs.writeFileSync(path.join(candidateDir, 'SHA256SUMS.txt'), manifest)
  const expectedManifestSha = sha256(manifest)

  const projectSafety = {
    messageCount: 2,
    messageDigest: 'b'.repeat(64),
    projectDeleteRemoved: true,
    projectHideArchived: true,
    relaunchScope: 'all-projects',
    sessionArchived: 0,
    sessionHidden: 0
  }
  const projectSafetyBytes = `${JSON.stringify(projectSafety)}\n`
  fs.writeFileSync(path.join(lifecycleDir, 'project-session-safety.json'), projectSafetyBytes)
  const gates = Object.fromEntries(
    REQUIRED_LIFECYCLE_GATES.map(gate => [
      gate,
      {
        detail:
          gate === 'networkIsolation'
            ? { firewallRuleCount: 6, mode: 'product-firewall', scopes: ['Internet', 'LocalSubnet'] }
            : gate === 'v32ToV321Update' || gate === 'rollbackVi39'
              ? { sameRegisteredInstallDir: true }
              : {},
        evidence: ['project-session-safety.json'],
        status: 'passed'
      }
    ])
  )
  const receipt = {
    artifacts: {
      candidate: artifactRecord({ ...candidate, tag: V321_IDENTITY.tag }),
      previous: artifactRecord({
        commit: V32_SOURCE_COMMIT,
        identitySource: 'immutable-public-v32',
        sha256: V32_SOURCE_SHA256,
        size: V32_SOURCE_SIZE,
        tag: V32_SOURCE_TAG
      }),
      rollback: artifactRecord({
        commit: ROLLBACK_COMMIT,
        identitySource: 'verified-v31-release-audit',
        sha256: ROLLBACK_SHA256,
        size: ROLLBACK_SIZE,
        tag: ROLLBACK_TAG
      })
    },
    evidenceManifest: [
      {
        path: 'project-session-safety.json',
        sha256: sha256(projectSafetyBytes),
        size: Buffer.byteLength(projectSafetyBytes)
      }
    ],
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
    runId: '0123456789abcdef0123456789abcdef',
    schemaVersion: 1,
    status: 'passed'
  }
  const receiptPath = path.join(lifecycleDir, 'lifecycle-result.json')
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`)
  fs.writeFileSync(
    path.join(lifecycleDir, 'host-validation.json'),
    `${JSON.stringify({
      evidenceFileCount: 1,
      receiptSha256: sha256(fs.readFileSync(receiptPath)),
      requiredGates: REQUIRED_LIFECYCLE_GATES,
      status: 'passed'
    })}\n`
  )

  const notesPath = path.join(root, 'release-notes.md')
  const notes = 'Hermes Vietnamese v32.1 signed Windows safety update\n'
  fs.writeFileSync(notesPath, notes)
  const publicReleasePath = path.join(root, 'public-release.json')
  fs.writeFileSync(
    publicReleasePath,
    `${JSON.stringify({
      artifactProvenanceClass: V321_IDENTITY.releaseClass,
      downloadFiles: [V321_IDENTITY.artifact],
      previousTag: V32_SOURCE_TAG,
      releaseClass: 'community-pilot',
      rollbackTag: ROLLBACK_TAG,
      tag: V321_IDENTITY.tag,
      windowsX64: {
        authenticode: 'NotSigned',
        filename: V321_IDENTITY.artifact,
        sha256: candidate.sha256,
        size: candidate.size
      }
    })}\n`
  )

  const release = {
    assets: fs.readdirSync(candidateDir).map(name => {
      const file = path.join(candidateDir, name)
      return { digest: `sha256:${sha256(fs.readFileSync(file))}`, name, size: fs.statSync(file).size }
    }),
    body: notes.trimEnd(),
    draft: true,
    name: 'Hermes Vietnamese v32.1',
    prerelease: true,
    tag_name: V321_IDENTITY.tag
  }
  const run = {
    conclusion: 'success',
    head_sha: harnessCommit,
    id: Number(lifecycleRunId),
    name: 'Kiểm thử runtime artifact Hermes Vietnamese',
    run_attempt: 1
  }
  const artifacts = {
    artifacts: [
      {
        digest: `sha256:${'c'.repeat(64)}`,
        expired: false,
        name: `v321-windows-lifecycle-${lifecycleRunId}-1`
      }
    ]
  }

  return {
    args: {
      artifacts,
      candidate,
      candidateDir,
      expectedManifestSha,
      expectedState: 'draft',
      lifecycleDir,
      lifecycleRunId,
      notesPath,
      publicReleasePath,
      release,
      run,
      stagingRunId
    },
    projectSafetyPath: path.join(lifecycleDir, 'project-session-safety.json')
  }
}

test('accepts only exact explicitly unsigned v32.1 bytes plus the full sealed project/session lifecycle', t => {
  const fixture = makeFixture(t)
  assert.equal(validateV321PromotionBundle(fixture.args).status, 'passed')
})

test('rejects lifecycle evidence that could hide a session after project metadata actions', t => {
  const fixture = makeFixture(t)
  const unsafe = JSON.parse(fs.readFileSync(fixture.projectSafetyPath, 'utf8'))
  unsafe.sessionHidden = 1
  fs.writeFileSync(fixture.projectSafetyPath, `${JSON.stringify(unsafe)}\n`)
  assert.throws(() => validateV321PromotionBundle(fixture.args), /evidence hash mismatch|safety evidence is incomplete/)
})

test('rejects a different installer byte even when the release metadata is edited to match it', t => {
  const fixture = makeFixture(t)
  fs.appendFileSync(path.join(fixture.args.candidateDir, V321_IDENTITY.artifact), 'tamper')
  assert.throws(() => validateV321PromotionBundle(fixture.args), /draft hash mismatch|exact candidate byte mismatch/)
})

test('rejects missing or misleading unsigned-status evidence', t => {
  const fixture = makeFixture(t)
  fs.writeFileSync(
    path.join(fixture.args.candidateDir, 'signing-windows-x64.txt'),
    'authenticode_status=Valid\nsigner_present=true\n'
  )
  assert.throws(() => validateV321PromotionBundle(fixture.args), /signing evidence|draft hash mismatch/)
})

test('rejects lifecycle evidence produced by a harness commit other than the workflow commit', t => {
  const fixture = makeFixture(t)
  fixture.args.run.head_sha = 'e'.repeat(40)
  assert.throws(
    () => validateV321PromotionBundle(fixture.args),
    /expected validation harness commit|harness commit mismatch/
  )
})
