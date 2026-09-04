// server.ts — máy chủ OpenAI-compatible ở 127.0.0.1 làm "custom endpoint" cho lõi Hermes.
// Lõi gửi /v1/chat/completions như với bất kỳ nhà cung cấp OpenAI nào; vỏ dịch sang Gemini
// và gọi Code Assist bằng token tài khoản Google của người dùng (google-account.ts).
//
// Chỉ lắng nghe loopback, có khoá Bearer riêng cho mỗi lần chạy để tiến trình khác trên máy
// không dùng ké token Google. Không ghi log nội dung hội thoại.

import crypto from 'node:crypto'
import http from 'node:http'

import type { GoogleAccount } from './google-account'
import { type GeminiResponse, type OpenAiChatRequest, StreamTranslator, toGeminiRequest, toOpenAiCompletion } from './openai-compat'

export const GOOGLE_BRIDGE_ENDPOINT_ID = 'google-account'
export const GOOGLE_BRIDGE_DEFAULT_MODEL = 'gemini-2.5-pro'

/** Danh sách model Code Assist chấp nhận qua cửa Gemini CLI (cập nhật theo Gemini CLI). */
export const GOOGLE_BRIDGE_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash'
]

export interface GoogleBridgeServerOptions {
  account: Pick<GoogleAccount, 'signedIn' | 'streamGenerate'>
  /** cổng cố định (0 = ngẫu nhiên). Cổng ổn định giúp custom endpoint của lõi không đổi base_url. */
  port?: number
  apiKey?: string
  log?: (message: string) => void
}

export interface GoogleBridgeServer {
  port: number
  baseUrl: string
  apiKey: string
  close(): Promise<void>
}

function readBody(req: http.IncomingMessage, limit = 64 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (c: Buffer) => {
      size += c.length

      if (size > limit) {
        reject(new Error('body quá lớn'))
        req.destroy()

        return
      }

      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sendError(res: http.ServerResponse, status: number, message: string, type = 'invalid_request_error'): void {
  sendJson(res, status, { error: { message, type, code: status } })
}

function statusFromError(error: unknown): number {
  const m = /HTTP (\d{3})/.exec(error instanceof Error ? error.message : String(error))

  return m ? Number(m[1]) : 502
}

export function startGoogleBridgeServer(opts: GoogleBridgeServerOptions): Promise<GoogleBridgeServer> {
  const apiKey = opts.apiKey ?? crypto.randomBytes(24).toString('base64url')
  const log = opts.log ?? (() => {})

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const auth = req.headers.authorization ?? ''

    if (auth !== `Bearer ${apiKey}`) {
      sendError(res, 401, 'Khoá của cầu nối Google không đúng', 'authentication_error')

      return
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      sendJson(res, 200, {
        object: 'list',
        data: GOOGLE_BRIDGE_MODELS.map(id => ({ id, object: 'model', created: 0, owned_by: 'google' }))
      })

      return
    }

    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      sendError(res, 404, `Không hỗ trợ ${req.method} ${url.pathname}`)

      return
    }

    if (!opts.account.signedIn) {
      sendError(res, 401, 'Chưa đăng nhập tài khoản Google trong Hermes Vietnamese', 'authentication_error')

      return
    }

    let body: OpenAiChatRequest

    try {
      body = JSON.parse(await readBody(req)) as OpenAiChatRequest
    } catch (error) {
      sendError(res, 400, `JSON không hợp lệ: ${error instanceof Error ? error.message : String(error)}`)

      return
    }

    if (!body || !Array.isArray(body.messages)) {
      sendError(res, 400, 'Thiếu messages')

      return
    }

    const model = body.model || GOOGLE_BRIDGE_DEFAULT_MODEL
    const id = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`
    const abort = new AbortController()
    req.on('close', () => abort.abort())

    let gemini

    try {
      gemini = toGeminiRequest(body)
    } catch (error) {
      sendError(res, 400, error instanceof Error ? error.message : String(error))

      return
    }

    if (body.stream) {
      const translator = new StreamTranslator(id, model)
      let headersSent = false

      try {
        for await (const chunk of opts.account.streamGenerate(model, gemini, abort.signal)) {
          if (!headersSent) {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
            headersSent = true
          }

          for (const out of translator.translate(chunk as GeminiResponse)) {
            res.write(`data: ${JSON.stringify(out)}\n\n`)
          }
        }

        if (!headersSent) {
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
        }

        res.end('data: [DONE]\n\n')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log(`google-bridge stream lỗi: ${message}`)

        if (headersSent) {
          res.write(`data: ${JSON.stringify({ error: { message, type: 'server_error' } })}\n\n`)
          res.end('data: [DONE]\n\n')
        } else {
          sendError(res, statusFromError(error), message, 'server_error')
        }
      }

      return
    }

    try {
      const chunks: GeminiResponse[] = []

      for await (const chunk of opts.account.streamGenerate(model, gemini, abort.signal)) {
        chunks.push(chunk as GeminiResponse)
      }

      sendJson(res, 200, toOpenAiCompletion(id, model, chunks))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(`google-bridge lỗi: ${message}`)
      sendError(res, statusFromError(error), message, 'server_error')
    }
  })

  server.keepAliveTimeout = 65_000

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.off('error', reject)
      log(`google-bridge lắng nghe 127.0.0.1:${port}`)

      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey,
        close: () =>
          new Promise<void>(done => {
            server.close(() => done())
            server.closeAllConnections?.()
          })
      })
    })
  })
}
