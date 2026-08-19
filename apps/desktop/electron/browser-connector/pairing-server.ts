import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { ConnectorCookieError, type TransferCookie, validateCookieTransfer } from './cookie-import'

export const CONNECTOR_PROTOCOL = 'hermes-cookie-transfer/1'
export const DEFAULT_PAIRING_TTL_MS = 120_000
export const MAX_TRANSFER_BODY_BYTES = 2 * 1024 * 1024

export type ConnectorBrowser = 'chrome' | 'edge'
export type PairingState = 'pairing' | 'preview' | 'approved' | 'ready' | 'consumed' | 'cancelled' | 'expired'

export type ExtensionPreview = {
  browser: ConnectorBrowser
  hostname: string
  cookieCount: number
  unsupportedCount: number
  expiredCount: number
  sessionCount: number
  earliestExpiry?: number
  latestExpiry?: number
}

export type PairingSnapshot = {
  attemptId: string
  hostname: string
  expiresAt: number
  state: PairingState
  preview?: ExtensionPreview
}

export type TransferEnvelope = {
  protocol: typeof CONNECTOR_PROTOCOL
  hostname: string
  cookies: TransferCookie[]
}

type PairRequest = ExtensionPreview & {
  protocol: typeof CONNECTOR_PROTOCOL
}

type PairingAttempt = {
  id: string
  sourceUrl: string
  hostname: string
  port: number
  expectedHost: string
  expiresAt: number
  pairingSecretHash: Buffer
  receiptSecretHash?: Buffer
  transferSecret?: string
  transferSecretHash?: Buffer
  state: PairingState
  preview?: ExtensionPreview
  transfer?: TransferEnvelope
  transferPromise: Promise<TransferEnvelope>
  resolveTransfer: (payload: TransferEnvelope) => void
  rejectTransfer: (error: ConnectorPairingError) => void
}

export class ConnectorPairingError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'ConnectorPairingError'
    this.code = code
  }
}

function secret(): string {
  return randomBytes(24).toString('base64url')
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function secretMatches(candidate: string, expected?: Buffer): boolean {
  if (!candidate || !expected) {
    return false
  }

  return timingSafeEqual(digest(candidate), expected)
}

function bearer(request: IncomingMessage): string {
  const value = String(request.headers.authorization ?? '')

  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

function json(response: ServerResponse, status: number, body: unknown, origin?: string): void {
  const encoded = JSON.stringify(body)
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(encoded),
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {})
  })
  response.end(encoded)
}

function stableError(response: ServerResponse, status: number, code: string, origin?: string): void {
  json(response, status, { ok: false, error: code }, origin)
}

function parseNonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ConnectorPairingError(code)
  }

  return value
}

function parseOptionalEpoch(value: unknown, code: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ConnectorPairingError(code)
  }

  return value
}

function parsePreview(value: unknown): PairRequest {
  if (!value || typeof value !== 'object') {
    throw new ConnectorPairingError('INVALID_PAIR_REQUEST')
  }

  const raw = value as Record<string, unknown>

  if (raw.protocol !== CONNECTOR_PROTOCOL) {
    throw new ConnectorPairingError('UNSUPPORTED_PROTOCOL')
  }

  if (raw.browser !== 'chrome' && raw.browser !== 'edge') {
    throw new ConnectorPairingError('INVALID_BROWSER')
  }

  if (typeof raw.hostname !== 'string' || !raw.hostname) {
    throw new ConnectorPairingError('INVALID_HOSTNAME')
  }

  return {
    protocol: CONNECTOR_PROTOCOL,
    browser: raw.browser,
    hostname: raw.hostname.toLowerCase(),
    cookieCount: parseNonNegativeInteger(raw.cookieCount, 'INVALID_COOKIE_COUNT'),
    unsupportedCount: parseNonNegativeInteger(raw.unsupportedCount, 'INVALID_UNSUPPORTED_COUNT'),
    expiredCount: parseNonNegativeInteger(raw.expiredCount, 'INVALID_EXPIRED_COUNT'),
    sessionCount: parseNonNegativeInteger(raw.sessionCount, 'INVALID_SESSION_COUNT'),
    earliestExpiry: parseOptionalEpoch(raw.earliestExpiry, 'INVALID_EARLIEST_EXPIRY'),
    latestExpiry: parseOptionalEpoch(raw.latestExpiry, 'INVALID_LATEST_EXPIRY')
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers['content-length'] ?? 0)

  if (Number.isFinite(declaredLength) && declaredLength > MAX_TRANSFER_BODY_BYTES) {
    throw new ConnectorPairingError('BODY_TOO_LARGE')
  }

  const chunks: Buffer[] = []
  let length = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length

    if (length > MAX_TRANSFER_BODY_BYTES) {
      throw new ConnectorPairingError('BODY_TOO_LARGE')
    }

    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ConnectorPairingError('INVALID_JSON')
  }
}

