import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'

import { validatePublicReleaseContract } from './validate-public-release-contract.mjs'

const tag = 'vi-v0.31.0-1'
const repository = 'LucDinhLe/hermes-agent-vietnamese'
const downloads = [
  'Hermes-Vietnamese-Windows-x64-Setup.exe',
  'Hermes-Vietnamese-Windows-arm64-Setup.exe',
  'Hermes-Vietnamese-macOS-Apple-Silicon.dmg',
  'Hermes-Vietnamese-macOS-Intel.dmg',
  'Hermes-Vietnamese-Linux-x64.deb',
  'Hermes-Vietnamese-Linux-arm64.deb',
  'Hermes-Vietnamese-Linux-x64.rpm',
  'Hermes-Vietnamese-Linux-arm64.rpm',
  'Hermes-Vietnamese-Linux-x64.AppImage',
  'Hermes-Vietnamese-Linux-arm64.AppImage'
]
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-public-release-contract-'))
let fixtureNumber = 0

after(() => fs.rmSync(temporaryRoot, { force: true, recursive: true }))

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function writeFixture() {
  fixtureNumber += 1
  const repoRoot = path.join(temporaryRoot, `fixture-${fixtureNumber}`)
  const candidateDir = path.join(repoRoot, 'candidate')
  const githubDir = path.join(repoRoot, '.github')

  fs.mkdirSync(candidateDir, { recursive: true })
  fs.mkdirSync(githubDir, { recursive: true })

  const files = [...downloads, 'Hermes-Vietnamese-macOS-Intel.zip', 'candidate-provenance.json']
  const manifest = []

  for (const filename of files) {
    const bytes = Buffer.from(`exact bytes for ${filename}`)
    fs.writeFileSync(path.join(candidateDir, filename), bytes)
    manifest.push(`${sha256(bytes)}  ${filename}`)
  }

  fs.writeFileSync(path.join(candidateDir, 'SHA256SUMS.txt'), `${manifest.join('\n')}\n`)
  fs.writeFileSync(path.join(candidateDir, 'release-runtime-evidence.json'), '{}\n')

  const windowsFilename = downloads[0]
  const windowsBytes = fs.readFileSync(path.join(candidateDir, windowsFilename))
  const release = {
    tag,
    rollbackTag: 'vi-v0.20.4-39',
    releaseClass: 'stable',
    windowsX64: {
      filename: windowsFilename,
      sha256: sha256(windowsBytes),
      size: windowsBytes.length
    },
    downloadFiles: downloads
  }
  fs.writeFileSync(path.join(githubDir, 'public-release.json'), `${JSON.stringify(release, null, 2)}\n`)

  const urls = downloads
    .map(filename => `https://github.com/${repository}/releases/download/${tag}/${filename}`)
    .join('\n')
  fs.writeFileSync(path.join(repoRoot, 'README.md'), urls)
  fs.writeFileSync(path.join(repoRoot, 'README.vi.md'), urls)

  return { candidateDir, release, repoRoot }
}

let fixture

beforeEach(() => {
  fixture = writeFixture()
})

test('accepts exact stable metadata, README URLs, candidate files, size, and hashes', () => {
  const result = validatePublicReleaseContract({ ...fixture, repository, tag })

  assert.equal(result.downloads, downloads.length)
  assert.equal(result.windowsX64, downloads[0])
})

test('rejects a README that only mentions the tag but has a stale asset URL', () => {
  fs.writeFileSync(path.join(fixture.repoRoot, 'README.md'), `${tag}\n`)

  assert.throws(() => validatePublicReleaseContract({ ...fixture, repository, tag }), /exact download URL/)
})

test('rejects stale public Windows size or SHA-256 metadata', () => {
  const releasePath = path.join(fixture.repoRoot, '.github', 'public-release.json')
  const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'))
  release.windowsX64.size += 1
  fs.writeFileSync(releasePath, JSON.stringify(release))

  assert.throws(() => validatePublicReleaseContract({ ...fixture, repository, tag }), /size mismatch/)
})

test('rejects an advertised distribution set that differs from candidate assets', () => {
  const releasePath = path.join(fixture.repoRoot, '.github', 'public-release.json')
  const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'))
  release.downloadFiles.pop()
  fs.writeFileSync(releasePath, JSON.stringify(release))

  assert.throws(() => validatePublicReleaseContract({ ...fixture, repository, tag }), /downloadFiles mismatch/)
})

test('rejects candidate files omitted from SHA256SUMS', () => {
  fs.writeFileSync(path.join(fixture.candidateDir, 'unexpected-metadata.json'), '{}')

  assert.throws(() => validatePublicReleaseContract({ ...fixture, repository, tag }), /release asset inventory/)
})
