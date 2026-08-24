import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { test } from 'vitest'

import {
  expectedExtensionId,
  extensionIdFromManifestKey,
  inspectConnectorSource,
  sourceDir
} from './build-connector-extension.mjs'
import {
  cookiePermissionOrigins,
  hasAnyPermissionOrigin,
  readCookieTransferPreview,
  revocableCookiePermissionOrigins,
  revokeCookiePermissions
} from '../extensions/hermes-connector/cookie-transfer.js'

const NOW = 1_800_000_000_000
const LOOPBACK_ORIGIN = 'http://127.0.0.1/*'

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

function permissionsFixture({
  origins = [],
  namedPermissions = ['cookies'],
  containsOrigin,
  removeOrigin,
  removeNamedPermission
} = {}) {
  const grantedOrigins = new Set(origins)
  const grantedNamedPermissions = new Set(namedPermissions)
  const calls = { contains: [], removeOrigins: [], removeNamedPermissions: [], getAll: 0 }
  const state = { grantedOrigins, grantedNamedPermissions }

  return {
    calls,
    grantedNamedPermissions,
    grantedOrigins,
    api: {
      async contains(details) {
        calls.contains.push(structuredClone(details))
        if (details.origins) {
          return details.origins.every(origin =>
            containsOrigin ? containsOrigin(origin, state) : grantedOrigins.has(origin)
          )
        }
        return details.permissions.every(permission => grantedNamedPermissions.has(permission))
      },
      async remove(details) {
        if (details.origins) {
          const [origin] = details.origins
          calls.removeOrigins.push(origin)
          if (removeOrigin) return removeOrigin(origin, state)
          return grantedOrigins.delete(origin)
        }

        const [permission] = details.permissions
        calls.removeNamedPermissions.push(permission)
        if (removeNamedPermission) return removeNamedPermission(permission, state)
        return grantedNamedPermissions.delete(permission)
      },
      async getAll() {
        calls.getAll += 1
        return {
          origins: [...grantedOrigins],
          permissions: [...grantedNamedPermissions]
        }
      }
    }
  }
}

let popupImportSequence = 0

async function popupHarness({ cookieQuery, permissionFixture, permissionRequestResult = true }) {
  const makeElement = ({ hidden = false } = {}) => ({
    classList: { toggle() {} },
    dataset: {},
    disabled: false,
    focus() {},
    hidden,
    listeners: new Map(),
    textContent: '',
    value: '',
    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    }
  })
  const elements = new Map([
    ['#hostname', makeElement()],
    ['#status', makeElement()],
    ['#preview', makeElement({ hidden: true })],
    ['#cookie-count', makeElement()],
    ['#session-count', makeElement()],
    ['#unsupported-count', makeElement()],
    ['#expiry', makeElement()],
    ['#preview-button', makeElement()],
    ['#pair-form', makeElement({ hidden: true })],
    ['#pairing-code', makeElement()],
    ['#revoke-permission', makeElement({ hidden: true })]
  ])
  const submitButton = makeElement()
  const permissionRequests = []
  const fetchCalls = []
  const documentMock = {
    documentElement: { lang: '' },
    querySelector(selector) {
      return elements.get(selector)
    },
    querySelectorAll(selector) {
      if (selector === 'button')
        return [elements.get('#preview-button'), elements.get('#revoke-permission'), submitButton]
      return []
    }
  }
  const permissionsApi = {
    ...permissionFixture.api,
    async request(details) {
      permissionRequests.push(structuredClone(details))
      if (!permissionRequestResult) return false
      for (const origin of details.origins || []) permissionFixture.grantedOrigins.add(origin)
      for (const permission of details.permissions || []) {
        permissionFixture.grantedNamedPermissions.add(permission)
      }
      return true
    }
  }
  const chromeMock = {
    cookies: {
      async getAll(details) {
        return cookieQuery(details)
      },
      async getAllCookieStores() {
        return [{ id: '0', tabIds: [7] }]
      }
    },
    i18n: {
      getMessage(key) {
        return key
      },
      getUILanguage() {
        return 'en-US'
      }
    },
    permissions: permissionsApi,
    tabs: {
      async query() {
        return [{ id: 7, url: 'https://app.example.com:8443/account' }]
      }
    }
  }
  const replacements = {
    chrome: chromeMock,
    document: documentMock,
    fetch: async (...args) => {
      fetchCalls.push(args)
      return {
        ok: false,
        status: 500,
        async json() {
          return {}
        }
      }
    },
    navigator: { userAgent: 'Mozilla/5.0 Chrome/151.0.0.0' },
    window: { addEventListener() {} }
  }
  const priorDescriptors = new Map()
  for (const [name, value] of Object.entries(replacements)) {
    priorDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
  }

  try {
    const popupUrl = pathToFileURL(join(sourceDir, 'popup.js'))
    popupUrl.searchParams.set('test', String(++popupImportSequence))
    await import(popupUrl.href)
    await new Promise(resolve => setTimeout(resolve, 0))
  } catch (error) {
    for (const [name, descriptor] of priorDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
    throw error
  }

  return {
    elements,
    fetchCalls,
    permissionRequests,
    async dispatch(selector, type) {
      const listener = elements.get(selector).listeners.get(type)
      assert.ok(listener, `Missing ${type} listener for ${selector}`)
      await listener({ preventDefault() {} })
    },
    cleanup() {
      for (const [name, descriptor] of priorDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
      }
    }
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

test('cookie permission origins omit ports and cover secure and non-secure cookie origins', () => {
  assert.deepEqual(cookiePermissionOrigins('http://127.0.0.1:43131/protected/source'), [
    'http://127.0.0.1/*',
    'https://127.0.0.1/*'
  ])
  assert.deepEqual(cookiePermissionOrigins('https://app.example.com:8443/account'), [
    'http://app.example.com/*',
    'https://app.example.com/*'
  ])
  assert.deepEqual(cookiePermissionOrigins('https://[::1]:8443/account'), ['http://[::1]/*', 'https://[::1]/*'])
  assert.deepEqual(cookiePermissionOrigins('https://BÜCHER.example:8443/account'), [
    'http://xn--bcher-kva.example/*',
    'https://xn--bcher-kva.example/*'
  ])
})

test('permission lifecycle detects host-only partial and legacy grants', async () => {
  const url = 'http://127.0.0.1:43131/protected/source'
  const origins = cookiePermissionOrigins(url)
  const legacyOrigin = 'http://127.0.0.1:43131/*'
  const revocableOrigins = revocableCookiePermissionOrigins(url)

  assert.deepEqual(revocableOrigins, [...origins, legacyOrigin])

  for (const grantedOrigins of [[origins[0]], [origins[1]], [legacyOrigin]]) {
    const fixture = permissionsFixture({ origins: grantedOrigins, namedPermissions: [] })
    assert.equal(await hasAnyPermissionOrigin(fixture.api, revocableOrigins), true)
  }

  const none = permissionsFixture({ namedPermissions: [] })
  assert.equal(await hasAnyPermissionOrigin(none.api, revocableOrigins), false)
})

test('permission revoke is idempotent when targets and named permission are absent', async () => {
  const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
  const fixture = permissionsFixture({ namedPermissions: [] })

  await revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] })

  assert.deepEqual(fixture.calls.removeOrigins, [])
  assert.deepEqual(fixture.calls.removeNamedPermissions, [])
})

