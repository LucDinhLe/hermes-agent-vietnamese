import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  electronBuilderWindowsNsisPatchMarker,
  electronBuilderWindowsNsisPatchNeedle,
  hasCompleteElectronBuilderWindowsNsisPatch,
  patchElectronBuilderWindowsNsis,
} from './patch-electron-builder-windows-nsis.mjs'

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-electron-windows-nsis-patch-'))
  try {
    return run(tempDir)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('non-Windows platforms skip without requiring the patch target', () => {
  const result = patchElectronBuilderWindowsNsis({
    platform: 'linux',
    nsisTargetPath: path.join(os.tmpdir(), 'missing-NsisTarget.js'),
  })

  assert.equal(result, 'skipped-platform')
})

test('Windows fails closed when NsisTarget.js is missing', () => {
  withTempDir((tempDir) => {
    const missingPath = path.join(tempDir, 'NsisTarget.js')

    assert.throws(
      () => patchElectronBuilderWindowsNsis({ platform: 'win32', nsisTargetPath: missingPath }),
      /required electron-builder Windows NSIS patch target not found/,
    )
  })
})

test('Windows fails closed when NsisTarget.js has an unexpected shape', () => {
  withTempDir((tempDir) => {
    const nsisTargetPath = path.join(tempDir, 'NsisTarget.js')
    fs.writeFileSync(nsisTargetPath, 'module.exports = {}\n')

    assert.throws(
      () => patchElectronBuilderWindowsNsis({ platform: 'win32', nsisTargetPath }),
      /expected NsisTarget\.js shape not found/,
    )
    assert.equal(fs.readFileSync(nsisTargetPath, 'utf8'), 'module.exports = {}\n')
  })
})

test('Windows replaces unsigned bootstrap execution with the NSIS reader exactly once', () => {
  withTempDir((tempDir) => {
    const nsisTargetPath = path.join(tempDir, 'NsisTarget.js')
    fs.writeFileSync(nsisTargetPath, `before\n${electronBuilderWindowsNsisPatchNeedle}\nafter\n`)

    assert.equal(
      patchElectronBuilderWindowsNsis({ platform: 'win32', nsisTargetPath }),
      'applied',
    )
    const patchedSource = fs.readFileSync(nsisTargetPath, 'utf8')
    assert.equal(hasCompleteElectronBuilderWindowsNsisPatch(patchedSource), true)
    assert.match(patchedSource, new RegExp(electronBuilderWindowsNsisPatchMarker))
    assert.match(
      patchedSource,
      /else if \(process\.platform === "win32"\)[\s\S]*UninstallerReader\.exec\(installerPath, uninstallerPath\)/,
    )

    assert.equal(
      patchElectronBuilderWindowsNsis({ platform: 'win32', nsisTargetPath }),
      'already-applied',
    )
    assert.equal(fs.readFileSync(nsisTargetPath, 'utf8'), patchedSource)
  })
})

test('Windows rejects a forged idempotency marker without the complete patch', () => {
  withTempDir((tempDir) => {
    const nsisTargetPath = path.join(tempDir, 'NsisTarget.js')
    const corrupted = `// ${electronBuilderWindowsNsisPatchMarker}\nmodule.exports = {}\n`
    fs.writeFileSync(nsisTargetPath, corrupted)

    assert.throws(
      () => patchElectronBuilderWindowsNsis({ platform: 'win32', nsisTargetPath }),
      /marker is present but the patched shape is incomplete/,
    )
    assert.equal(fs.readFileSync(nsisTargetPath, 'utf8'), corrupted)
  })
})
