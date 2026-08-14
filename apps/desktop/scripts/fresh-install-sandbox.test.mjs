import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import { freshInstallSandboxPrefix } from './fresh-install-sandbox.mjs'

test('uses the same stable LocalAppData storage class as a real Windows install', () => {
  const prefix = freshInstallSandboxPrefix({
    platform: 'win32',
    localAppData: 'C:\\Users\\Tester\\AppData\\Local',
    homeDir: 'C:\\Users\\Tester',
    tempDir: 'C:\\Users\\Tester\\AppData\\Local\\Temp'
  })

  assert.equal(
    prefix,
    path.join(
      'C:\\Users\\Tester\\AppData\\Local',
      'Hermes',
      'smoke-tests',
      'hermes-desktop-fresh-install-'
    )
  )
  assert.equal(prefix.includes(`${path.sep}Temp${path.sep}`), false)
})

test('derives a stable Windows location when LOCALAPPDATA is unavailable', () => {
  const prefix = freshInstallSandboxPrefix({
    platform: 'win32',
    localAppData: '',
    homeDir: 'C:\\Users\\Tester',
    tempDir: 'C:\\Windows\\Temp'
  })

  assert.equal(
    prefix,
    path.join(
      'C:\\Users\\Tester',
      'AppData',
      'Local',
      'Hermes',
      'smoke-tests',
      'hermes-desktop-fresh-install-'
    )
  )
})

test('continues to use the operating-system temp directory outside Windows', () => {
  const prefix = freshInstallSandboxPrefix({
    platform: 'linux',
    localAppData: '',
    homeDir: '/home/tester',
    tempDir: '/tmp'
  })

  assert.equal(prefix, path.join('/tmp', 'hermes-desktop-fresh-install-'))
})
