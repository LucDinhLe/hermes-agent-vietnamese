import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from 'vitest'

import {
  ConnectorCookieError,
  CookieImportService,
  type CookieSetDetails,
  type CookieStore,
  createMemoryCookieLedger,
  type StoredCookie,
  type TransferCookie,
  validateCookieTransfer
} from './cookie-import'
import { createFileCookieLedger } from './cookie-ledger'

const NOW = 1_800_000_000_000

function cookie(patch: Partial<TransferCookie> = {}): TransferCookie {
  return {
    name: 'session',
    value: 'test-value-not-a-real-secret',
    domain: 'app.example.com',
    hostOnly: true,
    path: '/',
    secure: true,
    httpOnly: true,
    session: false,
    expirationDate: NOW / 1000 + 3600,
    sameSite: 'lax',
    storeId: '0',
    ...patch
  }
}

class MemoryCookieStore implements CookieStore {
  readonly values: StoredCookie[] = []
  readonly setCalls: CookieSetDetails[] = []
  readonly removeCalls: Array<{ url: string; name: string }> = []
  flushCount = 0
  failSetAt = 0

  async get(filter: { url: string; name?: string }): Promise<StoredCookie[]> {
    return this.values.filter(item => !filter.name || item.name === filter.name)
  }

  async set(details: CookieSetDetails): Promise<void> {
    this.setCalls.push(structuredClone(details))

    if (this.failSetAt > 0 && this.setCalls.length === this.failSetAt) {
      throw new Error('sensitive upstream error')
    }

    const hostOnly = details.domain === undefined
    const domain = (details.domain ?? new URL(details.url).hostname).replace(/^\./u, '')

    const index = this.values.findIndex(
      item =>
        item.name === details.name &&
        item.domain?.replace(/^\./u, '') === domain &&
        Boolean(item.hostOnly) === hostOnly &&
        item.path === details.path &&
        Boolean(item.secure) === details.secure
    )

    const stored: StoredCookie = {
      name: details.name,
      value: details.value,
      domain,
      hostOnly,
      path: details.path,
      secure: details.secure,
      httpOnly: details.httpOnly,
      sameSite: details.sameSite,
      session: details.expirationDate === undefined,
      ...(details.expirationDate !== undefined ? { expirationDate: details.expirationDate } : {})
    }

    if (index >= 0) {
      this.values[index] = stored
    } else {
      this.values.push(stored)
    }
  }

  async remove(url: string, name: string): Promise<void> {
    this.removeCalls.push({ url, name })
    const index = this.values.findIndex(item => item.name === name)

    if (index >= 0) {
      this.values.splice(index, 1)
    }
  }

  async flushStore(): Promise<void> {
    this.flushCount += 1
  }
}

function errorCode(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof ConnectorCookieError)

    return error.code
  }

  assert.fail('expected ConnectorCookieError')
}

test('validates host-only, domain, session, HttpOnly and SameSite cookies', () => {
  const result = validateCookieTransfer(
    'https://app.example.com/account?private=ignored',
    [
      cookie(),
      cookie({ name: 'domain-cookie', domain: '.example.com', hostOnly: false, path: '/account' }),
      cookie({ name: 'session-cookie', session: true, expirationDate: undefined, httpOnly: false, sameSite: 'strict' })
    ],
    NOW
  )

  assert.equal(result.accepted.length, 3)
  assert.equal(result.sessionCount, 1)
  assert.equal(result.accepted[0].details.domain, undefined)
  assert.equal(result.accepted[0].details.httpOnly, true)
  assert.equal(result.accepted[1].details.domain, '.example.com')
  assert.equal(result.accepted[2].details.expirationDate, undefined)
  assert.equal(result.accepted[2].details.sameSite, 'strict')
  assert.equal(result.accepted[0].details.url.includes('?'), false)
})

