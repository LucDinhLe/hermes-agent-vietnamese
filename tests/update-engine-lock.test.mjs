import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertRemoteTagAdvertisement,
  nextEngineLock,
  nextPatchLedger,
  nextProductMetadata,
  signatureState
} from '../scripts/update-engine-lock.mjs'

test('engine lock refresh changes resolved facts while preserving policy', () => {
  const existing = {
    schemaVersion: 1,
    source: {
      repository: 'https://example.invalid/upstream.git',
      tag: 'old',
      tagObjectSha: 'a',
      commit: 'b',
      engineVersion: '1',
      desktopVersion: '2',
      license: 'MIT',
      tagSignature: 'unsigned'
    },
    observedAt: '2026-01-01',
    policy: {
      followMovingBranch: false,
      requireAnnotatedTag: true,
      requireExactCommit: true
    }
  }

  const refreshed = nextEngineLock(
    existing,
    {
      tag: 'v2026.9.1',
      tagObjectSha: 'c',
      commit: 'd',
      engineVersion: '3',
      desktopVersion: '4',
      tagSignature: 'present-unverified'
    },
    '2026-09-01'
  )

  assert.equal(refreshed.source.tag, 'v2026.9.1')
  assert.equal(refreshed.source.commit, 'd')
  assert.equal(refreshed.source.license, 'MIT')
  assert.deepEqual(refreshed.policy, existing.policy)
  assert.equal(refreshed.observedAt, '2026-09-01')
})

test('engine lock refresh advances only active patch provenance', () => {
  const ledger = {
    schemaVersion: 1,
    patches: [
      { id: 'active', state: 'active', upstreamCommit: 'old' },
      { id: 'retired', state: 'retired', upstreamCommit: 'historical' }
    ]
  }

  const refreshed = nextPatchLedger(ledger, 'new')

  assert.equal(refreshed.patches[0].upstreamCommit, 'new')
  assert.equal(refreshed.patches[1].upstreamCommit, 'historical')
})

test('engine lock refresh advances user-visible engine metadata from the same resolved tag', () => {
  const metadata = {
    displayName: 'Hermes Vietnamese',
    upstream: {
      productName: 'Hermes Agent',
      version: 'old-version',
      tag: 'old-tag',
      commit: 'old-commit',
      repository: 'https://github.com/NousResearch/hermes-agent'
    },
    license: { spdx: 'MIT', url: 'old-license-url' }
  }

  const refreshed = nextProductMetadata(metadata, {
    tag: 'v2026.9.1',
    commit: '0123456789012345678901234567890123456789',
    engineVersion: '0.21.0'
  })

  assert.equal(refreshed.upstream.version, '0.21.0')
  assert.equal(refreshed.upstream.tag, 'v2026.9.1')
  assert.equal(refreshed.upstream.commit, '0123456789012345678901234567890123456789')
  assert.equal(
    refreshed.license.url,
    'https://github.com/NousResearch/hermes-agent/blob/0123456789012345678901234567890123456789/LICENSE'
  )
  assert.equal(refreshed.displayName, metadata.displayName)
  assert.equal(refreshed.license.spdx, 'MIT')
})

test('tag signature state never claims verification from payload presence alone', () => {
  assert.equal(signatureState('object deadbeef\ntagger Example\n\nrelease'), 'unsigned')
  assert.equal(signatureState('release\n-----BEGIN PGP SIGNATURE-----\nabc'), 'present-unverified')
  assert.equal(signatureState('release\n-----BEGIN SSH SIGNATURE-----\nabc'), 'present-unverified')
})

test('engine update requires the remote annotated tag object and peeled commit', () => {
  const resolved = {
    tag: 'v2026.9.1',
    tagObjectSha: 'b'.repeat(40),
    commit: 'c'.repeat(40)
  }
  const valid = [
    `${resolved.tagObjectSha}\trefs/tags/${resolved.tag}`,
    `${resolved.commit}\trefs/tags/${resolved.tag}^{}`
  ].join('\n')

  assert.doesNotThrow(() => assertRemoteTagAdvertisement(valid, resolved))
  assert.throws(
    () => assertRemoteTagAdvertisement(valid.replace(resolved.commit, 'd'.repeat(40)), resolved),
    /peeled tag commit mismatch/
  )
})