test('permission revoke removes partial current and legacy grants independently', async () => {
  const origins = revocableCookiePermissionOrigins('https://app.example.com:8443/account')
  const grantedOrigins = [origins[1], origins[2]]
  const fixture = permissionsFixture({ origins: grantedOrigins })

  await revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] })

  assert.deepEqual(fixture.calls.removeOrigins, grantedOrigins)
  assert.deepEqual(fixture.calls.removeNamedPermissions, ['cookies'])
  assert.equal(fixture.grantedOrigins.size, 0)
  assert.equal(fixture.grantedNamedPermissions.size, 0)
})

test('permission revoke accepts false results when final state proves concurrent removal', async () => {
  const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
  const fixture = permissionsFixture({
    origins: [origins[1]],
    removeOrigin(origin, state) {
      state.grantedOrigins.delete(origin)
      return false
    },
    removeNamedPermission(permission, state) {
      state.grantedNamedPermissions.delete(permission)
      return false
    }
  })

  await revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] })

  assert.equal(fixture.grantedOrigins.size, 0)
  assert.equal(fixture.grantedNamedPermissions.size, 0)
})

test.each(['false', 'no-op', 'throw'])(
  'permission revoke rejects %s host removal but attempts every target',
  async mode => {
    const origins = revocableCookiePermissionOrigins('https://app.example.com:8443/account')
    const fixture = permissionsFixture({
      origins,
      removeOrigin(origin, state) {
        if (origin !== origins[0]) return state.grantedOrigins.delete(origin)
        if (mode === 'throw') throw new Error('fixture removal failure')
        if (mode === 'no-op') return true
        return false
      }
    })

    await assert.rejects(
      revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] }),
      /COOKIE_PERMISSION_REVOKE_FAILED/u
    )

    assert.deepEqual(fixture.calls.removeOrigins, origins)
  }
)

test('permission revoke rejects when a broader overlapping grant keeps the target effective', async () => {
  const broadOrigin = 'https://*.example.com/*'
  const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
  const fixture = permissionsFixture({
    origins: [broadOrigin],
    containsOrigin(origin, state) {
      return state.grantedOrigins.has(origin) || (origin === origins[1] && state.grantedOrigins.has(broadOrigin))
    },
    removeOrigin() {
      return true
    }
  })

  await assert.rejects(
    revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] }),
    /COOKIE_PERMISSION_REVOKE_FAILED/u
  )

  assert.deepEqual(fixture.calls.removeOrigins, [origins[1]])
  assert.equal(fixture.grantedOrigins.has(broadOrigin), true)
})

