import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(import.meta.dirname, '..')
const patch = readFileSync(path.join(ROOT, 'patches', 'edition-receipt-packaging.patch'), 'utf8')

test('packaged desktop carries the immutable edition receipt beside its engine stamp', () => {
  assert.match(patch, /"from": "build\/edition-receipt\.json"/)
  assert.match(patch, /"to": "edition-receipt\.json"/)
  assert.match(patch, /"from": "build\/install-stamp\.json"/)
  assert.doesNotMatch(patch, /publish|artifactName|appId|executableName|schemes/)
})