test('skips expired and partitioned cookies without weakening partition isolation', () => {
  const result = validateCookieTransfer(
    'https://app.example.com/',
    [
      cookie(),
      cookie({ name: 'expired', expirationDate: NOW / 1000 - 1 }),
      cookie({ name: 'partitioned', partitionKey: { topLevelSite: 'https://top.example' } })
    ],
    NOW
  )

  assert.equal(result.accepted.length, 1)
  assert.equal(result.skippedExpired, 1)
  assert.equal(result.skippedUnsupported, 1)
})

test('rejects unrelated domains and invalid security invariants before any write', () => {
  assert.equal(
    errorCode(() => validateCookieTransfer('https://app.example.com/', [cookie({ domain: '.evil.example' })], NOW)),
    'COOKIE_DOMAIN_MISMATCH'
  )
  assert.equal(
    errorCode(() =>
      validateCookieTransfer(
        'https://app.example.com/',
        [cookie({ name: '__Host-session', hostOnly: false, domain: '.example.com' })],
        NOW
      )
    ),
    'INVALID_HOST_PREFIX'
  )
  assert.equal(
    errorCode(() =>
      validateCookieTransfer('https://app.example.com/', [cookie({ secure: false, sameSite: 'no_restriction' })], NOW)
    ),
    'SAMESITE_NONE_REQUIRES_SECURE'
  )
})

test('imports cookies, exposes metadata only and revokes ledger identities', async () => {
  const store = new MemoryCookieStore()
  const ledger = createMemoryCookieLedger()

  const service = new CookieImportService(
    store,
    ledger,
    () => NOW,
    () => 'import-1'
  )

  const summary = await service.import('https://app.example.com/', [
    cookie(),
    cookie({ name: 'partitioned', partitionKey: { topLevelSite: 'https://top.example' } })
  ])

  assert.deepEqual(summary, {
    id: 'import-1',
    hostname: 'app.example.com',
    cookieCount: 1,
    importedAt: NOW,
    persistentUntil: NOW / 1000 + 3600,
    skippedExpired: 0,
    skippedUnsupported: 1,
    sessionCount: 0
  })
  assert.equal(JSON.stringify(summary).includes('test-value'), false)
  assert.equal(store.values.length, 1)

  await service.revoke('import-1')
  assert.equal(store.values.length, 0)
  assert.deepEqual(await service.list(), [])
})

test('restores overwritten cookie if a later write fails', async () => {
  const store = new MemoryCookieStore()
  await store.set({
    url: 'https://app.example.com/',
    name: 'session',
    value: 'previous-value',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    expirationDate: NOW / 1000 + 7200
  })
  store.setCalls.length = 0
  store.failSetAt = 2

  const service = new CookieImportService(
    store,
    createMemoryCookieLedger(),
    () => NOW,
    () => 'unused'
  )

  await assert.rejects(
    service.import('https://app.example.com/', [cookie(), cookie({ name: 'second' })]),
    (error: unknown) => error instanceof ConnectorCookieError && error.code === 'COOKIE_IMPORT_FAILED'
  )
  assert.equal(store.values.find(item => item.name === 'session')?.value, 'previous-value')
  assert.equal(
    store.values.some(item => item.name === 'second'),
    false
  )
})

test('ledger writes metadata atomically without cookie values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-connector-ledger-'))
  const path = join(root, 'imports.json')
  const ledger = createFileCookieLedger(path)
  await ledger.replace([
    {
      id: 'import-1',
      hostname: 'app.example.com',
      cookieCount: 1,
      importedAt: NOW,
      cookies: [
        {
          name: 'session',
          domain: 'app.example.com',
          hostOnly: true,
          path: '/',
          secure: true,
          url: 'https://app.example.com/'
        }
      ]
    }
  ])

  const raw = await readFile(path, 'utf8')
  assert.equal(raw.includes('test-value-not-a-real-secret'), false)
  assert.equal((await ledger.list())[0].id, 'import-1')
})
