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
import { readCookieTransferPreview } from '../extensions/hermes-connector/cookie-transfer.js'

const NOW = 1_800_000_000_000

function cookie(patch = {}) {
  return {
    name: 'session-cookie',
    value: 'fixture-only',
    domain: 'app.example.com',
    hostOnly: true,
    path: '/',
    secure: true,
    httpOnly: true,
    session: true,
    sameSite: 'lax',
    storeId: '0',
    ...patch
  }
}

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
  const popupSource = await readFile(join(sourceDir, 'popup.js'), 'utf8')
  const transferSource = await readFile(join(sourceDir, 'cookie-transfer.js'), 'utf8')
  const source = `${popupSource}\n${transferSource}`

  assert.equal(manifest.permissions.includes('<all_urls>'), false)
  assert.equal(extensionIdFromManifestKey(manifest.key), expectedExtensionId)
  assert.equal(JSON.stringify(manifest.permissions).includes('history'), false)
  assert.equal(JSON.stringify(manifest.permissions).includes('bookmarks'), false)
  assert.doesNotMatch(source, /localStorage|chrome\.history|chrome\.bookmarks|chrome\.passwords|console\./u)
  assert.match(popupSource, /window\.addEventListener\('unload', clearSensitiveState\)/u)
})

test('preview observes partitioned cookies but transfers only live unpartitioned cookies', async () => {
  const calls = []
  const cookies = {
    async getAll(details) {
      calls.push(structuredClone(details))

      return [
        cookie(),
        cookie({
          name: 'runtime-null-cookie',
          partitionKey: null
        }),
        cookie({
          name: 'persistent-cookie',
          session: false,
          expirationDate: NOW / 1000 + 3600
        }),
        cookie({
          name: 'expired-cookie',
          session: false,
          expirationDate: NOW / 1000 - 1
        }),
        cookie({
          name: 'partitioned-cookie',
          partitionKey: { topLevelSite: 'https://example.com' }
        })
      ]
    }
  }

  const summary = await readCookieTransferPreview(cookies, {
    url: 'https://app.example.com/account',
    storeId: '0',
    userAgent: 'Mozilla/5.0 Chrome/151.0.0.0',
    nowMs: NOW
  })

  assert.deepEqual(calls, [
    {
      url: 'https://app.example.com/account',
      storeId: '0',
      partitionKey: {}
    }
  ])
  assert.deepEqual(
    summary.importable.map(item => item.name),
    ['session-cookie', 'runtime-null-cookie', 'persistent-cookie']
  )
  assert.equal(
    summary.importable.some(item => item.partitionKey !== undefined),
    false
  )
  assert.equal(
    summary.importable.some(item => Object.hasOwn(item, 'partitionKey')),
    false
  )
  assert.equal(
    summary.importable.some(item => item.name === 'expired-cookie'),
    false
  )
  assert.deepEqual(summary.preview, {
    protocol: 'hermes-cookie-transfer/1',
    browser: 'chrome',
    hostname: 'app.example.com',
    cookieCount: 3,
    unsupportedCount: 1,
    expiredCount: 1,
    sessionCount: 2,
    earliestExpiry: NOW / 1000 + 3600,
    latestExpiry: NOW / 1000 + 3600
  })
})

test('partition-aware preview fails closed without a fallback query', async () => {
  const calls = []
  const expected = new Error('partition-aware query unavailable')
  const cookies = {
    async getAll(details) {
      calls.push(structuredClone(details))
      throw expected
    }
  }

  await assert.rejects(
    readCookieTransferPreview(cookies, {
      url: 'https://app.example.com/account',
      storeId: '0',
      userAgent: 'Mozilla/5.0 Chrome/151.0.0.0',
      nowMs: NOW
    }),
    error => error === expected
  )
  assert.deepEqual(calls, [
    {
      url: 'https://app.example.com/account',
      storeId: '0',
      partitionKey: {}
    }
  ])
})
