import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { rendererRuntimeKey } from '@/lib/session-runtime-key'

import { renderMessageStream } from './test-harness'

const { eventSourceRequest, inputRequestHandler } = vi.hoisted(() => ({
  eventSourceRequest: vi.fn(
    async (
      _sourceRuntimeId: null | string | undefined,
      _method: string,
      _params: Record<string, unknown>
    ): Promise<Record<string, unknown>> => ({ ok: true })
  ),
  inputRequestHandler: vi.fn((ctx: { event: { type: string } }) =>
    ['approval.request', 'clarify.request', 'mcp.setup.request', 'secret.request', 'sudo.request'].includes(
      ctx.event.type
    )
  )
}))

vi.mock('@/store/gateway-event-source', () => ({
  requestForGatewayEventSource: eventSourceRequest
}))

vi.mock('./gateway-event/input-requests', () => ({
  handleInputRequestEvent: inputRequestHandler
}))

vi.mock('@/app/right-sidebar/terminal/buffer', () => ({
  readActiveTerminal: vi.fn(() => null)
}))

vi.mock('@/app/chat/right-rail/preview-reader', () => ({
  readActivePreview: vi.fn(async () => null)
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const backend = (connectionId: string) => ({ connectionId, gatewayEpoch: 7, profile: 'mbc' })

const eventFrom = (connectionId: string, type: string) => ({
  connectionId,
  gatewayEpoch: 7,
  payload: { request_id: 'request-shared' },
  profile: 'mbc',
  session_id: 'runtime-shared',
  type
})

describe('request-id-only gateway event responses', () => {
  it('keeps identical source names, runtime ids, and request ids isolated by connection', async () => {
    const sourceA = rendererRuntimeKey(backend('source-a'), 'runtime-shared')
    const sourceB = rendererRuntimeKey(backend('source-b'), 'runtime-shared')
    const stream = renderMessageStream(sourceB, { qualifyRuntimeIds: true })

    act(() => stream.handleEvent(eventFrom('source-a', 'terminal.read.request')))

    await waitFor(() => expect(eventSourceRequest).toHaveBeenCalledTimes(1))
    expect(eventSourceRequest).toHaveBeenLastCalledWith(sourceA, 'terminal.read.respond', {
      request_id: 'request-shared',
      text: ''
    })

    act(() => stream.handleEvent(eventFrom('source-b', 'terminal.read.request')))

    await waitFor(() => expect(eventSourceRequest).toHaveBeenCalledTimes(2))
    expect(eventSourceRequest).toHaveBeenLastCalledWith(sourceB, 'terminal.read.respond', {
      request_id: 'request-shared',
      text: ''
    })
  })

  it('uses the event-source seam for every desktop bridge response and never adds session_id', async () => {
    const sourceA = rendererRuntimeKey(backend('source-a'), 'runtime-shared')
    const sourceB = rendererRuntimeKey(backend('source-b'), 'runtime-shared')
    const stream = renderMessageStream(sourceB, { qualifyRuntimeIds: true })

    for (const type of [
      'terminal.read.request',
      'preview.read.request',
      'preview.act.request',
      'window.read.request',
      'tour.request'
    ]) {
      act(() => stream.handleEvent(eventFrom('source-a', type)))
    }

    await waitFor(() => expect(eventSourceRequest).toHaveBeenCalledTimes(5))

    expect(eventSourceRequest.mock.calls.map(call => call[0])).toEqual(Array(5).fill(sourceA))
    expect(eventSourceRequest.mock.calls.map(call => call[1]).sort()).toEqual(
      [
        'preview.act.respond',
        'preview.read.respond',
        'terminal.read.respond',
        'tour.respond',
        'window.read.respond'
      ].sort()
    )

    for (const call of eventSourceRequest.mock.calls) {
      expect(call[2]).toMatchObject({ request_id: 'request-shared' })
      expect(call[2]).not.toHaveProperty('session_id')
    }
  })

  it('drops a scoped request event whose backend provenance is missing', () => {
    const stream = renderMessageStream(null, { qualifyRuntimeIds: true })

    act(() =>
      stream.handleEvent({
        payload: { request_id: 'request-shared' },
        session_id: 'runtime-shared',
        type: 'terminal.read.request'
      })
    )

    expect(eventSourceRequest).not.toHaveBeenCalled()
  })

  it('does not borrow the active session for any raw-response request without a source session id', () => {
    const active = rendererRuntimeKey(backend('source-b'), 'runtime-shared')
    const stream = renderMessageStream(active, { qualifyRuntimeIds: true })

    act(() => {
      for (const type of [
        'approval.request',
        'clarify.request',
        'mcp.setup.request',
        'preview.act.request',
        'preview.read.request',
        'secret.request',
        'sudo.request',
        'terminal.read.request',
        'tour.request',
        'window.read.request'
      ]) {
        stream.handleEvent({
          connectionId: 'source-a',
          gatewayEpoch: 7,
          payload: { request_id: 'request-shared' },
          profile: 'mbc',
          type
        })
      }
    })

    expect(inputRequestHandler).not.toHaveBeenCalled()
    expect(eventSourceRequest).not.toHaveBeenCalled()
  })
})
