import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import {
  expectedBundledProvenanceFromEnv,
  expectedDistributionArtifactName,
  readAndValidateBundledProvenance,
  validateBundledProvenance,
  validateExpectedDistributionArtifact
} from './packaged-provenance.mjs'

const COMMIT = '1'.repeat(40)
const OTHER_COMMIT = '2'.repeat(40)
const TAG = 'vi-v0.32.0-1'
const temporaryRoots = []

function expected(overrides = {}) {
  return { commit: COMMIT, releaseClass: 'community-prerelease', tag: TAG, ...overrides }
}

function policySurface(overrides = {}) {
  return {
    commit: COMMIT,
    releaseClass: 'community-prerelease',
    tag: TAG,
    updateChannel: 'community-prerelease',
    updateFeedEnabled: false,
    ...overrides
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-packaged-provenance-'))
  const resourcesPath = path.join(root, 'release', 'win-unpacked', 'resources')
  fs.mkdirSync(path.join(resourcesPath, 'agent-payload'), { recursive: true })
  temporaryRoots.push(root)
  return { resourcesPath, root }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

test('requires an explicit full expected tag, commit and release class', () => {
  assert.deepEqual(
    expectedBundledProvenanceFromEnv({
      HERMES_PAYLOAD_GIT_REF: COMMIT,
      HERMES_PAYLOAD_TAG: TAG,
      HERMES_RELEASE_CLASS: 'community-prerelease'
    }),
    expected()
  )
  assert.throws(() => expectedBundledProvenanceFromEnv({}), /HERMES_PAYLOAD_TAG is required/)
  assert.throws(
    () => expectedBundledProvenanceFromEnv({
      HERMES_PAYLOAD_GIT_REF: '1'.repeat(39),
      HERMES_PAYLOAD_TAG: TAG,
      HERMES_RELEASE_CLASS: 'community-prerelease'
    }),
    /full lowercase 40-character/
  )
})

test('rejects stale matching stamp and manifest bytes against the caller expectation', () => {
  const staleStamp = { payload: true, ...policySurface({ commit: OTHER_COMMIT }) }
  const staleManifest = { schemaVersion: 2, ...policySurface({ commit: OTHER_COMMIT }) }

  assert.throws(
    () => validateBundledProvenance({ expected: expected(), manifest: staleManifest, stamp: staleStamp }),
    /install-stamp\.json commit mismatch/
  )
})

test('rejects tag, release-class and update-policy contradictions independently', () => {
  const stamp = { payload: true, ...policySurface() }
  const manifest = { schemaVersion: 2, ...policySurface() }

  assert.throws(
    () => validateBundledProvenance({ expected: expected({ tag: 'vi-v0.32.0-2' }), manifest, stamp }),
    /tag mismatch/
  )
  assert.throws(
    () => validateBundledProvenance({
      expected: expected({ releaseClass: 'stable' }),
      manifest,
      stamp
    }),
    /releaseClass mismatch/
  )
  assert.throws(
    () => validateBundledProvenance({
      expected: expected(),
      manifest: { ...manifest, updateFeedEnabled: true },
      stamp
    }),
    /updateFeedEnabled mismatch/
  )
})

test('reads both packaged provenance surfaces and accepts only their exact expected tuple', () => {
  const { resourcesPath } = fixture()
  fs.writeFileSync(
    path.join(resourcesPath, 'install-stamp.json'),
    JSON.stringify({ payload: true, ...policySurface() })
  )
  fs.writeFileSync(
    path.join(resourcesPath, 'agent-payload', 'manifest.json'),
    JSON.stringify({ schemaVersion: 2, ...policySurface() })
  )

  const result = readAndValidateBundledProvenance({ expected: expected(), resourcesPath })
  assert.equal(result.provenance.commit, COMMIT)
  assert.equal(result.provenance.updateFeedEnabled, false)
})

test('binds skip-build validation to one exact versioned distribution path', () => {
  const { root } = fixture()
  const desktopRoot = root
  const name = expectedDistributionArtifactName({ arch: 'x64', platform: 'win32', tag: TAG })
  const artifact = path.join(root, 'release', name)
  fs.writeFileSync(artifact, 'candidate')

  assert.equal(
    validateExpectedDistributionArtifact({
      arch: 'x64',
      desktopRoot,
      expectedPath: path.join('release', name),
      platform: 'win32',
      tag: TAG
    }),
    artifact
  )
  assert.throws(
    () => validateExpectedDistributionArtifact({
      arch: 'x64',
      desktopRoot,
      expectedPath: path.join('release', 'Hermes-0.31.0-vi.7-win-x64.exe'),
      platform: 'win32',
      tag: TAG
    }),
    /artifact name mismatch/
  )
  assert.throws(
    () => validateExpectedDistributionArtifact({
      arch: 'x64',
      desktopRoot,
      expectedPath: path.join('release', expectedDistributionArtifactName({ arch: 'arm64', platform: 'win32', tag: TAG })),
      platform: 'win32',
      tag: TAG
    }),
    /artifact name mismatch/
  )
  fs.unlinkSync(artifact)
  assert.throws(
    () => validateExpectedDistributionArtifact({
      arch: 'x64',
      desktopRoot,
      expectedPath: path.join('release', name),
      platform: 'win32',
      tag: TAG
    }),
    /Missing expected distribution artifact/
  )
})
