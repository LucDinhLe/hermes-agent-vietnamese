import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  LOCAL_CANDIDATE_DERIVED_OUTPUTS,
  purgeLocalCandidateDerivedOutputs
} from './local-candidate-derived-outputs.mjs'

test('local candidate purge includes the complete electron-builder output root', () => {
  assert.ok(
    LOCAL_CANDIDATE_DERIVED_OUTPUTS.includes('apps/desktop/release'),
    'an interrupted NSIS installer, blockmap or update feed must never survive into a retry'
  )
})

test('local candidate purges every derived package-input root and preserves unrelated files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-local-candidate-derived-'))
  try {
    for (const relativePath of LOCAL_CANDIDATE_DERIVED_OUTPUTS) {
      const target = path.join(root, ...relativePath.split('/'))
      const decoy = path.extname(target) ? target : path.join(target, 'nested', 'evil-from-ignored-output.txt')
      fs.mkdirSync(path.dirname(decoy), { recursive: true })
      fs.writeFileSync(decoy, 'must not enter installer\n')
    }
    const preserved = path.join(root, 'apps', 'desktop', 'assets', 'icon.ico')
    fs.mkdirSync(path.dirname(preserved), { recursive: true })
    fs.writeFileSync(preserved, 'tracked input\n')

    const purged = purgeLocalCandidateDerivedOutputs(root)
    assert.equal(purged.length, LOCAL_CANDIDATE_DERIVED_OUTPUTS.length)
    for (const relativePath of LOCAL_CANDIDATE_DERIVED_OUTPUTS) {
      assert.equal(fs.existsSync(path.join(root, ...relativePath.split('/'))), false, relativePath)
    }
    assert.equal(fs.readFileSync(preserved, 'utf8'), 'tracked input\n')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('local candidate purge refuses an empty repository root', () => {
  assert.throws(() => purgeLocalCandidateDerivedOutputs(''), /repository root/i)
})
