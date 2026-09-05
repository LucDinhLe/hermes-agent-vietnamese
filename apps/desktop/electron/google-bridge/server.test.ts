import assert from 'node:assert/strict'

import { afterAll, beforeAll, test } from 'vitest'

import { GOOGLE_BRIDGE_MODELS, type GoogleBridgeServer, startGoogleBridgeServer } from './server'

let server: GoogleBridgeServer
let signedIn = true
let lastCall: { model: string; request: unknown } | null = null
let fail: Error | null = null

const account = {
  get signedIn() {
    return signedIn
  },
  async *streamGenerate(model: string, request: unknown, _signal?: AbortSignal) {
    lastCall = { model, request }

    if (fail) {
      throw fail
    }

    yield { candidates: [{ content: { parts: [{ text: 'Xin ' }] } }] }
    yield {
      candidates: [{ content: { parts: [{ text: 'chào' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 }
    }
  }
}

beforeAll(async () => {
  server = await startGoogleBridgeServer({ account })
})

afterAll(async () => {
  await server.close()
})

function call(path: string, init: RequestInit & { auth?: string } = {}) {
  return fetch(`http://127.0.0.1:${server.port}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${init.auth ?? server.apiKey}`,
      ...(init.headers ?? {})
    }
  })
}

test('từ chối khi thiếu/sai khoá; /v1/models liệt kê model Gemini', async () => {
  assert.equal((await call('/v1/models', { auth: 'sai' })).status, 401)
  const res = await call('/v1/models')
  assert.equal(res.status, 200)
  const body = (await res.json()) as { data: { id: string }[] }
  assert.deepEqual(
    body.data.map(m => m.id),
    GOOGLE_BRIDGE_MODELS
  )
})

test('chat completions không stream: dịch request, gộp chunk', async () => {
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'hi' }
      ]
    })
  })

  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    choices: { message: { content: string }; finish_reason: string }[]
    usage: { total_tokens: number }
    model: string
  }
  assert.equal(body.model, 'gemini-2.5-flash')
  assert.equal(body.choices[0].message.content, 'Xin chào')
  assert.equal(body.choices[0].finish_reason, 'stop')
  assert.equal(body.usage.total_tokens, 5)
  assert.equal(lastCall?.model, 'gemini-2.5-flash')
  assert.deepEqual((lastCall?.request as { systemInstruction: unknown }).systemInstruction, {
    role: 'user',
    parts: [{ text: 'S' }]
  })
})

test('chat completions stream: SSE chunk OpenAI, kết thúc bằng [DONE]', async () => {
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: '', messages: [{ role: 'user', content: 'hi' }], stream: true })
  })

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/)
  const text = await res.text()
  const events = text.split('\n\n').filter(Boolean)
  assert.equal(events[events.length - 1], 'data: [DONE]')
  const chunks = events
    .slice(0, -1)
    .map(
      e =>
        JSON.parse(e.slice(6)) as {
          model: string
          choices: { delta: { content?: string }; finish_reason: string | null }[]
          usage?: unknown
        }
    )
  assert.equal(chunks[0].model, 'gemini-2.5-pro', 'model rỗng → mặc định')
  assert.equal(chunks.map(c => c.choices[0].delta.content ?? '').join(''), 'Xin chào')
  assert.equal(chunks[chunks.length - 1].choices[0].finish_reason, 'stop')
  assert.ok(chunks[chunks.length - 1].usage)
})

test('lỗi: chưa đăng nhập → 401; JSON hỏng → 400; Code Assist HTTP 429 → 429', async () => {
  signedIn = false
  assert.equal((await call('/v1/chat/completions', { method: 'POST', body: '{"messages":[]}' })).status, 401)
  signedIn = true

  assert.equal((await call('/v1/chat/completions', { method: 'POST', body: '{' })).status, 400)

  fail = new Error('Code Assist streamGenerateContent HTTP 429: quota')
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    body: '{"messages":[{"role":"user","content":"x"}]}'
  })
  assert.equal(res.status, 429)
  assert.match(((await res.json()) as { error: { message: string } }).error.message, /quota/)
  fail = null
})
