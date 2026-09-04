import assert from 'node:assert/strict'
import http from 'node:http'

import { test } from 'vitest'

import {
  buildAuthUrl,
  CODE_ASSIST_BASE,
  type FetchLike,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  GoogleAccount,
  type GoogleAccountState,
  pkcePair,
  sseLines,
  waitForLoopbackCode
} from './google-account'

type Call = { url: string; init?: Parameters<FetchLike>[1] }

function fakeFetch(handler: (url: string, init?: Parameters<FetchLike>[1]) => unknown | Promise<unknown>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = []

  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init })
    const out = await handler(url, init)

    if (out && typeof out === 'object' && '__status' in (out as Record<string, unknown>)) {
      const status = (out as { __status: number }).__status

      return { ok: false, status, text: async () => 'lỗi', json: async () => ({}) }
    }

    return { ok: true, status: 200, text: async () => JSON.stringify(out), json: async () => out }
  }

  return { fetch, calls }
}

function store(initial: GoogleAccountState | null = null) {
  let state = initial

  return { load: () => state, save: (s: GoogleAccountState | null) => { state = s }, get: () => state }
}

function getUrl(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    }).on('error', reject)
  })
}

test('pkcePair + buildAuthUrl: S256, offline, client id của Gemini CLI', () => {
  const { verifier, challenge } = pkcePair()
  assert.ok(verifier.length >= 43)
  const u = new URL(buildAuthUrl('http://127.0.0.1:1/oauth2callback', 'st', challenge))
  assert.equal(u.searchParams.get('code_challenge'), challenge)
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('state'), 'st')
  assert.match(u.searchParams.get('client_id') ?? '', /apps\.googleusercontent\.com$/)
})

test('waitForLoopbackCode: nhận mã đúng state qua 127.0.0.1, từ chối state sai, đóng server', async () => {
  const ok = await waitForLoopbackCode({
    state: 's1',
    challenge: 'c',
    timeoutMs: 5000,
    openExternal: async url => {
      const redirect = new URL(url).searchParams.get('redirect_uri') as string
      const bad = await getUrl(`${redirect}?state=wrong&code=x`)
      assert.equal(bad.status, 200)
      assert.match(bad.body, /không thành công/)
    }
  }).catch(e => e as Error)

  assert.ok(ok instanceof Error && /state/.test(ok.message))

  const good = await waitForLoopbackCode({
    state: 's2',
    challenge: 'c',
    timeoutMs: 5000,
    openExternal: async url => {
      const redirect = new URL(url).searchParams.get('redirect_uri') as string
      await getUrl(`${redirect}?state=s2&code=CODE123`)
    }
  })

  assert.equal(good.code, 'CODE123')
  assert.match(good.redirectUri, /^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/)
  await assert.rejects(getUrl(good.redirectUri), 'server phải đóng sau khi có mã')
})

test('signIn: đổi mã lấy token, lấy email, lưu state; thiếu refresh_token → lỗi', async () => {
  const s = store()

  const { fetch, calls } = fakeFetch(url => {
    if (url === GOOGLE_TOKEN_URL) {return { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }}

    if (url === GOOGLE_USERINFO_URL) {return { email: 'luc@example.com' }}

    throw new Error(`unexpected ${url}`)
  })

  const acct = new GoogleAccount({
    fetch,
    load: s.load,
    save: s.save,
    now: () => 1000,
    openExternal: async url => {
      const redirect = new URL(url).searchParams.get('redirect_uri') as string
      const state = new URL(url).searchParams.get('state') as string
      await getUrl(`${redirect}?state=${state}&code=AUTHCODE`)
    }
  })

  assert.equal(await acct.signIn({ timeoutMs: 5000 }), 'luc@example.com')
  assert.ok(acct.signedIn)
  assert.equal(acct.email, 'luc@example.com')
  assert.deepEqual(s.get()?.tokens, { access_token: 'AT', refresh_token: 'RT', expiry_date: 1000 + 3600_000, email: 'luc@example.com' })
  const body = new URLSearchParams(calls[0].init?.body ?? '')
  assert.equal(body.get('grant_type'), 'authorization_code')
  assert.equal(body.get('code'), 'AUTHCODE')
  assert.ok(body.get('code_verifier'))
  assert.match(body.get('redirect_uri') ?? '', /^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/)

  const noRefresh = new GoogleAccount({
    fetch: fakeFetch(() => ({ access_token: 'AT', expires_in: 3600 })).fetch,
    load: () => null,
    save: () => {},
    openExternal: async url => {
      const u = new URL(url)
      await getUrl(`${u.searchParams.get('redirect_uri')}?state=${u.searchParams.get('state')}&code=x`)
    }
  })

  await assert.rejects(noRefresh.signIn({ timeoutMs: 5000 }), /refresh token/)
})

