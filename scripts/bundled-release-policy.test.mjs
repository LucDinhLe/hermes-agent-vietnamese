import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUNDLED_BUILD_NODE_MIN_MAJOR,
  BUNDLED_BUILD_NPM_RANGE,
  LOCAL_CANDIDATE_STATUS_COMMAND,
  bundledUpdatePolicy,
  createLocalCandidateProvenanceGuard,
  resolveBundledReleaseClass,
  resolvePayloadGitRef,
  validateBundledBuildNode,
  validateBundledBuildNpm,
  validateLocalCandidateCheckout
} from './bundled-release-policy.mjs'

test('bundled build provenance rejects a host below the Node 26 release floor', () => {
  assert.equal(BUNDLED_BUILD_NODE_MIN_MAJOR, 26)
  assert.deepEqual(validateBundledBuildNode('v26.0.0'), { major: 26, version: '26.0.0' })
  assert.deepEqual(validateBundledBuildNode('27.1.2'), { major: 27, version: '27.1.2' })
  assert.throws(() => validateBundledBuildNode('24.18.0'), /require Node 26.*current host.*24\.18\.0/)
  assert.throws(() => validateBundledBuildNode('unknown'), /cannot determine/)
})

test('bundled build provenance rejects npm releases excluded by the committed engine range', () => {
  assert.equal(BUNDLED_BUILD_NPM_RANGE, '<11.10.0 || >=11.17.0')
  assert.deepEqual(validateBundledBuildNpm('11.9.0'), {
    major: 11,
    minor: 9,
    patch: 0,
    version: '11.9.0'
  })
  assert.deepEqual(validateBundledBuildNpm('11.17.0'), {
    major: 11,
    minor: 17,
    patch: 0,
    version: '11.17.0'
  })
  assert.deepEqual(validateBundledBuildNpm('12.0.1'), {
    major: 12,
    minor: 0,
    patch: 1,
    version: '12.0.1'
  })
  for (const excluded of ['11.10.0', '11.12.1', '11.16.9']) {
    assert.throws(
      () => validateBundledBuildNpm(excluded),
      /require npm <11\.10\.0 \|\| >=11\.17\.0.*current host/
    )
  }
  assert.throws(() => validateBundledBuildNpm('unknown'), /cannot determine/)
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

test('tagless local candidate binds a fully clean HEAD to an explicit full commit', () => {
  const commit = 'a'.repeat(40)
  assert.deepEqual(
    validateLocalCandidateCheckout({ expectedCommit: commit, headCommit: commit, worktreeStatus: '' }),
    { commit, localCandidate: true }
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: 'a'.repeat(39), headCommit: commit, worktreeStatus: '' }),
    /full 40-character/
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: 'b'.repeat(40), headCommit: commit, worktreeStatus: '' }),
    /does not match HEAD/
  )
  assert.throws(
    () => validateLocalCandidateCheckout({ expectedCommit: commit, headCommit: commit, worktreeStatus: ' M tracked.js' }),
    /fully clean.*tracked and untracked/
  )
})

test('tagless local candidate rejects untracked desktop source and package assets', () => {
  const commit = 'd'.repeat(40)
  assert.equal(
    LOCAL_CANDIDATE_STATUS_COMMAND,
    'git status --porcelain=v1 --untracked-files=all'
  )

  for (const untrackedPath of [
    'apps/desktop/src/release-shadow.ts',
    'apps/desktop/public/release-shadow.js',
    'apps/desktop/assets/release-shadow.svg'
  ]) {
    assert.throws(
      () => validateLocalCandidateCheckout({
        expectedCommit: commit,
        headCommit: commit,
        worktreeStatus: `?? ${untrackedPath}`
      }),
      /fully clean.*tracked and untracked/,
      untrackedPath
    )
  }
})

test('tagless local candidate installs from lock and revalidates provenance after the build', () => {
  const commit = 'e'.repeat(40)
  assert.throws(
    () => createLocalCandidateProvenanceGuard({ expectedCommit: commit, skipInstall: true }),
    /forbids --no-install.*npm ci.*committed lockfile/
  )

  const guard = createLocalCandidateProvenanceGuard({ expectedCommit: commit })
  assert.deepEqual(
    guard.check({ headCommit: commit, worktreeStatus: '' }),
    { commit, localCandidate: true }
  )
  assert.throws(
    () => guard.check({
      headCommit: commit,
      worktreeStatus: '?? apps/desktop/public/appeared-during-build.js'
    }),
    /fully clean.*tracked and untracked/
  )
  assert.throws(
    () => guard.check({ headCommit: 'f'.repeat(40), worktreeStatus: '' }),
    /does not match HEAD/
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
