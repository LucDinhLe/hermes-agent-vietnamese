import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rendererRuntimeKey } from '@/lib/session-runtime-key'

// Regression coverage for the #89206 wake-failure class: session-scoped RPCs
// routed to a backend that does not own the session's profile. Three layers:
//   1. The registry publishes the ACTIVE route's profile ($activeGatewayRoute)
//      from applyActive itself, so eviction fallbacks move it in lockstep.
//   2. store/profile.ts mirrors that atom into $activeGatewayProfile, so the
//      "already active" fast path can never trust a stale profile.
//   3. session-request-router pins session-scoped RPCs to the owning
//      profile's socket at REQUEST time when the active route diverges.

const secondaryGateways: Array<{
  close: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  connectionState: string
  request: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/hermes', () => ({
  HermesGateway: class {
    connectionState = 'closed'
    connect = vi.fn(async () => {
      this.connectionState = 'open'
    })
    request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (this.connectionState !== 'open') {
        throw new Error('gateway is not connected')
      }

      return { method, params }
    })
    close = vi.fn()
    onEvent = vi.fn(() => () => {})
    onState = vi.fn(() => () => {})

    constructor() {
      secondaryGateways.push(this)
    }
  },
  setApiRequestConnection: vi.fn()
}))
vi.mock('@/store/session', () => ({ setConnection: vi.fn(), setGatewayState: vi.fn() }))
vi.mock('@/store/notify-baseline', () => ({ markNativeNotifyBaseline: vi.fn() }))

const {
  $activeGatewayRoute,
  activeGatewayProfileKey,
  closeSecondaryGateways,
  configureGatewayRegistry,
  ensureGatewayForAgent,
  ensureGatewayForProfile,
  gatewayEpochForAgent,
  pruneSecondaryGateways,
  retireLocalProfileGateways,
  setPrimaryGateway
} = await import('./gateway')

const {
  RendererRuntimeEpochMismatchError,
  RendererRuntimeKeyRequiredError,
  requestForSessionOwner,
  requestForRendererRuntime,
  RendererRuntimeOwnerMismatchError,
  RendererRuntimeSessionMismatchError,
  requestForSessionProfile,
  sessionRpcNeedsProfileRoute,
  UnresolvedSessionOwnerError
} = await import('./session-request-router')

function installDesktop(): void {
  ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
    getConnection: vi.fn(async (profile: null | string) =>
      profile ? { port: 5151, profile, token: 'secondary-token' } : { port: 4242, token: 'primary-token' }
    ),
    getConnectionFor: vi.fn(async (connectionId: string, profile: string) => ({
      connectionId,
      port: connectionId === 'source-a' ? 6161 : 6262,
      profile,
      token: `${connectionId}-token`
    })),
    touchBackend: vi.fn(async () => undefined)
  }
}

function makePrimary() {
  return {
    connectionState: 'open',
    request: vi.fn(async (method: string, params: Record<string, unknown>) => ({ method, params }))
  }
}

beforeEach(() => {
  secondaryGateways.length = 0
  configureGatewayRegistry({ onEvent: vi.fn() })
  closeSecondaryGateways()
})

afterEach(() => {
  closeSecondaryGateways()
  vi.clearAllMocks()
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

describe('$activeGatewayRoute (registry-owned active profile)', () => {
  it('tracks profile activation and eviction fallback in lockstep with the socket', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()

    await ensureGatewayForProfile('default')
    expect(activeGatewayProfileKey()).toBe('default')

    await ensureGatewayForProfile('loki')
    expect(activeGatewayProfileKey()).toBe('loki')
    expect($activeGatewayRoute.get()).toBe('loki')

    // Idle-reap style eviction of everything but... nothing keeps loki alive.
    // The registry must move BOTH the socket and the published profile back
    // to the primary — before the fix only the socket moved, and the stale
    // profile atom made ensureGatewayProfile skip the re-swap forever.
    retireLocalProfileGateways('loki')
    expect(activeGatewayProfileKey()).toBe('default')
    expect($activeGatewayRoute.get()).toBe('default')
  })

  it('falls back to primary when pruning evicts the active secondary', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()

    await ensureGatewayForProfile('hulk')
    expect(activeGatewayProfileKey()).toBe('hulk')

    // Force-evict the active entry (retention flags off) — the keep-set is
    // empty and the active guard is bypassed by retiring first.
    retireLocalProfileGateways('hulk')
    pruneSecondaryGateways(new Set())

    expect(activeGatewayProfileKey()).toBe('default')
  })
})

describe('sessionRpcNeedsProfileRoute', () => {
  it('routes ambient when the owner is unknown or already active', () => {
    expect(sessionRpcNeedsProfileRoute(null, 'default')).toBe(false)
    expect(sessionRpcNeedsProfileRoute('', 'default')).toBe(false)
    expect(sessionRpcNeedsProfileRoute('   ', 'loki')).toBe(false)
    expect(sessionRpcNeedsProfileRoute('loki', 'loki')).toBe(false)
    expect(sessionRpcNeedsProfileRoute('default', 'default')).toBe(false)
  })

  it('pins to the owning profile when the active route diverges', () => {
    expect(sessionRpcNeedsProfileRoute('loki', 'default')).toBe(true)
    expect(sessionRpcNeedsProfileRoute('default', 'loki')).toBe(true)
    expect(sessionRpcNeedsProfileRoute('loki', 'hulk')).toBe(true)
  })
})