function transferPreview(
  sourceUrl: string,
  payload: TransferEnvelope,
  nowMs: number
): Omit<ExtensionPreview, 'browser'> {
  let validated

  try {
    validated = validateCookieTransfer(sourceUrl, payload.cookies, nowMs)
  } catch (error) {
    if (error instanceof ConnectorCookieError) {
      throw new ConnectorPairingError('INVALID_COOKIE_TRANSFER')
    }

    throw error
  }

  const expiries = validated.accepted
    .map(cookie => cookie.details.expirationDate)
    .filter((value): value is number => value !== undefined)

  return {
    hostname: validated.hostname,
    cookieCount: validated.accepted.length,
    unsupportedCount: validated.skippedUnsupported,
    expiredCount: validated.skippedExpired,
    sessionCount: validated.sessionCount,
    ...(expiries.length > 0 ? { earliestExpiry: Math.min(...expiries), latestExpiry: Math.max(...expiries) } : {})
  }
}

function previewMatches(expected: ExtensionPreview, actual: Omit<ExtensionPreview, 'browser'>): boolean {
  return (
    expected.hostname === actual.hostname &&
    expected.cookieCount === actual.cookieCount &&
    expected.unsupportedCount === actual.unsupportedCount &&
    expected.expiredCount === actual.expiredCount &&
    expected.sessionCount === actual.sessionCount &&
    expected.earliestExpiry === actual.earliestExpiry &&
    expected.latestExpiry === actual.latestExpiry
  )
}

export class ConnectorPairingServer {
  private server: Server | undefined
  private attempt: PairingAttempt | undefined
  private expiryTimer: NodeJS.Timeout | undefined

  constructor(
    private readonly allowedOrigins: ReadonlySet<string>,
    private readonly clock: () => number = Date.now,
    private readonly ttlMs = DEFAULT_PAIRING_TTL_MS
  ) {}

