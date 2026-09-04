// openai-compat.ts — dịch hai chiều giữa OpenAI Chat Completions (thứ Hermes gửi cho một
// "custom endpoint") và Gemini generateContent (thứ Code Assist nhận). Thuần hàm, không I/O.
//
// Phạm vi: messages (system/user/assistant/tool, text + image data URL), tools (function),
// tool_choice, temperature/top_p/max_tokens/stop, stream chunks, usage. Thứ không có trong
// Gemini bị bỏ qua thay vì làm lỗi.

export interface OpenAiChatRequest {
  model: string
  messages: OpenAiMessage[]
  tools?: { type: 'function'; function: { name: string; description?: string; parameters?: unknown } }[]
  tool_choice?: unknown
  temperature?: number
  top_p?: number
  max_tokens?: number
  max_completion_tokens?: number
  stop?: string | string[]
  stream?: boolean
  reasoning_effort?: string
}

export interface OpenAiMessage {
  role: 'system' | 'developer' | 'user' | 'assistant' | 'tool'
  content?: string | null | { type: string; text?: string; image_url?: { url: string } }[]
  name?: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> }
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> }
  thought?: boolean
}

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiRequest {
  contents: GeminiContent[]
  systemInstruction?: { role?: string; parts: GeminiPart[] }
  tools?: { functionDeclarations: { name: string; description?: string; parameters?: unknown }[] }[]
  toolConfig?: { functionCallingConfig: { mode: 'AUTO' | 'ANY' | 'NONE'; allowedFunctionNames?: string[] } }
  generationConfig?: Record<string, unknown>
}

function parseArgs(text: string): Record<string, unknown> {
  if (!text || !text.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(text) as unknown

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { value: parsed }
  } catch {
    return { raw: text }
  }
}

function contentToParts(content: OpenAiMessage['content']): GeminiPart[] {
  if (content == null) {
    return []
  }

  if (typeof content === 'string') {
    return content ? [{ text: content }] : []
  }

  const parts: GeminiPart[] = []

  for (const item of content) {
    if (item.type === 'text' && typeof item.text === 'string') {
      parts.push({ text: item.text })
    } else if (item.type === 'image_url' && item.image_url?.url) {
      const m = /^data:([^;]+);base64,(.+)$/s.exec(item.image_url.url)

      if (m) {
        parts.push({ inlineData: { mimeType: m[1], data: m[2] } })
      } else {
        parts.push({ text: `[image] ${item.image_url.url}` })
      }
    }
  }

  return parts
}

/** Gemini không có role "tool"; functionResponse cần tên hàm, lấy từ tool_calls trước đó. */
export function toGeminiRequest(req: OpenAiChatRequest): GeminiRequest {
  const systemParts: GeminiPart[] = []
  const contents: GeminiContent[] = []
  const callNames = new Map<string, string>()

  const push = (role: 'user' | 'model', parts: GeminiPart[]) => {
    if (!parts.length) {
      return
    }

    const last = contents[contents.length - 1]

    if (last && last.role === role) {
      last.parts.push(...parts)
    } else {
      contents.push({ role, parts })
    }
  }

  for (const msg of req.messages) {
    if (msg.role === 'system' || msg.role === 'developer') {
      systemParts.push(...contentToParts(msg.content))
    } else if (msg.role === 'user') {
      push('user', contentToParts(msg.content))
    } else if (msg.role === 'assistant') {
      const parts = contentToParts(msg.content)

      for (const call of msg.tool_calls ?? []) {
        callNames.set(call.id, call.function.name)
        parts.push({ functionCall: { id: call.id, name: call.function.name, args: parseArgs(call.function.arguments) } })
      }

      push('model', parts)
    } else if (msg.role === 'tool') {
      const name = (msg.tool_call_id && callNames.get(msg.tool_call_id)) || msg.name || 'tool'
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '')
      let response: Record<string, unknown>

      try {
        const parsed = JSON.parse(text) as unknown

        response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { result: parsed }
      } catch {
        response = { result: text }
      }

      push('user', [{ functionResponse: { id: msg.tool_call_id, name, response } }])
    }
  }

  // Gemini bắt buộc lượt đầu là user
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(tiếp tục)' }] })
  }

  const out: GeminiRequest = { contents }

  if (systemParts.length) {
    out.systemInstruction = { role: 'user', parts: systemParts }
  }

  if (req.tools?.length) {
    out.tools = [
      {
        functionDeclarations: req.tools
          .filter(t => t.type === 'function' && t.function?.name)
          .map(t => ({ name: t.function.name, description: t.function.description, parameters: sanitizeSchema(t.function.parameters) }))
      }
    ]

    const choice = req.tool_choice

    if (choice === 'none') {
      out.toolConfig = { functionCallingConfig: { mode: 'NONE' } }
    } else if (choice === 'required') {
      out.toolConfig = { functionCallingConfig: { mode: 'ANY' } }
    } else if (choice && typeof choice === 'object' && (choice as { function?: { name?: string } }).function?.name) {
      out.toolConfig = {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [(choice as { function: { name: string } }).function.name] }
      }
    }
  }

  const gen: Record<string, unknown> = {}

  if (typeof req.temperature === 'number') {gen.temperature = req.temperature}

  if (typeof req.top_p === 'number') {gen.topP = req.top_p}

  const maxTokens = req.max_completion_tokens ?? req.max_tokens

  if (typeof maxTokens === 'number' && maxTokens > 0) {gen.maxOutputTokens = maxTokens}

  if (req.stop) {gen.stopSequences = Array.isArray(req.stop) ? req.stop : [req.stop]}

  if (Object.keys(gen).length) {
    out.generationConfig = gen
  }

  return out
}

