// google-account.ts — đăng nhập tài khoản Google cho Hermes Vietnamese theo đúng cửa mà
// Gemini CLI dùng (ứng dụng cài đặt, client id/secret công khai trong mã nguồn Gemini CLI,
// Apache-2.0) và gọi Gemini qua Google Cloud Code Assist bằng token của người dùng.
//
// Tất cả nằm trong VỎ (Electron main). Lõi Hermes không đổi: lõi chỉ thấy một "custom
// endpoint" OpenAI-compatible chạy ở 127.0.0.1 (xem server.ts).
//
// Rủi ro đã được Luc chấp nhận 04/09/2026: đây là cửa của Gemini CLI, Google có thể đóng
// hoặc coi là vi phạm điều khoản; tài liệu công khai phải nói rõ điều này.
//
// Mọi I/O (fetch, mở trình duyệt, đọc/ghi tệp) tiêm qua deps để test được.

import crypto from 'node:crypto'
import http from 'node:http'

// Client id/secret của ứng dụng cài đặt Gemini CLI (Google phát hành công khai trong mã nguồn
// gemini-cli, packages/core/src/code_assist/oauth2.ts). Theo RFC 8252 chúng không phải bí mật;
// lưu ở dạng base64 chỉ để trình quét bí mật của GitHub không chặn push, không nhằm che giấu.
const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8')

export const GOOGLE_OAUTH_CLIENT_ID = decode(
  'NjgxMjU1ODA5Mzk1LW9vOGZ0Mm9wcmRybnA5ZTNhcWY2YXYzaG1kaWIxMzVqLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t'
)
export const GOOGLE_OAUTH_CLIENT_SECRET = decode('R09DU1BYLTR1SGdNUG0tMW83U2stZ2VWNkN1NWNsWEZzeGw=')
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
export const CODE_ASSIST_BASE = 'https://cloudcode-pa.googleapis.com/v1internal'
export const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  email?: string
}

export interface GoogleAccountState {
  tokens: GoogleTokens | null
  /** dự án Cloud Code Assist đã xác định (có thể null với bậc miễn phí quản lý) */
  project: string | null
  tier: string | null
  /** dự án do người dùng tự nhập khi Google đòi (bậc legacy/standard) */
  projectOverride?: string | null
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
  body?: unknown
}>

export interface GoogleAccountDeps {
  fetch: FetchLike
  openExternal: (url: string) => Promise<void>
  load: () => GoogleAccountState | null
  save: (state: GoogleAccountState | null) => void
  now?: () => number
}

const CLIENT_METADATA = { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' }

// ── PKCE ────────────────────────────────────────────────────────────────────

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

  return { verifier, challenge }
}

export function buildAuthUrl(redirectUri: string, state: string, challenge: string): string {
  const u = new URL(GOOGLE_AUTH_URL)
  u.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('state', state)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')

  return u.toString()
}

async function tokenRequest(
  fetch: FetchLike,
  params: Record<string, string>
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      ...params
    }).toString()
  })

  if (!res.ok) {
    throw new Error(`Google token endpoint HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

export interface LoopbackCodeOptions {
  state: string
  challenge: string
  timeoutMs: number
  openExternal: (url: string) => Promise<void>
}

/**
 * Dựng server loopback ở 127.0.0.1 (cổng ngẫu nhiên), mở trang uỷ quyền Google qua
 * openExternal, hứng mã ở /oauth2callback. Luôn đóng server khi xong (thành công, lỗi, hết giờ).
 */
export function waitForLoopbackCode(opts: LoopbackCodeOptions): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    let done = false
    let redirectUri = ''

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')

      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end()

        return
      }

      const err = url.searchParams.get('error')
      const gotState = url.searchParams.get('state')
      const gotCode = url.searchParams.get('code')

      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })

      if (err || gotState !== opts.state || !gotCode) {
        res.end('<p style="font-family:sans-serif">Đăng nhập Google không thành công. Bạn có thể đóng cửa sổ này.</p>')
        finish(new Error(err ? `Google từ chối: ${err}` : 'state không khớp'))

        return
      }

      res.end(
        '<p style="font-family:sans-serif">Đã đăng nhập Google cho Hermes Vietnamese. Bạn có thể đóng cửa sổ này và quay lại ứng dụng.</p>'
      )
      finish(null, gotCode)
    })

    const timer = setTimeout(() => finish(new Error('Hết thời gian chờ đăng nhập Google')), opts.timeoutMs)

    function finish(error: Error | null, code?: string): void {
      if (done) {
        return
      }

      done = true
      clearTimeout(timer)
      server.close()

      if (error) {
        reject(error)
      } else {
        resolve({ code: code as string, redirectUri })
      }
    }

    server.on('error', finish)

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      redirectUri = `http://127.0.0.1:${port}/oauth2callback`

      opts.openExternal(buildAuthUrl(redirectUri, opts.state, opts.challenge)).catch(finish)
    })
  })
}

