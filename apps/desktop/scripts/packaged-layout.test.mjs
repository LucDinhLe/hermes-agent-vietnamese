import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

import { packagedAppDirectoryName } from './packaged-layout.mjs'

test('matches electron-builder unpacked directory names for supported release targets', () => {
  assert.equal(packagedAppDirectoryName('win32', 'x64'), 'win-unpacked')
  assert.equal(packagedAppDirectoryName('win32', 'arm64'), 'win-arm64-unpacked')
  assert.equal(packagedAppDirectoryName('darwin', 'arm64'), 'mac-arm64')
  assert.equal(packagedAppDirectoryName('linux', 'x64'), 'linux-unpacked')
  assert.equal(packagedAppDirectoryName('linux', 'arm64'), 'linux-arm64-unpacked')
})

test('fails closed for release targets outside the supported matrix', () => {
  assert.throws(() => packagedAppDirectoryName('freebsd', 'x64'), /Unsupported packaged-app platform/)
  assert.throws(() => packagedAppDirectoryName('linux', 'ia32'), /Unsupported packaged-app architecture/)
})

test('declares the project homepage required by Linux package metadata', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.homepage, 'https://github.com/LucDinhLe/hermes-agent-vietnamese')
})
