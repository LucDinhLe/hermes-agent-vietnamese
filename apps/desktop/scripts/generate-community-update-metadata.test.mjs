import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { load } from 'js-yaml'
import { afterEach, test } from 'vitest'

import { generateCommunityUpdateMetadata } from './generate-community-update-metadata.mjs'

const require = createRequire(import.meta.url)
const { MacUpdater } = require('electron-updater/out/MacUpdater.js')
const temporaryRoots = []

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-community-update-metadata-'))
  temporaryRoots.push(root)

  return root
}

function writeArtifact(directory, name, content) {
  fs.writeFileSync(path.join(directory, name), content)
}

function sha512(content) {
  return createHash('sha512').update(content).digest('base64')
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

test('generates deterministic updater manifests from normalized immutable artifacts', () => {
  const directory = fixture()
  const artifacts = {
    'Hermes-Vietnamese-Windows-x64-Setup.exe': 'win-x64',
    'Hermes-Vietnamese-Windows-arm64-Setup.exe': 'win-arm64',
    'Hermes-Vietnamese-macOS-Intel.zip': 'mac-x64',
    'Hermes-Vietnamese-macOS-Apple-Silicon.zip': 'mac-arm64',
    'Hermes-Vietnamese-Linux-x64.AppImage': 'linux-x64',
    'Hermes-Vietnamese-Linux-arm64.AppImage': 'linux-arm64'
  }

  for (const [name, content] of Object.entries(artifacts)) {
    writeArtifact(directory, name, content)
  }

  const outputs = generateCommunityUpdateMetadata({
    directory,
    releaseDate: '2026-08-19T08:00:00Z',
    tag: 'vi-v0.20.4-35'
  })

  assert.deepEqual(outputs.map(file => path.basename(file)).sort(), [
    'latest-linux-arm64.yml',
    'latest-linux.yml',
    'latest-mac.yml',
    'latest.yml'
  ])

  const windows = fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8')
  assert.match(windows, /^version: 0\.20\.4-vi\.35$/m)
  assert.match(windows, /url: 'Hermes-Vietnamese-Windows-x64-Setup\.exe'/)
  assert.match(windows, /url: 'Hermes-Vietnamese-Windows-arm64-Setup\.exe'/)
  assert.ok(windows.includes(`sha512: ${sha512('win-x64')}`))
  assert.match(windows, /size: 7/)
  assert.match(windows, /releaseDate: '2026-08-19T08:00:00Z'/)

  const parsedWindows = load(windows)
  assert.equal(parsedWindows.version, '0.20.4-vi.35')
  assert.equal(parsedWindows.files.length, 2)
  assert.equal(parsedWindows.files[0].sha512, sha512('win-x64'))

  const parsedMac = load(fs.readFileSync(path.join(directory, 'latest-mac.yml'), 'utf8'))
  assert.equal(parsedMac.files[0].url, 'Hermes-Vietnamese-macOS-Intel.zip')
  assert.equal(parsedMac.files[1].url, 'Hermes-Vietnamese-macOS-Apple-Silicon.zip#arm64')
  assert.equal(parsedMac.files[1].sha512, sha512('mac-arm64'))
  const macArmUrl = new URL(parsedMac.files[1].url, 'https://example.test/release/')
  assert.equal(macArmUrl.pathname, '/release/Hermes-Vietnamese-macOS-Apple-Silicon.zip')
  assert.equal(macArmUrl.hash, '#arm64')
  const resolvedMacFiles = parsedMac.files.map(file => ({
    info: file,
    url: new URL(file.url, 'https://example.test/release/')
  }))
  assert.equal(MacUpdater.filterFilesForArch(resolvedMacFiles, true)[0].info.url, parsedMac.files[1].url)
  assert.equal(MacUpdater.filterFilesForArch(resolvedMacFiles, false)[0].info.url, parsedMac.files[0].url)

  const linuxArm = fs.readFileSync(path.join(directory, 'latest-linux-arm64.yml'), 'utf8')
  assert.match(linuxArm, /url: 'Hermes-Vietnamese-Linux-arm64\.AppImage'/)
  assert.doesNotMatch(linuxArm, /Linux-x64/)

  const firstPass = Object.fromEntries(outputs.map(file => [path.basename(file), fs.readFileSync(file, 'utf8')]))
  generateCommunityUpdateMetadata({ directory, releaseDate: '2026-08-19T08:00:00Z', tag: 'vi-v0.20.4-35' })
  const secondPass = Object.fromEntries(outputs.map(file => [path.basename(file), fs.readFileSync(file, 'utf8')]))
  assert.deepEqual(secondPass, firstPass)
})

test('refuses incomplete artifact sets and invalid community tags', () => {
  const directory = fixture()
  writeArtifact(directory, 'Hermes-Vietnamese-Windows-x64-Setup.exe', 'only-one-file')

  assert.throws(
    () =>
      generateCommunityUpdateMetadata({
        directory,
        releaseDate: '2026-08-19T08:00:00Z',
        tag: 'vi-v0.20.4-35'
      }),
    /Missing normalized update artifact/
  )
  assert.throws(
    () =>
      generateCommunityUpdateMetadata({
        directory,
        releaseDate: '2026-08-19T08:00:00Z',
        tag: 'v0.20.4'
      }),
    /release tag must be vi-vX\.Y\.Z-N/
  )
})
