import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AGENT_BROWSER_INPUT,
  NODE_INPUT,
  PAYLOAD_ITEMS,
  buildManifest
} from '../scripts/stage-resident-runtime.mjs'

test('resident payload manifest binds one candidate, engine, receipt, and every required item', () => {
  const manifest = buildManifest({
    candidate: 'V33-dev.7',
    engineCommit: '5fc308a70719a83cccdbba4c0e39c23f5a8239d5',
    receiptSha256: 'a'.repeat(64),
    builtAt: '2026-08-29T00:00:00.000Z'
  })

  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.candidate, 'V33-dev.7')
  assert.equal(manifest.engineCommit, '5fc308a70719a83cccdbba4c0e39c23f5a8239d5')
  assert.equal(manifest.editionReceiptSha256, 'a'.repeat(64))
  assert.deepEqual(Object.keys(manifest.items), PAYLOAD_ITEMS)
  assert.ok(Object.values(manifest.items).every(item => item.status === 'staged'))
  assert.match(NODE_INPUT.sha256, /^[0-9a-f]{64}$/)
  assert.match(AGENT_BROWSER_INPUT.integrity, /^sha512-/)
})
