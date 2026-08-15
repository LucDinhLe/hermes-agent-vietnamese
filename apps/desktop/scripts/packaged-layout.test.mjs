import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

import { isMacDmgArtifactName, packagedAppDirectoryName } from './packaged-layout.mjs'

test('matches electron-builder unpacked directory names for supported release targets', () => {
  assert.equal(packagedAppDirectoryName('win32', 'x64'), 'win-unpacked')
  assert.equal(packagedAppDirectoryName('win32', 'arm64'), 'win-arm64-unpacked')
  assert.equal(packagedAppDirectoryName('darwin', 'x64'), 'mac')
  assert.equal(packagedAppDirectoryName('darwin', 'arm64'), 'mac-arm64')
  assert.equal(packagedAppDirectoryName('linux', 'x64'), 'linux-unpacked')
  assert.equal(packagedAppDirectoryName('linux', 'arm64'), 'linux-arm64-unpacked')
})

test('fails closed for release targets outside the supported matrix', () => {
  assert.throws(() => packagedAppDirectoryName('freebsd', 'x64'), /Unsupported packaged-app platform/)
  assert.throws(() => packagedAppDirectoryName('linux', 'ia32'), /Unsupported packaged-app architecture/)
})

test('finds release-version override DMGs without rebuilding the packaged app', () => {
  assert.equal(isMacDmgArtifactName('Hermes-0.20.0-vi.19-mac-arm64.dmg', 'arm64'), true)
  assert.equal(isMacDmgArtifactName('Hermes-0.20.0-vi.19-mac-x64.dmg', 'x64'), true)
  assert.equal(isMacDmgArtifactName('Hermes-0.20.0-vi.19-mac-x64.dmg.blockmap', 'x64'), false)
  assert.equal(isMacDmgArtifactName('Hermes-0.20.0-vi.19-mac-x64.dmg', 'arm64'), false)
})

test('declares the project homepage required by Linux package metadata', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.homepage, 'https://github.com/LucDinhLe/hermes-agent-vietnamese')
})
