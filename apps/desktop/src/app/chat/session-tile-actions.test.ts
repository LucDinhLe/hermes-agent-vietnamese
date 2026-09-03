import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { group } from '@/components/pane-shell/tree/model'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import type { SessionTileOwner } from '@/store/session-states'

import { MAIN_COMPOSER_SCOPE } from './composer/scope'

const requestGatewayMock = vi.hoisted(() => vi.fn())
const requestOwnerMock = vi.hoisted(() => vi.fn())
const getSessionForOwnerMock = vi.hoisted(() => vi.fn())

const RendererRuntimeEpochMismatchErrorMock = vi.hoisted(
  () =>
    class RendererRuntimeEpochMismatchError extends Error {
      constructor() {
        super('stale renderer runtime epoch')
        this.name = 'RendererRuntimeEpochMismatchError'
      }
    }
)

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionForOwner: getSessionForOwnerMock
}))

vi.mock('@/store/session-request-router', () => ({
  RendererRuntimeEpochMismatchError: RendererRuntimeEpochMismatchErrorMock,
  requestForSessionOwner: (owner: unknown, method: string, params?: Record<string, unknown>, timeoutMs?: number) => {
    requestOwnerMock(owner, method, params, timeoutMs)

    return requestGatewayMock(method, params, timeoutMs)
  }
}))

const { $layoutTree } = await import('@/components/pane-shell/tree/store')

const {
  $sessionTiles,
  activateSessionTileOwner,
  discardSessionTile,
  isProvisionalSessionTile,
  openProvisionalSessionTile,
  setSessionTileDelegate
} = await import('@/store/session-states')

const { promoteProvisionalTileWithLayout, useSessionTileActions } = await import('./session-tile-actions')

const RUNTIME_SESSION_ID = 'rt-tile-current'
const STORED_SESSION_ID = 'stored-tile-db'
const RECOVERED_SESSION_ID = 'rt-tile-recovered'

const RECOVERED_RENDERER_RUNTIME_ID = rendererRuntimeKey(
  { connectionId: null, gatewayEpoch: 1, profile: 'default' },
  RECOVERED_SESSION_ID
)

function renderTileActions(owner: SessionTileOwner = { connectionId: null, profile: 'default' }) {
  return renderHook(() =>
    useSessionTileActions({
      runtimeId: RUNTIME_SESSION_ID,
      scope: MAIN_COMPOSER_SCOPE,
      storedSessionId: STORED_SESSION_ID,
      tile: {
        kind: 'durable',
        owner,
        runtimeId: RUNTIME_SESSION_ID,
        storedSessionId: STORED_SESSION_ID
      }
    })
  )
}

function renderProvisionalTileActions() {
  return renderHook(() =>
    useSessionTileActions({
      runtimeId: RUNTIME_SESSION_ID,
      scope: MAIN_COMPOSER_SCOPE,
      storedSessionId: 'draft-local-stable',
      tile: {
        draftId: 'draft-local-stable',
        kind: 'provisional',
        owner: { connectionId: 'mbc-source', profile: 'mbc' },
        provisionalStoredSessionId: 'candidate-never-durable',
        runtimeId: RUNTIME_SESSION_ID,
        storedSessionId: 'draft-local-stable'
      }
    })
  )
}

