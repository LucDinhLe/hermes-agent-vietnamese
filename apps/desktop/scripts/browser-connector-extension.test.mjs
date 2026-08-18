import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { test } from 'vitest'

import {
  expectedExtensionId,
  extensionIdFromManifestKey,
  inspectConnectorSource,
  sourceDir
} from './build-connector-extension.mjs'

test('official connector is MV3, incognito-disabled and optional-permission only', async () => {
  const trust = await inspectConnectorSource()
  assert.equal(trust.manifestVersion, 3)
  assert.equal(trust.extensionId, expectedExtensionId)
  assert.deepEqual(trust.permissions, ['activeTab'])
  assert.deepEqual(trust.optionalPermissions, ['cookies'])
  assert.deepEqual(trust.optionalHostPermissions, ['http://*/*', 'https://*/*', 'http://127.0.0.1/*'])
  assert.match(trust.sha256, /^[a-f0-9]{64}$/u)
})

test('connector source has no all-urls default grant or sensitive browser APIs', async () => {
  const manifest = JSON.parse(await readFile(join(sourceDir, 'manifest.json'), 'utf8'))
  const source = await readFile(join(sourceDir, 'popup.js'), 'utf8')
  assert.equal(manifest.permissions.includes('<all_urls>'), false)
  assert.equal(extensionIdFromManifestKey(manifest.key), expectedExtensionId)
  assert.equal(JSON.stringify(manifest.permissions).includes('history'), false)
  assert.equal(JSON.stringify(manifest.permissions).includes('bookmarks'), false)
  assert.doesNotMatch(source, /localStorage|chrome\.history|chrome\.bookmarks|chrome\.passwords|console\./u)
  assert.match(source, /chrome\.cookies\.getAll\(\{ url: activeTab\.url, storeId \}\)/u)
  assert.match(source, /window\.addEventListener\('unload', clearSensitiveState\)/u)
})
