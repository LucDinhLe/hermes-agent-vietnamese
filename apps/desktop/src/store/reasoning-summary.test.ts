import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesGateway } from '@/hermes'
import type { ChatMessage } from '@/lib/chat-messages'

import {
  $reasoningSummaries,
  clearReasoningSummaryCache,
  findReasoningSummary,
  publicReasoningText,
  reasoningSourceDigest,
  setReasoningSummaryEnabled,
  summarizeReasoningMessage
} from './reasoning-summary'

const message = (): ChatMessage => ({
  id: 'assistant-live-1',
  role: 'assistant',
  parts: [
    { type: 'reasoning', text: 'Kiểm tra giả định. ' },
    { type: 'reasoning', text: ' Chọn phương án an toàn.' },
    { type: 'text', text: 'Câu trả lời gốc.' }
  ]
})

function gatewayMock() {
  const request = vi.fn(async (_method: string, params: Record<string, unknown>) => ({
    summary: 'Đã kiểm tra giả định và chọn phương án an toàn.',
    source_digest: params.source_digest,
    provider: 'test-provider',
    model: 'test-model',
    usage: null
  }))

  return { gateway: { request } as unknown as HermesGateway, request }
}

describe('reasoning summary', () => {
  beforeEach(() => {
    clearReasoningSummaryCache()
    setReasoningSummaryEnabled(false)
  })

  it('makes zero auxiliary calls while disabled and leaves source content unchanged', async () => {
    const source = message()
    const before = structuredClone(source)
    const { gateway, request } = gatewayMock()

    const result = await summarizeReasoningMessage({
      gateway,
      message: source,
      profile: 'default',
      sessionLineage: 'session-1'
    })

    expect(result).toBeNull()
    expect(request).not.toHaveBeenCalled()
    expect(source).toEqual(before)
  })

  it('calls once per digest and persists the derivative separately', async () => {
    setReasoningSummaryEnabled(true)
    const source = message()
    const { gateway, request } = gatewayMock()
    const options = { gateway, message: source, profile: 'default', sessionLineage: 'session-1' }

    const first = await summarizeReasoningMessage(options)
    const second = await summarizeReasoningMessage(options)

    expect(request).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
    expect(first?.summary).toContain('phương án an toàn')
    expect(JSON.stringify($reasoningSummaries.get())).not.toContain(publicReasoningText(source))
  })

  it('isolates cache lookup by profile and session while surviving a rebuilt message id', async () => {
    setReasoningSummaryEnabled(true)
    const source = message()
    const { gateway } = gatewayMock()

    const record = await summarizeReasoningMessage({
      gateway,
      message: source,
      profile: 'work',
      sessionLineage: 'session-1'
    })

    const digest = await reasoningSourceDigest(publicReasoningText(source))
    const records = $reasoningSummaries.get()

    expect(findReasoningSummary(records, 'work', 'session-1', 'rehydrated-id', digest)).toEqual(record)
    expect(findReasoningSummary(records, 'personal', 'session-1', 'rehydrated-id', digest)).toBeUndefined()
    expect(findReasoningSummary(records, 'work', 'session-2', 'rehydrated-id', digest)).toBeUndefined()
  })

  it('contains auxiliary failures without changing the completed message', async () => {
    setReasoningSummaryEnabled(true)
    const source = message()
    const before = structuredClone(source)
    const request = vi.fn().mockRejectedValue(new Error('offline'))

    const result = await summarizeReasoningMessage({
      gateway: { request } as unknown as HermesGateway,
      message: source,
      profile: 'default',
      sessionLineage: 'session-1'
    })

    expect(result).toBeNull()
    expect(source).toEqual(before)
  })
})
