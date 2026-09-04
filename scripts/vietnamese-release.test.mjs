import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import {
  compareVietnameseReleaseTags,
  parseVietnameseReleaseTag,
  payloadNodeDescriptor,
  resolveVietnameseReleaseCandidate,
  sha256File,
  validateFeaturedCandidatePromotion,
  validateStablePromotionOrder,
  validateVietnameseReleaseNotesForClass,
  validateVietnameseReleasePresentation,
  validateVietnameseCandidateCheckout,
  VI_PRODUCT_RELEASE
} from './vietnamese-release.mjs'

test('Vietnamese release tags map to deterministic Electron SemVer', () => {
  assert.deepEqual(parseVietnameseReleaseTag('vi-v0.20.0-15'), {
    tag: 'vi-v0.20.0-15',
    baseVersion: '0.20.0',
    iteration: 15,
    calver: false,
    channel: 'legacy',
    appVersion: '0.20.0-vi.15'
  })
  assert.throws(() => parseVietnameseReleaseTag('v0.20.0'), /vi-vX.Y.Z-N/)
})

test('calver tags (composite channel) keep the version string and pick the channel from the suffix', () => {
  assert.deepEqual(parseVietnameseReleaseTag('v2026.9.3-thunghiem.1'), {
    tag: 'v2026.9.3-thunghiem.1',
    baseVersion: '2026.9.3',
    iteration: 1,
    calver: true,
    channel: 'thunghiem',
    appVersion: '2026.9.3-thunghiem.1'
  })
  assert.equal(parseVietnameseReleaseTag('v2026.9.3').channel, 'latest')
  assert.equal(parseVietnameseReleaseTag('v2026.9.3').appVersion, '2026.9.3')
  assert.throws(() => parseVietnameseReleaseTag('v2026.9.3-beta.1'))
  // calver không bị khoá theo technicalVersion legacy của product-metadata
  assert.equal(resolveVietnameseReleaseCandidate('v2026.9.3-thunghiem.1').appVersion, '2026.9.3-thunghiem.1')
})

test('legacy source descriptor resolves its own candidate independently of current public Latest', () => {
  const desktopPackage = JSON.parse(fs.readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'))
  const runtime = spawnSync(
    process.env.PYTHON || 'python',
    ['-c', 'import hermes_cli; print(hermes_cli.__version__)'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  )
  const expectedCandidateTag = `vi-v${VI_PRODUCT_RELEASE.technicalVersion}-1`
  const candidate = resolveVietnameseReleaseCandidate(expectedCandidateTag)

  assert.equal(runtime.status, 0, runtime.stderr)
  assert.equal(candidate.tag, expectedCandidateTag)
  assert.equal(candidate.productVersion, VI_PRODUCT_RELEASE.productVersion)
  assert.equal(candidate.baseVersion, VI_PRODUCT_RELEASE.technicalVersion)
  assert.equal(candidate.iteration, 1)
  assert.equal(candidate.appVersion, `${VI_PRODUCT_RELEASE.technicalVersion}-vi.1`)
  assert.equal(candidate.releaseTitle, `Hermes Vietnamese ${VI_PRODUCT_RELEASE.productVersion}`)
  assert.equal(desktopPackage.version, VI_PRODUCT_RELEASE.technicalVersion)
  assert.equal(runtime.stdout.trim(), VI_PRODUCT_RELEASE.upstreamVersion)
  assert.notEqual(VI_PRODUCT_RELEASE.technicalVersion, VI_PRODUCT_RELEASE.upstreamVersion)
  assert.throws(
    () => resolveVietnameseReleaseCandidate('vi-v999.0.0-1'),
    /does not match Hermes Vietnamese technical version/
  )
})

test('stable promotion order follows the full Vietnamese release tag', () => {
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-1', 'vi-v0.20.4-39'), 1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-1', 'vi-v0.31.0-1'), 0)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-1', 'vi-v0.31.0-2'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-2', 'vi-v0.31.0-3'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-3', 'vi-v0.31.0-4'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-4', 'vi-v0.31.0-5'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-5', 'vi-v0.31.0-6'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v0.31.0-6', 'vi-v0.31.0-7'), -1)
  assert.equal(compareVietnameseReleaseTags('vi-v1.0.0-1', 'vi-v0.999.999-999'), 1)

  assert.deepEqual(
    validateStablePromotionOrder({
      previousLatestTag: 'vi-v0.20.4-39',
      tag: 'vi-v0.31.0-1'
    }),
    {
      newer: true,
      previousLatestTag: 'vi-v0.20.4-39',
      tag: 'vi-v0.31.0-1'
    }
  )
  assert.throws(
    () =>
      validateStablePromotionOrder({
        previousLatestTag: 'vi-v0.31.0-2',
        tag: 'vi-v0.31.0-1'
      }),
    /must be newer than current Latest/
  )
})

