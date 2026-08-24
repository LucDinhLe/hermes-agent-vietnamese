import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { assertEmptyEvidenceDirectory, assertEvidenceBoundary } from './host-boundary.mjs'

test('writable evidence mapping rejects a symlink or junction root and canonical overlap', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-boundary-test-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  const protectedRoot = path.join(root, 'protected')
  const evidenceTarget = path.join(protectedRoot, 'evidence')
  const directLink = path.join(root, 'direct-link')
  const parentAlias = path.join(root, 'parent-alias')
  fs.mkdirSync(evidenceTarget, { recursive: true })

  fs.symlinkSync(evidenceTarget, directLink, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => assertEmptyEvidenceDirectory(directLink), /link or junction/)

  fs.symlinkSync(protectedRoot, parentAlias, process.platform === 'win32' ? 'junction' : 'dir')
  const aliasedEvidence = path.join(parentAlias, 'evidence')
  assert.throws(() => assertEvidenceBoundary(aliasedEvidence, [protectedRoot]), /overlaps a protected host path/)
})
