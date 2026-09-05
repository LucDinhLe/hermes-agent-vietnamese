// index.ts — vòng đời cầu nối tài khoản Google trong Electron main.
//
//   trạng thái đăng nhập  → HERMES_HOME/google-account.json (token mã hoá bằng safeStorage)
//   cổng + khoá cầu nối   → HERMES_HOME/google-bridge.json (ổn định qua các lần mở)
//   máy chủ loopback      → chỉ chạy khi đã đăng nhập
//   lõi Hermes            → được đăng ký một custom endpoint "google-account" trỏ vào máy chủ
//                            (POST /api/providers/custom-endpoints, API sẵn có của lõi 8.31)
//
// Không sửa lõi. Gỡ đăng nhập thì tắt máy chủ và xoá endpoint khỏi cấu hình lõi.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { type FetchLike, GoogleAccount, type GoogleAccountState } from './google-account'
import {
  GOOGLE_BRIDGE_DEFAULT_MODEL,
  GOOGLE_BRIDGE_ENDPOINT_ID,
  GOOGLE_BRIDGE_MODELS,
  type GoogleBridgeServer,
  startGoogleBridgeServer
} from './server'

export const GOOGLE_ACCOUNT_FILE = 'google-account.json'
export const GOOGLE_BRIDGE_FILE = 'google-bridge.json'
export const GOOGLE_BRIDGE_ENDPOINT_NAME = 'Google (tài khoản Google)'

export interface GoogleBridgeStatus {
  available: true
  signedIn: boolean
  email: string | null
  tier: string | null
  project: string | null
  serverPort: number | null
  /** dự án Google Cloud người dùng đã nhập (nếu có) */
  projectOverride: string | null
  endpointId: string
  models: string[]
  defaultModel: string
  /** lỗi gần nhất (đăng nhập, khởi động máy chủ, đăng ký endpoint) để hiển thị */
  lastError: string | null
}

export interface SecretCodec {
  encrypt(plain: string): string
  decrypt(stored: string): string
}

export interface GoogleBridgeDeps {
  hermesHome: string
  secrets: SecretCodec
  openExternal: (url: string) => Promise<void>
  fetch: typeof fetch
  log: (message: string) => void
  /** kết nối backend cục bộ hiện tại (null nếu chưa sẵn sàng) */
  backend: () => { baseUrl: string; token: string } | null
}

interface BridgeRecord {
  port: number
  apiKey: string
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 })

  try {
    fs.chmodSync(file, 0o600)
  } catch {
    /* Windows */
  }
}

/** Cổng ổn định theo thư mục dữ liệu (47000–47999) để base_url đã ghi vào lõi không đổi. */
export function preferredBridgePort(hermesHome: string): number {
  const h = crypto.createHash('sha256').update(path.resolve(hermesHome)).digest()

  return 47000 + (h.readUInt16BE(0) % 1000)
}

export class GoogleBridge {
  readonly account: GoogleAccount
  private server: GoogleBridgeServer | null = null
  private record: BridgeRecord
  private lastError: string | null = null
  private registered: string | null = null

  constructor(private readonly deps: GoogleBridgeDeps) {
    const accountFile = path.join(deps.hermesHome, GOOGLE_ACCOUNT_FILE)

    this.account = new GoogleAccount({
      fetch: deps.fetch as unknown as FetchLike,
      openExternal: deps.openExternal,
      load: () => {
        const raw = readJson<{ v: 1; data: string }>(accountFile)

        if (!raw?.data) {
          return null
        }

        try {
          return JSON.parse(deps.secrets.decrypt(raw.data)) as GoogleAccountState
        } catch (error) {
          deps.log(
            `[google-bridge] không đọc được ${GOOGLE_ACCOUNT_FILE}: ${error instanceof Error ? error.message : String(error)}`
          )

          return null
        }
      },
      save: state => {
        if (!state) {
          try {
            fs.rmSync(accountFile, { force: true })
          } catch {
            /* ignore */
          }

          return
        }

        writeJson(accountFile, { v: 1, data: deps.secrets.encrypt(JSON.stringify(state)) })
      }
    })

    const stored = readJson<BridgeRecord>(path.join(deps.hermesHome, GOOGLE_BRIDGE_FILE))
    this.record =
      stored?.port && stored.apiKey
        ? stored
        : { port: preferredBridgePort(deps.hermesHome), apiKey: crypto.randomBytes(24).toString('base64url') }

    if (!stored) {
      writeJson(path.join(deps.hermesHome, GOOGLE_BRIDGE_FILE), this.record)
    }
  }

  status(): GoogleBridgeStatus {
    return {
      available: true,
      signedIn: this.account.signedIn,
      email: this.account.email,
      tier: this.account.tier,
      project: this.account.project,
      serverPort: this.server?.port ?? null,
      projectOverride: this.account.projectOverride,
      endpointId: GOOGLE_BRIDGE_ENDPOINT_ID,
      models: GOOGLE_BRIDGE_MODELS,
      defaultModel: GOOGLE_BRIDGE_DEFAULT_MODEL,
      lastError: this.lastError
    }
  }