/** Gemini không nhận một số khoá JSON Schema của OpenAI; lược bỏ để không bị 400. */
export function sanitizeSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema)
  }

  const drop = new Set(['$schema', 'additionalProperties', 'strict', 'examples', 'default', '$id', 'title', 'const'])
  const out: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (drop.has(k)) {
      continue
    }

    out[k] = k === 'properties' && v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, sanitizeSchema(pv)]))
      : sanitizeSchema(v)
  }

  return out
}

// ── Gemini → OpenAI ─────────────────────────────────────────────────────────

export interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number }
}

export interface OpenAiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export function toOpenAiUsage(res: GeminiResponse | undefined): OpenAiUsage | undefined {
  const u = res?.usageMetadata

  if (!u) {
    return undefined
  }

  const prompt = u.promptTokenCount ?? 0
  const completion = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)

  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: u.totalTokenCount ?? prompt + completion }
}

export function finishReasonToOpenAi(reason: string | undefined, hadToolCalls: boolean): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
  if (hadToolCalls) {return 'tool_calls'}

  if (!reason) {return null}

  if (reason === 'MAX_TOKENS') {return 'length'}

  if (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'BLOCKLIST' || reason === 'PROHIBITED_CONTENT') {return 'content_filter'}

  return 'stop'
}

/**
 * Trạng thái dịch stream: gom text và các functionCall (mỗi call một index OpenAI) qua nhiều
 * chunk. Trả về danh sách chunk OpenAI cho một chunk Gemini.
 */
export class StreamTranslator {
  private toolIndex = 0
  private sawToolCall = false
  private readonly created = Math.floor(Date.now() / 1000)

  constructor(
    private readonly id: string,
    private readonly model: string
  ) {}

  private envelope(delta: Record<string, unknown>, finish: string | null, usage?: OpenAiUsage) {
    return {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [{ index: 0, delta, finish_reason: finish }],
      ...(usage ? { usage } : {})
    }
  }

  translate(chunk: GeminiResponse): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    const cand = chunk.candidates?.[0]

    for (const part of cand?.content?.parts ?? []) {
      if (part.thought) {
        continue
      }

      if (typeof part.text === 'string' && part.text) {
        out.push(this.envelope({ content: part.text }, null))
      }

      if (part.functionCall) {
        this.sawToolCall = true
        const idx = this.toolIndex++

        out.push(
          this.envelope(
            {
              tool_calls: [
                {
                  index: idx,
                  id: part.functionCall.id || `call_${this.id.slice(-8)}_${idx}`,
                  type: 'function',
                  function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) }
                }
              ]
            },
            null
          )
        )
      }
    }

    if (cand?.finishReason) {
      out.push(this.envelope({}, finishReasonToOpenAi(cand.finishReason, this.sawToolCall), toOpenAiUsage(chunk)))
    }

    return out
  }
}

/** Gộp toàn bộ chunk Gemini thành một chat.completion (đường không stream). */
export function toOpenAiCompletion(id: string, model: string, chunks: GeminiResponse[]): Record<string, unknown> {
  let text = ''
  const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = []
  let finish: string | undefined
  let usage: OpenAiUsage | undefined

  for (const chunk of chunks) {
    const cand = chunk.candidates?.[0]

    for (const part of cand?.content?.parts ?? []) {
      if (part.thought) {continue}

      if (typeof part.text === 'string') {text += part.text}

      if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.id || `call_${id.slice(-8)}_${toolCalls.length}`,
          type: 'function',
          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) }
        })
      }
    }

    if (cand?.finishReason) {finish = cand.finishReason}
    usage = toOpenAiUsage(chunk) ?? usage
  }

  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text || (toolCalls.length ? null : ''), ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason: finishReasonToOpenAi(finish, toolCalls.length > 0) ?? 'stop'
      }
    ],
    usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  }
}
