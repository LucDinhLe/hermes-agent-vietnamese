import { randomUUID } from 'node:crypto'

export const HERMES_PREVIEW_PARTITION = 'persist:hermes-preview'
export const MAX_COOKIE_COUNT = 500
export const MAX_COOKIE_FIELD_BYTES = 4096

export type SameSite = 'unspecified' | 'no_restriction' | 'lax' | 'strict'

export type TransferCookie = {
  name: string
  value: string
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  session: boolean
  expirationDate?: number
  sameSite: SameSite
  storeId: string
  partitionKey?: {
    topLevelSite?: string
    hasCrossSiteAncestor?: boolean
  }
}

export type CookieSetDetails = {
  url: string
  name: string
  value: string
  domain?: string
  path: string
  secure: boolean
  httpOnly: boolean
  expirationDate?: number
  sameSite: SameSite
}

export type StoredCookie = {
  name: string
  value: string
  domain?: string
  hostOnly?: boolean
  path?: string
  secure?: boolean
  httpOnly?: boolean
  expirationDate?: number
  sameSite: SameSite
  session?: boolean
}

export type CookieStore = {
  get(filter: { url: string; name?: string }): Promise<StoredCookie[]>
  set(details: CookieSetDetails): Promise<void>
  remove(url: string, name: string): Promise<void>
  flushStore(): Promise<void>
}

export type ImportedCookieIdentity = {
  name: string
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  url: string
}

export type CookieImportRecord = {
  id: string
  hostname: string
  cookieCount: number
  importedAt: number
  persistentUntil?: number
  cookies: ImportedCookieIdentity[]
}

export type CookieImportSummary = Omit<CookieImportRecord, 'cookies'> & {
  skippedExpired: number
  skippedUnsupported: number
  sessionCount: number
}

export type CookieImportLedger = {
  list(): Promise<CookieImportRecord[]>
  replace(records: CookieImportRecord[]): Promise<void>
}

export class ConnectorCookieError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'ConnectorCookieError'
    this.code = code
  }
}

type ValidatedCookie = {
  details: CookieSetDetails
  identity: ImportedCookieIdentity
  session: boolean
}

type ValidatedTransfer = {
  hostname: string
  accepted: ValidatedCookie[]
  skippedExpired: number
  skippedUnsupported: number
  sessionCount: number
  persistentUntil?: number
}

const SAME_SITE_VALUES = new Set<SameSite>(['unspecified', 'no_restriction', 'lax', 'strict'])

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

function hasCookieNameSeparator(value: string): boolean {
  return [...value].some(character => {
    const codePoint = character.codePointAt(0) ?? 0

    return codePoint <= 31 || codePoint === 127 || character === ';' || character === ',' || /\s/u.test(character)
  })
}

function fail(code: string): never {
  throw new ConnectorCookieError(code)
}

function sourceUrl(rawUrl: string): URL {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return fail('INVALID_SOURCE_URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail('INVALID_SOURCE_URL')
  }

  parsed.username = ''
  parsed.password = ''
  parsed.search = ''
  parsed.hash = ''

  return parsed
}

function normalizedDomain(domain: string): string {
  const value = domain.trim().replace(/^\.+/u, '').toLowerCase()

  if (!value || value.length > 255 || value.includes('/') || value.includes(':') || value.endsWith('.')) {
    return fail('INVALID_COOKIE_DOMAIN')
  }

  return value
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function assertBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') {
    fail('INVALID_COOKIE_SCHEMA')
  }
}

function assertString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    fail('INVALID_COOKIE_SCHEMA')
  }
}

