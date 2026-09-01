import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesModule from '@/hermes'
import { rendererDurableKey, rendererRuntimeKey } from '@/lib/session-runtime-key'
import { setSessions } from '@/store/session'
import { $sessionTiles, sessionTileDelegate } from '@/store/session-states'
import type { SessionInfo } from '@/types/hermes'

import { useSessionTileDelegate } from './use-session-tile-delegate'

vi.mock('@/hermes', async importActual => ({
  ...(await importActual<typeof HermesModule>()),
  getLatestSessionMessagesForOwner: vi.fn(async () => ({ messages: [], session_id: '' }))
}))

const { getLatestSessionMessagesForOwner } = await import('@/hermes')

const row = (over: Partial<SessionInfo>): SessionInfo =>
  ({
    ended_at: null,
    id: 'live',
    input_tokens: 0,
    is_active: false,
    last_active: 0,
    message_count: 1,
    model: null,
    output_tokens: 0,
    preview: null,
    profile: 'default',
    source: null,
    started_at: 0,
    title: null,
    ...over
  }) as SessionInfo

function renderTile(
  requestGateway: ReturnType<typeof vi.fn>,
  refs?: {
    getStoredSessionIdForRuntime?: (runtimeSessionId: string) => null | string
    requestedStoredSessionIds?: string[]
    runtimeIdByStoredSessionIdRef?: { current: Map<string, string> }
    sessionStateByRuntimeIdRef?: { current: Map<string, unknown> }
    updateSessionState?: ReturnType<typeof vi.fn>
  }
) {
  renderHook(() =>
    useSessionTileDelegate({
      archiveSession: vi.fn(async () => undefined),
      bindSessionRuntime: vi.fn((_storedSessionId, runtimeSessionId) => runtimeSessionId),
      branchStoredSession: vi.fn(async () => undefined),
      createProvisionalTileRuntime: vi.fn(async () => 'runtime-provisional'),
      executeSlashCommand: vi.fn(async () => undefined) as never,
      getRuntimeIdForStoredSession: storedSessionId =>
        refs?.runtimeIdByStoredSessionIdRef?.current.get(storedSessionId) ?? null,
      getStoredSessionIdForRuntime: refs?.getStoredSessionIdForRuntime ?? (() => null),
      invalidateSessionRuntimeBinding: vi.fn(),
      removeSession: vi.fn(async () => undefined),
      requestForStoredSession: (<T,>(
        _storedSessionId: string,
        method: string,
        params?: Record<string, unknown>,
        timeoutMs?: number
      ) => {
        refs?.requestedStoredSessionIds?.push(_storedSessionId)
        const request = requestGateway as unknown as (
          method: string,
          params?: Record<string, unknown>,
          timeoutMs?: number
        ) => Promise<T>

        return timeoutMs === undefined ? request(method, params) : request(method, params, timeoutMs)
      }) as never,
      runtimeIdByStoredSessionIdRef: (refs?.runtimeIdByStoredSessionIdRef ?? { current: new Map() }) as never,
      sessionStateByRuntimeIdRef: (refs?.sessionStateByRuntimeIdRef ?? { current: new Map() }) as never,
      updateSessionState: (refs?.updateSessionState ?? vi.fn()) as never
    })
  )
}

function setTileOwner(storedSessionId: string, owner: { connectionId: null | string; profile: string }) {
  $sessionTiles.set([{ dir: 'right', kind: 'durable', owner, storedSessionId }] as never)
}