describe('requestForSessionProfile', () => {
  it("dispatches on the owning profile's own socket when the active route moved off it (#89206)", async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    await ensureGatewayForProfile('default')

    const ambient = vi.fn(async (method: string, params?: Record<string, unknown>) => ({
      ambient: true,
      method,
      params
    }))

    // Active route is 'default'; the session belongs to 'loki'. The failing
    // path sent session.resume on the ambient (default) socket — the default
    // backend has never heard of the session and the bot never woke.
    const result = await requestForSessionProfile<{ method: string; params: Record<string, unknown> }>(
      'loki',
      ambient as never,
      'session.resume',
      { session_id: 'stored-loki-chat' }
    )

    expect(ambient).not.toHaveBeenCalled()
    expect(result).toEqual({ method: 'session.resume', params: { session_id: 'stored-loki-chat' } })
    expect(secondaryGateways).toHaveLength(1)
    expect(secondaryGateways[0].request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-loki-chat' })
  })

  it('forwards timeout and abort signal onto the owning profile socket', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    await ensureGatewayForProfile('default')

    const ambient = vi.fn(async (method: string, params?: Record<string, unknown>) => ({
      ambient: true,
      method,
      params
    }))

    const controller = new AbortController()

    await requestForSessionProfile(
      'loki',
      ambient as never,
      'prompt.submit',
      { session_id: 'stored-loki-chat', text: 'hi' },
      1_800_000,
      controller.signal
    )

    expect(ambient).not.toHaveBeenCalled()
    expect(secondaryGateways[0].request).toHaveBeenCalledWith(
      'prompt.submit',
      { session_id: 'stored-loki-chat', text: 'hi' },
      1_800_000,
      controller.signal
    )
  })

  it('keeps the ambient dispatcher when the active route already serves the owner', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    await ensureGatewayForProfile('loki')

    const ambient = vi.fn(async (method: string, params?: Record<string, unknown>) => ({
      ambient: true,
      method,
      params
    }))

    const result = await requestForSessionProfile('loki', ambient as never, 'session.activate', { session_id: 'rt-1' })

    expect(ambient).toHaveBeenCalledWith('session.activate', { session_id: 'rt-1' })
    expect(result).toEqual({ ambient: true, method: 'session.activate', params: { session_id: 'rt-1' } })
  })

  it('keeps the ambient dispatcher for sessions with no owning profile', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    await ensureGatewayForProfile('default')

    const ambient = vi.fn(async () => ({ ambient: true }))
    await requestForSessionProfile(null, ambient as never, 'session.usage', { session_id: 'rt-2' })

    expect(ambient).toHaveBeenCalledOnce()
  })
})

describe('requestForSessionOwner', () => {
  it('keeps duplicate Agent names isolated by owning connection even when that profile is active', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()

    const fromA = await requestForSessionOwner({ connectionId: 'source-a', profile: 'mbc' }, 'session.resume', {
      session_id: 'stored-a'
    })
    const fromB = await requestForSessionOwner({ connectionId: 'source-b', profile: 'mbc' }, 'session.resume', {
      session_id: 'stored-b'
    })

    expect(fromA).toEqual({ method: 'session.resume', params: { session_id: 'stored-a' } })
    expect(fromB).toEqual({ method: 'session.resume', params: { session_id: 'stored-b' } })
    expect(secondaryGateways).toHaveLength(2)
    expect(secondaryGateways[0].request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-a' })
    expect(secondaryGateways[1].request).toHaveBeenCalledWith('session.resume', { session_id: 'stored-b' })
  })

  it('forwards a deadline through an explicit registry connection', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    const controller = new AbortController()

    await requestForSessionOwner(
      { connectionId: 'source-a', profile: 'mbc' },
      'prompt.submit',
      { session_id: 'runtime-a', text: 'hello' },
      1_800_000,
      controller.signal
    )

    expect(secondaryGateways[0].request).toHaveBeenCalledWith(
      'prompt.submit',
      { session_id: 'runtime-a', text: 'hello' },
      1_800_000,
      controller.signal
    )
  })

  it('strips the renderer backend scope exactly once at the RPC boundary', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop()
    await ensureGatewayForAgent('source-a', 'mbc')
    const rendererId = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc'), profile: 'mbc' },
      'runtime-shared'
    )

    await requestForSessionOwner({ connectionId: 'source-a', profile: 'mbc' }, 'prompt.submit', {
      session_id: rendererId,
      text: 'hello'
    })

    expect(secondaryGateways[0].request).toHaveBeenCalledWith('prompt.submit', {
      session_id: 'runtime-shared',
      text: 'hello'
    })
  })

  it('rejects a renderer key when the explicit RPC owner is a different connection with the same profile', async () => {
    const rendererId = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: 'renderer-current', profile: 'mbc' },
      'runtime-shared'
    )

    await expect(
      requestForSessionOwner({ connectionId: 'source-b', profile: 'mbc' }, 'prompt.submit', {
        session_id: rendererId,
        text: 'must not leak'
      })
    ).rejects.toBeInstanceOf(RendererRuntimeOwnerMismatchError)
    expect(secondaryGateways).toHaveLength(0)
  })

  it('rejects a stale renderer key while continuing to allow raw durable ids', async () => {
    setPrimaryGateway(makePrimary() as never, 'default')
    installDesktop()
    await ensureGatewayForAgent('source-a', 'mbc')
    const stale = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc') - 1, profile: 'mbc' },
      'runtime-shared'
    )

    await expect(
      requestForSessionOwner({ connectionId: 'source-a', profile: 'mbc' }, 'process.list', { session_id: stale })
    ).rejects.toBeInstanceOf(RendererRuntimeEpochMismatchError)
    await expect(
      requestForSessionOwner({ connectionId: 'source-a', profile: 'mbc' }, 'session.resume', {
        session_id: 'stored-durable'
      })
    ).resolves.toEqual({ method: 'session.resume', params: { session_id: 'stored-durable' } })
  })

  it('fails closed when durable ownership is absent or malformed', async () => {
    await expect(requestForSessionOwner(null, 'session.resume', { session_id: 'stored-a' })).rejects.toBeInstanceOf(
      UnresolvedSessionOwnerError
    )
    await expect(
      requestForSessionOwner({ connectionId: null, profile: '   ' }, 'session.resume', { session_id: 'stored-a' })
    ).rejects.toBeInstanceOf(UnresolvedSessionOwnerError)
    await expect(
      requestForSessionOwner({ connectionId: '', profile: 'mbc' }, 'session.resume', { session_id: 'stored-a' })
    ).rejects.toBeInstanceOf(UnresolvedSessionOwnerError)
  })
})

