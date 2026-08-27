import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import {
  findPackagedResourcesPath,
  validateExtractedNativeProvenance,
  verifyNativeDistributionProvenance
} from './verify-native-distribution-provenance.mjs'

const roots = []

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-native-provenance-test-'))
  roots.push(root)
  return root
}

function writeResources(root, expected) {
  const resources = path.join(root, 'payload', 'Hermes.app', 'Contents', 'Resources')
  fs.mkdirSync(path.join(resources, 'agent-payload'), { recursive: true })
  const policy = {
    releaseClass: expected.releaseClass,
    updateChannel: 'community-prerelease',
    updateFeedEnabled: false
  }
  fs.writeFileSync(
    path.join(resources, 'install-stamp.json'),
    JSON.stringify({ ...expected, ...policy, payload: true })
  )
  fs.writeFileSync(
    path.join(resources, 'agent-payload', 'manifest.json'),
    JSON.stringify({ ...expected, ...policy, schemaVersion: 2, thin: false })
  )
  return resources
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('native distribution provenance verifier', () => {
  test('finds one packaged Resources directory and validates its immutable identity', () => {
    const root = tempRoot()
    const expected = {
      commit: 'a'.repeat(40),
      releaseClass: 'community-prerelease',
      tag: 'vi-v0.32.1-18'
    }
    const resources = writeResources(root, expected)
    assert.equal(findPackagedResourcesPath(root), resources)
    assert.deepEqual(validateExtractedNativeProvenance({ expected, extractedRoot: root }), {
      ...expected,
      updateChannel: 'community-prerelease',
      updateFeedEnabled: false
    })
  })

  test('rejects an ambiguous extraction instead of guessing which payload is real', () => {
    const root = tempRoot()
    const expected = {
      commit: 'b'.repeat(40),
      releaseClass: 'community-prerelease',
      tag: 'vi-v0.32.1-18'
    }
    writeResources(path.join(root, 'one'), expected)
    writeResources(path.join(root, 'two'), expected)
    assert.throws(() => findPackagedResourcesPath(root), /exactly one packaged Resources directory/)
  })

  test('rejects a platform outside the native verifier contract', () => {
    assert.throws(
      () =>
        verifyNativeDistributionProvenance({
          arch: 'x64',
          artifactPath: 'unused',
          desktopRoot: tempRoot(),
          env: {},
          platform: 'win32'
        }),
      /supports darwin\|linux/
    )
  })
})