describe('useSessionTileDelegate resumeTile', () => {
  beforeEach(() => {
    setSessions([])
    $sessionTiles.set([])
    vi.mocked(getLatestSessionMessagesForOwner).mockClear()
  })

  afterEach(() => {
    setSessions([])
    $sessionTiles.set([])
  })

  it('carries the owning profile into a cold tile resume so it cannot fork profiles', async () => {
    // A tile opens a session owned by another profile. Resuming without the
    // profile lets the gateway fall back to the launch-profile DB and clone the
    // conversation into the wrong profile (#67603). The owning profile must ride
    // both the transcript prefetch and the resume RPC.
    setSessions([row({ connection_id: 'source-a', id: 'stored-x', profile: 'ai-engineer' })])
    setTileOwner('stored-x', { connectionId: 'source-a', profile: 'ai-engineer' })

    const requestGateway = vi.fn(async (method: string) =>
      method === 'session.resume' ? ({ session_id: 'runtime-1' } as never) : ({} as never)
    )

    renderTile(requestGateway)
    const runtimeId = await sessionTileDelegate()!.resumeTile('stored-x')

    expect(runtimeId).toBe('runtime-1')
    expect(getLatestSessionMessagesForOwner).toHaveBeenCalledWith('stored-x', {
      connectionId: 'source-a',
      profile: 'ai-engineer'
    })
    expect(requestGateway).toHaveBeenCalledWith('session.resume', {
      session_id: 'stored-x',
      cols: 96,
      profile: 'ai-engineer',
      omit_messages: true
    })
  })

  it('resolves and carries a default-profile session explicitly', async () => {
    setSessions([row({ id: 'stored-y', profile: 'default' })])
    setTileOwner('stored-y', { connectionId: null, profile: 'default' })

    const requestGateway = vi.fn(async (method: string) =>
      method === 'session.resume' ? ({ session_id: 'runtime-2' } as never) : ({} as never)
    )

    renderTile(requestGateway)
    await sessionTileDelegate()!.resumeTile('stored-y')

    expect(requestGateway).toHaveBeenCalledWith('session.resume', {
      session_id: 'stored-y',
      cols: 96,
      profile: 'default',
      omit_messages: true
    })
  })

  it('reuses a warm binding that still carries a transcript', async () => {
    const stateA = { busy: false, messages: [{ id: 'm1' }], storedSessionId: 'stored-a' }
    const runtimeIdByStoredSessionIdRef = { current: new Map([['stored-a', 'runtime-a']]) }
    const sessionStateByRuntimeIdRef = { current: new Map([['runtime-a', stateA]]) }
    const requestGateway = vi.fn(async () => ({}) as never)

    renderTile(requestGateway, { runtimeIdByStoredSessionIdRef, sessionStateByRuntimeIdRef })
    const runtimeId = await sessionTileDelegate()!.resumeTile('stored-a')

    expect(runtimeId).toBe('runtime-a')
    expect(requestGateway).not.toHaveBeenCalled()
  })

  it('falls through to a real resume when the warm binding has no transcript (post-wake empty tile)', async () => {
    // Sleep/wake regression: a released/stale cached state (messages: []) must
    // NOT satisfy the warm path — reusing it re-bound the tile to a dead
    // runtime id and painted the pane permanently empty.
    setSessions([row({ id: 'stored-b', profile: 'default' })])
    setTileOwner('stored-b', { connectionId: null, profile: 'default' })

    const staleState = { busy: false, messages: [], storedSessionId: 'stored-b' }
    const runtimeIdByStoredSessionIdRef = { current: new Map([['stored-b', 'runtime-dead']]) }
    const sessionStateByRuntimeIdRef = { current: new Map([['runtime-dead', staleState]]) }

    const requestGateway = vi.fn(async (method: string) =>
      method === 'session.resume' ? ({ session_id: 'runtime-fresh' } as never) : ({} as never)
    )

    renderTile(requestGateway, { runtimeIdByStoredSessionIdRef, sessionStateByRuntimeIdRef })
    const runtimeId = await sessionTileDelegate()!.resumeTile('stored-b')

    expect(runtimeId).toBe('runtime-fresh')
    expect(requestGateway).toHaveBeenCalledWith('session.resume', {
      session_id: 'stored-b',
      cols: 96,
      profile: 'default',
      omit_messages: true
    })
  })

  it('invalidateRuntimeBindings clears the stored→runtime map so tiles re-resume after reconnect', async () => {
    setSessions([row({ id: 'stored-c', profile: 'default' })])
    setTileOwner('stored-c', { connectionId: null, profile: 'default' })

    const liveState = { busy: false, messages: [{ id: 'm1' }], storedSessionId: 'stored-c' }
    const runtimeIdByStoredSessionIdRef = { current: new Map([['stored-c', 'runtime-dead']]) }
    const sessionStateByRuntimeIdRef = { current: new Map([['runtime-dead', liveState]]) }

    const requestGateway = vi.fn(async (method: string) =>
      method === 'session.resume' ? ({ session_id: 'runtime-fresh' } as never) : ({} as never)
    )

    renderTile(requestGateway, { runtimeIdByStoredSessionIdRef, sessionStateByRuntimeIdRef })

    // Gateway reconnect (what resetTileRuntimeBindings calls on wake):
    sessionTileDelegate()!.invalidateRuntimeBindings!()
    expect(runtimeIdByStoredSessionIdRef.current.size).toBe(0)

    // The next resume goes cold instead of reusing the dead binding.
    const runtimeId = await sessionTileDelegate()!.resumeTile('stored-c')
    expect(runtimeId).toBe('runtime-fresh')
  })
})

