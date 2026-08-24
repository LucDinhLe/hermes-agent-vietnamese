import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  electronBuilderMacPatchMarker,
  electronBuilderMacPatchNeedle,
  patchElectronBuilderMacBinary,
} from './patch-electron-builder-mac-binary.mjs'

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-electron-mac-patch-'))
  try {
    return run(tempDir)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('non-macOS platforms skip without requiring the patch target', () => {
  const result = patchElectronBuilderMacBinary({
    platform: 'win32',
    electronMacPath: path.join(os.tmpdir(), 'missing-electronMac.js'),
  })

  assert.equal(result, 'skipped-platform')
})

test('macOS fails closed when electronMac.js is missing', () => {
  withTempDir((tempDir) => {
    const missingPath = path.join(tempDir, 'electronMac.js')

    assert.throws(
      () => patchElectronBuilderMacBinary({ platform: 'darwin', electronMacPath: missingPath }),
      /required electron-builder macOS patch target not found/,
    )
  })
})

test('macOS fails closed when electronMac.js has an unexpected shape', () => {
  withTempDir((tempDir) => {
    const electronMacPath = path.join(tempDir, 'electronMac.js')
    fs.writeFileSync(electronMacPath, 'module.exports = {}\n')

    assert.throws(
      () => patchElectronBuilderMacBinary({ platform: 'darwin', electronMacPath }),
      /expected electronMac\.js shape not found/,
    )
    assert.equal(fs.readFileSync(electronMacPath, 'utf8'), 'module.exports = {}\n')
  })
})

test('macOS applies the patch once and accepts its idempotency marker', () => {
  withTempDir((tempDir) => {
    const electronMacPath = path.join(tempDir, 'electronMac.js')
    fs.writeFileSync(electronMacPath, `before\n${electronBuilderMacPatchNeedle}\nafter\n`)

    assert.equal(
      patchElectronBuilderMacBinary({ platform: 'darwin', electronMacPath }),
      'applied',
    )
    const patchedSource = fs.readFileSync(electronMacPath, 'utf8')
    assert.match(patchedSource, new RegExp(electronBuilderMacPatchMarker))
    assert.doesNotMatch(patchedSource, /doRename\(path\.join\(contentsPath, "MacOS"\)/)

    assert.equal(
      patchElectronBuilderMacBinary({ platform: 'darwin', electronMacPath }),
      'already-applied',
    )
    assert.equal(fs.readFileSync(electronMacPath, 'utf8'), patchedSource)
  })
})