  async start(rawUrl: string): Promise<PairingSnapshot & { pairingCode: string }> {
    await this.cancel()

    let parsed: URL

    try {
      parsed = new URL(rawUrl)
    } catch {
      throw new ConnectorPairingError('INVALID_SOURCE_URL')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ConnectorPairingError('INVALID_SOURCE_URL')
    }

    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''

    const pairingSecret = secret()
    let resolveTransfer!: (payload: TransferEnvelope) => void
    let rejectTransfer!: (error: ConnectorPairingError) => void

    const transferPromise = new Promise<TransferEnvelope>((resolve, reject) => {
      resolveTransfer = resolve
      rejectTransfer = reject
    })

    void transferPromise.catch(() => undefined)

    this.server = createServer((request, response) => {
      void this.handle(request, response)
    })

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject)
      this.server?.listen(0, '127.0.0.1', () => resolve())
    })

    const address = this.server.address()

    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
      await this.closeServer()
      throw new ConnectorPairingError('LOOPBACK_BIND_FAILED')
    }

    const now = this.clock()
    this.attempt = {
      id: randomUUID(),
      sourceUrl: parsed.toString(),
      hostname: parsed.hostname.toLowerCase(),
      port: address.port,
      expectedHost: `127.0.0.1:${address.port}`,
      expiresAt: now + this.ttlMs,
      pairingSecretHash: digest(pairingSecret),
      state: 'pairing',
      transferPromise,
      resolveTransfer,
      rejectTransfer
    }
    this.expiryTimer = setTimeout(() => void this.expire(), this.ttlMs)
    this.expiryTimer.unref()

    return { ...this.snapshot(), pairingCode: `${address.port}.${pairingSecret}` }
  }

  snapshot(): PairingSnapshot {
    const attempt = this.requireAttempt()
    this.expireIfNeeded(attempt)

    return {
      attemptId: attempt.id,
      hostname: attempt.hostname,
      expiresAt: attempt.expiresAt,
      state: attempt.state,
      ...(attempt.preview ? { preview: structuredClone(attempt.preview) } : {})
    }
  }

  approve(attemptId: string): void {
    const attempt = this.current(attemptId)

    if (attempt.state !== 'preview') {
      throw new ConnectorPairingError('PAIR_NOT_READY')
    }

    attempt.transferSecret = secret()
    attempt.transferSecretHash = digest(attempt.transferSecret)
    attempt.state = 'approved'
  }

  async waitForTransfer(attemptId: string): Promise<TransferEnvelope> {
    const attempt = this.current(attemptId)

    return attempt.transferPromise
  }

  consume(attemptId: string): TransferEnvelope {
    const attempt = this.current(attemptId)

    if (attempt.state !== 'ready' || !attempt.transfer) {
      throw new ConnectorPairingError('TRANSFER_NOT_READY')
    }

    const transfer = attempt.transfer
    attempt.transfer = undefined
    attempt.state = 'consumed'

    return transfer
  }

  async complete(attemptId: string): Promise<void> {
    const attempt = this.current(attemptId)

    if (attempt.state !== 'consumed') {
      throw new ConnectorPairingError('TRANSFER_NOT_CONSUMED')
    }

    this.scrubAttemptSecrets(attempt)
    await this.closeServer()
  }

  async cancel(): Promise<void> {
    if (this.attempt && !['consumed', 'cancelled', 'expired'].includes(this.attempt.state)) {
      this.attempt.state = 'cancelled'
      this.attempt.rejectTransfer(new ConnectorPairingError('PAIRING_CANCELLED'))
    }

    if (this.attempt) {
      this.attempt.transfer = undefined
      this.scrubAttemptSecrets(this.attempt)
    }

    await this.closeServer()
    this.attempt = undefined
  }

  private requireAttempt(): PairingAttempt {
    if (!this.attempt) {
      throw new ConnectorPairingError('NO_ACTIVE_PAIRING')
    }

    return this.attempt
  }

  private current(attemptId: string): PairingAttempt {
    const attempt = this.requireAttempt()
    this.expireIfNeeded(attempt)

    if (attempt.id !== attemptId) {
      throw new ConnectorPairingError('PAIRING_ATTEMPT_MISMATCH')
    }

    if (attempt.state === 'expired') {
      throw new ConnectorPairingError('PAIRING_EXPIRED')
    }

    if (attempt.state === 'cancelled') {
      throw new ConnectorPairingError('PAIRING_CANCELLED')
    }

    return attempt
  }

  private expireIfNeeded(attempt: PairingAttempt): void {
    if (this.clock() < attempt.expiresAt || ['consumed', 'cancelled', 'expired'].includes(attempt.state)) {
      return
    }

    void this.expire()
    throw new ConnectorPairingError('PAIRING_EXPIRED')
  }

  private async expire(): Promise<void> {
    const attempt = this.attempt

    if (!attempt || ['consumed', 'cancelled', 'expired'].includes(attempt.state)) {
      return
    }

    attempt.state = 'expired'
    attempt.transfer = undefined
    this.scrubAttemptSecrets(attempt)
    attempt.rejectTransfer(new ConnectorPairingError('PAIRING_EXPIRED'))
    await this.closeServer()
  }

  private async closeServer(): Promise<void> {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer)
    }

    this.expiryTimer = undefined

    const active = this.server
    this.server = undefined

    if (!active) {
      return
    }

    await new Promise<void>(resolve => active.close(() => resolve()))
  }

  private scrubAttemptSecrets(attempt: PairingAttempt): void {
    attempt.pairingSecretHash.fill(0)
    attempt.receiptSecretHash?.fill(0)
    attempt.transferSecretHash?.fill(0)
    attempt.transferSecret = undefined
  }

  private requestOrigin(request: IncomingMessage): string | undefined {
    const origin = String(request.headers.origin ?? '')

    return this.allowedOrigins.has(origin) ? origin : undefined
  }

  private requestAllowed(request: IncomingMessage, response: ServerResponse): string | undefined {
    const attempt = this.attempt
    const origin = this.requestOrigin(request)

    if (!attempt || request.headers.host !== attempt.expectedHost) {
      stableError(response, 403, 'REQUEST_REJECTED')

      return undefined
    }

    if (!origin) {
      stableError(response, 403, 'ORIGIN_REJECTED')

      return undefined
    }

    if (request.headers['x-hermes-connector'] !== '1') {
      stableError(response, 403, 'REQUEST_REJECTED', origin)

      return undefined
    }

    return origin
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method === 'OPTIONS') {
        const origin = this.requestOrigin(request)

        if (!origin) {
          stableError(response, 403, 'ORIGIN_REJECTED')

          return
        }

        response.writeHead(204, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type, x-hermes-connector, x-hermes-pairing-code',
          'Access-Control-Max-Age': '60',
          'Cache-Control': 'no-store',
          Vary: 'Origin'
        })
        response.end()

        return
      }

      const origin = this.requestAllowed(request, response)

      if (!origin) {
        return
      }

      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

      if (request.method === 'POST' && url.pathname === '/v1/pair') {
        await this.handlePair(request, response, origin)
      } else if (request.method === 'GET' && url.pathname === '/v1/status') {
        this.handleStatus(request, response, origin, url)
      } else if (request.method === 'POST' && url.pathname === '/v1/transfer') {
        await this.handleTransfer(request, response, origin)
      } else {
        stableError(response, 404, 'NOT_FOUND', origin)
      }
    } catch (error) {
      const code = error instanceof ConnectorPairingError ? error.code : 'REQUEST_FAILED'
      const status = code === 'BODY_TOO_LARGE' ? 413 : 400
      stableError(response, status, code, this.requestOrigin(request))
    }
  }

  private assertJson(request: IncomingMessage): void {
    if (
      !String(request.headers['content-type'] ?? '')
        .toLowerCase()
        .startsWith('application/json')
    ) {
      throw new ConnectorPairingError('CONTENT_TYPE_REQUIRED')
    }
  }

  private async handlePair(request: IncomingMessage, response: ServerResponse, origin: string): Promise<void> {
    const attempt = this.requireAttempt()
    this.expireIfNeeded(attempt)

    if (attempt.state !== 'pairing') {
      throw new ConnectorPairingError('PAIRING_CODE_REPLAYED')
    }

    if (!secretMatches(String(request.headers['x-hermes-pairing-code'] ?? ''), attempt.pairingSecretHash)) {
      throw new ConnectorPairingError('PAIRING_CODE_REJECTED')
    }

    this.assertJson(request)
    const preview = parsePreview(await readJsonBody(request))

    if (preview.hostname !== attempt.hostname) {
      throw new ConnectorPairingError('HOSTNAME_MISMATCH')
    }

    if (preview.cookieCount < 1 || preview.sessionCount > preview.cookieCount) {
      throw new ConnectorPairingError('INVALID_COOKIE_COUNT')
    }

    const receiptSecret = secret()
    attempt.receiptSecretHash = digest(receiptSecret)
    attempt.pairingSecretHash.fill(0)
    attempt.preview = preview
    attempt.state = 'preview'
    json(response, 200, { ok: true, attemptId: attempt.id, receiptToken: receiptSecret }, origin)
  }

  private handleStatus(request: IncomingMessage, response: ServerResponse, origin: string, url: URL): void {
    const attempt = this.requireAttempt()
    this.expireIfNeeded(attempt)

    if (
      url.searchParams.get('attemptId') !== attempt.id ||
      !secretMatches(bearer(request), attempt.receiptSecretHash)
    ) {
      throw new ConnectorPairingError('RECEIPT_REJECTED')
    }

    if (attempt.state !== 'approved' || !attempt.transferSecretHash) {
      json(response, 202, { ok: true, state: attempt.state }, origin)

      return
    }

    json(response, 200, { ok: true, state: 'approved', transferToken: attempt.transferSecret }, origin)
  }

  private async handleTransfer(request: IncomingMessage, response: ServerResponse, origin: string): Promise<void> {
    const attempt = this.requireAttempt()
    this.expireIfNeeded(attempt)

    if (attempt.state === 'ready' || attempt.state === 'consumed') {
      throw new ConnectorPairingError('TRANSFER_TOKEN_REPLAYED')
    }

    if (attempt.state !== 'approved') {
      throw new ConnectorPairingError('PAIR_NOT_APPROVED')
    }

    if (!secretMatches(bearer(request), attempt.transferSecretHash)) {
      throw new ConnectorPairingError('TRANSFER_TOKEN_REJECTED')
    }

    this.assertJson(request)
    const raw = (await readJsonBody(request)) as TransferEnvelope

    if (
      !raw ||
      raw.protocol !== CONNECTOR_PROTOCOL ||
      raw.hostname !== attempt.hostname ||
      !Array.isArray(raw.cookies)
    ) {
      throw new ConnectorPairingError('INVALID_TRANSFER')
    }

    const actualPreview = transferPreview(attempt.sourceUrl, raw, this.clock())

    if (!attempt.preview || !previewMatches(attempt.preview, actualPreview)) {
      throw new ConnectorPairingError('TRANSFER_PREVIEW_MISMATCH')
    }

    attempt.transferSecretHash?.fill(0)
    attempt.transferSecret = undefined
    attempt.transfer = raw
    attempt.state = 'ready'
    attempt.resolveTransfer(raw)
    json(response, 200, { ok: true }, origin)
  }
}