describe('useSessionTileDelegate interruptSession', () => {
  beforeEach(() => {
    setSessions([])
  })

  afterEach(async () => {
    setSessions([])
    const { clearSessionRecentlyInterrupted } = await import('../../session/hooks/use-prompt-actions/utils')
    clearSessionRecentlyInterrupted()
  })

  it('marks the session recently interrupted so a quick tile edit/resend still interrupt-firsts (#83855)', async () => {
    const { isSessionRecentlyInterrupted } = await import('../../session/hooks/use-prompt-actions/utils')

    const requestGateway = vi.fn(async () => ({}) as never)

    renderTile(requestGateway, {
      getStoredSessionIdForRuntime: runtimeSessionId =>
        runtimeSessionId === 'runtime-tile-1' ? 'stored-tile-1' : null,
      runtimeIdByStoredSessionIdRef: { current: new Map([['stored-tile-1', 'runtime-tile-1']]) }
    })
    await sessionTileDelegate()!.interruptSession('runtime-tile-1')

    expect(requestGateway).toHaveBeenCalledWith('session.interrupt', { session_id: 'runtime-tile-1' })
    // Same 3s cooldown the primary chat's Stop sets: busy reads false while the
    // gateway winds down, so the rewind path must still interrupt-first.
    expect(isSessionRecentlyInterrupted('runtime-tile-1')).toBe(true)
  })

  it('reverse-resolves a missing cache slice without treating rendererDurableKey as a stored id', async () => {
    const backend = { connectionId: 'source-a', gatewayEpoch: 7, profile: 'research' }
    const runtimeId = rendererRuntimeKey(backend, 'shared-runtime')
    const durableKey = rendererDurableKey(backend, 'stored-a')
    const requestedStoredSessionIds: string[] = []
    const getStoredSessionIdForRuntime = vi.fn(() => 'stored-a')
    const requestGateway = vi.fn(async () => ({}) as never)

    renderTile(requestGateway, {
      getStoredSessionIdForRuntime,
      requestedStoredSessionIds,
      runtimeIdByStoredSessionIdRef: { current: new Map([[durableKey, runtimeId]]) },
      sessionStateByRuntimeIdRef: { current: new Map() }
    })

    await sessionTileDelegate()!.interruptSession(runtimeId)

    expect(getStoredSessionIdForRuntime).toHaveBeenCalledWith(runtimeId)
    expect(requestedStoredSessionIds).toEqual(['stored-a'])
    expect(requestedStoredSessionIds).not.toContain(durableKey)
  })
})