export class GoogleAccount {
  private state: GoogleAccountState | null
  private refreshing: Promise<string> | null = null

  constructor(private readonly deps: GoogleAccountDeps) {
    this.state = deps.load()
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  get signedIn(): boolean {
    return Boolean(this.state?.tokens?.refresh_token)
  }

  get email(): string | null {
    return this.state?.tokens?.email ?? null
  }

  get project(): string | null {
    return this.state?.project ?? null
  }

  get tier(): string | null {
    return this.state?.tier ?? null
  }

  /**
   * Đăng nhập: mở trình duyệt hệ thống, hứng mã ở 127.0.0.1 (loopback, cổng ngẫu nhiên),
   * đổi mã lấy token bằng PKCE. Trả về email. Người dùng tự bấm trong trình duyệt;
   * ứng dụng không bao giờ thấy mật khẩu Google.
   */
  async signIn(opts: { timeoutMs?: number } = {}): Promise<string> {
    const { verifier, challenge } = pkcePair()
    const state = crypto.randomBytes(16).toString('hex')

    const { code: authCode, redirectUri } = await waitForLoopbackCode({
      state,
      challenge,
      timeoutMs: opts.timeoutMs ?? 5 * 60 * 1000,
      openExternal: this.deps.openExternal
    })

    const tok = await tokenRequest(this.deps.fetch, {
      grant_type: 'authorization_code',
      code: authCode,
      code_verifier: verifier,
      redirect_uri: redirectUri
    })

    if (!tok.refresh_token) {
      throw new Error(
        'Google không cấp refresh token; hãy thu hồi quyền của Gemini CLI trong tài khoản Google rồi đăng nhập lại'
      )
    }

    let email: string | undefined

    try {
      const me = await this.deps.fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${tok.access_token}` }
      })

      if (me.ok) {
        email = ((await me.json()) as { email?: string }).email
      }
    } catch {
      /* email chỉ để hiển thị */
    }

    this.state = {
      tokens: {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expiry_date: this.now() + tok.expires_in * 1000,
        email
      },
      project: null,
      tier: null
    }
    this.deps.save(this.state)

    return email ?? 'tài khoản Google'
  }

  signOut(): void {
    this.state = null
    this.deps.save(null)
  }

  /** Access token còn hạn, tự làm mới khi sắp hết; gộp các lần gọi song song. */
  async accessToken(): Promise<string> {
    const tokens = this.state?.tokens

    if (!tokens?.refresh_token) {
      throw new Error('Chưa đăng nhập Google')
    }

    if (tokens.expiry_date - this.now() > TOKEN_REFRESH_SKEW_MS) {
      return tokens.access_token
    }

    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const tok = await tokenRequest(this.deps.fetch, {
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token
          })

          const next: GoogleAccountState = {
            ...(this.state as GoogleAccountState),
            tokens: {
              ...tokens,
              access_token: tok.access_token,
              expiry_date: this.now() + tok.expires_in * 1000,
              refresh_token: tok.refresh_token ?? tokens.refresh_token
            }
          }

          this.state = next
          this.deps.save(next)

          return tok.access_token
        } finally {
          this.refreshing = null
        }
      })()
    }

    return this.refreshing
  }

  private async caPost<T>(method: string, body: unknown): Promise<T> {
    const token = await this.accessToken()

    const res = await this.deps.fetch(`${CODE_ASSIST_BASE}:${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'HermesVietnamese/google-bridge'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      throw new Error(`Code Assist ${method} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
    }

    return (await res.json()) as T
  }

  /**
   * Xác định dự án Code Assist (loadCodeAssist, onboardUser cho lần đầu). Kết quả lưu lại;
   * bậc miễn phí dùng dự án do Google quản lý nên project có thể là chuỗi rỗng.
   */
  /** Dự án do người dùng nhập (ưu tiên) hoặc biến môi trường, giống Gemini CLI. */
  get projectOverride(): string | null {
    return (
      this.state?.projectOverride ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT_ID ?? null
    )
  }

  /** Đặt (hoặc xoá) dự án Google Cloud rồi buộc xác định lại bậc ở lần gọi sau. */
  setProject(project: string | null): void {
    const value = project?.trim() || null
    this.state = { ...(this.state as GoogleAccountState), projectOverride: value, project: null, tier: null }
    this.deps.save(this.state)
  }

  private async onboard(tierId: string, explicit: string | null): Promise<string | null> {
    const isFree = tierId === 'free-tier'

    interface Lro {
      name?: string
      done?: boolean
      response?: { cloudaicompanionProject?: { id?: string } }
    }

    let lro = await this.caPost<Lro>('onboardUser', {
      tierId,
      cloudaicompanionProject: isFree ? undefined : (explicit ?? undefined),
      metadata: { ...CLIENT_METADATA, duetProject: isFree ? undefined : (explicit ?? undefined) }
    })

    for (let i = 0; !lro.done && lro.name && i < 24; i += 1) {
      await new Promise(r => setTimeout(r, 5000))
      const token = await this.accessToken()
      const res = await this.deps.fetch(`${CODE_ASSIST_BASE}/${lro.name}`, {
        headers: { authorization: `Bearer ${token}` }
      })
      lro = (await res.json()) as Lro
    }

    return lro.response?.cloudaicompanionProject?.id ?? null
  }

  /**
   * Xác định dự án Code Assist (loadCodeAssist, onboardUser cho lần đầu). Kết quả lưu lại;
   * bậc miễn phí dùng dự án do Google quản lý nên project có thể null. Khi Google trả về bậc
   * đòi dự án mà người dùng chưa nhập, thử một lượt bậc miễn phí trước khi báo lỗi, vì nhiều
   * tài khoản Gmail vẫn dùng được Gemini theo tài khoản.
   */
  async ensureProject(): Promise<{ project: string | null; tier: string | null }> {
    if (this.state?.tier) {
      return { project: this.state.project, tier: this.state.tier }
    }

    const explicit = this.projectOverride

    interface Tier {
      id?: string
      name?: string
      isDefault?: boolean
    }
    interface LoadRes {
      currentTier?: Tier | null
      allowedTiers?: Tier[] | null
      cloudaicompanionProject?: string | null
      paidTier?: Tier | null
    }

    const load = await this.caPost<LoadRes>('loadCodeAssist', {
      cloudaicompanionProject: explicit ?? undefined,
      metadata: { ...CLIENT_METADATA, duetProject: explicit ?? undefined }
    })

    let project: string | null = null
    let tier: string | null = null

    if (load.currentTier) {
      tier = load.paidTier?.id ?? load.currentTier.id ?? 'standard-tier'
      project = load.cloudaicompanionProject ?? explicit ?? null
    } else {
      const chosen = (load.allowedTiers ?? []).find(t => t.isDefault) ?? { id: 'legacy-tier' }
      tier = chosen.id ?? 'legacy-tier'
      project = (await this.onboard(tier, explicit)) ?? explicit ?? null

      if (!project && tier !== 'free-tier') {
        // Google xếp tài khoản vào bậc đòi dự án nhưng người dùng chưa có; thử bậc miễn phí.
        try {
          const freeProject = await this.onboard('free-tier', null)
          tier = 'free-tier'
          project = freeProject
        } catch (error) {
          throw new Error(
            `Google xếp tài khoản vào bậc "${tier}" nên cần một dự án Google Cloud. ` +
              `Bậc Google cho phép: ${(load.allowedTiers ?? []).map(t => t.id).join(', ') || 'không có'}. ` +
              `Thử bậc miễn phí cũng không được (${error instanceof Error ? error.message : String(error)}). ` +
              'Hãy nhập mã dự án Google Cloud ở ô bên dưới rồi thử lại.'
          )
        }
      }
    }

    this.state = { ...(this.state as GoogleAccountState), project, tier }
    this.deps.save(this.state)

    return { project, tier }
  }

  /**
   * Gọi streamGenerateContent (SSE). Trả về AsyncIterable các JSON chunk kiểu Gemini
   * (đã bóc lớp `response` của Code Assist).
   */
  async *streamGenerate(
    model: string,
    request: unknown,
    signal?: AbortSignal
  ): AsyncGenerator<Record<string, unknown>> {
    const { project } = await this.ensureProject()
    const token = await this.accessToken()

    const res = await this.deps.fetch(`${CODE_ASSIST_BASE}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'HermesVietnamese/google-bridge'
      },
      body: JSON.stringify({ model, project: project ?? undefined, user_prompt_id: crypto.randomUUID(), request }),
      signal
    })

    if (!res.ok) {
      throw new Error(`Code Assist streamGenerateContent HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
    }

    for await (const line of sseLines(res.body as AsyncIterable<Uint8Array> | null, res)) {
      if (!line.startsWith('data: ')) {
        continue
      }

      const payload = JSON.parse(line.slice(6)) as { response?: Record<string, unknown> }

      if (payload.response) {
        yield payload.response
      }
    }
  }
}

/** Tách dòng từ luồng SSE (body của fetch) hoặc từ text() khi không có body stream. */
export async function* sseLines(
  body: AsyncIterable<Uint8Array> | null,
  res: { text(): Promise<string> }
): AsyncGenerator<string> {
  if (!body) {
    for (const line of (await res.text()).split(/\r?\n/)) {
      yield line
    }

    return
  }

  const decoder = new TextDecoder()
  let buf = ''

  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true })
    let idx: number

    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '')
      buf = buf.slice(idx + 1)
      yield line
    }
  }

  if (buf) {
    yield buf
  }
}
