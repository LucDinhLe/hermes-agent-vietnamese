import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeRepositoryUrl, readJson, resolveShellState, sha256File } from './lib/contracts.mjs'
import { verifyEdition } from './verify-edition.mjs'
import { expectedChangedPaths } from './verify-materialized-tree.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = { requireCleanShell: false, requireRelease: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--require-release') {
      options.requireRelease = true
      continue
    }

    if (arg === '--require-clean-shell') {
      options.requireCleanShell = true
      continue
    }

    if (arg === '--resources' || arg === '--shell-commit' || arg === '--receipt-sha256') {
      const value = argv[index + 1]

      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`)
      }

      if (arg === '--resources') {
        options.resourcesDir = value
      } else if (arg === '--shell-commit') {
        options.expectedShellCommit = value
      } else {
        options.expectedReceiptSha256 = value.toLowerCase()
      }
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.resourcesDir) {
    throw new Error(
      'Usage: npm run verify:provenance -- --resources <directory> [--shell-commit <sha>] [--receipt-sha256 <sha>] [--require-clean-shell] [--require-release]'
    )
  }

  return options
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`)
  }
}

function stableJson(value) {
  return JSON.stringify(value)
}

export function verifyPackagedProvenance(options) {
  const root = options.root ?? ROOT
  const contract = options.contract ?? verifyEdition(root)
  const resourcesDir = path.resolve(options.resourcesDir)
  const receiptPath = path.join(resourcesDir, 'edition-receipt.json')
  const stampPath = path.join(resourcesDir, 'install-stamp.json')
  const receiptSha256 = sha256File(receiptPath)
  const receipt = readJson(receiptPath)
  const stamp = readJson(stampPath)
  const shell = options.shellState ?? resolveShellState(root, contract.edition.maintainer.repository)
  const expectedShellCommit = options.expectedShellCommit ?? shell.commit

  if (options.expectedReceiptSha256) {
    if (!/^[0-9a-f]{64}$/.test(options.expectedReceiptSha256)) {
      throw new Error('Expected receipt SHA-256 must be exactly 64 hexadecimal characters')
    }

    assertEqual(receiptSha256, options.expectedReceiptSha256, 'Packaged receipt SHA-256')
  }

  assertEqual(receipt.schemaVersion, 1, 'Receipt schema')
  assertEqual(receipt.engine.tag, contract.lock.source.tag, 'Receipt engine tag')
  assertEqual(receipt.engine.tagObjectSha, contract.lock.source.tagObjectSha, 'Receipt tag object')
  assertEqual(receipt.engine.commit, contract.lock.source.commit, 'Receipt engine commit')
  assertEqual(receipt.engine.version, contract.lock.source.engineVersion, 'Receipt engine version')
  assertEqual(
    normalizeRepositoryUrl(receipt.engine.repository),
    normalizeRepositoryUrl(contract.lock.source.repository),
    'Receipt engine repository'
  )
  assertEqual(receipt.edition.id, contract.edition.id, 'Receipt edition ID')
  assertEqual(receipt.edition.version, contract.edition.technicalVersion, 'Receipt edition version')
  assertEqual(receipt.edition.overlaySha256, contract.overlaySha256, 'Receipt overlay digest')
  assertEqual(
    stableJson(receipt.edition.overlayFiles),
    stableJson(contract.overlayInventory),
    'Receipt overlay inventory'
  )
  assertEqual(
    stableJson(receipt.edition.patches),
    stableJson(contract.patches.map((patch) => ({ id: patch.id, sha256: patch.sha256 }))),
    'Receipt patch inventory'
  )
  const expectedChangedPathInventory = expectedChangedPaths(contract)

  assertEqual(
    stableJson(receipt.changedPaths),
    stableJson(expectedChangedPathInventory),
    'Receipt changed-path inventory'
  )
  const expectedMaterializedPaths = expectedChangedPathInventory.filter(
    (file) => file !== 'apps/desktop/build/edition-receipt.json'
  )

  assertEqual(
    stableJson(receipt.materializedFiles?.map((entry) => entry.path)),
    stableJson(expectedMaterializedPaths),
    'Receipt materialized-file inventory'
  )

  if (!receipt.materializedFiles.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256))) {
    throw new Error('Receipt materialized-file inventory contains an invalid SHA-256')
  }

  if (!expectedShellCommit || !/^[0-9a-f]{40}$/.test(expectedShellCommit)) {
    throw new Error('Expected shell commit must be an exact 40-character SHA')
  }

  assertEqual(receipt.edition.shellCommit, expectedShellCommit, 'Receipt shell commit')
  assertEqual(stamp.schemaVersion, 1, 'Install stamp schema')
  assertEqual(stamp.commit, contract.lock.source.commit, 'Install stamp engine commit')
  assertEqual(stamp.source, 'local', 'Install stamp source')
  assertEqual(stamp.dirty, true, 'Install stamp composite-tree dirty flag')

  if (options.requireCleanShell) {
    assertEqual(shell.commit, expectedShellCommit, 'Current shell commit')
    assertEqual(shell.dirty, false, 'Current shell dirty flag')
    assertEqual(receipt.edition.shellDirty, false, 'Receipt shell dirty flag')
  }

  if (options.requireRelease) {
    assertEqual(shell.commit, expectedShellCommit, 'Current shell commit')
    assertEqual(shell.dirty, false, 'Current shell dirty flag')
    assertEqual(receipt.releaseMode, true, 'Receipt release mode')
    assertEqual(receipt.edition.shellDirty, false, 'Receipt shell dirty flag')

    if (!Array.isArray(receipt.edition.shellLiveRemoteRefs) || receipt.edition.shellLiveRemoteRefs.length === 0) {
      throw new Error('Release receipt has no live maintainer remote evidence')
    }
  } else {
    assertEqual(receipt.releaseMode, false, 'Diagnostic receipt release mode')
  }

  return {
    receipt,
    receiptSha256,
    stamp,
    stampSha256: sha256File(stampPath)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyPackagedProvenance(parseArgs(process.argv.slice(2)))

  console.log(
    `[provenance] engine ${result.receipt.engine.commit.slice(0, 12)} + ` +
      `edition ${result.receipt.edition.shellCommit.slice(0, 12)}`
  )
  console.log(`[provenance] receipt ${result.receiptSha256}; install stamp ${result.stampSha256}`)
}