test('accessToken: dùng token còn hạn; làm mới khi sắp hết và gộp các lần gọi song song; signOut xoá', async () => {
  let t = 0
  const s = store({ tokens: { access_token: 'OLD', refresh_token: 'RT', expiry_date: 10_000_000 }, project: null, tier: null })
  const { fetch, calls } = fakeFetch(() => ({ access_token: 'NEW', expires_in: 3600 }))
  const acct = new GoogleAccount({ fetch, load: s.load, save: s.save, now: () => t, openExternal: async () => {} })

  t = 1_000_000
  assert.equal(await acct.accessToken(), 'OLD')
  assert.equal(calls.length, 0)

  t = 9_900_000 // còn < 5 phút
  const [a, b] = await Promise.all([acct.accessToken(), acct.accessToken()])
  assert.equal(a, 'NEW')
  assert.equal(b, 'NEW')
  assert.equal(calls.length, 1, 'gộp song song thành một lần refresh')
  assert.equal(new URLSearchParams(calls[0].init?.body ?? '').get('grant_type'), 'refresh_token')
  assert.equal(s.get()?.tokens?.access_token, 'NEW')
  assert.equal(s.get()?.tokens?.refresh_token, 'RT', 'giữ refresh_token cũ khi Google không cấp mới')

  acct.signOut()
  assert.equal(s.get(), null)
  await assert.rejects(acct.accessToken(), /Chưa đăng nhập/)
})

test('ensureProject: người đã có tier → lấy project từ loadCodeAssist; người mới bậc miễn phí → onboardUser, project rỗng vẫn hợp lệ', async () => {
  const base = { tokens: { access_token: 'AT', refresh_token: 'RT', expiry_date: Number.MAX_SAFE_INTEGER }, project: null, tier: null }

  const s1 = store({ ...base })

  const f1 = fakeFetch(url => {
    if (url === `${CODE_ASSIST_BASE}:loadCodeAssist`) {return { currentTier: { id: 'standard-tier' }, cloudaicompanionProject: 'proj-1' }}

    throw new Error(`unexpected ${url}`)
  })

  const a1 = new GoogleAccount({ fetch: f1.fetch, load: s1.load, save: s1.save, openExternal: async () => {} })
  assert.deepEqual(await a1.ensureProject(), { project: 'proj-1', tier: 'standard-tier' })
  assert.equal(f1.calls[0].init?.headers?.authorization, 'Bearer AT')
  assert.deepEqual(await a1.ensureProject(), { project: 'proj-1', tier: 'standard-tier' })
  assert.equal(f1.calls.length, 1, 'kết quả được lưu, không gọi lại')

  const s2 = store({ ...base })

  const f2 = fakeFetch(url => {
    if (url === `${CODE_ASSIST_BASE}:loadCodeAssist`) {return { allowedTiers: [{ id: 'free-tier', isDefault: true }] }}

    if (url === `${CODE_ASSIST_BASE}:onboardUser`) {return { name: 'operations/1', done: true, response: {} }}

    throw new Error(`unexpected ${url}`)
  })

  const a2 = new GoogleAccount({ fetch: f2.fetch, load: s2.load, save: s2.save, openExternal: async () => {} })
  assert.deepEqual(await a2.ensureProject(), { project: null, tier: 'free-tier' })
  assert.equal(JSON.parse(f2.calls[1].init?.body ?? '{}').tierId, 'free-tier')
})

