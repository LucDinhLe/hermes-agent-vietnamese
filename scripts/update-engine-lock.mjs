import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeRepositoryUrl, readJson, runGit } from './lib/contracts.mjs'
import { verifyEdition } from './verify-edition.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = { write: true }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.write = false
      continue
    }

    if (arg === '--engine-dir' || arg === '--tag') {
      const value = argv[index + 1]

      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`)
      }

      options[arg === '--engine-dir' ? 'engineDir' : 'tag'] = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.engineDir || !options.tag) {
    throw new Error('Usage: npm run engine:update -- --engine-dir <checkout> --tag <annotated-tag> [--dry-run]')
  }

  return options
}

function projectVersion(pyproject) {
  const lines = pyproject.split(/\r?\n/)
  const projectStart = lines.findIndex((line) => line.trim() === '[project]')
  let version

  for (let index = projectStart + 1; projectStart >= 0 && index < lines.length; index += 1) {
    if (lines[index].trim().startsWith('[')) {
      break
    }

    const match = /^version\s*=\s*"([^"]+)"\s*$/.exec(lines[index].trim())

    if (match) {
      version = match[1]
      break
    }
  }

  if (!version) {
    throw new Error('Locked engine pyproject.toml has no [project] version')
  }

  return version
}

export function signatureState(tagPayload) {
  return /-----BEGIN (?:PGP|SSH) SIGNATURE-----/.test(tagPayload) ? 'present-unverified' : 'unsigned'
}

export function nextEngineLock(existing, resolved, observedAt) {
  return {
    ...existing,
    source: {
      ...existing.source,
      tag: resolved.tag,
      tagObjectSha: resolved.tagObjectSha,
      commit: resolved.commit,
      engineVersion: resolved.engineVersion,
      desktopVersion: resolved.desktopVersion,
      tagSignature: resolved.tagSignature
    },
    observedAt
  }
}

export function nextPatchLedger(existing, commit) {
  return {
    ...existing,
    patches: existing.patches.map((patch) =>
      patch.state === 'active'
        ? {
            ...patch,
            upstreamCommit: commit
          }
        : patch
    )
  }
}

export function nextProductMetadata(existing, resolved) {
  const repository = existing?.upstream?.repository

  if (typeof repository !== 'string' || !repository) {
    throw new Error('Vietnamese product metadata has no upstream repository')
  }

  return {
    ...existing,
    upstream: {
      ...existing.upstream,
      version: resolved.engineVersion,
      tag: resolved.tag,
      commit: resolved.commit
    },
    license: {
      ...existing.license,
      url: `${repository.replace(/\.git$/, '').replace(/\/$/, '')}/blob/${resolved.commit}/LICENSE`
    }
  }
}

function resolveTag(engineDir, tag) {
  if (runGit(['cat-file', '-t', tag], engineDir).stdout !== 'tag') {
    throw new Error(`Engine ref must be an annotated tag: ${tag}`)
  }

  const tagObjectSha = runGit(['rev-parse', tag], engineDir).stdout
  const commit = runGit(['rev-parse', `${tag}^{commit}`], engineDir).stdout
  const tagPayload = runGit(['cat-file', '-p', tag], engineDir).stdout
  const pyproject = runGit(['show', `${commit}:pyproject.toml`], engineDir).stdout
  const desktopPackage = JSON.parse(runGit(['show', `${commit}:apps/desktop/package.json`], engineDir).stdout)

  if (typeof desktopPackage.version !== 'string' || !desktopPackage.version) {
    throw new Error('Locked engine desktop package has no version')
  }

  return {
    tag,
    tagObjectSha,
    commit,
    engineVersion: projectVersion(pyproject),
    desktopVersion: desktopPackage.version,
    tagSignature: signatureState(tagPayload)
  }
}

export function assertRemoteTagAdvertisement(output, resolved) {
  const refs = new Map(
    output
      .split(/\r?\n/)
      .map((line) => /^(\S+)\s+(\S+)$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[2], match[1]])
  )
  const tagRef = `refs/tags/${resolved.tag}`

  if (refs.get(tagRef) !== resolved.tagObjectSha) {
    throw new Error(`Remote annotated tag object mismatch for ${resolved.tag}`)
  }

  if (refs.get(`${tagRef}^{}`) !== resolved.commit) {
    throw new Error(`Remote peeled tag commit mismatch for ${resolved.tag}`)
  }
}

function resolveExpectedRemote(engineDir, repository) {
  const expected = normalizeRepositoryUrl(repository)
  const remotes = runGit(['remote'], engineDir).stdout.split(/\r?\n/).filter(Boolean)

  for (const remote of remotes) {
    const url = runGit(['remote', 'get-url', remote], engineDir, {
      allowFailure: true
    })

    if (url.ok && normalizeRepositoryUrl(url.stdout) === expected) {
      return remote
    }
  }

  throw new Error(`Engine checkout has no remote matching ${repository}; refusing official provenance`)
}

function verifyRemoteTag(engineDir, remote, resolved) {
  const tagRef = `refs/tags/${resolved.tag}`
  const advertised = runGit(['ls-remote', '--exit-code', remote, tagRef, `${tagRef}^{}`], engineDir).stdout

  assertRemoteTagAdvertisement(advertised, resolved)
}

function proveActivePatches(engineDir, commit, ledger) {
  const worktree = path.join(ROOT, '.work', `engine-lock-check-${process.pid}-${randomUUID()}`)
  let added = false
  let operationError
  let cleanupError

  try {
    runGit(['-c', 'core.longpaths=true', 'worktree', 'add', '--detach', worktree, commit], engineDir, {
      timeoutMs: 180_000
    })
    added = true

    for (const patch of ledger.patches.filter((entry) => entry.state === 'active')) {
      runGit(['apply', '--index', '--whitespace=error-all', path.join(ROOT, 'patches', patch.file)], worktree)
    }
  } catch (error) {
    operationError = error
  } finally {
    if (added) {
      const cleanup = runGit(['-c', 'core.longpaths=true', 'worktree', 'remove', '--force', worktree], engineDir, {
        allowFailure: true,
        timeoutMs: 180_000
      })

      if (!cleanup.ok) {
        cleanupError = new Error(
          `Unable to remove temporary patch-check worktree ${worktree}: ${cleanup.stderr || cleanup.stdout || 'unknown error'}`
        )
      }
    }
  }

  if (operationError && cleanupError) {
    throw new AggregateError([operationError, cleanupError], 'Patch proof and temporary worktree cleanup both failed')
  }

  if (operationError) {
    throw operationError
  }

  if (cleanupError) {
    throw cleanupError
  }
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function updateEngineLock(options) {
  const engineDir = path.resolve(options.engineDir)
  verifyEdition(ROOT)

  const lockPath = path.join(ROOT, 'engine.lock.json')
  const ledgerPath = path.join(ROOT, 'patches', 'series.json')
  const edition = readJson(path.join(ROOT, 'edition.json'))
  const productMetadataPath = path.join(
    ROOT,
    ...edition.overlayRoot.split('/'),
    'apps',
    'desktop',
    'src',
    'plugins',
    'hermes-vietnamese',
    'product-metadata.json'
  )
  const lockText = readFileSync(lockPath, 'utf8')
  const ledgerText = readFileSync(ledgerPath, 'utf8')
  const productMetadataText = readFileSync(productMetadataPath, 'utf8')
  const lock = readJson(lockPath)
  const ledger = readJson(ledgerPath)
  const productMetadata = readJson(productMetadataPath)
  const resolved = resolveTag(engineDir, options.tag)
  const expectedRemote = resolveExpectedRemote(engineDir, lock.source.repository)

  proveActivePatches(engineDir, resolved.commit, ledger)
  verifyRemoteTag(engineDir, expectedRemote, resolved)

  const observedAt = new Date().toISOString().slice(0, 10)
  const nextLock = nextEngineLock(lock, resolved, observedAt)
  const nextLedger = nextPatchLedger(ledger, resolved.commit)
  const nextMetadata = nextProductMetadata(productMetadata, resolved)

  if (options.write === false) {
    return {
      lock: nextLock,
      ledger: nextLedger,
      metadata: nextMetadata,
      remote: expectedRemote,
      resolved,
      written: false
    }
  }

  try {
    writeJson(lockPath, nextLock)
    writeJson(ledgerPath, nextLedger)
    writeJson(productMetadataPath, nextMetadata)
    verifyEdition(ROOT)
  } catch (error) {
    writeFileSync(lockPath, lockText, 'utf8')
    writeFileSync(ledgerPath, ledgerText, 'utf8')
    writeFileSync(productMetadataPath, productMetadataText, 'utf8')
    throw error
  }

  return {
    lock: nextLock,
    ledger: nextLedger,
    metadata: nextMetadata,
    remote: expectedRemote,
    resolved,
    written: true
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = updateEngineLock(parseArgs(process.argv.slice(2)))

  console.log(
    `[engine:update] ${result.resolved.tag} -> ${result.resolved.commit.slice(0, 12)} ` +
      `(agent ${result.resolved.engineVersion}, desktop ${result.resolved.desktopVersion})`
  )
  console.log(`[engine:update] remote ${result.remote} advertises the exact annotated tag object and peeled commit`)
  console.log(
    `[engine:update] active patches apply cleanly; files ${result.written ? 'updated' : 'unchanged (dry run)'}`
  )
}
