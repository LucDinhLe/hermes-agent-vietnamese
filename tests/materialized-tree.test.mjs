import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { sha256File } from '../scripts/lib/contracts.mjs'
import { verifyMaterializedFiles } from '../scripts/verify-materialized-tree.mjs'

test('materialized inventory detects any post-receipt byte change', () => {
  const tree = mkdtempSync(path.join(tmpdir(), 'hermes-v33-materialized-'))
  const relative = 'apps/desktop/example.txt'
  const target = path.join(tree, ...relative.split('/'))

  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, 'locked bytes', { encoding: 'utf8', flush: true })

  const receipt = {
    changedPaths: [relative, 'apps/desktop/build/edition-receipt.json'],
    materializedFiles: [{ path: relative, sha256: sha256File(target) }]
  }

  assert.equal(verifyMaterializedFiles(tree, receipt), 1)

  writeFileSync(target, 'mutated bytes', { encoding: 'utf8', flush: true })
  assert.throws(() => verifyMaterializedFiles(tree, receipt), /digest mismatch/)
})
