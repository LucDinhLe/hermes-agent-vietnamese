import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBackendKey } from '@/app/session/session-binding-registry'
import { parseRendererRuntimeKey, rendererRuntimeKey } from '@/lib/session-runtime-key'
import type { ProfileInfo } from '@/types/hermes'

vi.mock('@/app/chat/session-view', async () => {
  const { atom } = await import('nanostores')

  return { PRIMARY_SESSION_VIEW: { $awaitingResponse: atom(false), $busy: atom(false) } }
})
vi.mock('@/app/open-session', () => ({ openSession: vi.fn() }))
vi.mock('@/components/pane-shell/tree/store', async () => {
  const { atom } = await import('nanostores')

  return { $narrowViewport: atom(false) }
})
vi.mock('@/contrib/events', () => ({ onGatewayEvent: vi.fn() }))
vi.mock('@/hermes', () => ({ deleteProfile: vi.fn(), getLogs: vi.fn(), getStatus: vi.fn() }))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/store/system-actions', () => ({ runGatewayRestart: vi.fn() }))
vi.mock('@/store/session', async () => {
  const { atom } = await import('nanostores')

  return {
    $activeSessionId: atom(null),
    $connection: atom(null),
    $currentCwd: atom(''),
    $currentModel: atom(''),
    $gatewayState: atom('open'),
    $messages: atom([]),
    $selectedStoredSessionId: atom(null),
    $sessions: atom([]),
    rememberedSessionProfile: (_sessions: unknown, _sessionId: null | string, activeProfile: null | string) =>
      (activeProfile ?? '').trim() || 'default',
    requestSessionResume: vi.fn(),
    setResumeExhaustedSessionId: vi.fn()
  }
})
vi.mock('@/store/session-states', async () => {
  const { atom } = await import('nanostores')

  return {
    $focusedRuntimeId: atom(null),
    $focusedSessionState: atom(null),
    $focusedStoredSessionId: atom(null),
    $sessionStates: atom({})
  }
})
vi.mock('@/store/profile', async () => {
  const { atom } = await import('nanostores')

  const profiles = atom([
    {
      has_env: false,
      is_default: false,
      model: null,
      name: 'cached-only',
      path: '/profiles/cached-only',
      provider: null,
      skill_count: 0
    }
  ])

  return {
    $activeGatewayProfile: atom('remote-worker'),
    $gatewaySwapTarget: atom(null),
    $profiles: profiles,
    ensureGatewayAgent: vi.fn(),
    ensureGatewayProfile: vi.fn(),
    newSessionInProfile: vi.fn(),
    normalizeProfileKey: (value: null | string | undefined) => (value ?? '').trim() || 'default',
    refreshProfiles: vi.fn(async () => profiles.get()),
    selectProfile: vi.fn(),
    setActiveProfile: vi.fn(),
    setShowAllProfiles: vi.fn()
  }
})
vi.mock('@/store/gateway', async () => {
  const { atom } = await import('nanostores')

  return {
    $gateway: atom(null),
    activeGatewayConnectionId: vi.fn(() => null),
    ensureGatewayForAgent: vi.fn(),
    gatewayEpochForAgent: vi.fn(() => 7),
    openGatewayForAgent: vi.fn(),
    openGatewayForProfile: vi.fn(),
    requestGatewayForAgent: vi.fn(
      async (connectionId: string, profile: string, method: string, params: Record<string, unknown>) => ({
        connectionId,
        method,
        params,
        profile
      })
    ),
    requestGatewayForAgentWithBackend: vi.fn(
      async (connectionId: string, profile: string, method: string, params: Record<string, unknown>) => ({
        backend: { connectionId, gatewayEpoch: 7, profile },
        result: { connectionId, method, params, profile }
      })
    ),
    requestGatewayForProfile: vi.fn(async (profile: string, method: string, params: Record<string, unknown>) => ({
      method,
      params,
      profile
    })),
    requestGatewayForProfileWithBackend: vi.fn(
      async (profile: string, method: string, params: Record<string, unknown>) => ({
        backend: { connectionId: null, gatewayEpoch: 7, profile },
        result: { method, params, profile }
      })
    ),
    retireLocalProfileGateways: vi.fn()
  }
})

const { host } = await import('./index')
const { openSession: openSessionCore } = await import('@/app/open-session')
const { deleteProfile } = await import('@/hermes')

const {
  activeGatewayConnectionId,
  gatewayEpochForAgent,
  openGatewayForAgent,
  openGatewayForProfile,
  requestGatewayForAgent,
  requestGatewayForAgentWithBackend,
  requestGatewayForProfile,
  requestGatewayForProfileWithBackend,
  retireLocalProfileGateways
} = await import('@/store/gateway')

const {
  $activeGatewayProfile,
  $gatewaySwapTarget,
  $profiles,
  ensureGatewayAgent,
  ensureGatewayProfile,
  refreshProfiles,
  setShowAllProfiles
} = await import('@/store/profile')

const { $focusedRuntimeId, $focusedSessionState, $focusedStoredSessionId } = await import('@/store/session-states')

