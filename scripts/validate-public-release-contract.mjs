import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateReleaseAssetInventory } from './release-asset-inventory.mjs'

const SHA256SUMS = 'SHA256SUMS.txt'
const DISTRIBUTION_ASSET_RE =
  /^Hermes-Vietnamese-(?:Windows-(?:x64|arm64)-Setup\.exe|macOS-(?:Apple-Silicon|Intel)\.dmg|Linux-(?:x64|arm64)\.(?:AppImage|deb|rpm))$/

function fail(message) {
  throw new Error(`Public release contract failed: ${message}`)
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function equalStringSets(actual, expected, label) {
  const actualSorted = sorted(actual)
  const expectedSorted = sorted(expected)

  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    fail(`${label} mismatch; expected [${expectedSorted.join(', ')}], got [${actualSorted.join(', ')}]`)
  }
}

export function parseChecksumManifest(text) {
  const entries = new Map()

  for (const [index, line] of String(text).trim().split(/\r?\n/).entries()) {
    const match = line.match(/^([a-f0-9]{64}) {2}([^/\\]+)$/)

    if (!match) {
      fail(`invalid SHA256SUMS line ${index + 1}`)
    }

    const [, sha256, filename] = match

    if (entries.has(filename)) {
      fail(`duplicate SHA256SUMS entry: ${filename}`)
    }

    entries.set(filename, sha256)
  }

  if (!entries.size) {
    fail('SHA256SUMS.txt is empty')
  }

  return entries
}

function sha256File(filename) {
  return createHash('sha256').update(fs.readFileSync(filename)).digest('hex')
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}

export function validatePublicReleaseContract({ candidateDir, repository, repoRoot, tag }) {
  const release = readJson(path.join(repoRoot, '.github', 'public-release.json'))

  if (release.tag !== tag) {
    fail(`public-release tag ${release.tag} does not match ${tag}`)
  }
  if (release.releaseClass !== 'stable') {
    fail(`public-release releaseClass must be stable, got ${release.releaseClass}`)
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    fail(`invalid GitHub repository: ${repository}`)
  }

  const manifestPath = path.join(candidateDir, SHA256SUMS)

  if (!fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
    fail(`missing ${SHA256SUMS}`)
  }

  const manifestBytes = fs.readFileSync(manifestPath)
  const manifest = parseChecksumManifest(manifestBytes.toString('utf8'))
  const candidateFiles = fs
    .readdirSync(candidateDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)

  validateReleaseAssetInventory(candidateFiles, manifestBytes, 'release-runtime-evidence.json')

  for (const [filename, expectedSha] of manifest) {
    const actualSha = sha256File(path.join(candidateDir, filename))

    if (actualSha !== expectedSha) {
      fail(`${filename} SHA-256 mismatch; expected ${expectedSha}, got ${actualSha}`)
    }
  }

  if (!Array.isArray(release.downloadFiles) || !release.downloadFiles.length) {
    fail('downloadFiles must be a non-empty array')
  }

  const downloadFiles = release.downloadFiles.map(value => String(value))

  if (new Set(downloadFiles).size !== downloadFiles.length) {
    fail('downloadFiles contains duplicates')
  }

  const distributionAssets = [...manifest.keys()].filter(filename => DISTRIBUTION_ASSET_RE.test(filename))

  equalStringSets(downloadFiles, distributionAssets, 'downloadFiles')

  const prefix = `https://github.com/${repository}/releases/download/${tag}/`

  for (const readme of ['README.md', 'README.vi.md']) {
    const text = fs.readFileSync(path.join(repoRoot, readme), 'utf8')

    for (const filename of downloadFiles) {
      if (!text.includes(prefix + filename)) {
        fail(`${readme} is missing exact download URL for ${filename}`)
      }
    }
  }

  const windows = release.windowsX64

  if (!windows || typeof windows !== 'object') {
    fail('windowsX64 metadata is missing')
  }
  if (!downloadFiles.includes(windows.filename)) {
    fail(`windowsX64 filename is not in downloadFiles: ${windows.filename}`)
  }

  const windowsPath = path.join(candidateDir, windows.filename)
  const windowsSize = fs.statSync(windowsPath).size
  const windowsSha = manifest.get(windows.filename)

  if (windows.size !== windowsSize) {
    fail(`windowsX64 size mismatch; expected ${windows.size}, got ${windowsSize}`)
  }
  if (windows.sha256 !== windowsSha) {
    fail(`windowsX64 SHA-256 mismatch; expected ${windows.sha256}, got ${windowsSha}`)
  }

  return {
    assets: manifest.size,
    downloads: downloadFiles.length,
    tag,
    windowsX64: windows.filename
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const [candidateDir, tag, repository] = process.argv.slice(2)

  try {
    if (!candidateDir || !tag || !repository || process.argv.length !== 5) {
      throw new Error('Usage: node scripts/validate-public-release-contract.mjs <candidate-dir> <tag> <owner/repo>')
    }

    const result = validatePublicReleaseContract({
      candidateDir: path.resolve(candidateDir),
      repository,
      repoRoot: process.cwd(),
      tag
    })

    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