test.each(['false', 'no-op', 'throw'])(
  'permission revoke rejects %s named-cookie removal and verifies final state',
  async mode => {
    const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
    const fixture = permissionsFixture({
      removeNamedPermission(permission, state) {
        if (mode === 'throw') throw new Error('fixture named removal failure')
        if (mode === 'no-op') return true
        return false
      }
    })

    await assert.rejects(
      revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] }),
      /COOKIE_PERMISSION_REVOKE_FAILED/u
    )

    assert.deepEqual(fixture.calls.removeNamedPermissions, ['cookies'])
    assert.equal(fixture.grantedNamedPermissions.has('cookies'), true)
  }
)

test('permission revoke removes named cookies when only loopback transport remains', async () => {
  const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
  const fixture = permissionsFixture({ origins: [origins[1], LOOPBACK_ORIGIN] })

  await revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] })

  assert.deepEqual([...fixture.grantedOrigins], [LOOPBACK_ORIGIN])
  assert.deepEqual(fixture.calls.removeNamedPermissions, ['cookies'])
  assert.equal(fixture.grantedNamedPermissions.has('cookies'), false)
})

test('permission revoke preserves named cookies when an unrelated source origin remains', async () => {
  const origins = revocableCookiePermissionOrigins('https://app.example.com/account')
  const unrelatedOrigin = 'https://other.example/*'
  const fixture = permissionsFixture({ origins: [origins[1], LOOPBACK_ORIGIN, unrelatedOrigin] })

  await revokeCookiePermissions(fixture.api, { origins, transportOrigins: [LOOPBACK_ORIGIN] })

  assert.deepEqual([...fixture.grantedOrigins], [LOOPBACK_ORIGIN, unrelatedOrigin])
  assert.deepEqual(fixture.calls.removeNamedPermissions, [])
  assert.equal(fixture.grantedNamedPermissions.has('cookies'), true)
})

test.each([
  {
    name: 'partition-aware query rejects',
    expectedStatus: 'previewFailed',
    async cookieQuery() {
      throw new Error('fixture query failure')
    }
  },
  {
    name: 'only expired and partitioned cookies remain',
    expectedStatus: 'noCookies',
    async cookieQuery() {
      return [
        cookie({ name: 'expired', session: false, expirationDate: 1 }),
        cookie({ name: 'partitioned', partitionKey: { topLevelSite: 'https://example.com' } })
      ]
    }
  }
])('popup exposes Revoke and holds no transfer state when $name', async ({ cookieQuery, expectedStatus }) => {
  const permissionFixture = permissionsFixture({ namedPermissions: [] })
  const harness = await popupHarness({ cookieQuery, permissionFixture })

  try {
    await harness.dispatch('#preview-button', 'click')

    assert.equal(harness.elements.get('#status').textContent, expectedStatus)
    assert.equal(harness.elements.get('#revoke-permission').hidden, false)
    assert.equal(harness.elements.get('#preview').hidden, true)
    assert.equal(harness.elements.get('#pair-form').hidden, true)

    harness.elements.get('#pairing-code').value = `43131.${'a'.repeat(32)}`
    await harness.dispatch('#pair-form', 'submit')
    assert.equal(harness.fetchCalls.length, 0)
  } finally {
    harness.cleanup()
  }
})

test('popup exposes Revoke for a host-only legacy grant without named cookies permission', async () => {
  const legacyOrigin = 'https://app.example.com:8443/*'
  const permissionFixture = permissionsFixture({ origins: [legacyOrigin], namedPermissions: [] })
  const harness = await popupHarness({
    async cookieQuery() {
      return []
    },
    permissionFixture
  })

  try {
    assert.equal(harness.elements.get('#revoke-permission').hidden, false)
  } finally {
    harness.cleanup()
  }
})

test('failed permission revoke clears and blocks the cached transfer payload', async () => {
  const permissionFixture = permissionsFixture({
    namedPermissions: [],
    removeOrigin() {
      return true
    }
  })
  const harness = await popupHarness({
    async cookieQuery() {
      return [cookie()]
    },
    permissionFixture
  })

  try {
    await harness.dispatch('#preview-button', 'click')
    assert.equal(harness.elements.get('#pair-form').hidden, false)

    harness.elements.get('#pairing-code').value = `43131.${'a'.repeat(32)}`
    await harness.dispatch('#revoke-permission', 'click')

    assert.equal(harness.elements.get('#status').textContent, 'permissionRevokeFailed')
    assert.equal(harness.elements.get('#pair-form').hidden, true)
    assert.equal(harness.elements.get('#pairing-code').value, '')
    assert.equal(harness.elements.get('#revoke-permission').hidden, false)

    await harness.dispatch('#pair-form', 'submit')
    assert.equal(harness.fetchCalls.length, 0)
  } finally {
    harness.cleanup()
  }
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