function validateCookie(
  raw: TransferCookie,
  source: URL,
  nowSeconds: number
): ValidatedCookie | 'expired' | 'unsupported' {
  if (!raw || typeof raw !== 'object') {
    fail('INVALID_COOKIE_SCHEMA')
  }

  assertString(raw.name)
  assertString(raw.value)
  assertString(raw.domain)
  assertString(raw.path)
  assertString(raw.storeId)
  assertBoolean(raw.hostOnly)
  assertBoolean(raw.secure)
  assertBoolean(raw.httpOnly)
  assertBoolean(raw.session)

  if (!SAME_SITE_VALUES.has(raw.sameSite)) {
    fail('INVALID_COOKIE_SCHEMA')
  }

  if (!raw.storeId.trim()) {
    fail('INVALID_COOKIE_STORE')
  }

  if (!raw.name || hasCookieNameSeparator(raw.name) || byteLength(raw.name) > MAX_COOKIE_FIELD_BYTES) {
    fail('INVALID_COOKIE_NAME')
  }

  if (byteLength(raw.value) > MAX_COOKIE_FIELD_BYTES) {
    fail('INVALID_COOKIE_VALUE')
  }

  if (!raw.path.startsWith('/') || raw.path.length > 2048) {
    fail('INVALID_COOKIE_PATH')
  }

  const domain = normalizedDomain(raw.domain)
  const hostname = source.hostname.toLowerCase()

  if ((raw.hostOnly && domain !== hostname) || (!raw.hostOnly && !domainMatches(hostname, domain))) {
    fail('COOKIE_DOMAIN_MISMATCH')
  }

  if (raw.secure && source.protocol !== 'https:') {
    fail('SECURE_COOKIE_ON_HTTP')
  }

  if (raw.sameSite === 'no_restriction' && !raw.secure) {
    fail('SAMESITE_NONE_REQUIRES_SECURE')
  }

  if (raw.name.startsWith('__Secure-') && (!raw.secure || source.protocol !== 'https:')) {
    fail('INVALID_SECURE_PREFIX')
  }

  if (
    raw.name.startsWith('__Host-') &&
    (!raw.secure || source.protocol !== 'https:' || !raw.hostOnly || raw.path !== '/')
  ) {
    fail('INVALID_HOST_PREFIX')
  }

  if (raw.partitionKey !== undefined) {
    return 'unsupported'
  }

  if (!raw.session) {
    if (typeof raw.expirationDate !== 'number' || !Number.isFinite(raw.expirationDate)) {
      fail('INVALID_COOKIE_EXPIRY')
    }

    if (raw.expirationDate <= nowSeconds) {
      return 'expired'
    }
  }

  const url = `${raw.secure ? 'https:' : source.protocol}//${hostname}${raw.path}`

  const details: CookieSetDetails = {
    url,
    name: raw.name,
    value: raw.value,
    path: raw.path,
    secure: raw.secure,
    httpOnly: raw.httpOnly,
    sameSite: raw.sameSite,
    ...(!raw.hostOnly ? { domain: `.${domain}` } : {}),
    ...(!raw.session ? { expirationDate: raw.expirationDate } : {})
  }

  return {
    details,
    session: raw.session,
    identity: {
      name: raw.name,
      domain,
      hostOnly: raw.hostOnly,
      path: raw.path,
      secure: raw.secure,
      url
    }
  }
}

export function validateCookieTransfer(
  rawUrl: string,
  cookies: TransferCookie[],
  nowMs = Date.now()
): ValidatedTransfer {
  const source = sourceUrl(rawUrl)

  if (!Array.isArray(cookies) || cookies.length === 0 || cookies.length > MAX_COOKIE_COUNT) {
    fail('INVALID_COOKIE_COUNT')
  }

  const accepted: ValidatedCookie[] = []
  const identities = new Set<string>()
  let skippedExpired = 0
  let skippedUnsupported = 0
  let sessionCount = 0
  let persistentUntil: number | undefined
  const nowSeconds = nowMs / 1000

  for (const raw of cookies) {
    const result = validateCookie(raw, source, nowSeconds)

    if (result === 'expired') {
      skippedExpired += 1

      continue
    }

    if (result === 'unsupported') {
      skippedUnsupported += 1

      continue
    }

    const key = JSON.stringify(result.identity)

    if (identities.has(key)) {
      fail('DUPLICATE_COOKIE_IDENTITY')
    }

    identities.add(key)
    accepted.push(result)

    if (result.session) {
      sessionCount += 1
    } else if (result.details.expirationDate !== undefined) {
      persistentUntil = Math.max(persistentUntil ?? 0, result.details.expirationDate)
    }
  }

  if (accepted.length === 0) {
    fail('NO_IMPORTABLE_COOKIES')
  }

  return {
    hostname: source.hostname.toLowerCase(),
    accepted,
    skippedExpired,
    skippedUnsupported,
    sessionCount,
    persistentUntil
  }
}

function domainsEqual(left?: string, right?: string): boolean {
  return (
    String(left ?? '')
      .replace(/^\.+/u, '')
      .toLowerCase() ===
    String(right ?? '')
      .replace(/^\.+/u, '')
      .toLowerCase()
  )
}

