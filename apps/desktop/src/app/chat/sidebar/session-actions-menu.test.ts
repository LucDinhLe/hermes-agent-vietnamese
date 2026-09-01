import { atom } from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $activeSessionId, $selectedStoredSessionId, $sessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { renameSessionPreferringRpc } from './session-actions-menu'

// The branched-session rename bug: a freshly branched session lives only in the
// gateway's runtime _sessions map (no state.db row yet), so REST PATCH
// /api/sessions/{id} 404s with "Session not found". renameSessionPreferringRpc
// must route the ACTIVE row through the session.title RPC (runtime id), which
// persists the row on demand, and otherwise fall back to REST.

// Hoisted so the vi.mock factories below (which vitest lifts to the top of the
// module) can reference these before the module body runs. This matters because
// projects.ts subscribes to $gateway at import and nanostores fires the
// subscriber synchronously — that reaches the @/store/gateway mock's
// activeGateway() during the transitive import on line 4, before a plain
// module-level const would be initialized (temporal dead zone).
const { renameSessionForOwner, request, activeGateway } = vi.hoisted(() => ({
  renameSessionForOwner: vi.fn(async () => ({ ok: true, title: 'rest-title' })),
  request: vi.fn(async (_method: string, _params?: Record<string, unknown>) => ({ title: 'rpc-title' }) as never),
  activeGateway: vi.fn<() => { request: unknown } | null>(() => ({ request: undefined }))
}))

// Wire activeGateway's default return to the shared request mock now that it exists.
activeGateway.mockReturnValue({ request })

vi.mock('@/hermes', () => ({
  renameSessionForOwner: (...args: unknown[]) => renameSessionForOwner(...(args as [])),
  // profile.ts calls this at import (its $activeGatewayProfile subscribe fires
  // immediately), pulled in transitively via session-states.
  setApiRequestProfile: () => {},
  HermesGateway: class {}
}))

vi.mock('@/store/gateway', () => ({
  // projects.ts subscribes to $gateway at module load (its repo-scan sync fires
  // immediately), pulled in transitively via the session store. Provide a real
  // atom plus the hoisted activeGateway so the synchronous subscriber doesn't
  // throw on an incomplete mock or hit an uninitialized reference.
  $gateway: atom(null),
  activeGateway: () => activeGateway()
}))

vi.mock('@/store/session-request-router', () => ({
  requestForRendererRuntime: (runtimeId: string, method: string, params: Record<string, unknown>) => {
    if (!activeGateway()) {
      return Promise.reject(new Error('not connected'))
    }

    return request(method, { session_id: runtimeId, ...params })
  }
}))

const RUNTIME_ID = 'rt-runtime-1'
const STORED_ID = 'stored-branch-1'
const ownerA = { connectionId: 'source-a', profile: 'work' }
const row = (): SessionInfo =>
  ({
    connection_id: ownerA.connectionId,
    id: STORED_ID,
    message_count: 1,
    profile: ownerA.profile,
    source: 'cli',
    started_at: 0,
    title: 'Stored'
  }) as SessionInfo

afterEach(() => {
  renameSessionForOwner.mockClear()
  request.mockClear()
  activeGateway.mockReset()
  activeGateway.mockReturnValue({ request })
  $activeSessionId.set(null)
  $selectedStoredSessionId.set(null)
  $sessions.set([])
})

describe('renameSessionPreferringRpc', () => {
  it('renames the active branched session via the session.title RPC, not REST', async () => {
    $selectedStoredSessionId.set(STORED_ID)
    $activeSessionId.set(RUNTIME_ID)

    const result = await renameSessionPreferringRpc(STORED_ID, 'My branch')

    expect(request).toHaveBeenCalledWith('session.title', { session_id: RUNTIME_ID, title: 'My branch' })
    expect(renameSessionForOwner).not.toHaveBeenCalled()
    expect(result.title).toBe('rpc-title')
  })

  it('falls back to REST when the RPC fails (e.g. socket mid-reconnect)', async () => {
    $selectedStoredSessionId.set(STORED_ID)
    $activeSessionId.set(RUNTIME_ID)
    $sessions.set([row()])
    request.mockRejectedValueOnce(new Error('not connected'))

    const result = await renameSessionPreferringRpc(STORED_ID, 'My branch', ownerA)

    expect(request).toHaveBeenCalledOnce()
    expect(renameSessionForOwner).toHaveBeenCalledWith(STORED_ID, 'My branch', ownerA)
    expect(result.title).toBe('rest-title')
  })

  it('uses REST for a non-active row (background/persisted session)', async () => {
    $selectedStoredSessionId.set('some-other-active-session')
    $activeSessionId.set(RUNTIME_ID)
    $sessions.set([row()])

    await renameSessionPreferringRpc(STORED_ID, 'My branch', ownerA)

    expect(request).not.toHaveBeenCalled()
    expect(renameSessionForOwner).toHaveBeenCalledWith(STORED_ID, 'My branch', ownerA)
  })

  it('uses REST when clearing the title (RPC rejects empty titles)', async () => {
    $selectedStoredSessionId.set(STORED_ID)
    $activeSessionId.set(RUNTIME_ID)
    $sessions.set([row()])

    await renameSessionPreferringRpc(STORED_ID, '', ownerA)

    expect(request).not.toHaveBeenCalled()
    expect(renameSessionForOwner).toHaveBeenCalledWith(STORED_ID, '', ownerA)
  })

  it('uses REST when no gateway is connected', async () => {
    $selectedStoredSessionId.set(STORED_ID)
    $activeSessionId.set(RUNTIME_ID)
    activeGateway.mockReturnValue(null)
    $sessions.set([row()])

    await renameSessionPreferringRpc(STORED_ID, 'My branch', ownerA)

    expect(request).not.toHaveBeenCalled()
    expect(renameSessionForOwner).toHaveBeenCalledWith(STORED_ID, 'My branch', ownerA)
  })

  it('fails closed when a REST fallback has no exact backend owner', async () => {
    await expect(renameSessionPreferringRpc(STORED_ID, '')).rejects.toThrow('exact backend owner')
    expect(renameSessionForOwner).not.toHaveBeenCalled()
  })
})
