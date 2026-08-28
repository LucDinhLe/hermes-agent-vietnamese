import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertRegularFile,
  assertSafeRelativePath,
  readJson,
  resolveShellState,
  runGit,
  sha256File
} from './lib/contracts.mjs'
import { verifyEdition } from './verify-edition.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RECEIPT_PATH = 'apps/desktop/build/edition-receipt.json'

function parseArgs(argv) {
  const options = { requireCleanShell: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--require-clean-shell') {
      options.requireCleanShell = true
      continue
    }

    if (arg === '--tree' || arg === '--shell-commit') {
      const value = argv[index + 1]

      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`)
      }

      options[arg === '--tree' ? 'tree' : 'expectedShellCommit'] = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.tree) {
    throw new Error(
      'Usage: npm run verify:materialized -- --tree <directory> [--shell-commit <sha>] [--require-clean-shell]'
    )
  }

  return options
}

function splitLines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean).sort() : []
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch`)
  }
}

export function verifyMaterializedFiles(tree, receipt) {
  const expectedPaths = receipt.changedPaths.filter((file) => file !== RECEIPT_PATH)
  const inventory = receipt.materializedFiles

  if (!Array.isArray(inventory)) {
    throw new Error('Receipt has no materialized-file inventory')
  }

  assertJsonEqual(
    inventory.map((entry) => entry.path),
    expectedPaths,
    'Materialized-file path inventory'
  )

  for (const entry of inventory) {
    const relative = assertSafeRelativePath(entry.path, 'materialized file')
    const target = path.join(tree, ...relative.split('/'))

    assertRegularFile(target, 'materialized file')

    if (!/^[0-9a-f]{64}$/.test(entry.sha256) || sha256File(target) !== entry.sha256) {
      throw new Error(`Materialized file digest mismatch: ${relative}`)
    }
  }

  return inventory.length
}

export function verifyMaterializedTree(options) {
  const root = options.root ?? ROOT
  const tree = path.resolve(options.tree)
  const contract = options.contract ?? verifyEdition(root)
  const receiptPath = path.join(tree, ...RECEIPT_PATH.split('/'))
  const receipt = readJson(receiptPath)
  const shell = resolveShellState(root, contract.edition.maintainer.repository)
  const expectedShellCommit = options.expectedShellCommit ?? shell.commit
  const treeHead = runGit(['rev-parse', 'HEAD'], tree).stdout
  const stagedPaths = splitLines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB'], tree).stdout)
  const unstagedPaths = splitLines(runGit(['diff', '--name-only'], tree).stdout)
  const expectedPatches = contract.patches.map((patch) => ({ id: patch.id, sha256: patch.sha256 }))

  if (!expectedShellCommit || !/^[0-9a-f]{40}$/.test(expectedShellCommit)) {
    throw new Error('Expected shell commit must be an exact 40-character SHA')
  }

  if (treeHead !== contract.lock.source.commit || receipt.engine.commit !== contract.lock.source.commit) {
    throw new Error('Materialized tree is not based on the locked engine commit')
  }

  if (receipt.edition.shellCommit !== expectedShellCommit) {
    throw new Error('Materialized receipt shell commit mismatch')
  }

  if (options.requireCleanShell && (shell.dirty || receipt.edition.shellDirty)) {
    throw new Error('Materialized verification requires a clean shell and clean receipt')
  }

  assertJsonEqual(receipt.edition.overlayFiles, contract.overlayInventory, 'Overlay inventory')
  assertJsonEqual(receipt.edition.patches, expectedPatches, 'Patch inventory')
  assertJsonEqual(stagedPaths, receipt.changedPaths, 'Staged changed-path inventory')

  if (unstagedPaths.length > 0) {
    throw new Error(`Materialized tree has unstaged changes: ${unstagedPaths.join(', ')}`)
  }

  const fileCount = verifyMaterializedFiles(tree, receipt)

  return { fileCount, receipt, receiptSha256: sha256File(receiptPath) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyMaterializedTree(parseArgs(process.argv.slice(2)))

  console.log(`[materialized] ${result.fileCount} file digest(s) verified; receipt ${result.receiptSha256}`)
}
