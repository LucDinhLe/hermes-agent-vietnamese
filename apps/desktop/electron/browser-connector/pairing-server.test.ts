import assert from 'node:assert/strict'

import { afterEach, test } from 'vitest'

import type { TransferCookie } from './cookie-import'
import {
  CONNECTOR_PROTOCOL,
  ConnectorPairingError,
  ConnectorPairingServer,
  type ExtensionPreview
} from './pairing-server'

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop'
const NOW = 1_800_000_000_000
const servers: ConnectorPairingServer[] = []

function cookie(): TransferCookie {
  return {
    name: 'session',
    value: 'fixture-value',
    domain: 'app.example.com',
    hostOnly: true,
    path: '/',
    secure: true,
    httpOnly: true,
    session: false,
    expirationDate: NOW / 1000 + 3600,
    sameSite: 'lax',
    storeId: '0'
  }
}

function parseCode(code: string): { endpoint: string; secret: string } {
  const [port, secret] = code.split('.')

  return { endpoint: `http://127.0.0.1:${port}`, secret }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { Origin: ORIGIN, 'X-Hermes-Connector': '1', ...extra }
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

function preview(patch: Partial<ExtensionPreview> = {}) {
  return {
    protocol: CONNECTOR_PROTOCOL,
    browser: 'chrome',
    hostname: 'app.example.com',
    cookieCount: 1,
    unsupportedCount: 0,
    expiredCount: 0,
    sessionCount: 0,
    earliestExpiry: NOW / 1000 + 3600,
    latestExpiry: NOW / 1000 + 3600,
    ...patch
  }
}

async function pair(server: ConnectorPairingServer, previewPatch: Partial<ExtensionPreview> = {}) {
  const started = await server.start('https://app.example.com/account?private=removed')
  const { endpoint, secret } = parseCode(started.pairingCode)

  const response = await fetch(`${endpoint}/v1/pair`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': secret }),
    body: JSON.stringify(preview(previewPatch))
  })

  return { started, endpoint, secret, response, body: await jsonResponse(response) }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.cancel()))
})

test('binds to loopback and completes two-sided one-time transfer', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
  servers.push(server)
  const paired = await pair(server)

  assert.equal(paired.response.status, 200)
  assert.equal(server.snapshot().state, 'preview')
  assert.equal(server.snapshot().preview?.hostname, 'app.example.com')

  server.approve(paired.started.attemptId)

  const statusResponse = await fetch(`${paired.endpoint}/v1/status?attemptId=${paired.started.attemptId}`, {
    headers: headers({ Authorization: `Bearer ${paired.body.receiptToken}` })
  })

  const status = await jsonResponse(statusResponse)
  assert.equal(statusResponse.status, 200)

  const transferResponse = await fetch(`${paired.endpoint}/v1/transfer`, {
    method: 'POST',
    headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ protocol: CONNECTOR_PROTOCOL, hostname: 'app.example.com', cookies: [cookie()] })
  })

  assert.equal(transferResponse.status, 200)
  assert.equal((await server.waitForTransfer(paired.started.attemptId)).cookies.length, 1)
  assert.equal(server.consume(paired.started.attemptId).cookies[0].value, 'fixture-value')
  await server.complete(paired.started.attemptId)
})

test('rejects wrong origin, wrong token and pairing replay', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
  servers.push(server)
  const started = await server.start('https://app.example.com/')
  const { endpoint, secret } = parseCode(started.pairingCode)

  const wrongOrigin = await fetch(`${endpoint}/v1/pair`, {
    method: 'POST',
    headers: {
      ...headers({ 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': secret }),
      Origin: 'https://evil.example'
    },
    body: JSON.stringify(preview())
  })

  assert.equal(wrongOrigin.status, 403)

  const wrongToken = await fetch(`${endpoint}/v1/pair`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': 'wrong' }),
    body: JSON.stringify(preview())
  })

  assert.equal((await jsonResponse(wrongToken)).error, 'PAIRING_CODE_REJECTED')

  const valid = await fetch(`${endpoint}/v1/pair`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': secret }),
    body: JSON.stringify(preview())
  })

  assert.equal(valid.status, 200)

  const replay = await fetch(`${endpoint}/v1/pair`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': secret }),
    body: JSON.stringify(preview())
  })

  assert.equal((await jsonResponse(replay)).error, 'PAIRING_CODE_REPLAYED')
})

