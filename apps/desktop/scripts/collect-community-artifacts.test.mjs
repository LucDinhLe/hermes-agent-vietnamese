import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import { collectCommunityArtifacts, writeChecksums } from './collect-community-artifacts.mjs'

const temporaryRoots = []

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-community-release-'))
  const releaseDir = path.join(root, 'release')
  const outputDir = path.join(root, 'output')
  fs.mkdirSync(releaseDir)
  temporaryRoots.push(root)
  return { outputDir, releaseDir }
}

function writeArtifact(directory, name, content = name) {
  fs.writeFileSync(path.join(directory, name), content)
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

test('normalizes Windows x64 and arm64 installers independently', () => {
  for (const arch of ['x64', 'arm64']) {
    const { outputDir, releaseDir } = fixture()
    writeArtifact(releaseDir, `Hermes-0.17.0-win-${arch}.exe`)

    const result = collectCommunityArtifacts({ arch, outputDir, platform: 'win32', releaseDir })

    assert.deepEqual(
      result.copied.map(file => path.basename(file)),
      [`Hermes-Vietnamese-Windows-${arch}-Setup.exe`]
    )
    assert.match(fs.readFileSync(result.checksumPath, 'utf8'), /Hermes-Vietnamese-Windows-/)
  }
})

test('requires both macOS distribution files for Apple Silicon and Intel', () => {
  for (const [arch, label] of [
    ['arm64', 'Apple-Silicon'],
    ['x64', 'Intel']
  ]) {
    const { outputDir, releaseDir } = fixture()
    writeArtifact(releaseDir, `Hermes-0.17.0-mac-${arch}.dmg`)
    writeArtifact(releaseDir, `Hermes-0.17.0-mac-${arch}.zip`)

    const result = collectCommunityArtifacts({ arch, outputDir, platform: 'darwin', releaseDir })

    assert.deepEqual(result.copied.map(file => path.basename(file)).sort(), [
      `Hermes-Vietnamese-macOS-${label}.dmg`,
      `Hermes-Vietnamese-macOS-${label}.zip`
    ])
  }
})

test('maps electron-builder Linux architecture names for every package format', () => {
  const fixtures = [
    {
      arch: 'x64',
      sourceNames: [
        'Hermes-0.17.0-linux-x86_64.AppImage',
        'Hermes-0.17.0-linux-amd64.deb',
        'Hermes-0.17.0-linux-x86_64.rpm'
      ]
    },
    {
      arch: 'arm64',
      sourceNames: [
        'Hermes-0.17.0-linux-arm64.AppImage',
        'Hermes-0.17.0-linux-arm64.deb',
        'Hermes-0.17.0-linux-aarch64.rpm'
      ]
    }
  ]

  for (const { arch, sourceNames } of fixtures) {
    const { outputDir, releaseDir } = fixture()
    for (const sourceName of sourceNames) writeArtifact(releaseDir, sourceName)

    const result = collectCommunityArtifacts({ arch, outputDir, platform: 'linux', releaseDir })

    assert.deepEqual(result.copied.map(file => path.basename(file)).sort(), [
      `Hermes-Vietnamese-Linux-${arch}.AppImage`,
      `Hermes-Vietnamese-Linux-${arch}.deb`,
      `Hermes-Vietnamese-Linux-${arch}.rpm`
    ])
  }
})

test('combined checksums include per-target manifests and exclude only themselves', () => {
  const { outputDir } = fixture()
  fs.mkdirSync(outputDir)
  writeArtifact(outputDir, 'b.bin', 'beta')
  writeArtifact(outputDir, 'a.bin', 'alpha')
  writeArtifact(outputDir, 'SHA256SUMS-win32-x64.txt', 'target manifest')

  const outputPath = writeChecksums(outputDir)
  const lines = fs.readFileSync(outputPath, 'utf8').trim().split('\n')

  assert.deepEqual(
    lines.map(line => line.split('  ')[1]),
    ['SHA256SUMS-win32-x64.txt', 'a.bin', 'b.bin']
  )
  assert.equal(lines.some(line => line.endsWith('  SHA256SUMS.txt')), false)
})