describe('provisional tile promotion transaction', () => {
  const owner = { connectionId: 'mbc-source', profile: 'mbc' } as const

  const provisional = {
    draftId: 'draft-local-stable',
    kind: 'provisional' as const,
    owner,
    provisionalStoredSessionId: 'candidate-never-durable',
    runtimeId: RUNTIME_SESSION_ID,
    storedSessionId: 'draft-local-stable'
  }

  beforeEach(() => {
    window.localStorage.clear()
    activateSessionTileOwner(owner)
    $sessionTiles.set([])
    openProvisionalSessionTile(provisional)
  })

  afterEach(() => {
    $sessionTiles.set([])
    $layoutTree.set(null)
  })

  it('does not mutate the tile store when the draft pane is missing or the durable destination collides', () => {
    $layoutTree.set(group(['workspace'], { active: 'workspace', id: 'main' }))

    expect(
      promoteProvisionalTileWithLayout({
        durableSessionId: 'durable-confirmed',
        provisionalTile: provisional,
        runtimeId: RUNTIME_SESSION_ID
      })
    ).toBeNull()
    expect($sessionTiles.get()).toEqual([
      expect.objectContaining({ draftId: provisional.draftId, kind: 'provisional' })
    ])

    $layoutTree.set(
      group([`session-tile:${provisional.draftId}`, 'session-tile:durable-confirmed'], {
        active: `session-tile:${provisional.draftId}`,
        id: 'main'
      })
    )

    expect(
      promoteProvisionalTileWithLayout({
        durableSessionId: 'durable-confirmed',
        provisionalTile: provisional,
        runtimeId: RUNTIME_SESSION_ID
      })
    ).toBeNull()
    expect($sessionTiles.get()).toEqual([
      expect.objectContaining({ draftId: provisional.draftId, kind: 'provisional' })
    ])
  })

  it('rekeys layout and tile together, and rolls the tile back if layout changes during the transition', () => {
    $layoutTree.set(
      group([`session-tile:${provisional.draftId}`], {
        active: `session-tile:${provisional.draftId}`,
        id: 'main'
      })
    )

    const unsubscribe = $sessionTiles.subscribe(tiles => {
      if (tiles.some(tile => !isProvisionalSessionTile(tile) && tile.storedSessionId === 'durable-confirmed')) {
        $layoutTree.set(group(['workspace'], { active: 'workspace', id: 'main' }))
      }
    })

    expect(
      promoteProvisionalTileWithLayout({
        durableSessionId: 'durable-confirmed',
        provisionalTile: provisional,
        runtimeId: RUNTIME_SESSION_ID
      })
    ).toBeNull()
    unsubscribe()

    expect($sessionTiles.get()).toEqual([
      expect.objectContaining({ draftId: provisional.draftId, kind: 'provisional' })
    ])

    $layoutTree.set(
      group([`session-tile:${provisional.draftId}`], {
        active: `session-tile:${provisional.draftId}`,
        id: 'main'
      })
    )

    expect(
      promoteProvisionalTileWithLayout({
        durableSessionId: 'durable-confirmed',
        provisionalTile: provisional,
        runtimeId: RUNTIME_SESSION_ID
      })
    ).toMatchObject({ durableSessionId: 'durable-confirmed' })
    expect($sessionTiles.get()).toEqual([
      expect.objectContaining({ kind: 'durable', storedSessionId: 'durable-confirmed' })
    ])
    expect($layoutTree.get()).toEqual(
      group(['session-tile:durable-confirmed'], { active: 'session-tile:durable-confirmed', id: 'main' })
    )
  })
})