test('streamGenerate: bóc lớp response từ SSE, bỏ dòng không phải data', async () => {
  const s = store({ tokens: { access_token: 'AT', refresh_token: 'RT', expiry_date: Number.MAX_SAFE_INTEGER }, project: 'p', tier: 'standard-tier' })
  const sse = 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Xin"}]}}]}}\n\n: keepalive\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n'

  const fetch: FetchLike = async (url, init) => {
    assert.equal(url, `${CODE_ASSIST_BASE}:streamGenerateContent?alt=sse`)
    const body = JSON.parse(init?.body ?? '{}')
    assert.equal(body.model, 'gemini-2.5-pro')
    assert.equal(body.project, 'p')
    assert.ok(body.user_prompt_id)

    return { ok: true, status: 200, text: async () => sse, json: async () => ({}), body: null }
  }

  const acct = new GoogleAccount({ fetch, load: s.load, save: s.save, openExternal: async () => {} })
  const chunks: unknown[] = []

  for await (const c of acct.streamGenerate('gemini-2.5-pro', { contents: [] })) {
    chunks.push(c)
  }

  assert.equal(chunks.length, 2)
  assert.deepEqual(chunks[0], { candidates: [{ content: { parts: [{ text: 'Xin' }] } }] })
})

test('sseLines: tách dòng qua ranh giới chunk, bỏ \\r', async () => {
  const enc = new TextEncoder()

  async function* body() {
    yield enc.encode('data: a\r\nda')
    yield enc.encode('ta: b\n\nx')
  }

  const lines: string[] = []

  for await (const l of sseLines(body(), { text: async () => '' })) {
    lines.push(l)
  }

  assert.deepEqual(lines, ['data: a', 'data: b', '', 'x'])
})

test('ensureProject: Google xếp bậc đòi dự án nhưng không cấp project → thử lại bậc miễn phí; setProject dùng mã người dùng nhập', async () => {
  const base = { tokens: { access_token: 'AT', refresh_token: 'RT', expiry_date: Number.MAX_SAFE_INTEGER }, project: null, tier: null }
  const s = store({ ...base })
  const calls: { url: string; body: Record<string, unknown> }[] = []

  const fetch: FetchLike = async (url, init) => {
    const body = JSON.parse(init?.body ?? '{}') as Record<string, unknown>
    calls.push({ url, body })

    if (url.endsWith(':loadCodeAssist')) {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ allowedTiers: [{ id: 'legacy-tier', isDefault: true }] }) }
    }

    if (url.endsWith(':onboardUser')) {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ done: true, response: {} }) }
    }

    throw new Error(`unexpected ${url}`)
  }

  const acct = new GoogleAccount({ fetch, load: s.load, save: s.save, openExternal: async () => {} })
  assert.deepEqual(await acct.ensureProject(), { project: null, tier: 'free-tier' }, 'rơi về bậc miễn phí thay vì báo lỗi')
  assert.deepEqual(calls.map(c => c.body.tierId).filter(Boolean), ['legacy-tier', 'free-tier'])

  acct.setProject('  du-an-cua-toi  ')
  assert.equal(acct.projectOverride, 'du-an-cua-toi')
  assert.equal(s.get()?.tier, null, 'nhập dự án thì xác định lại bậc')
  calls.length = 0
  await acct.ensureProject()
  assert.equal(calls[0].body.cloudaicompanionProject, 'du-an-cua-toi')
})
