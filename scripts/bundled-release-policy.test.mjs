import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUNDLED_BUILD_NODE_MIN_MAJOR,
  bundledUpdatePolicy,
  resolveBundledReleaseClass,
  resolvePayloadGitRef,
  validateBundledBuildNode,
  validateLocalCandidateCheckout
} from './bundled-release-policy.mjs'

test('bundled build provenance rejects a host below the Node 26 release floor', () => {
  assert.equal(BUNDLED_BUILD_NODE_MIN_MAJOR, 26)
  assert.deepEqual(validateBundledBuildNode('v26.0.0'), { major: 26, version: '26.0.0' })
  assert.deepEqual(validateBundledBuildNode('27.1.2'), { major: 27, version: '27.1.2' })
  assert.throws(() => validateBundledBuildNode('24.18.0'), /require Node 26.*current host.*24\.18\.0/)
  assert.throws(() => validateBundledBuildNode('unknown'), /cannot determine/)
})

test('unsigned local candidates default to community prerelease and can never claim stable', () => {
  assert.equal(resolveBundledReleaseClass('', { localCandidate: true }), 'community-prerelease')
  assert.throws(
    () => resolveBundledReleaseClass('stable', { localCandidate: true }),
    /unsigned.*community-prerelease/
  )
})

test('tagged builds require an explicit supported release class', () => {
  assert.throws(() => resolveBundledReleaseClass(''), /bundled builds require/)
  assert.throws(() => resolveBundledReleaseClass('pilot'), /bundled builds require/)
  assert.equal(resolveBundledReleaseClass('stable'), 'stable')
})

test('community prerelease metadata disables the update feed while stable enables it', () => {
  assert.deepEqual(bundledUpdatePolicy('community-prerelease'), {
    releaseClass: 'community-prerelease',
    updateChannel: 'community-prerelease',
    updateFeedEnabled: false
  })
  assert.deepEqual(bundledUpdatePolicy('stable'), {
    releaseClass: 'stable',
    updateChannel: 'stable',
    updateFeedEnabled: true
  })
})

test('tagless local candidate binds a clean tracked HEAD to an explicit full commit', () => {
  const commit = 'a'.repeat(40)
  assert.deepEqual(
    validateLocalCandidateCheckout({ expectedCommit: commit, headCommit: commit, trackedStatus: '' }),
    { commit, localCandidate: true }
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: 'a'.repeat(39), headCommit: commit, trackedStatus: '' }),
    /full 40-character/
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: 'b'.repeat(40), headCommit: commit, trackedStatus: '' }),
    /does not match HEAD/
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: commit, headCommit: commit, trackedStatus: ' M tracked.js' }),
    /clean tracked/
  )
})

test('payload archive uses the immutable commit only in explicit local-candidate mode', () => {
  const tag = 'vi-v0.32.0-1'
  const commit = 'c'.repeat(40)
  assert.equal(resolvePayloadGitRef({ tag, commit, localCandidate: false }), tag)
  assert.equal(resolvePayloadGitRef({ tag, commit, localCandidate: true }), commit)
  assert.throws(
    () => resolvePayloadGitRef({ tag, commit: 'HEAD', localCandidate: true }),
    /full 40-character/
  )
})