// A tile's cancelRun/steerPrompt/reloadFromMessage each build their own
// requestGateway call directly instead of going through the shared
// submitPromptText pipeline (which already wraps its call in
// withSessionNotFoundResume) — see use-prompt-actions/index.test.tsx's
// "sleep/wake session recovery" suite for the same regression on the
// primary chat's own reloadFromMessage.
describe('useSessionTileActions sleep/wake session recovery', () => {
  beforeEach(() => {
    setSessionTileDelegate({
      archiveSession: vi.fn(async () => undefined),
      branchSession: vi.fn(async () => undefined),
      bindSessionRuntime: vi.fn((_storedId, runtimeId) =>
        rendererRuntimeKey({ connectionId: null, gatewayEpoch: 1, profile: 'default' }, runtimeId)
      ),
      deleteSession: vi.fn(async () => undefined),
      executeSlash: vi.fn(async () => undefined),
      interruptSession: vi.fn(async () => undefined),
      resumeTile: vi.fn(async () => RUNTIME_SESSION_ID),
      submitToSession: vi.fn(async () => undefined),
      updateSession: vi.fn((_runtimeId, updater) =>
        updater({
          attachedImages: [],
          busy: false,
          cwd: null,
          messages: [],
          model: null,
          streamId: null,
          storedSessionId: STORED_SESSION_ID
        } as never)
      )
    })
  })

  afterEach(() => {
    requestGatewayMock.mockReset()
    requestOwnerMock.mockReset()
    getSessionForOwnerMock.mockReset()
    vi.restoreAllMocks()
  })

  it.each(['draft-local-stable', 'draft-another-tile'])(
    'validates the actual composer scope on a provisional first send: %s',
    async composerScope => {
      const owner = { connectionId: 'mbc-source', profile: 'mbc' } as const

      activateSessionTileOwner(owner)
      $sessionTiles.set([])
      openProvisionalSessionTile({
        draftId: 'draft-local-stable',
        owner,
        provisionalStoredSessionId: 'candidate-never-durable',
        runtimeId: RUNTIME_SESSION_ID
      })
      $layoutTree.set(
        group(['session-tile:draft-local-stable'], {
          active: 'session-tile:draft-local-stable',
          id: 'main'
        })
      )
      requestGatewayMock.mockResolvedValue({})
      getSessionForOwnerMock.mockResolvedValue({
        id: 'candidate-never-durable',
        profile: 'mbc',
        source: 'desktop',
        title: 'first send',
        message_count: 1,
        started_at: 1,
        last_active: 1
      })
      const { result, unmount } = renderProvisionalTileActions()

      try {
        const ok = await act(async () => result.current.submitText('first send', { composerScope }))

        expect(ok).toBe(composerScope === 'draft-local-stable')
        const submits = requestOwnerMock.mock.calls.filter(([, method]) => method === 'prompt.submit')

        if (composerScope === 'draft-local-stable') {
          expect(submits).toHaveLength(1)
          expect(submits[0]).toEqual([
            owner,
            'prompt.submit',
            expect.objectContaining({ session_id: RUNTIME_SESSION_ID }),
            expect.any(Number)
          ])
          expect($sessionTiles.get()).toEqual([
            expect.objectContaining({ kind: 'durable', storedSessionId: 'candidate-never-durable' })
          ])
        } else {
          expect(submits).toEqual([])
          expect(getSessionForOwnerMock).not.toHaveBeenCalled()
        }
      } finally {
        unmount()
        $sessionTiles.set([])
        $layoutTree.set(null)
      }
    }
  )

  it('routes a duplicate durable id through the owner captured by the tile', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'mbc' } as const

    requestGatewayMock.mockResolvedValue({})
    const { result } = renderTileActions(ownerA)

    await act(async () => {
      await result.current.cancelRun()
    })

    expect(requestOwnerMock).toHaveBeenCalledWith(
      ownerA,
      'session.interrupt',
      { session_id: RUNTIME_SESSION_ID },
      undefined
    )
  })

  it('keeps the same profile, stored id, and runtime isolated across A and B tiles', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'mbc' } as const
    const ownerB = { connectionId: 'source-b', profile: 'mbc' } as const

    requestGatewayMock.mockResolvedValue({})
    const tileA = renderTileActions(ownerA)

    await act(async () => {
      await tileA.result.current.cancelRun()
    })
    tileA.unmount()

    const tileB = renderTileActions(ownerB)

    await act(async () => {
      await tileB.result.current.cancelRun()
    })

    expect(requestOwnerMock.mock.calls.map(([owner, method, params]) => ({ method, owner, params }))).toEqual([
      { method: 'session.interrupt', owner: ownerA, params: { session_id: RUNTIME_SESSION_ID } },
      { method: 'session.interrupt', owner: ownerB, params: { session_id: RUNTIME_SESSION_ID } }
    ])
  })

  it('eventually promotes a tile when its exact-owner DB row appears after the initial window', async () => {
    const owner = { connectionId: 'mbc-source', profile: 'mbc' } as const
    let rowAvailable = false

    activateSessionTileOwner(owner)

    for (const existing of $sessionTiles.get()) {
      discardSessionTile(existing.storedSessionId)
    }

    openProvisionalSessionTile({
      draftId: 'draft-local-stable',
      owner,
      provisionalStoredSessionId: 'candidate-never-durable',
      runtimeId: RUNTIME_SESSION_ID
    })
    $layoutTree.set(
      group(['session-tile:draft-local-stable'], {
        active: 'session-tile:draft-local-stable',
        id: 'main'
      })
    )

    getSessionForOwnerMock.mockImplementation(async (storedSessionId, exactOwner) => {
      if (!rowAvailable) {
        throw new Error('row not committed yet')
      }

      return {
        ended_at: null,
        id: storedSessionId,
        input_tokens: 0,
        is_active: false,
        last_active: 1,
        message_count: 1,
        model: null,
        output_tokens: 0,
        preview: '/status',
        profile: exactOwner.profile,
        source: 'desktop',
        started_at: 1,
        title: 'confirmed',
        tool_call_count: 0
      }
    })

    const { result } = renderProvisionalTileActions()

    vi.useFakeTimers()

    try {
      const initial = result.current.submitText('/status')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_150)
      })
      await expect(initial).resolves.toBe(true)
      expect($sessionTiles.get()).toContainEqual(
        expect.objectContaining({ draftId: 'draft-local-stable', kind: 'provisional' })
      )

      rowAvailable = true
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
        await Promise.resolve()
      })

      expect(getSessionForOwnerMock).toHaveBeenLastCalledWith('candidate-never-durable', owner)
      expect($sessionTiles.get()).toEqual([
        expect.objectContaining({ kind: 'durable', storedSessionId: 'candidate-never-durable' })
      ])
      expect($layoutTree.get()).toEqual(
        group(['session-tile:candidate-never-durable'], {
          active: 'session-tile:candidate-never-durable',
          id: 'main'
        })
      )

      const lookupCount = getSessionForOwnerMock.mock.calls.length

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      expect(getSessionForOwnerMock).toHaveBeenCalledTimes(lookupCount)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resumes the stored session and retries once when session.interrupt reports "session not found"', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []
    let interruptAttempts = 0

    requestGatewayMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params })

      if (method === 'session.interrupt') {
        interruptAttempts += 1

        if (interruptAttempts === 1) {
          throw Object.assign(new Error('opaque gateway failure'), { code: 4007 })
        }

        return {}
      }

      if (method === 'session.resume') {
        return { session_id: RECOVERED_SESSION_ID }
      }

      return {}
    })

    const { result } = renderTileActions()

    await act(async () => {
      await result.current.cancelRun()
    })

    // First interrupt (stale id) → session.resume (stored id) → retry interrupt (fresh id).
    expect(calls.map(c => c.method)).toEqual(['session.interrupt', 'session.resume', 'session.interrupt'])
    expect(calls[0]?.params).toEqual({ session_id: RUNTIME_SESSION_ID })
    expect(calls[1]?.params).toEqual({
      session_id: STORED_SESSION_ID,
      source: 'desktop',
      omit_messages: true,
      profile: 'default'
    })
    expect(calls[2]?.params).toEqual({ session_id: RECOVERED_RENDERER_RUNTIME_ID })
  })

  it('resumes the stored session and retries once when session.redirect (steer) reports "session not found"', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []
    let redirectAttempts = 0

    requestGatewayMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params })

      if (method === 'session.redirect') {
        redirectAttempts += 1

        if (redirectAttempts === 1) {
          throw Object.assign(new Error('opaque gateway failure'), { code: 4007 })
        }

        return { status: 'redirected' }
      }

      if (method === 'session.resume') {
        return { session_id: RECOVERED_SESSION_ID }
      }

      return {}
    })

    const { result } = renderTileActions()

    const ok = await act(async () => result.current.steerPrompt('actually use Postgres'))

    expect(ok).toBe(true)
    expect(calls.map(c => c.method)).toEqual(['session.redirect', 'session.resume', 'session.redirect'])
    expect(calls[2]?.params).toEqual({ session_id: RECOVERED_RENDERER_RUNTIME_ID, text: 'actually use Postgres' })
  })

  it('never resumes a provisional candidate after structural 4007', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []

    requestGatewayMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params })

      if (method === 'session.interrupt') {
        throw Object.assign(new Error('opaque gateway failure'), { code: 4007 })
      }

      return {}
    })

    const owner = { connectionId: 'mbc-source', profile: 'mbc' } as const

    activateSessionTileOwner(owner)
    openProvisionalSessionTile({
      draftId: 'draft-local-stable',
      owner,
      provisionalStoredSessionId: 'candidate-never-durable',
      runtimeId: RUNTIME_SESSION_ID
    })

    const { result } = renderProvisionalTileActions()

    await act(async () => {
      await result.current.cancelRun()
    })

    expect(calls).toEqual([{ method: 'session.interrupt', params: { session_id: RUNTIME_SESSION_ID } }])
    expect(calls.some(call => call.method === 'session.resume')).toBe(false)
    expect($sessionTiles.get()).toContainEqual(
      expect.objectContaining({
        draftId: 'draft-local-stable',
        error: 'Hermes không còn giữ phiên đang chạy này. Cuộc trò chuyện và bản nháp vẫn được giữ.',
        provisionalStoredSessionId: undefined,
        runtimeId: undefined
      })
    )
  })

  it('invalidates a provisional runtime on a stale socket epoch without resuming its candidate', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = []

    requestGatewayMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params })

      if (method === 'session.interrupt') {
        throw new RendererRuntimeEpochMismatchErrorMock()
      }

      return {}
    })

    const owner = { connectionId: 'mbc-source', profile: 'mbc' } as const

    activateSessionTileOwner(owner)
    openProvisionalSessionTile({
      draftId: 'draft-local-stable',
      owner,
      provisionalStoredSessionId: 'candidate-never-durable',
      runtimeId: RUNTIME_SESSION_ID
    })

    const { result } = renderProvisionalTileActions()

    await act(async () => {
      await result.current.cancelRun()
    })

    expect(calls).toEqual([{ method: 'session.interrupt', params: { session_id: RUNTIME_SESSION_ID } }])
    expect(calls.some(call => call.method === 'session.resume')).toBe(false)
    expect($sessionTiles.get()).toContainEqual(
      expect.objectContaining({
        draftId: 'draft-local-stable',
        error: 'Hermes không còn giữ phiên đang chạy này. Cuộc trò chuyện và bản nháp vẫn được giữ.',
        provisionalStoredSessionId: undefined,
        runtimeId: undefined
      })
    )
  })
})