test('does not expose an upload token before desktop approval', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
  servers.push(server)
  const paired = await pair(server)

  const response = await fetch(`${paired.endpoint}/v1/status?attemptId=${paired.started.attemptId}`, {
    headers: headers({ Authorization: `Bearer ${paired.body.receiptToken}` })
  })

  const body = await jsonResponse(response)
  assert.equal(response.status, 202)
  assert.equal(body.state, 'preview')
  assert.equal(body.transferToken, undefined)
})

test('rejects transfer replay and a payload that differs from the approved preview', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
  servers.push(server)
  const paired = await pair(server)
  server.approve(paired.started.attemptId)

  const status = await jsonResponse(
    await fetch(`${paired.endpoint}/v1/status?attemptId=${paired.started.attemptId}`, {
      headers: headers({ Authorization: `Bearer ${paired.body.receiptToken}` })
    })
  )

  const mismatch = await fetch(`${paired.endpoint}/v1/transfer`, {
    method: 'POST',
    headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      protocol: CONNECTOR_PROTOCOL,
      hostname: 'app.example.com',
      cookies: [cookie(), { ...cookie(), name: 'extra' }]
    })
  })

  assert.equal((await jsonResponse(mismatch)).error, 'TRANSFER_PREVIEW_MISMATCH')

  const valid = await fetch(`${paired.endpoint}/v1/transfer`, {
    method: 'POST',
    headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ protocol: CONNECTOR_PROTOCOL, hostname: 'app.example.com', cookies: [cookie()] })
  })

  assert.equal(valid.status, 200)

  const replay = await fetch(`${paired.endpoint}/v1/transfer`, {
    method: 'POST',
    headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ protocol: CONNECTOR_PROTOCOL, hostname: 'app.example.com', cookies: [cookie()] })
  })

  assert.equal((await jsonResponse(replay)).error, 'TRANSFER_TOKEN_REPLAYED')
})

for (const fixture of [
  {
    name: 'partitioned',
    preview: { unsupportedCount: 1 },
    unsafeCookie: { ...cookie(), name: 'partitioned', partitionKey: { topLevelSite: 'https://top.example' } }
  },
  {
    name: 'expired',
    preview: { expiredCount: 1 },
    unsafeCookie: { ...cookie(), name: 'expired', expirationDate: NOW / 1000 - 1 }
  }
] as const) {
  test(`keeps ${fixture.name} counts in preview metadata but rejects that cookie from transfer`, async () => {
    const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
    servers.push(server)
    const paired = await pair(server, fixture.preview)
    server.approve(paired.started.attemptId)

    const status = await jsonResponse(
      await fetch(`${paired.endpoint}/v1/status?attemptId=${paired.started.attemptId}`, {
        headers: headers({ Authorization: `Bearer ${paired.body.receiptToken}` })
      })
    )

    const unsafeTransfer = await fetch(`${paired.endpoint}/v1/transfer`, {
      method: 'POST',
      headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        protocol: CONNECTOR_PROTOCOL,
        hostname: 'app.example.com',
        cookies: [cookie(), fixture.unsafeCookie]
      })
    })

    assert.equal((await jsonResponse(unsafeTransfer)).error, 'TRANSFER_PREVIEW_MISMATCH')

    const filteredTransfer = await fetch(`${paired.endpoint}/v1/transfer`, {
      method: 'POST',
      headers: headers({ Authorization: `Bearer ${status.transferToken}`, 'Content-Type': 'application/json' }),
      body: JSON.stringify({ protocol: CONNECTOR_PROTOCOL, hostname: 'app.example.com', cookies: [cookie()] })
    })

    assert.equal(filteredTransfer.status, 200)
    assert.equal((await server.waitForTransfer(paired.started.attemptId)).cookies.length, 1)
  })
}

test('expires and closes an unfinished pairing attempt', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), Date.now, 15)
  servers.push(server)
  const started = await server.start('https://app.example.com/')

  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(server.snapshot().state, 'expired')
  await assert.rejects(fetch(`${parseCode(started.pairingCode).endpoint}/v1/status`))
})

test('cancellation rejects a pending desktop wait without leaking payload details', async () => {
  const server = new ConnectorPairingServer(new Set([ORIGIN]), () => NOW)
  servers.push(server)
  const paired = await pair(server)
  const pending = server.waitForTransfer(paired.started.attemptId)

  await server.cancel()
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof ConnectorPairingError && error.code === 'PAIRING_CANCELLED'
  )
})
