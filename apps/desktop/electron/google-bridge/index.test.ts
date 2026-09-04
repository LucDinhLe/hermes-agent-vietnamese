import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import { GOOGLE_ACCOUNT_FILE, GOOGLE_BRIDGE_FILE, GoogleBridge, preferredBridgePort } from './index'

const codec = { encrypt: (s: string) => `enc:${Buffer.from(s).toString('base64')}`, decrypt: (s: string) => Buffer.from(s.slice(4), 'base64').toString() }

function fakeBackend(): Promise<{ baseUrl: string; token: string; calls: { method: string; url: string; body: unknown }[]; close(): void }> {
  const calls: { method: string; url: string; body: unknown }[] = []

  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        if (req.headers.authorization !== 'Bearer TOK') {
          res.writeHead(401).end()

          return
        }

        calls.push({ method: req.method ?? '', url: req.url ?? '', body: body ? JSON.parse(body) : null })
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ baseUrl: `http://127.0.0.1:${port}`, token: 'TOK', calls, close: () => server.close() })
    })
  })
}

test('preferredBridgePort: ổn định theo thư mục, trong 47000–47999', () => {
  const p = preferredBridgePort('/x/hermes-vietnamese')
  assert.equal(p, preferredBridgePort('/x/hermes-vietnamese'))
  assert.ok(p >= 47000 && p < 48000)
})

test('GoogleBridge: chưa đăng nhập → không chạy server; đã đăng nhập → server + đăng ký endpoint vào lõi; signOut xoá cả hai', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-'))
  const backend = await fakeBackend()
  const logs: string[] = []

  const deps = {
    hermesHome: home,
    secrets: codec,
    openExternal: async () => {},
    fetch,
    log: (m: string) => logs.push(m),
    backend: () => backend
  }

  const b1 = new GoogleBridge(deps)
  await b1.ensureRunning()
  assert.equal(b1.status().signedIn, false)
  assert.equal(b1.status().serverPort, null)
  assert.ok(fs.existsSync(path.join(home, GOOGLE_BRIDGE_FILE)), 'cổng + khoá được ghi ngay')

  // giả lập đã đăng nhập: ghi state qua chính codec
  const state = { tokens: { access_token: 'AT', refresh_token: 'RT', expiry_date: Number.MAX_SAFE_INTEGER, email: 'a@b.c' }, project: 'p', tier: 'standard-tier' }
  fs.writeFileSync(path.join(home, GOOGLE_ACCOUNT_FILE), JSON.stringify({ v: 1, data: codec.encrypt(JSON.stringify(state)) }))

  const b2 = new GoogleBridge(deps)
  await b2.ensureRunning()
  const st = b2.status()
  assert.equal(st.signedIn, true)
  assert.equal(st.email, 'a@b.c')
  assert.equal(st.serverPort, JSON.parse(fs.readFileSync(path.join(home, GOOGLE_BRIDGE_FILE), 'utf8')).port)
  assert.equal(backend.calls.length, 1)
  assert.equal(backend.calls[0].url, '/api/providers/custom-endpoints')
  const reg = backend.calls[0].body as { id: string; base_url: string; api_key: string; model: string; models: string[] }
  assert.equal(reg.id, 'google-account')
  assert.equal(reg.base_url, `http://127.0.0.1:${st.serverPort}/v1`)
  assert.equal(reg.model, 'gemini-2.5-pro')
  assert.ok(reg.models.length > 3)

  await b2.ensureRunning()
  assert.equal(backend.calls.length, 1, 'gọi lại không đăng ký trùng')

  // máy chủ thật trả lời /v1/models với khoá đã đăng ký
  const models = await fetch(`${reg.base_url}/models`, { headers: { authorization: `Bearer ${reg.api_key}` } })
  assert.equal(models.status, 200)

  await b2.signOut()
  assert.equal(b2.status().signedIn, false)
  assert.equal(b2.status().serverPort, null)
  assert.ok(!fs.existsSync(path.join(home, GOOGLE_ACCOUNT_FILE)))
  assert.equal(backend.calls[backend.calls.length - 1].method, 'DELETE')
  assert.equal(backend.calls[backend.calls.length - 1].url, '/api/providers/custom-endpoints/google-account')

  backend.close()
})