test('candidate checkout binds a clean HEAD to the exact local tag', () => {
  const commit = 'a'.repeat(40)
  const input = { tag: 'vi-v0.31.0-1', tagCommit: commit, headCommit: commit, status: '' }

  assert.deepEqual(validateVietnameseCandidateCheckout(input), {
    clean: true,
    commit,
    tag: input.tag
  })
  assert.throws(() => validateVietnameseCandidateCheckout({ ...input, tagCommit: 'b'.repeat(40) }), /points to/)
  assert.throws(() => validateVietnameseCandidateCheckout({ ...input, status: ' M README.md' }), /must be clean/)
})

test('every advertised native target has one immutable Node archive', () => {
  const descriptors = []

  for (const [platform, arch] of [
    ['win32', 'x64'],
    ['win32', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64']
  ]) {
    const descriptor = payloadNodeDescriptor(platform, arch)
    assert.match(descriptor.sha256, /^[0-9a-f]{64}$/)
    assert.equal(descriptor.url, `https://nodejs.org/dist/${descriptor.version}/${descriptor.archive}`)
    descriptors.push(descriptor)
  }

  assert.equal(new Set(descriptors.map(descriptor => descriptor.archive)).size, descriptors.length)
  assert.equal(new Set(descriptors.map(descriptor => descriptor.version)).size, 1)
})

test('sha256File hashes the exact bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-release-input-'))
  const file = path.join(dir, 'input.bin')
  try {
    fs.writeFileSync(file, 'Hermes\n')
    assert.equal(sha256File(file), 'e8a6e32094432e8c602c3e0576d9dae9addc1c09df402dbe8a24ad00adcec5bf')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('release presentation must match the immutable candidate title and notes', () => {
  const expectedTitle = VI_PRODUCT_RELEASE.releaseTitle
  const expectedBody = 'Candidate notes\n\nNo stable claim.\n'

  assert.deepEqual(
    validateVietnameseReleasePresentation({
      body: 'Candidate notes\r\n\r\nNo stable claim.',
      expectedBody,
      expectedTitle,
      name: expectedTitle
    }),
    { bodyMatches: true, title: expectedTitle }
  )
  assert.throws(
    () =>
      validateVietnameseReleasePresentation({
        body: expectedBody,
        expectedBody,
        expectedTitle,
        name: `${expectedTitle} Stable/Latest`
      }),
    /title mismatch/
  )
  assert.throws(
    () =>
      validateVietnameseReleasePresentation({
        body: `${expectedBody}\nStable/Latest`,
        expectedBody,
        expectedTitle,
        name: expectedTitle
      }),
    /body differs/
  )
})

test('prerelease promotion requires the exact prepared public candidate', () => {
  const featuredCandidate = {
    tag: 'vi-v0.31.0-1',
    releaseClass: 'community-prerelease',
    published: true
  }

  assert.deepEqual(validateFeaturedCandidatePromotion({ featuredCandidate, tag: featuredCandidate.tag }), {
    published: true,
    tag: featuredCandidate.tag
  })
  assert.throws(
    () => validateFeaturedCandidatePromotion({ featuredCandidate, tag: 'vi-v0.31.0-2' }),
    /featured candidate tag mismatch/
  )
  assert.throws(
    () =>
      validateFeaturedCandidatePromotion({
        featuredCandidate: { ...featuredCandidate, releaseClass: 'stable' },
        tag: featuredCandidate.tag
      }),
    /releaseClass must be community-prerelease/
  )
  assert.throws(
    () =>
      validateFeaturedCandidatePromotion({
        featuredCandidate: { ...featuredCandidate, published: false },
        tag: featuredCandidate.tag
      }),
    /target published state/
  )
})

test('release notes cannot claim a different publication class', () => {
  const communityNotes = 'Lớp phát hành: community prerelease, chưa phải stable. Latest hiện vẫn là bản cũ.'
  const stableNotes = 'Lớp phát hành: stable. Bản này là Stable/Latest.'

  assert.deepEqual(
    validateVietnameseReleaseNotesForClass({
      body: communityNotes,
      releaseClass: 'community-prerelease'
    }),
    { classMatches: true, releaseClass: 'community-prerelease' }
  )
  assert.deepEqual(validateVietnameseReleaseNotesForClass({ body: stableNotes, releaseClass: 'stable' }), {
    classMatches: true,
    releaseClass: 'stable'
  })
  assert.throws(
    () =>
      validateVietnameseReleaseNotesForClass({
        body: `${communityNotes} Candidate này là Stable/Latest.`,
        releaseClass: 'community-prerelease'
      }),
    /must not claim Stable\/Latest/
  )
  assert.throws(
    () =>
      validateVietnameseReleaseNotesForClass({
        body: communityNotes,
        releaseClass: 'stable'
      }),
    /stable notes must identify/
  )
})
