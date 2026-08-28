import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyBranding } from './lib/branding.mjs'
import {
  matchesAllowedPath,
  isForbiddenPath,
  resolveShellState,
  runGit,
  sha256File,
  verifyLiveRemoteRefs
} from './lib/contracts.mjs'
import { verifyEdition } from './verify-edition.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = { release: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--release') {
      options.release = true
      continue
    }

    if (arg === '--engine-dir' || arg === '--output') {
      const value = argv[index + 1]

      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a path`)
      }

      options[arg === '--engine-dir' ? 'engineDir' : 'output'] = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.engineDir) {
    throw new Error('Usage: npm run materialize -- --engine-dir <git checkout> [--output <empty path>] [--release]')
  }

  return options
}

function splitLines(value) {
  return value
    ? value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : []
}

function contractFingerprint(contract) {
  return JSON.stringify({
    edition: contract.edition,
    lock: contract.lock,
    overlayInventory: contract.overlayInventory,
    overlaySha256: contract.overlaySha256,
    patches: contract.patches
  })
}

export function materialize(options) {
  const contract = verifyEdition(ROOT)
  const engineDir = path.resolve(options.engineDir)
  const output = path.resolve(
    options.output ??
      path.join(ROOT, '.work', `engine-${contract.lock.source.commit.slice(0, 12)}-${randomUUID().slice(0, 8)}`)
  )
  const shell = resolveShellState(ROOT, contract.edition.maintainer.repository)
  const liveRemoteRefs = options.release ? verifyLiveRemoteRefs(ROOT, shell.remoteCandidates) : []

  if (options.release && (shell.dirty || !shell.commit || liveRemoteRefs.length === 0)) {
    throw new Error(
      'Release materialization requires a clean edition commit on a locally tracked branch whose current head is verified against the configured maintainer remote'
    )
  }

  if (existsSync(output)) {
    throw new Error(`Output must not already exist: ${output}`)
  }

  const tagType = runGit(['cat-file', '-t', contract.lock.source.tag], engineDir).stdout
  const tagObject = runGit(['rev-parse', contract.lock.source.tag], engineDir).stdout
  const tagCommit = runGit(['rev-parse', `${contract.lock.source.tag}^{commit}`], engineDir).stdout

  if (tagType !== 'tag') {
    throw new Error(`Locked ref is not an annotated tag: ${contract.lock.source.tag}`)
  }

  if (tagObject !== contract.lock.source.tagObjectSha) {
    throw new Error(`Tag object mismatch: expected ${contract.lock.source.tagObjectSha}, got ${tagObject}`)
  }

  if (tagCommit !== contract.lock.source.commit) {
    throw new Error(`Tag commit mismatch: expected ${contract.lock.source.commit}, got ${tagCommit}`)
  }

  mkdirSync(path.dirname(output), { recursive: true })
  let worktreeAdded = false

  try {
    runGit(['-c', 'core.longpaths=true', 'worktree', 'add', '--detach', output, contract.lock.source.commit], engineDir)
    worktreeAdded = true

    for (const patch of contract.patches) {
      runGit(['apply', '--index', '--whitespace=error-all', path.join(ROOT, 'patches', patch.file)], output)
    }

    const overlayRoot = path.join(ROOT, ...contract.edition.overlayRoot.split('/'))
    cpSync(overlayRoot, output, {
      recursive: true,
      force: true,
      errorOnExist: false
    })

    for (const entry of contract.overlayInventory) {
      const copied = path.join(output, ...entry.path.split('/'))

      if (sha256File(copied) !== entry.sha256) {
        throw new Error(`Overlay changed while it was being copied: ${entry.path}`)
      }
    }

    const brandingPaths = applyBranding(output, contract.edition)

    const receiptPath = path.join(output, 'apps', 'desktop', 'build', 'edition-receipt.json')
    mkdirSync(path.dirname(receiptPath), { recursive: true })

    const expectedReceiptPath = 'apps/desktop/build/edition-receipt.json'
    const expectedPaths = [
      ...new Set([
        ...contract.overlayFiles,
        ...contract.patches.flatMap((patch) => patch.paths),
        ...brandingPaths,
        expectedReceiptPath
      ])
    ].sort()
    const materializedFiles = expectedPaths
      .filter((file) => file !== expectedReceiptPath)
      .map((file) => ({ path: file, sha256: sha256File(path.join(output, ...file.split('/'))) }))
    const receipt = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      releaseMode: Boolean(options.release),
      engine: {
        repository: contract.lock.source.repository,
        tag: contract.lock.source.tag,
        tagObjectSha: tagObject,
        commit: tagCommit,
        version: contract.lock.source.engineVersion
      },
      edition: {
        id: contract.edition.id,
        version: contract.edition.technicalVersion,
        shellCommit: shell.commit,
        shellDirty: shell.dirty,
        shellLiveRemoteRefs: liveRemoteRefs,
        overlaySha256: contract.overlaySha256,
        overlayFiles: contract.overlayInventory,
        patches: contract.patches.map((patch) => ({
          id: patch.id,
          sha256: patch.sha256
        }))
      },
      changedPaths: expectedPaths,
      materializedFiles
    }

    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
    runGit(['add', '--all'], output)
    runGit(['add', '--force', expectedReceiptPath], output)

    const changedPaths = splitLines(
      runGit(['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB'], output).stdout
    ).sort()

    if (JSON.stringify(changedPaths) !== JSON.stringify(expectedPaths)) {
      const missing = expectedPaths.filter((file) => !changedPaths.includes(file))
      const unexpected = changedPaths.filter((file) => !expectedPaths.includes(file))

      throw new Error(
        `Materialized diff does not match its receipt. Missing: ${missing.join(', ') || 'none'}. ` +
          `Unexpected: ${unexpected.join(', ') || 'none'}.`
      )
    }

    for (const file of changedPaths) {
      if (!matchesAllowedPath(file, contract.edition.allowedPaths)) {
        throw new Error(`Materialized path is not allowlisted: ${file}`)
      }

      if (isForbiddenPath(file, contract.edition.forbiddenPrefixes)) {
        throw new Error(`Materialized path enters a forbidden engine prefix: ${file}`)
      }
    }

    const unstaged = runGit(['diff', '--name-only'], output).stdout

    if (unstaged) {
      throw new Error(`Materialized worktree has unstaged changes: ${unstaged}`)
    }

    const finalContract = verifyEdition(ROOT)
    const finalShell = resolveShellState(ROOT, contract.edition.maintainer.repository)
    const finalLiveRemoteRefs = options.release ? verifyLiveRemoteRefs(ROOT, finalShell.remoteCandidates) : []

    if (contractFingerprint(finalContract) !== contractFingerprint(contract)) {
      throw new Error('Edition contract changed during materialization')
    }

    if (finalShell.commit !== shell.commit) {
      throw new Error('Edition shell commit changed during materialization')
    }

    if (
      options.release &&
      (finalShell.dirty || JSON.stringify(finalLiveRemoteRefs) !== JSON.stringify(liveRemoteRefs))
    ) {
      throw new Error('Release edition shell or verified remote state changed during materialization')
    }

    console.log(
      `[materialize] engine ${tagCommit.slice(0, 12)} + edition ${shell.commit?.slice(0, 12) ?? 'uncommitted'}`
    )
    console.log(`[materialize] staged ${changedPaths.length} allowlisted path(s) at ${output}`)

    return { changedPaths, output, receipt }
  } catch (error) {
    if (!worktreeAdded) {
      throw error
    }

    const cleanup = runGit(['-c', 'core.longpaths=true', 'worktree', 'remove', '--force', output], engineDir, {
      allowFailure: true
    })

    if (!cleanup.ok) {
      const cleanupError = new Error(
        `Unable to remove failed materialization ${output}: ${cleanup.stderr || cleanup.stdout || 'unknown error'}`
      )

      throw new AggregateError([error, cleanupError], 'Materialization and temporary worktree cleanup both failed')
    }

    throw error
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  materialize(parseArgs(process.argv.slice(2)))
}
