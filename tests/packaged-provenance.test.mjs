import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { verifyPackagedProvenance } from '../scripts/verify-packaged-provenance.mjs'
import { verifyEdition } from '../scripts/verify-edition.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const SHELL_COMMIT = 'a'.repeat(40)

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function fixture() {
  const contract = verifyEdition(ROOT)
  const resourcesDir = mkdtempSync(path.join(tmpdir(), 'hermes-v33-provenance-'))
  const changedPaths = [
    ...new Set([
      ...contract.overlayFiles,
      ...contract.patches.flatMap((patch) => patch.paths),
      'apps/desktop/index.html',
      'apps/desktop/package.json',
      'apps/desktop/build/edition-receipt.json'
    ])
  ].sort()
  const receipt = {
    schemaVersion: 1,
    releaseMode: true,
    engine: {
      repository: contract.lock.source.repository,
      tag: contract.lock.source.tag,
      tagObjectSha: contract.lock.source.tagObjectSha,
      commit: contract.lock.source.commit,
      version: contract.lock.source.engineVersion
    },
    edition: {
      id: contract.edition.id,
      version: contract.edition.technicalVersion,
      shellCommit: SHELL_COMMIT,
      shellDirty: false,
      shellLiveRemoteRefs: ['refs/remotes/origin/main'],
      overlaySha256: contract.overlaySha256,
      overlayFiles: contract.overlayInventory,
      patches: contract.patches.map((patch) => ({
        id: patch.id,
        kind: patch.kind,
        sha256: patch.sha256
      }))
    },
    changedPaths,
    materializedFiles: changedPaths
      .filter((file) => file !== 'apps/desktop/build/edition-receipt.json')
      .map((file) => ({ path: file, sha256: 'f'.repeat(64) }))
  }
  const stamp = {
    schemaVersion: 1,
    commit: contract.lock.source.commit,
    branch: null,
    builtAt: new Date(0).toISOString(),
    dirty: true,
    source: 'local'
  }

  writeJson(path.join(resourcesDir, 'edition-receipt.json'), receipt)
  writeJson(path.join(resourcesDir, 'install-stamp.json'), stamp)

  return { contract, receipt, resourcesDir, stamp }
}

test('packaged provenance binds engine stamp, shell commit, overlay, and patches', () => {
  const sample = fixture()
  const result = verifyPackagedProvenance({
    contract: sample.contract,
    expectedShellCommit: SHELL_COMMIT,
    requireRelease: true,
    resourcesDir: sample.resourcesDir,
    root: ROOT,
    shellState: { commit: SHELL_COMMIT, dirty: false }
  })

  assert.match(result.receiptSha256, /^[0-9a-f]{64}$/)
  assert.match(result.stampSha256, /^[0-9a-f]{64}$/)
})

test('packaged provenance rejects an install stamp from the shell commit', () => {
  const sample = fixture()
  sample.stamp.commit = SHELL_COMMIT
  writeJson(path.join(sample.resourcesDir, 'install-stamp.json'), sample.stamp)

  assert.throws(
    () =>
      verifyPackagedProvenance({
        contract: sample.contract,
        expectedShellCommit: SHELL_COMMIT,
        requireRelease: true,
        resourcesDir: sample.resourcesDir,
        root: ROOT,
        shellState: { commit: SHELL_COMMIT, dirty: false }
      }),
    /Install stamp engine commit mismatch/
  )
})

test('diagnostic CI provenance rejects a dirty shell receipt', () => {
  const sample = fixture()
  sample.receipt.releaseMode = false
  sample.receipt.edition.shellDirty = true
  sample.receipt.edition.shellLiveRemoteRefs = []
  writeJson(path.join(sample.resourcesDir, 'edition-receipt.json'), sample.receipt)

  assert.throws(
    () =>
      verifyPackagedProvenance({
        contract: sample.contract,
        expectedShellCommit: SHELL_COMMIT,
        requireCleanShell: true,
        resourcesDir: sample.resourcesDir,
        root: ROOT,
        shellState: { commit: SHELL_COMMIT, dirty: false }
      }),
    /Receipt shell dirty flag mismatch/
  )
})

test('packaged provenance rejects a shell that changed after materialization', () => {
  const sample = fixture()

  assert.throws(
    () =>
      verifyPackagedProvenance({
        contract: sample.contract,
        expectedShellCommit: SHELL_COMMIT,
        requireCleanShell: true,
        resourcesDir: sample.resourcesDir,
        root: ROOT,
        shellState: { commit: 'b'.repeat(40), dirty: false }
      }),
    /Current shell commit mismatch/
  )
})

test('packaged provenance binds the packaged receipt to its pre-build SHA-256', () => {
  const sample = fixture()
  const first = verifyPackagedProvenance({
    contract: sample.contract,
    expectedShellCommit: SHELL_COMMIT,
    requireRelease: true,
    resourcesDir: sample.resourcesDir,
    root: ROOT,
    shellState: { commit: SHELL_COMMIT, dirty: false }
  })

  sample.receipt.generatedAt = new Date(1).toISOString()
  writeJson(path.join(sample.resourcesDir, 'edition-receipt.json'), sample.receipt)

  assert.throws(
    () =>
      verifyPackagedProvenance({
        contract: sample.contract,
        expectedReceiptSha256: first.receiptSha256,
        expectedShellCommit: SHELL_COMMIT,
        requireRelease: true,
        resourcesDir: sample.resourcesDir,
        root: ROOT,
        shellState: { commit: SHELL_COMMIT, dirty: false }
      }),
    /Packaged receipt SHA-256 mismatch/
  )
})
