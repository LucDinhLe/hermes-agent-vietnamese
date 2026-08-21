import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HermesConnection } from '@/global'
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
    $selectedStoredSessionId: atom(null)
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
    requestGatewayForProfile: vi.fn(async (profile: string, method: string, params: Record<string, unknown>) => ({
      method,
      params,
      profile
    })),
    retireLocalProfileGateways: vi.fn()
  }
})

const { host } = await import('./index')
const { deleteProfile } = await import('@/hermes')

const { activeGatewayConnectionId, requestGatewayForAgent, requestGatewayForProfile, retireLocalProfileGateways } =
  await import('@/store/gateway')

const { $profiles, ensureGatewayAgent, refreshProfiles } = await import('@/store/profile')
const { $connection } = await import('@/store/session')

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
  $profiles.set([profile('cached-only')])
  $connection.set(null)
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

describe('connection-aware plugin host APIs', () => {
  it('reports a registered remote primary from the published live connection', () => {
    $connection.set({ connectionId: 'remote-primary', mode: 'remote', profile: 'default' } as HermesConnection)

    expect(host.activeConnectionId()).toBe('remote-primary')
  })

  it('prefers the active pooled registry identity and keeps local primaries legacy-null', () => {
    $connection.set({ connectionId: 'stale-remote', mode: 'local', profile: 'default' } as HermesConnection)

    expect(host.activeConnectionId()).toBeNull()

    vi.mocked(activeGatewayConnectionId).mockReturnValueOnce('active-pool')
    expect(host.activeConnectionId()).toBe('active-pool')
  })

  it('propagates a registry activation failure to the plugin caller', async () => {
    vi.mocked(ensureGatewayAgent).mockRejectedValueOnce(new Error('source unavailable'))

    await expect(host.ensureAgent('local', 'research')).rejects.toThrow('source unavailable')
    expect(ensureGatewayAgent).toHaveBeenCalledWith('local', 'research')
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

  it('deletes the active registry-remote profile through its exact source without retiring local sockets', async () => {
    $connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'worker' } as HermesConnection)

    await host.deleteProfile('worker')

    expect(retireLocalProfileGateways).not.toHaveBeenCalled()
    expect(deleteProfile).toHaveBeenCalledWith('worker', 'source-b')
  })

  it('preserves explicit local deletion when the primary connection is remote', async () => {
    $connection.set({ connectionId: 'remote-primary', mode: 'remote', profile: 'worker' } as HermesConnection)

    await host.deleteProfile('worker', 'local')

    expect(retireLocalProfileGateways).toHaveBeenCalledWith('worker')
    expect(deleteProfile).toHaveBeenCalledWith('worker', 'local')
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

    $connection.set({ mode: 'local', profile: 'desktop-primary' } as HermesConnection)
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
    $connection.set({ mode: 'local', profile: 'cached-worker' } as HermesConnection)
    vi.mocked(refreshProfiles).mockRejectedValueOnce(new Error('profile backend unavailable'))
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { getProfileRoutes }

    await expect(host.profileRoutes()).resolves.toEqual([
      { connectionId: 'connection-cached', mode: 'remote', profile: 'cached-worker', targetProfile: 'cached-worker' }
    ])
    expect(getProfileRoutes).toHaveBeenCalledWith(['cached-worker'])
  })

  it('does not present an active remote inventory as local fallback routes', async () => {
    const getProfileRoutes = vi.fn(async () => [])

    $profiles.set([profile('remote-only')])
    $connection.set({ connectionId: 'source-remote', mode: 'remote', profile: 'remote-only' } as HermesConnection)
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { getProfileRoutes }

    await expect(host.profileRoutes()).resolves.toEqual([])
    expect(refreshProfiles).not.toHaveBeenCalled()
    expect(getProfileRoutes).toHaveBeenCalledWith([])
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
