import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertRegularFile,
  assertSafeRelativePath,
  collectFiles,
  isForbiddenPath,
  matchesAllowedPath,
  normalizeRepositoryUrl,
  pathsDeclaredByPatch,
  readJson,
  sha256File,
  sha256Tree
} from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function verifyEdition(root = ROOT) {
  const lock = readJson(path.join(root, 'engine.lock.json'))
  const edition = readJson(path.join(root, 'edition.json'))
  const series = readJson(path.join(root, 'patches', 'series.json'))

  if (lock?.schemaVersion !== 1 || edition?.schemaVersion !== 1 || series?.schemaVersion !== 1) {
    throw new Error('Engine lock, edition, and patch ledger must use schemaVersion 1')
  }

  if (normalizeRepositoryUrl(lock?.source?.repository) !== 'https://github.com/nousresearch/hermes-agent') {
    throw new Error('Engine lock repository must be the official Hermes Agent upstream')
  }

  if (lock?.source?.license !== 'MIT') {
    throw new Error('Locked upstream license must remain MIT')
  }

  if (!new Set(['unsigned', 'present-unverified']).has(lock?.source?.tagSignature)) {
    throw new Error('Engine tag signature state must not claim unproven verification')
  }

  if (!/^[0-9a-f]{40}$/.test(lock?.source?.commit ?? '')) {
    throw new Error('engine.lock.json must pin an exact 40-character commit')
  }

  if (!/^[0-9a-f]{40}$/.test(lock?.source?.tagObjectSha ?? '')) {
    throw new Error('engine.lock.json must pin the annotated tag object')
  }

  if (
    lock?.policy?.followMovingBranch !== false ||
    lock?.policy?.requireExactCommit !== true ||
    lock?.policy?.requireAnnotatedTag !== true
  ) {
    throw new Error('engine lock policy must require an annotated tag and exact commit while refusing moving branches')
  }

  const allowed = edition.allowedPaths.map((item) =>
    assertSafeRelativePath(item, 'allowed path', {
      allowDirectoryGlob: true
    })
  )
  const forbidden = edition.forbiddenPrefixes.map((item) => assertSafeRelativePath(item, 'forbidden prefix'))

  for (const entry of allowed) {
    const pathPart = entry.endsWith('/**') ? entry.slice(0, -3) : entry

    if (!pathPart.startsWith('apps/desktop/')) {
      throw new Error(`Vietnamese edition ownership must stay under apps/desktop/: ${entry}`)
    }
  }
  const overlayRoot = path.join(root, ...assertSafeRelativePath(edition.overlayRoot, 'overlay root').split('/'))
  const productMetadata = readJson(path.join(overlayRoot, 'apps', 'desktop', 'product-metadata.json'))

  if (productMetadata?.schemaVersion !== 1) {
    throw new Error('Vietnamese product metadata must use schemaVersion 1')
  }
  const overlayFiles = collectFiles(overlayRoot)
  const upstreamRepository = productMetadata.upstream?.repository
  const immutableLicenseUrl =
    typeof upstreamRepository === 'string'
      ? `${upstreamRepository.replace(/\.git$/, '').replace(/\/$/, '')}/blob/${lock.source.commit}/LICENSE`
      : null

  const metadataFacts = [
    ['display name', productMetadata.displayName, edition.displayName],
    ['product version', productMetadata.productVersion, edition.productVersion],
    ['technical version', productMetadata.technicalVersion, edition.technicalVersion],
    ['engine version', productMetadata.upstream?.version, lock.source.engineVersion],
    ['engine tag', productMetadata.upstream?.tag, lock.source.tag],
    ['engine commit', productMetadata.upstream?.commit, lock.source.commit],
    [
      'engine repository',
      normalizeRepositoryUrl(productMetadata.upstream?.repository),
      normalizeRepositoryUrl(lock.source.repository)
    ],
    ['license', productMetadata.license?.spdx, lock.source.license],
    ['immutable license URL', productMetadata.license?.url, immutableLicenseUrl],
    ['reserved app ID', productMetadata.identity?.appId, edition.identity?.appId],
    ['reserved executable', productMetadata.identity?.executableName, edition.identity?.executableName],
    ['reserved protocol', productMetadata.identity?.protocol, edition.identity?.protocol]
  ]

  for (const [label, actual, expected] of metadataFacts) {
    if (actual !== expected) {
      throw new Error(`Vietnamese product metadata ${label} drift: expected ${expected}, got ${actual}`)
    }
  }

  if (
    edition.identity?.activation !== 'blocked-until-migration-gate' ||
    productMetadata.identity?.status !== 'reserved-not-active'
  ) {
    throw new Error('Independent installer identity must remain fail-closed until the migration gate')
  }

  for (const file of overlayFiles) {
    if (!matchesAllowedPath(file, allowed)) {
      throw new Error(`Overlay path is not allowlisted: ${file}`)
    }

    if (isForbiddenPath(file, forbidden)) {
      throw new Error(`Overlay enters a forbidden engine prefix: ${file}`)
    }

    if (/(^|\/)\.env($|\.)|token|secret/i.test(file)) {
      throw new Error(`Overlay filename looks secret-bearing: ${file}`)
    }
  }

  const patchReceipts = []

  for (const entry of series.patches ?? []) {
    if (entry.state !== 'active') {
      continue
    }

    const patchFile = path.join(root, 'patches', assertSafeRelativePath(entry.file, 'patch file'))
    assertRegularFile(patchFile, 'patch file')

    if (entry.upstreamCommit !== lock.source.commit) {
      throw new Error(`Patch ${entry.id} is not rebased to the locked upstream commit`)
    }

    const actualPaths = pathsDeclaredByPatch(patchFile)
    const ledgerPaths = [...entry.paths].map((item) => assertSafeRelativePath(item, 'ledger path')).sort()

    if (JSON.stringify(actualPaths) !== JSON.stringify(ledgerPaths)) {
      throw new Error(`Patch ${entry.id} path ledger does not match its diff`)
    }

    for (const file of actualPaths) {
      if (!matchesAllowedPath(file, allowed)) {
        throw new Error(`Patch path is not allowlisted: ${file}`)
      }

      if (isForbiddenPath(file, forbidden)) {
        throw new Error(`Patch enters a forbidden engine prefix: ${file}`)
      }
    }

    if (!entry.rationale || !entry.retireWhen || !Array.isArray(entry.tests) || entry.tests.length === 0) {
      throw new Error(`Patch ${entry.id} lacks rationale, retirement condition, or tests`)
    }

    patchReceipts.push({
      id: entry.id,
      file: entry.file,
      sha256: sha256File(patchFile),
      paths: actualPaths
    })
  }

  return {
    edition,
    lock,
    overlayFiles,
    overlayInventory: overlayFiles.map((file) => ({
      path: file,
      sha256: sha256File(path.join(overlayRoot, ...file.split('/')))
    })),
    overlaySha256: sha256Tree(overlayRoot),
    patches: patchReceipts
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipt = verifyEdition()

  console.log(
    `[edition] OK ${receipt.edition.id}: ${receipt.overlayFiles.length} overlay files, ` +
      `${receipt.patches.length} active patch(es), engine ${receipt.lock.source.commit.slice(0, 12)}`
  )
}