const {
  $activeSessionId,
  $messages,
  $selectedStoredSessionId,
  $sessions,
  requestSessionResume,
  setResumeExhaustedSessionId
} = await import('@/store/session')

const setMockAtom = <T>(store: unknown, value: T) => (store as { set(next: T): void }).set(value)

const profile = (name: string): ProfileInfo => ({
  has_env: false,
  is_default: name === 'default',
  model: null,
  name,
  path: `/profiles/${name}`,
  provider: null,
  skill_count: 0
})

afterEach(() => {
  vi.clearAllMocks()
  vi.mocked(activeGatewayConnectionId).mockReturnValue(null)
  vi.mocked(gatewayEpochForAgent).mockReturnValue(7)
  $activeGatewayProfile.set('remote-worker')
  $gatewaySwapTarget.set(null)
  setMockAtom($focusedRuntimeId, null)
  setMockAtom($focusedStoredSessionId, null)
  setMockAtom($focusedSessionState, null)
  setMockAtom($activeSessionId, null)
  setMockAtom($selectedStoredSessionId, null)
  setMockAtom($messages, [])
  setMockAtom($sessions, [])
  $profiles.set([profile('cached-only')])
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

describe('connection-aware plugin host APIs', () => {
  it('routes a raw durable id by its own A/B owner instead of the focused session or ambient backend', async () => {
    setMockAtom($focusedStoredSessionId, 'stored-a')
    setMockAtom($sessions, [
      { connection_id: 'source-a', id: 'stored-a', profile: 'mbc' },
      { connection_id: 'source-b', id: 'stored-b', profile: 'mbc' }
    ])

    vi.mocked(requestGatewayForAgentWithBackend).mockResolvedValueOnce({
      backend: { connectionId: 'source-b', gatewayEpoch: 9, profile: 'mbc' },
      result: { session_id: 'runtime-b', session_key: 'stored-b' }
    })

    const resumed = await host.request<{ session_id: string }>('session.resume', { session_id: 'stored-b' })

    expect(requestGatewayForAgentWithBackend).toHaveBeenCalledWith('source-b', 'mbc', 'session.resume', {
      session_id: 'stored-b'
    })
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalledWith(
      'source-a',
      'mbc',
      'session.resume',
      expect.anything()
    )
    expect(parseRendererRuntimeKey(resumed.session_id)).toEqual({
      backend: { connectionId: 'source-b', gatewayEpoch: 9, profile: 'mbc' },
      runtimeSessionId: 'runtime-b'
    })
  })

  it('fails closed for an unqualified runtime id instead of guessing the focused owner', async () => {
    setMockAtom($focusedStoredSessionId, 'runtime-shared')
    // A coincident durable row must not turn a raw live capability into an
    // unfenced request. Method policy is checked before durable lookup.
    setMockAtom($sessions, [{ connection_id: 'source-a', id: 'runtime-shared', profile: 'mbc' }])

    await expect(host.request('session.interrupt', { session_id: 'runtime-shared' })).rejects.toThrow(
      /renderer runtime key is required/i
    )
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('rejects an A/B durable-id collision instead of selecting the first matching owner', async () => {
    setMockAtom($sessions, [
      { connection_id: 'source-a', id: 'stored-shared', profile: 'mbc' },
      { connection_id: 'source-b', id: 'stored-shared', profile: 'mbc' }
    ])

    await expect(host.request('session.resume', { session_id: 'stored-shared' })).rejects.toThrow(
      /one exact durable session owner/i
    )
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('keeps raw session.set_hidden on the explicit durable-owner path', async () => {
    setMockAtom($sessions, [{ connection_id: 'source-a', id: 'stored-a', profile: 'mbc' }])

    await host.request('session.set_hidden', { hidden: true, session_id: 'stored-a' })

    expect(requestGatewayForAgent).toHaveBeenCalledWith('source-a', 'mbc', 'session.set_hidden', {
      hidden: true,
      session_id: 'stored-a'
    })
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('qualifies a hidden offscreen create before its first live submit without a session row', async () => {
    $activeGatewayProfile.set('mbc')
    vi.mocked(activeGatewayConnectionId).mockReturnValue('source-a')
    vi.mocked(gatewayEpochForAgent).mockImplementation((connectionId, profileName) =>
      connectionId === 'source-a' && profileName === 'mbc' ? 11 : 0
    )
    vi.mocked(requestGatewayForAgentWithBackend).mockResolvedValueOnce({
      backend: { connectionId: 'source-a', gatewayEpoch: 11, profile: 'mbc' },
      result: { session_id: 'runtime-hidden', stored_session_id: 'stored-hidden' }
    })

    const created = await host.request<{ session_id: string; stored_session_id: string }>('session.create', {
      hidden: true,
      profile: 'mbc'
    })

    expect($sessions.get()).toEqual([])
    expect(parseRendererRuntimeKey(created.session_id)).toEqual({
      backend: { connectionId: 'source-a', gatewayEpoch: 11, profile: 'mbc' },
      runtimeSessionId: 'runtime-hidden'
    })

    await host.request('prompt.submit', { session_id: created.session_id, text: 'hello' })

    expect(requestGatewayForAgent).toHaveBeenCalledWith(
      'source-a',
      'mbc',
      'prompt.submit',
      { session_id: 'runtime-hidden', text: 'hello' },
      undefined,
      undefined,
      11
    )
  })

  it('retires a profile gateway before deleting it', async () => {
    const order: string[] = []

    vi.mocked(retireLocalProfileGateways).mockImplementationOnce(() => {
      order.push('retire')
    })
    vi.mocked(deleteProfile).mockImplementationOnce(async () => {
      order.push('delete')

      return { ok: true, path: '/profiles/worker' }
    })

    await host.deleteProfile('worker')

    expect(order).toEqual(['retire', 'delete'])
    expect(retireLocalProfileGateways).toHaveBeenCalledWith('worker')
    // The rail paints from $profiles; skipping the refresh leaves a stale
    // badge whose click hot-loops against the deletion guard (#88769).
    expect(refreshProfiles).toHaveBeenCalled()
  })

  it('refreshes the profile inventory before asking Electron for routes', async () => {
    const getProfileRoutes = vi.fn(async () => [
      { connectionId: 'connection-local', mode: 'local', profile: 'desktop-primary', targetProfile: 'desktop-primary' },
      {
        connectionId: 'connection-remote',
        mode: 'remote',
        profile: 'remote-worker',
        targetProfile: 'backend-worker'
      }
    ])

    vi.mocked(refreshProfiles).mockResolvedValueOnce([profile('desktop-primary'), profile('remote-worker')])
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { getProfileRoutes }

    const routes = await host.profileRoutes()

    expect(routes).toEqual([
      { connectionId: 'connection-local', mode: 'local', profile: 'desktop-primary', targetProfile: 'desktop-primary' },
      {
        connectionId: 'connection-remote',
        mode: 'remote',
        profile: 'remote-worker',
        targetProfile: 'backend-worker'
      }
    ])
    expect(refreshProfiles).toHaveBeenCalledOnce()
    expect(getProfileRoutes).toHaveBeenCalledWith(['desktop-primary', 'remote-worker'])
  })

  it('falls back to the cached profile inventory when refresh fails', async () => {
    const getProfileRoutes = vi.fn(async () => [
      { connectionId: 'connection-cached', mode: 'remote', profile: 'cached-worker', targetProfile: 'cached-worker' }
    ])

    $profiles.set([profile('cached-worker')])
    vi.mocked(refreshProfiles).mockRejectedValueOnce(new Error('profile backend unavailable'))
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { getProfileRoutes }

    await expect(host.profileRoutes()).resolves.toEqual([
      { connectionId: 'connection-cached', mode: 'remote', profile: 'cached-worker', targetProfile: 'cached-worker' }
    ])
    expect(getProfileRoutes).toHaveBeenCalledWith(['cached-worker'])
  })

  it('forwards a targeted request without changing foreground state', async () => {
    const route = {
      connectionId: 'source-a',
      mode: 'remote' as const,
      profile: 'remote-worker',
      targetProfile: 'backend-worker'
    }

    const result = await host.requestProfile(route, 'profiles.list', { include_sessions: true })

    expect(result).toEqual({
      connectionId: 'source-a',
      method: 'profiles.list',
      params: { include_sessions: true },
      profile: 'remote-worker'
    })
    expect(requestGatewayForAgent).toHaveBeenCalledWith('source-a', 'remote-worker', 'profiles.list', {
      include_sessions: true
    })
    expect(requestGatewayForProfile).not.toHaveBeenCalled()
  })

  it('strips a renderer key only when its encoded owner matches the explicit route', async () => {
    const route = {
      connectionId: 'source-a',
      mode: 'remote' as const,
      profile: 'mbc',
      targetProfile: 'mbc'
    }

    const runtimeId = rendererRuntimeKey(
      createBackendKey({ connectionId: 'source-a', gatewayEpoch: 7, profile: 'mbc' }),
      'runtime-shared'
    )

    await host.requestProfile(route, 'session.interrupt', { session_id: runtimeId })

    expect(requestGatewayForAgent).toHaveBeenCalledWith(
      'source-a',
      'mbc',
      'session.interrupt',
      { session_id: 'runtime-shared' },
      undefined,
      undefined,
      7
    )
  })

  it('rejects an encoded renderer key owned by another source before sending raw id', async () => {
    const runtimeId = rendererRuntimeKey(
      createBackendKey({ connectionId: 'source-a', gatewayEpoch: 7, profile: 'mbc' }),
      'runtime-shared'
    )

    await expect(
      host.requestProfile(
        { connectionId: 'source-b', mode: 'remote', profile: 'mbc', targetProfile: 'mbc' },
        'session.interrupt',
        { session_id: runtimeId }
      )
    ).rejects.toThrow(/different backend owner/i)
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('rejects a raw live requestProfile id before route lookup or gateway dispatch', async () => {
    const getAgentRoster = vi.fn()

    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { getAgentRoster }

    await expect(
      host.requestProfile(
        { connectionId: 'source-a', mode: 'remote', profile: 'mbc', targetProfile: 'mbc' },
        'prompt.submit',
        { session_id: 'runtime-shared', text: 'hello' }
      )
    ).rejects.toThrow(/renderer runtime key is required/i)
    expect(getAgentRoster).not.toHaveBeenCalled()
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('keeps raw resume and set_hidden available through an explicit profile route without a sidebar row', async () => {
    const route = { connectionId: 'local', mode: 'local' as const, profile: 'mbc', targetProfile: 'mbc' }
    vi.mocked(requestGatewayForAgentWithBackend).mockResolvedValueOnce({
      backend: { connectionId: 'local', gatewayEpoch: 13, profile: 'mbc' },
      result: { session_id: 'runtime-hidden', session_key: 'stored-hidden' }
    })

    const resumed = await host.requestProfile<{ session_id: string }>(route, 'session.resume', {
      profile: 'mbc',
      session_id: 'stored-hidden'
    })

    await host.requestProfile(route, 'session.set_hidden', {
      hidden: true,
      profile: 'mbc',
      session_id: 'stored-hidden'
    })

    expect($sessions.get()).toEqual([])
    expect(parseRendererRuntimeKey(resumed.session_id)?.backend).toEqual({
      connectionId: 'local',
      gatewayEpoch: 13,
      profile: 'mbc'
    })
    expect(requestGatewayForAgent).toHaveBeenCalledWith('local', 'mbc', 'session.set_hidden', {
      hidden: true,
      profile: 'mbc',
      session_id: 'stored-hidden'
    })
  })

  it('rejects a stale renderer key before any gateway dispatch', async () => {
    vi.mocked(gatewayEpochForAgent).mockReturnValue(8)

    const runtimeId = rendererRuntimeKey(
      createBackendKey({ connectionId: 'source-a', gatewayEpoch: 7, profile: 'mbc' }),
      'runtime-shared'
    )

    await expect(
      host.requestProfile(
        { connectionId: 'source-a', mode: 'remote', profile: 'mbc', targetProfile: 'mbc' },
        'session.interrupt',
        { session_id: runtimeId }
      )
    ).rejects.toThrow(/stale gateway connection/i)
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
    expect(requestGatewayForAgentWithBackend).not.toHaveBeenCalled()
  })

  it('isolates same-profile A/B creates and their live submits when raw runtime ids collide', async () => {
    const epochs = new Map([
      ['source-a', 31],
      ['source-b', 47]
    ])

    vi.mocked(gatewayEpochForAgent).mockImplementation(connectionId => epochs.get(connectionId || '') ?? 0)
    vi.mocked(requestGatewayForAgentWithBackend).mockImplementation(async (connectionId, profileName, method) => ({
      backend: { connectionId, gatewayEpoch: epochs.get(connectionId || '') ?? 0, profile: profileName },
      result: { method, session_id: 'runtime-shared', stored_session_id: `stored-${connectionId}` }
    }))
    const routeA = { connectionId: 'source-a', mode: 'remote' as const, profile: 'mbc', targetProfile: 'mbc' }
    const routeB = { connectionId: 'source-b', mode: 'remote' as const, profile: 'mbc', targetProfile: 'mbc' }

    const createdA = await host.requestProfile<{ session_id: string }>(routeA, 'session.create', { profile: 'mbc' })
    const createdB = await host.requestProfile<{ session_id: string }>(routeB, 'session.create', { profile: 'mbc' })

    expect(createdA.session_id).not.toBe(createdB.session_id)
    expect(parseRendererRuntimeKey(createdA.session_id)?.backend).toEqual({
      connectionId: 'source-a',
      gatewayEpoch: 31,
      profile: 'mbc'
    })
    expect(parseRendererRuntimeKey(createdB.session_id)?.backend).toEqual({
      connectionId: 'source-b',
      gatewayEpoch: 47,
      profile: 'mbc'
    })

    await host.requestProfile(routeA, 'prompt.submit', { session_id: createdA.session_id, text: 'a' })
    await host.requestProfile(routeB, 'prompt.submit', { session_id: createdB.session_id, text: 'b' })

    expect(requestGatewayForAgent).toHaveBeenNthCalledWith(
      1,
      'source-a',
      'mbc',
      'prompt.submit',
      { session_id: 'runtime-shared', text: 'a' },
      undefined,
      undefined,
      31
    )
    expect(requestGatewayForAgent).toHaveBeenNthCalledWith(
      2,
      'source-b',
      'mbc',
      'prompt.submit',
      { session_id: 'runtime-shared', text: 'b' },
      undefined,
      undefined,
      47
    )
  })

  it('qualifies a session.branch child on the exact parent runtime generation', async () => {
    const parent = rendererRuntimeKey(
      createBackendKey({ connectionId: 'source-a', gatewayEpoch: 7, profile: 'mbc' }),
      'runtime-parent'
    )

    vi.mocked(requestGatewayForAgent).mockResolvedValueOnce({
      session_id: 'runtime-child',
      stored_session_id: 'stored-child'
    })

    const branched = await host.requestProfile<{ session_id: string }>(
      { connectionId: 'source-a', mode: 'remote', profile: 'mbc', targetProfile: 'mbc' },
      'session.branch',
      { session_id: parent }
    )

    expect(parseRendererRuntimeKey(branched.session_id)).toEqual({
      backend: { connectionId: 'source-a', gatewayEpoch: 7, profile: 'mbc' },
      runtimeSessionId: 'runtime-child'
    })
  })

  it('keeps the profile-only request overload as a legacy fallback', async () => {
    const result = await host.requestProfile('legacy-worker', 'profiles.list', { include_sessions: true })

    expect(result).toEqual({
      method: 'profiles.list',
      params: { include_sessions: true },
      profile: 'legacy-worker'
    })
    expect(requestGatewayForProfile).toHaveBeenCalledWith('legacy-worker', 'profiles.list', {
      include_sessions: true
    })
  })

  it('rejects a profile-only request when the current registry makes it ambiguous', async () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getAgentRoster: vi.fn(async () => ({
        agents: [
          { connectionId: 'source-a', profile: 'research' },
          { connectionId: 'source-b', profile: 'research' }
        ],
        sources: [
          { connectionId: 'source-a', kind: 'remote', label: 'A' },
          { connectionId: 'source-b', kind: 'remote', label: 'B' }
        ]
      }))
    }

    await expect(host.requestProfile('research', 'profiles.list')).rejects.toThrow(/route descriptor/i)
    expect(requestGatewayForProfile).not.toHaveBeenCalled()
  })

  it('keeps profile-only compatibility when sole-local enumeration fails', async () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getAgentRoster: vi.fn(async () => ({
        agents: [],
        sources: [{ connectionId: 'local', kind: 'local', label: 'This device' }]
      }))
    }

    await expect(host.requestProfile('research', 'profiles.list')).resolves.toEqual({
      method: 'profiles.list',
      params: {},
      profile: 'research'
    })
  })

  it('rejects profile-only routing when another source is undialed', async () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getAgentRoster: vi.fn(async () => ({
        agents: [{ connectionId: 'local', profile: 'research' }],
        sources: [
          { connectionId: 'local', kind: 'local', label: 'This device' },
          { connectionId: 'homelab', kind: 'ssh', label: 'Homelab' }
        ]
      }))
    }

    await expect(host.requestProfile('research', 'profiles.list')).rejects.toThrow(/route descriptor/i)
    expect(requestGatewayForProfile).not.toHaveBeenCalled()
  })
})

describe('profile-aware plugin session opens', () => {
  it('waits until the target Bot Chat runtime and history are on main before resolving', async () => {
    vi.mocked(openGatewayForProfile).mockImplementationOnce(async () => undefined)

    let resolved = false

    const opening = host
      .openSession('bot-chat', {
        profile: 'hyoseob',
        awaitHydration: true,
        expectHistory: true,
        hydrationTimeoutMs: 1_000
      })
      .then(() => {
        resolved = true
      })

    // Flush a macrotask rather than counting microtask ticks: the profile
    // activation is now a bounded race, so the number of awaits between the
    // call and the core open is an implementation detail, and `resolved`
    // staying false through a full turn of the event loop is the stronger
    // assertion anyway.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(openSessionCore).toHaveBeenCalledWith('bot-chat', expect.any(Function), 'in-place', {
      connectionId: null,
      profile: 'hyoseob'
    })
    expect(resolved).toBe(false)
    expect($gatewaySwapTarget.get()).toBe('hyoseob')

    setMockAtom($focusedStoredSessionId, 'bot-chat')
    setMockAtom($focusedRuntimeId, 'runtime-tile')
    setMockAtom($focusedSessionState, {
      messages: [{ id: 'tile-history', parts: [], role: 'assistant' }],
      storedSessionId: 'bot-chat'
    } as never)

    await Promise.resolve()
    expect(resolved).toBe(false)

    setMockAtom($selectedStoredSessionId, 'bot-chat')
    setMockAtom($activeSessionId, 'runtime-hyoseob')
    setMockAtom($messages, [])

    await Promise.resolve()
    expect(resolved).toBe(false)

    setMockAtom($messages, [{ id: 'history-1', parts: [], role: 'user' }] as never)

    await opening
    expect(resolved).toBe(true)
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('requests an explicit resume on a cold open where selection has not settled (#89206)', async () => {
    vi.mocked(openGatewayForProfile).mockImplementationOnce(async () => undefined)

    // Cold-start shape from the field: the persisted route already points at
    // the bot's stored session, but no selection, no runtime, no transcript.
    setMockAtom($selectedStoredSessionId, null)
    setMockAtom($activeSessionId, null)
    setMockAtom($messages, [])

    const opening = host.openSession('cold-bot-chat', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: true,
      hydrationTimeoutMs: 1_000
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    // The old pre-open "already selected" precondition skipped this request,
    // stranding the pane blank until timeout. It must fire now.
    expect(requestSessionResume).toHaveBeenCalledWith('cold-bot-chat')

    setMockAtom($selectedStoredSessionId, 'cold-bot-chat')
    setMockAtom($activeSessionId, 'runtime-cold')
    setMockAtom($messages, [{ id: 'history-cold', parts: [], role: 'assistant' }] as never)

    await opening
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('requests a fresh resume when the same main Bot Chat lost its transcript', async () => {
    $activeGatewayProfile.set('hyoseob')
    setMockAtom($selectedStoredSessionId, 'bot-chat')
    setMockAtom($activeSessionId, 'runtime-stale')
    setMockAtom($messages, [])

    const opening = host.openSession('bot-chat', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: true,
      hydrationTimeoutMs: 1_000
    })

    await Promise.resolve()
    expect(requestSessionResume).toHaveBeenCalledWith('bot-chat')

    setMockAtom($activeSessionId, 'runtime-refreshed')
    setMockAtom($messages, [{ id: 'history-restored', parts: [], role: 'assistant' }] as never)

    await opening
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('resolves a history-bearing wake on transcript paint without waiting for the runtime (paint-first)', async () => {
    vi.mocked(openGatewayForProfile).mockImplementationOnce(async () => undefined)

    setMockAtom($selectedStoredSessionId, null)
    setMockAtom($activeSessionId, null)
    setMockAtom($messages, [])

    let resolved = false

    const opening = host
      .openSession('slow-runtime-chat', {
        profile: 'hyoseob',
        awaitHydration: true,
        expectHistory: true,
        hydrationTimeoutMs: 1_000
      })
      .then(() => {
        resolved = true
      })

    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false)

    // The REST prefetch paints the persisted transcript while the runtime
    // resume (agent build, MCP discovery, skill load) is still warming — the
    // exact cold-boot shape where the runtime takes 30s+ on slow machines.
    // The wake must complete on the paint; the runtime binds in background.
    setMockAtom($selectedStoredSessionId, 'slow-runtime-chat')
    setMockAtom($messages, [{ id: 'painted-history', parts: [], role: 'assistant' }] as never)

    await opening
    expect(resolved).toBe(true)
    expect($activeSessionId.get()).toBeNull()
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('accepts an explicitly empty Bot Chat once its main runtime is bound', async () => {
    $activeGatewayProfile.set('hyoseob')

    const opening = host.openSession('empty-bot-chat', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: false,
      hydrationTimeoutMs: 1_000
    })

    setMockAtom($selectedStoredSessionId, 'empty-bot-chat')
    setMockAtom($activeSessionId, 'runtime-empty')
    setMockAtom($messages, [])

    await opening
    expect($activeSessionId.get()).toBe('runtime-empty')
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('arms the core Retry surface when Bot Chat hydration times out', async () => {
    $activeGatewayProfile.set('hyoseob')

    await expect(
      host.openSession('stranded-bot-chat', {
        profile: 'hyoseob',
        awaitHydration: true,
        expectHistory: true,
        hydrationTimeoutMs: 1
      })
    ).rejects.toThrow(/timed out loading/i)

    expect(setResumeExhaustedSessionId).toHaveBeenCalledWith('stranded-bot-chat')
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('retries a Bot Chat hydration timeout once without ever arming the Retry surface (#89617)', async () => {
    $activeGatewayProfile.set('hyoseob')

    // First attempt: leave the surface unhealthy so the hydration wait below
    // times out, exactly like a profile backend still waking up. Second
    // attempt: the backend is warm now — hydrate immediately. Queued as two
    // one-shots (not a standing mockImplementation) so this doesn't leak into
    // later tests via the shared afterEach's vi.clearAllMocks(), which clears
    // call history but not a standing implementation.
    vi.mocked(openSessionCore)
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        setMockAtom($selectedStoredSessionId, 'waking-bot-chat')
        setMockAtom($activeSessionId, 'runtime-waking')
        setMockAtom($messages, [{ id: 'history-waking', parts: [], role: 'assistant' }] as never)
      })

    await host.openSession('waking-bot-chat', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: true,
      hydrationTimeoutMs: 1,
      retryHydrationTimeoutOnce: true
    })

    expect(openSessionCore).toHaveBeenCalledTimes(2)
    // The overlay in apps/desktop/src/app/chat/index.tsx is gated purely on
    // this atom equalling the routed session id — if it were ever set here,
    // the user would land on "Couldn't load this session" even though the
    // retry above succeeded underneath, since only a manual resumeSession()
    // call clears it for the currently-routed session.
    expect(setResumeExhaustedSessionId).not.toHaveBeenCalled()
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('still arms the Retry surface when a retried Bot Chat hydration times out twice', async () => {
    $activeGatewayProfile.set('hyoseob')

    await expect(
      host.openSession('stranded-bot-chat', {
        profile: 'hyoseob',
        awaitHydration: true,
        expectHistory: true,
        hydrationTimeoutMs: 1,
        retryHydrationTimeoutOnce: true
      })
    ).rejects.toThrow(/timed out loading/i)

    expect(openSessionCore).toHaveBeenCalledTimes(2)
    expect(setResumeExhaustedSessionId).toHaveBeenCalledWith('stranded-bot-chat')
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('lets the latest rapid bot selection win and cancels the older hydration wait', async () => {
    vi.mocked(ensureGatewayProfile).mockImplementation(async (target: null | string | undefined) => {
      $activeGatewayProfile.set(target || 'default')
    })

    const firstOutcome = host
      .openSession('chat-a', {
        profile: 'jimin',
        awaitHydration: true,
        expectHistory: true,
        hydrationTimeoutMs: 1_000
      })
      .then(
        () => 'resolved',
        error => String(error)
      )

    await Promise.resolve()

    const second = host.openSession('chat-b', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: true,
      hydrationTimeoutMs: 1_000
    })

    setMockAtom($selectedStoredSessionId, 'chat-b')
    setMockAtom($activeSessionId, 'runtime-b')
    setMockAtom($messages, [{ id: 'history-b', parts: [], role: 'assistant' }] as never)

    await second
    expect(await firstOutcome).toMatch(/superseded/i)
    expect($activeGatewayProfile.get()).toBe('remote-worker')
    expect($selectedStoredSessionId.get()).toBe('chat-b')
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('keeps chrome API home on the previous profile when opening a Bot Chat', async () => {
    $activeGatewayProfile.set('default')

    await host.openSession('bot-chat', {
      profile: 'worker',
      keepAllProfilesScope: true
    })

    expect(ensureGatewayProfile).not.toHaveBeenCalled()
    expect(openGatewayForProfile).toHaveBeenCalledWith('worker')
    expect(setShowAllProfiles).toHaveBeenCalledWith(true)
    expect($activeGatewayProfile.get()).toBe('default')
  })

  it('keeps a same-profile A route and owner when ambient switches to B during the wake', async () => {
    $activeGatewayProfile.set('mbc')
    vi.mocked(activeGatewayConnectionId).mockReturnValue('source-a')
    let finishDial: (() => void) | undefined
    vi.mocked(openGatewayForAgent).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDial = resolve
        })
    )

    const opening = host.openSession('stored-shared', {
      profile: 'mbc',
      route: { connectionId: 'source-a', mode: 'remote', profile: 'mbc', targetProfile: 'mbc' },
      keepAllProfilesScope: true
    })

    await Promise.resolve()
    expect(openGatewayForAgent).toHaveBeenCalledWith('source-a', 'mbc')

    // The foreground source changes while A's exact background dial is still
    // pending. Navigation must retain A's owner and never sample ambient B.
    vi.mocked(activeGatewayConnectionId).mockReturnValue('source-b')
    finishDial?.()
    await opening

    expect(openGatewayForProfile).not.toHaveBeenCalled()
    expect(ensureGatewayAgent).not.toHaveBeenCalled()
    expect(openSessionCore).toHaveBeenCalledWith('stored-shared', expect.any(Function), 'in-place', {
      connectionId: 'source-a',
      profile: 'mbc'
    })
  })

  it('defaults keepAllProfilesScope to navigation instead of a workspace switch', async () => {
    $activeGatewayProfile.set('default')

    await host.openSession('bot-chat', { profile: 'worker' })

    expect(ensureGatewayProfile).not.toHaveBeenCalled()
    expect(openGatewayForProfile).toHaveBeenCalledWith('worker')
    expect(setShowAllProfiles).toHaveBeenCalledWith(true)
    expect($activeGatewayProfile.get()).toBe('default')
  })

  it('still switches workspace when keepAllProfilesScope is false', async () => {
    $activeGatewayProfile.set('default')
    vi.mocked(openGatewayForProfile).mockImplementationOnce(async () => undefined)

    await host.openSession('stored-worker', {
      profile: 'worker',
      keepAllProfilesScope: false
    })

    expect(ensureGatewayProfile).toHaveBeenCalledWith('worker')
    expect(openGatewayForProfile).not.toHaveBeenCalled()
    expect(setShowAllProfiles).toHaveBeenCalledWith(false)
    expect($activeGatewayProfile.get()).toBe('worker')
  })

  it('keeps the Sessions sidebar in all-profiles even when the bot is already live', async () => {
    $activeGatewayProfile.set('hyoseob')
    setMockAtom($selectedStoredSessionId, 'bot-chat')
    setMockAtom($activeSessionId, 'runtime-live')
    setMockAtom($messages, [{ id: 'history', parts: [], role: 'assistant' }] as never)

    await host.openSession('bot-chat', {
      profile: 'hyoseob',
      awaitHydration: true,
      expectHistory: true,
      hydrationTimeoutMs: 1_000
    })

    expect(setShowAllProfiles).toHaveBeenCalledWith(true)
  })

  it('surfaces a wedged profile activation instead of waiting on it forever (#89556)', async () => {
    // The dial the store is waiting on never settles - a backend that accepts
    // the socket and then never completes the handshake. Before this was
    // bounded, openSession's await sat here for the life of the window and the
    // hydration timer, which is armed downstream, never got a chance to fire:
    // the pane wedged with no error and no Retry rather than timing out.
    vi.mocked(ensureGatewayProfile).mockImplementationOnce(() => new Promise<void>(() => undefined))

    setMockAtom($selectedStoredSessionId, 'wedged-chat')
    setMockAtom($activeSessionId, 'runtime-wedged')
    setMockAtom($messages, [{ id: 'history-1', parts: [], role: 'user' }] as never)

    await expect(
      host.openSession('wedged-chat', {
        profile: 'medicina',
        intent: 'main',
        awaitHydration: true,
        expectHistory: true,
        keepAllProfilesScope: false,
        hydrationTimeoutMs: 60
      })
    ).rejects.toThrow("Timed out loading medicina's session history.")

    // The stranded-session surface is the point: a bounded failure the user can
    // retry, not a frozen pane.
    expect(setResumeExhaustedSessionId).toHaveBeenCalledWith('wedged-chat')
    expect($gatewaySwapTarget.get()).toBeNull()
  })

  it('names the phase in the wake log so a stuck dial is not read as a slow transcript', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    vi.mocked(ensureGatewayProfile).mockImplementationOnce(() => new Promise<void>(() => undefined))

    await expect(
      host.openSession('wedged-chat', {
        profile: 'medicina',
        intent: 'main',
        awaitHydration: true,
        expectHistory: true,
        keepAllProfilesScope: false,
        hydrationTimeoutMs: 60
      })
    ).rejects.toThrow('Timed out loading ')

    expect(warn).toHaveBeenCalledWith(
      '[bot-wake] hydration timed out',
      expect.objectContaining({ phase: 'activation' })
    )

    const payload = warn.mock.calls.at(-1)?.[1] as { hydrationWaitMs: number; profileActivationMs: number }

    // The whole budget went to activation. Reporting it as hydration wait time
    // would send a support bundle reader looking at transcript size.
    expect(payload.profileActivationMs).toBeGreaterThan(0)
    expect(payload.hydrationWaitMs).toBe(0)

    warn.mockRestore()
  })

  it('gives hydration its own full budget after a slow but successful activation', async () => {
    // Guards the choice of a SEPARATE budget per phase over one shared clock.
    // A cold profile backend can legitimately spend most of the budget getting
    // its socket up; if hydration then inherited what was left, this wake would
    // fail even though the transcript painted well inside the documented
    // 20s-equivalent window.
    vi.mocked(ensureGatewayProfile).mockImplementationOnce(
      async (target: null | string | undefined) =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            $activeGatewayProfile.set(target || 'default')
            resolve()
          }, 150)
        })
    )

    const opening = host.openSession('slow-dial-chat', {
      profile: 'medicina',
      intent: 'main',
      awaitHydration: true,
      expectHistory: true,
      keepAllProfilesScope: false,
      hydrationTimeoutMs: 200
    })

    // 300ms total is past a single shared 200ms budget and inside hydration's
    // own one, which only starts once the profile is actually active.
    await new Promise(resolve => setTimeout(resolve, 300))
    setMockAtom($selectedStoredSessionId, 'slow-dial-chat')
    setMockAtom($activeSessionId, 'runtime-medicina')
    setMockAtom($messages, [{ id: 'history-1', parts: [], role: 'user' }] as never)

    await expect(opening).resolves.toBeUndefined()
    expect(setResumeExhaustedSessionId).not.toHaveBeenCalled()
  })

  it('absorbs an activation that rejects after its budget has already expired', async () => {
    // The abandoned race loser keeps running - there is no cancellation handle
    // for an in-flight dial - so a late rejection must not escape as an
    // unhandled promise rejection long after the caller gave up.
    // Node's process-level hook, not window's: under jsdom a rejection that
    // escapes lands on the runner's process, which is where vitest turns it
    // into an "Unhandled Rejection" run failure.
    const unhandled: unknown[] = []

    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }

    const existing = process.listeners('unhandledRejection')

    for (const listener of existing) {
      process.off('unhandledRejection', listener)
    }

    process.on('unhandledRejection', onUnhandled)

    vi.mocked(ensureGatewayProfile).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          setTimeout(() => reject(new Error('dial failed after the caller gave up')), 120)
        })
    )

    await expect(
      host.openSession('late-failure-chat', {
        profile: 'medicina',
        intent: 'main',
        awaitHydration: true,
        expectHistory: true,
        keepAllProfilesScope: false,
        hydrationTimeoutMs: 40
      })
    ).rejects.toThrow('Timed out loading ')

    await new Promise(resolve => setTimeout(resolve, 200))
    process.off('unhandledRejection', onUnhandled)

    for (const listener of existing) {
      process.on('unhandledRejection', listener)
    }

    expect(unhandled).toEqual([])
  })

  it('leaves a plain open unbounded, because it has no budget and no Retry surface', async () => {
    // Deliberate scope line, not an oversight: the activation deadline rides on
    // the same contract as the hydration one. A caller that never passed
    // awaitHydration gets exactly the behaviour it had before, since a
    // rejection here would surface to code with nowhere to render it.
    vi.mocked(ensureGatewayProfile).mockImplementationOnce(() => new Promise<void>(() => undefined))

    let settled = 'pending'

    void host
      .openSession('plain-chat', {
        profile: 'medicina',
        intent: 'main',
        keepAllProfilesScope: false,
        hydrationTimeoutMs: 40
      })
      .then(
        () => {
          settled = 'resolved'
        },
        () => {
          settled = 'rejected'
        }
      )

    await new Promise(resolve => setTimeout(resolve, 200))

    expect(settled).toBe('pending')
    expect(setResumeExhaustedSessionId).not.toHaveBeenCalled()
  })
})
