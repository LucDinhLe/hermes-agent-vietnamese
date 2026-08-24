import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSessionState } from '@/app/types'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $workProgressSessions } from '@/store/work-progress'
import type { RpcEvent } from '@/types/hermes'

import { useMessageStream } from './index'

const SID = 'session-1'
const OTHER_SID = 'session-2'
const sessionStates = new Map<string, ClientSessionState>()
let handleEvent: ((event: RpcEvent) => void) | null = null

function Harness() {
  const activeSessionIdRef = useRef<string | null>(SID)
  const sessionStateByRuntimeIdRef = useRef(sessionStates)
  const queryClientRef = useRef(new QueryClient())

  const stream = useMessageStream({
    activeSessionIdRef,
    hydrateFromStoredSession: vi.fn(async () => undefined),
    queryClient: queryClientRef.current,
    refreshHermesConfig: vi.fn(async () => undefined),
    refreshSessions: vi.fn(async () => undefined),
    sessionStateByRuntimeIdRef,
    updateSessionState: (sessionId, updater) => {
      const next = updater(sessionStates.get(sessionId) ?? createClientSessionState())
      sessionStates.set(sessionId, next)

      return next
    }
  })

  useEffect(() => {
    handleEvent = stream.handleGatewayEvent
  }, [stream.handleGatewayEvent])

  return null
}

async function mountStream() {
  render(<Harness />)
  await waitFor(() => expect(handleEvent).not.toBeNull())
}

function emit(type: RpcEvent['type'], payload: RpcEvent['payload'] = {}, sessionId = SID) {
  act(() => handleEvent!({ payload, session_id: sessionId, type }))
}

describe('per-session work progress', () => {
  beforeEach(() => {
    handleEvent = null
    sessionStates.clear()
    $workProgressSessions.set({})
  })

  afterEach(() => {
    cleanup()
    sessionStates.clear()
    $workProgressSessions.set({})
    vi.restoreAllMocks()
  })

  it('projects the real workflow and Advisor checkpoints without crossing sessions', async () => {
    await mountStream()

    emit('message.start', {}, SID)
    emit('message.start', {}, OTHER_SID)
    expect($workProgressSessions.get()[SID]).toEqual({ kind: 'analyzing' })
    expect($workProgressSessions.get()[OTHER_SID]).toEqual({ kind: 'analyzing' })

    emit('advisor.progress', { checkpoint: 'plan', state: 'reviewing' }, SID)
    expect($workProgressSessions.get()[SID]).toEqual({
      checkpoint: 'plan',
      kind: 'advisor',
      state: 'reviewing'
    })
    expect($workProgressSessions.get()[OTHER_SID]).toEqual({ kind: 'analyzing' })

    emit('tool.start', { name: 'terminal', tool_id: 'tool-1' }, SID)
    expect($workProgressSessions.get()[SID]).toEqual({ kind: 'tool-running', toolName: 'terminal' })

    emit('advisor.progress', { checkpoint: 'final', state: 'reviewing' }, SID)
    expect($workProgressSessions.get()[SID]).toEqual({
      checkpoint: 'final',
      kind: 'advisor',
      state: 'reviewing'
    })
  })

  it.each(['message.complete', 'error'] as const)('clears only its session when %s ends the turn', async type => {
    await mountStream()
    emit('message.start', {}, SID)
    emit('message.start', {}, OTHER_SID)

    emit(type, type === 'error' ? { message: 'boom' } : { text: 'done' }, SID)

    expect($workProgressSessions.get()[SID]).toBeUndefined()
    expect($workProgressSessions.get()[OTHER_SID]).toEqual({ kind: 'analyzing' })
  })

  it('clears progress when the backend settles a turn without a completion frame', async () => {
    await mountStream()
    emit('message.start')

    emit('session.info', { running: false })

    expect($workProgressSessions.get()[SID]).toBeUndefined()
  })
})