describe('requestForRendererRuntime', () => {
  it('rejects before raw dispatch when opening the owner socket advances its epoch', async () => {
    setPrimaryGateway(makePrimary() as never, 'default')
    installDesktop()
    await ensureGatewayForAgent('source-a', 'mbc')
    const rendererId = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc'), profile: 'mbc' },
      'runtime-reused'
    )

    secondaryGateways[0].connectionState = 'closed'

    await expect(requestForRendererRuntime(rendererId, 'session.interrupt')).rejects.toBeInstanceOf(
      RendererRuntimeEpochMismatchError
    )
    expect(secondaryGateways[0].connect).toHaveBeenCalledTimes(2)
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })

  it('routes identical backend ids to their exact connection and never leaks the renderer key', async () => {
    setPrimaryGateway(makePrimary() as never, 'default')
    installDesktop()
    await ensureGatewayForAgent('source-a', 'mbc')
    await ensureGatewayForAgent('source-b', 'mbc')
    const fromA = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc'), profile: 'mbc' },
      'runtime-shared'
    )
    const fromB = rendererRuntimeKey(
      { connectionId: 'source-b', gatewayEpoch: gatewayEpochForAgent('source-b', 'mbc'), profile: 'mbc' },
      'runtime-shared'
    )

    await requestForRendererRuntime(fromA, 'process.list')
    await requestForRendererRuntime(fromB, 'process.list')

    expect(secondaryGateways[0].request).toHaveBeenCalledWith('process.list', { session_id: 'runtime-shared' })
    expect(secondaryGateways[1].request).toHaveBeenCalledWith('process.list', { session_id: 'runtime-shared' })
    expect(secondaryGateways[0].request).not.toHaveBeenCalledWith('process.list', { session_id: fromA })
    expect(secondaryGateways[1].request).not.toHaveBeenCalledWith('process.list', { session_id: fromB })
  })

  it('fails closed for raw, malformed, stale, and mismatched runtime identities', async () => {
    setPrimaryGateway(makePrimary() as never, 'default')
    installDesktop()
    await ensureGatewayForAgent('source-a', 'mbc')
    const currentEpoch = gatewayEpochForAgent('source-a', 'mbc')
    const current = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: currentEpoch, profile: 'mbc' },
      'runtime-a'
    )
    const other = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: currentEpoch, profile: 'mbc' },
      'runtime-b'
    )
    const stale = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: currentEpoch - 1, profile: 'mbc' },
      'runtime-a'
    )

    await expect(requestForRendererRuntime('runtime-a', 'process.list')).rejects.toBeInstanceOf(
      RendererRuntimeKeyRequiredError
    )
    await expect(requestForRendererRuntime('hermes-runtime-v1:not-json', 'process.list')).rejects.toThrow(
      'renderer runtime key is malformed'
    )
    await expect(requestForRendererRuntime(stale, 'process.list')).rejects.toBeInstanceOf(
      RendererRuntimeEpochMismatchError
    )
    await expect(requestForRendererRuntime(current, 'process.list', { session_id: other })).rejects.toBeInstanceOf(
      RendererRuntimeSessionMismatchError
    )
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })
})