  /** Gọi khi app mở và mỗi khi backend cục bộ sẵn sàng. An toàn gọi nhiều lần. */
  async ensureRunning(): Promise<void> {
    if (!this.account.signedIn) {
      return
    }

    try {
      await this.startServer()
      await this.registerEndpoint()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.deps.log(`[google-bridge] ensureRunning: ${this.lastError}`)
    }
  }

  private async startServer(): Promise<GoogleBridgeServer> {
    if (this.server) {
      return this.server
    }

    const tryPort = async (port: number) =>
      startGoogleBridgeServer({ account: this.account, port, apiKey: this.record.apiKey, log: this.deps.log })

    try {
      this.server = await tryPort(this.record.port)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code !== 'EADDRINUSE' && code !== 'EACCES') {
        throw error
      }

      this.deps.log(`[google-bridge] cổng ${this.record.port} bận (${code}); chọn cổng khác`)
      this.server = await tryPort(0)
      this.record = { ...this.record, port: this.server.port }
      writeJson(path.join(this.deps.hermesHome, GOOGLE_BRIDGE_FILE), this.record)
      this.registered = null
    }

    return this.server
  }

  private async backendRequest(method: string, route: string, body?: unknown): Promise<Response | null> {
    const backend = this.deps.backend()

    if (!backend) {
      return null
    }

    return this.deps.fetch(`${backend.baseUrl}${route}`, {
      method,
      headers: { authorization: `Bearer ${backend.token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  }

  /** Ghi custom endpoint vào cấu hình lõi (idempotent; bỏ qua nếu backend chưa sẵn sàng). */
  async registerEndpoint(): Promise<boolean> {
    if (!this.server) {
      return false
    }

    const baseUrl = this.server.baseUrl

    if (this.registered === baseUrl) {
      return true
    }

    const res = await this.backendRequest('POST', '/api/providers/custom-endpoints', {
      id: GOOGLE_BRIDGE_ENDPOINT_ID,
      name: GOOGLE_BRIDGE_ENDPOINT_NAME,
      base_url: baseUrl,
      api_key: this.record.apiKey,
      model: GOOGLE_BRIDGE_DEFAULT_MODEL,
      models: GOOGLE_BRIDGE_MODELS,
      discover_models: false,
      context_length: 1_000_000
    })

    if (!res) {
      return false
    }

    if (!res.ok) {
      throw new Error(`đăng ký endpoint vào lõi thất bại: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    }

    this.registered = baseUrl
    this.lastError = null
    this.deps.log(`[google-bridge] đã đăng ký custom endpoint ${GOOGLE_BRIDGE_ENDPOINT_ID} → ${baseUrl}`)

    return true
  }

  /** Nhập mã dự án Google Cloud rồi thử xác định lại bậc và bật cầu nối. */
  async setProject(project: string | null): Promise<GoogleBridgeStatus> {
    this.lastError = null
    this.account.setProject(project)

    try {
      await this.account.ensureProject()
      await this.startServer()
      await this.registerEndpoint()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.deps.log(`[google-bridge] setProject: ${this.lastError}`)
    }

    return this.status()
  }

  async signIn(): Promise<GoogleBridgeStatus> {
    this.lastError = null

    try {
      await this.account.signIn()
      await this.account.ensureProject()
      await this.startServer()
      await this.registerEndpoint()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.deps.log(`[google-bridge] signIn: ${this.lastError}`)
    }

    return this.status()
  }

  /** Đặt endpoint Google làm nhà cung cấp mặc định (gọi API sẵn có của lõi). */
  async activate(): Promise<GoogleBridgeStatus> {
    try {
      await this.registerEndpoint()
      const res = await this.backendRequest(
        'POST',
        `/api/providers/custom-endpoints/${GOOGLE_BRIDGE_ENDPOINT_ID}/activate`
      )

      if (res && !res.ok) {
        throw new Error(`kích hoạt thất bại: HTTP ${res.status}`)
      }

      this.lastError = null
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
    }

    return this.status()
  }

  async signOut(): Promise<GoogleBridgeStatus> {
    this.account.signOut()
    await this.stopServer()

    try {
      const res = await this.backendRequest('DELETE', `/api/providers/custom-endpoints/${GOOGLE_BRIDGE_ENDPOINT_ID}`)

      if (res && !res.ok && res.status !== 404) {
        this.deps.log(`[google-bridge] xoá endpoint khỏi lõi: HTTP ${res.status}`)
      }
    } catch (error) {
      this.deps.log(`[google-bridge] xoá endpoint khỏi lõi: ${error instanceof Error ? error.message : String(error)}`)
    }

    this.registered = null
    this.lastError = null

    return this.status()
  }

  async stopServer(): Promise<void> {
    const s = this.server
    this.server = null

    if (s) {
      await s.close()
    }
  }
}
