import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { interactActivePreview } from '@/app/chat/right-rail/preview-reader'
import type { ClientSessionState } from '@/app/types'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $gateway } from '@/store/gateway'
import type { RpcEvent } from '@/types/hermes'

import { useMessageStream } from './index'

vi.mock('@/app/chat/right-rail/preview-reader', () => ({
  interactActivePreview: vi.fn(),
  readActivePreview: vi.fn()
}))

const SID = 'shared-browser-session'
let handleEvent: ((event: RpcEvent) => void) | null = null

function Harness() {
  const activeSessionIdRef = useRef<string | null>(SID)
  const sessionStateByRuntimeIdRef = useRef(new Map<string, ClientSessionState>())
  const queryClientRef = useRef(new QueryClient())

  const stream = useMessageStream({
    activeSessionIdRef,
    hydrateFromStoredSession: vi.fn(async () => undefined),
    queryClient: queryClientRef.current,
    refreshHermesConfig: vi.fn(async () => undefined),
    refreshSessions: vi.fn(async () => undefined),
    sessionStateByRuntimeIdRef,
    updateSessionState: (sessionId, updater) => {
      const current = sessionStateByRuntimeIdRef.current.get(sessionId) ?? createClientSessionState()
      const next = updater(current)
      sessionStateByRuntimeIdRef.current.set(sessionId, next)

      return next
    }
  })

  useEffect(() => {
    handleEvent = stream.handleGatewayEvent
  }, [stream.handleGatewayEvent])

  return null
}

describe('preview.interact.request', () => {
  const request = vi.fn(async () => ({}))

  beforeEach(async () => {
    handleEvent = null
    request.mockClear()
    vi.mocked(interactActivePreview).mockResolvedValue({
      action: 'click',
      message: 'Clicked @p2.',
      ok: true,
      title: 'Example',
      url: 'https://example.com/next'
    })
    $gateway.set({ request } as never)
    render(<Harness />)
    await waitFor(() => expect(handleEvent).not.toBeNull())
  })

  afterEach(() => {
    cleanup()
    $gateway.set(null)
    vi.restoreAllMocks()
  })

  it('executes the action on the live preview and answers the blocking gateway request', async () => {
    act(() =>
      handleEvent!({
        payload: { action: 'click', ref: '@p2', request_id: 'request-1' },
        session_id: SID,
        type: 'preview.interact.request'
      })
    )

    await waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(interactActivePreview).toHaveBeenCalledWith({
      action: 'click',
      delta_y: undefined,
      key: undefined,
      ref: '@p2',
      text: undefined
    })
    expect(request).toHaveBeenCalledWith('preview.interact.respond', {
      request_id: 'request-1',
      text: JSON.stringify({
        action: 'click',
        message: 'Clicked @p2.',
        ok: true,
        title: 'Example',
        url: 'https://example.com/next'
      })
    })
  })
})