function matchesIdentity(cookie: StoredCookie, identity: ImportedCookieIdentity): boolean {
  return (
    cookie.name === identity.name &&
    domainsEqual(cookie.domain, identity.domain) &&
    Boolean(cookie.hostOnly) === identity.hostOnly &&
    (cookie.path ?? '/') === identity.path &&
    Boolean(cookie.secure) === identity.secure
  )
}

function restoreDetails(cookie: StoredCookie, identity: ImportedCookieIdentity): CookieSetDetails {
  return {
    url: identity.url,
    name: cookie.name,
    value: cookie.value,
    path: cookie.path ?? '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite,
    ...(!cookie.hostOnly && cookie.domain ? { domain: cookie.domain } : {}),
    ...(!cookie.session && cookie.expirationDate !== undefined ? { expirationDate: cookie.expirationDate } : {})
  }
}

async function priorCookie(store: CookieStore, cookie: ValidatedCookie): Promise<StoredCookie | undefined> {
  const existing = await store.get({ url: cookie.identity.url, name: cookie.identity.name })

  return existing.find(item => matchesIdentity(item, cookie.identity))
}

async function rollbackWrites(
  store: CookieStore,
  writes: Array<{ cookie: ValidatedCookie; previous?: StoredCookie }>
): Promise<void> {
  for (const write of [...writes].reverse()) {
    try {
      if (write.previous) {
        await store.set(restoreDetails(write.previous, write.cookie.identity))
      } else {
        await store.remove(write.cookie.identity.url, write.cookie.identity.name)
      }
    } catch {
      // The public error stays redacted. A failed rollback is reported by the
      // stable IMPORT_ROLLBACK_FAILED code below, never by serializing cookies.
      throw new ConnectorCookieError('IMPORT_ROLLBACK_FAILED')
    }
  }

  await store.flushStore()
}

export class CookieImportService {
  constructor(
    private readonly store: CookieStore,
    private readonly ledger: CookieImportLedger,
    private readonly clock: () => number = Date.now,
    private readonly idFactory: () => string = randomUUID
  ) {}

  async import(rawUrl: string, cookies: TransferCookie[]): Promise<CookieImportSummary> {
    const now = this.clock()
    const transfer = validateCookieTransfer(rawUrl, cookies, now)
    const writes: Array<{ cookie: ValidatedCookie; previous?: StoredCookie }> = []

    try {
      for (const cookie of transfer.accepted) {
        const previous = await priorCookie(this.store, cookie)
        await this.store.set(cookie.details)
        writes.push({ cookie, previous })
      }

      await this.store.flushStore()

      const record: CookieImportRecord = {
        id: this.idFactory(),
        hostname: transfer.hostname,
        cookieCount: transfer.accepted.length,
        importedAt: now,
        ...(transfer.persistentUntil !== undefined ? { persistentUntil: transfer.persistentUntil } : {}),
        cookies: transfer.accepted.map(item => item.identity)
      }

      const records = await this.ledger.list()
      await this.ledger.replace([...records, record])

      const { cookies: _privateCookies, ...summary } = record

      return {
        ...summary,
        skippedExpired: transfer.skippedExpired,
        skippedUnsupported: transfer.skippedUnsupported,
        sessionCount: transfer.sessionCount
      }
    } catch (error) {
      if (writes.length > 0) {
        await rollbackWrites(this.store, writes)
      }

      if (error instanceof ConnectorCookieError) {
        throw error
      }

      throw new ConnectorCookieError('COOKIE_IMPORT_FAILED')
    }
  }

  async list(): Promise<Array<Omit<CookieImportRecord, 'cookies'>>> {
    return (await this.ledger.list()).map(({ cookies: _privateCookies, ...record }) => record)
  }

  async revoke(importId: string): Promise<void> {
    const records = await this.ledger.list()
    const record = records.find(item => item.id === importId)

    if (!record) {
      fail('IMPORT_NOT_FOUND')
    }

    try {
      for (const identity of record.cookies) {
        const existing = await this.store.get({ url: identity.url, name: identity.name })

        if (existing.some(cookie => matchesIdentity(cookie, identity))) {
          await this.store.remove(identity.url, identity.name)
        }
      }

      await this.store.flushStore()
      await this.ledger.replace(records.filter(item => item.id !== importId))
    } catch {
      throw new ConnectorCookieError('COOKIE_REVOKE_FAILED')
    }
  }
}

export function createMemoryCookieLedger(initial: CookieImportRecord[] = []): CookieImportLedger {
  let records = structuredClone(initial)

  return {
    async list() {
      return structuredClone(records)
    },
    async replace(next) {
      records = structuredClone(next)
    }
  }
}
