import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const secondaryGateways: Array<{
  close: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  connectionState: string
  emitEvent: (event: Record<string, unknown>) => void
  emitState: (state: string) => void
  request: ReturnType<typeof vi.fn>
}> = []

let connectGate: Promise<void> | null = null

vi.mock('@/hermes', () => ({
  HermesGateway: class {
    private readonly eventListeners = new Set<(event: Record<string, unknown>) => void>()
    private readonly stateListeners = new Set<(state: string) => void>()

    connectionState = 'closed'
    connect = vi.fn(async () => {
      if (this.connectionState === 'connecting') {
        return
      }

      this.connectionState = 'connecting'

      if (connectGate) {
        await connectGate
      }

      this.connectionState = 'open'
    })
    request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (this.connectionState !== 'open') {
        throw new Error('gateway is not connected')
      }

      return { method, params }
    })
    close = vi.fn()
    onEvent = vi.fn((listener: (event: Record<string, unknown>) => void) => {
      this.eventListeners.add(listener)

      return () => this.eventListeners.delete(listener)
    })
    onState = vi.fn((listener: (state: string) => void) => {
      this.stateListeners.add(listener)

      return () => this.stateListeners.delete(listener)
    })

    emitEvent(event: Record<string, unknown>): void {
      for (const listener of this.eventListeners) {
        listener(event)
      }
    }

    emitState(state: string): void {
      this.connectionState = state
      for (const listener of this.stateListeners) {
        listener(state)
      }
    }

    constructor() {
      secondaryGateways.push(this)
    }
  },
  setApiRequestConnection: vi.fn()
}))
vi.mock('@/store/session', () => ({ setGatewayState: vi.fn() }))
vi.mock('@/store/notify-baseline', () => ({ markNativeNotifyBaseline: vi.fn() }))

const {
  _resetGatewayEpochsForTests,
  $gateway,
  activeGatewayProfileKey,
  closeSecondaryGateways,
  configureGatewayRegistry,
  ensureGatewayForAgent,
  ensureGatewayForProfile,
  gatewayActivationEpoch,
  GatewaySocketEpochMismatchError,
  gatewayEpochForAgent,
  disposeSecondariesForConnection,
  openGatewayForAgent,
  pruneSecondaryGateways,
  reconnectSecondaryGateways,
  reportPrimaryGatewayState,
  requestGatewayForAgent,
  requestGatewayForAgentWithBackend,
  requestGatewayForProfile,
  requestGatewayForProfileWithBackend,
  setPrimaryGateway
} = await import('./gateway')

function installDesktop(getConnection: ReturnType<typeof vi.fn>): void {
  ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
    getConnection,
    touchBackend: vi.fn(async () => undefined)
  }
}

function makePrimary() {
  return {
    connectionState: 'open',
    request: vi.fn(async (method: string, params: Record<string, unknown>) => ({ method, params }))
  }
}

beforeEach(async () => {
  secondaryGateways.length = 0
  connectGate = null
  configureGatewayRegistry({ onEvent: vi.fn() })
  closeSecondaryGateways()
  _resetGatewayEpochsForTests()
})

afterEach(() => {
  closeSecondaryGateways()
  vi.clearAllMocks()
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

describe('requestGatewayForProfile', () => {
  it('returns the exact pooled backend receipt that carried the response', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) =>
        profile ? { port: 5151, profile, token: 'secondary-token' } : { port: 4242, token: 'primary-token' }
      )
    )

    const response = await requestGatewayForProfileWithBackend('worker', 'session.create', { hidden: true })

    expect(response).toEqual({
      backend: { connectionId: null, gatewayEpoch: 1, profile: 'worker' },
      result: { method: 'session.create', params: { hidden: true } }
    })
  })

  it('uses the physical primary epoch for a shared-primary profile and rejects its pre-reconnect key', async () => {
    const primary = makePrimary()

    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) => ({
        mode: 'remote',
        profile,
        sharedPrimary: profile === 'mbc',
        wsUrl: 'wss://shared.invalid/api/ws?token=redacted'
      }))
    )
    reportPrimaryGatewayState('open')
    await ensureGatewayForProfile('mbc')

    const mintedEpoch = gatewayEpochForAgent(null, 'mbc')

    expect(mintedEpoch).toBeGreaterThan(0)
    reportPrimaryGatewayState('closed')
    reportPrimaryGatewayState('open')
    expect(gatewayEpochForAgent(null, 'mbc')).toBe(mintedEpoch + 1)

    await expect(
      requestGatewayForProfile(
        'mbc',
        'session.interrupt',
        { session_id: 'runtime-reused' },
        undefined,
        undefined,
        mintedEpoch
      )
    ).rejects.toBeInstanceOf(GatewaySocketEpochMismatchError)
    expect(primary.request).not.toHaveBeenCalled()
  })

  it('advances a logical profile epoch when its route changes from shared primary to a dedicated socket', async () => {
    const primary = makePrimary()
    let shared = true

    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) => ({
        port: shared ? 4242 : 5151,
        profile,
        ...(shared ? { sharedPrimary: true } : {})
      }))
    )
    reportPrimaryGatewayState('open')
    await ensureGatewayForProfile('mbc')
    const sharedEpoch = gatewayEpochForAgent(null, 'mbc')

    shared = false

    await expect(
      requestGatewayForProfile(
        'mbc',
        'session.interrupt',
        { session_id: 'runtime-from-shared-primary' },
        undefined,
        undefined,
        sharedEpoch
      )
    ).rejects.toBeInstanceOf(GatewaySocketEpochMismatchError)

    expect(gatewayEpochForAgent(null, 'mbc')).toBeGreaterThan(sharedEpoch)
    expect(primary.request).not.toHaveBeenCalled()
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })

  it('requests through a pooled profile gateway without changing the active gateway', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) =>
        profile ? { port: 5151, profile, token: 'secondary-token' } : { port: 4242, token: 'primary-token' }
      )
    )
    await ensureGatewayForProfile('default')

    const result = await requestGatewayForProfile('worker', 'profiles.list', { include_sessions: true })

    expect(result).toEqual({ method: 'profiles.list', params: { include_sessions: true } })
    expect(secondaryGateways).toHaveLength(1)
    expect(secondaryGateways[0].request).toHaveBeenCalledWith('profiles.list', { include_sessions: true })
    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()
    expect($gateway.get()).toBe(primary)
  })

  it('uses the primary socket and adds profile scope for a shared global remote route', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) => ({
        port: 4242,
        ...(profile ? { profile, sharedPrimary: true } : {}),
        token: 'primary-token'
      }))
    )
    await ensureGatewayForProfile('default')

    const result = await requestGatewayForProfile('venture', 'session.list', { limit: 20, profile: 'wrong' })

    expect(result).toEqual({ method: 'session.list', params: { limit: 20, profile: 'venture' } })
    expect(primary.request).toHaveBeenCalledWith('session.list', { limit: 20, profile: 'venture' })
    expect(secondaryGateways).toHaveLength(0)
    expect($gateway.get()).toBe(primary)
    // A scoped background request must not foreground its logical profile.
    // Only ensureGatewayForProfile owns active-route transitions.
    expect(activeGatewayProfileKey()).toBe('default')
  })

  it('serializes concurrent requests while a secondary gateway is connecting', async () => {
    let releaseConnect: () => void = () => undefined
    connectGate = new Promise<void>(resolve => {
      releaseConnect = resolve
    })

    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) =>
        profile ? { port: 5151, profile, token: 'secondary-token' } : { port: 4242, token: 'primary-token' }
      )
    )
    await ensureGatewayForProfile('default')

    const first = requestGatewayForProfile('worker', 'profiles.list')
    await vi.waitFor(() => expect(secondaryGateways[0]?.connect).toHaveBeenCalledOnce())
    const second = requestGatewayForProfile('worker', 'profiles.list')
    const guardedSecond = second.catch(error => error)

    await Promise.resolve()
    releaseConnect()

    const [firstResult, secondResult] = await Promise.all([first, guardedSecond])

    expect(firstResult).toEqual({ method: 'profiles.list', params: {} })
    expect(secondResult).toEqual({ method: 'profiles.list', params: {} })
    expect(secondaryGateways[0].connect).toHaveBeenCalledOnce()
    expect(secondaryGateways[0].request).toHaveBeenCalledTimes(2)
    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()
    expect($gateway.get()).toBe(primary)
  })

  it('prevents pruning while a background request is connecting or in flight', async () => {
    let releaseConnect: () => void = () => undefined
    connectGate = new Promise<void>(resolve => {
      releaseConnect = resolve
    })

    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    installDesktop(
      vi.fn(async (profile: null | string) =>
        profile ? { port: 5151, profile, token: 'secondary-token' } : { port: 4242, token: 'primary-token' }
      )
    )
    await ensureGatewayForProfile('default')

    const request = requestGatewayForProfile('worker', 'profiles.list')
    await vi.waitFor(() => expect(secondaryGateways[0]?.connect).toHaveBeenCalledOnce())

    pruneSecondaryGateways(new Set())
    releaseConnect()

    await expect(request).resolves.toEqual({ method: 'profiles.list', params: {} })
    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()

    pruneSecondaryGateways(new Set())
    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()
  })
})

describe('requestGatewayForAgent', () => {
  it('returns source-qualified receipts for duplicate profile names', async () => {
    const primary = makePrimary()
    setPrimaryGateway(primary as never, 'default')
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    const [fromA, fromB] = await Promise.all([
      requestGatewayForAgentWithBackend('source-a', 'mbc', 'session.create'),
      requestGatewayForAgentWithBackend('source-b', 'mbc', 'session.create')
    ])

    expect(fromA.backend).toEqual({ connectionId: 'source-a', gatewayEpoch: 1, profile: 'mbc' })
    expect(fromB.backend).toEqual({ connectionId: 'source-b', gatewayEpoch: 1, profile: 'mbc' })
    expect(fromA.result).toEqual({ method: 'session.create', params: {} })
    expect(fromB.result).toEqual({ method: 'session.create', params: {} })
  })

  it('reports a dropped registry socket for only its exact backend owner', async () => {
    const primary = makePrimary()
    const onBackendStateChanged = vi.fn()

    setPrimaryGateway(primary as never, 'default')
    configureGatewayRegistry({ onBackendStateChanged, onEvent: vi.fn() })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await openGatewayForAgent('source-a', 'research')
    await openGatewayForAgent('source-b', 'research')
    onBackendStateChanged.mockClear()

    secondaryGateways[0].emitState('closed')

    expect(onBackendStateChanged).toHaveBeenCalledWith(
      { connectionId: 'source-a', gatewayEpoch: 1, profile: 'research' },
      'closed'
    )
    expect(onBackendStateChanged).not.toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'source-b' }),
      expect.anything()
    )
  })

  it('rechecks a renderer capability epoch after reopening and before sending its raw runtime id', async () => {
    const primary = makePrimary()

    setPrimaryGateway(primary as never, 'default')
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await openGatewayForAgent('source-a', 'research')
    const mintedEpoch = gatewayEpochForAgent('source-a', 'research')

    secondaryGateways[0].emitState('closed')

    await expect(
      requestGatewayForAgent(
        'source-a',
        'research',
        'session.interrupt',
        { session_id: 'runtime-reused' },
        undefined,
        undefined,
        mintedEpoch
      )
    ).rejects.toBeInstanceOf(GatewaySocketEpochMismatchError)
    expect(gatewayEpochForAgent('source-a', 'research')).toBe(mintedEpoch + 1)
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })

  it('advances the scoped socket epoch when a registry gateway reconnects', async () => {
    const primary = makePrimary()
    const onEvent = vi.fn()

    setPrimaryGateway(primary as never, 'default')
    configureGatewayRegistry({ onEvent })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await openGatewayForAgent('source-a', 'research')

    expect(gatewayEpochForAgent('source-a', 'research')).toBe(1)
    secondaryGateways[0].emitEvent({ method: 'session.updated' })
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectionId: 'source-a', gatewayEpoch: 1, profile: 'research' })
    )

    secondaryGateways[0].emitState('closed')
    reconnectSecondaryGateways()

    await vi.waitFor(() => expect(secondaryGateways[0].connect).toHaveBeenCalledTimes(2))
    expect(gatewayEpochForAgent('source-a', 'research')).toBe(2)

    secondaryGateways[0].emitEvent({ method: 'session.updated' })
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectionId: 'source-a', gatewayEpoch: 2, profile: 'research' })
    )
  })

  it('invalidates an intentionally disposed socket and never reuses its epoch on replacement', async () => {
    const primary = makePrimary()
    const onBackendStateChanged = vi.fn()

    setPrimaryGateway(primary as never, 'default')
    configureGatewayRegistry({ onBackendStateChanged, onEvent: vi.fn() })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await openGatewayForAgent('source-a', 'research')
    const disposedEpoch = gatewayEpochForAgent('source-a', 'research')
    onBackendStateChanged.mockClear()

    disposeSecondariesForConnection('source-a')

    expect(onBackendStateChanged).toHaveBeenCalledWith(
      { connectionId: 'source-a', gatewayEpoch: disposedEpoch, profile: 'research' },
      'closed'
    )

    await openGatewayForAgent('source-a', 'research')
    const replacementEpoch = gatewayEpochForAgent('source-a', 'research')

    expect(replacementEpoch).toBeGreaterThan(disposedEpoch)
    await expect(
      requestGatewayForAgent(
        'source-a',
        'research',
        'session.interrupt',
        { session_id: 'runtime-from-disposed-socket' },
        undefined,
        undefined,
        disposedEpoch
      )
    ).rejects.toBeInstanceOf(GatewaySocketEpochMismatchError)
    expect(secondaryGateways[1].request).not.toHaveBeenCalled()
  })

  it('leases separate registry sockets for duplicate profile names without changing the active gateway', async () => {
    const primary = makePrimary()
    const getConnection = vi.fn(async (profile: null | string) => ({ port: 4242, profile, token: 'legacy-token' }))

    const getConnectionFor = vi.fn(async ({ connectionId, profile }) => ({
      connectionId,
      port: connectionId === 'source-a' ? 5151 : 5252,
      profile,
      token: `${connectionId}-token`
    }))

    const getGatewayWsUrlFor = vi.fn(async ({ connectionId, profile }) => ({
      ok: true as const,
      wsUrl: `ws://${connectionId}/${profile}`
    }))

    setPrimaryGateway(primary as never, 'default')
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection,
      getConnectionFor,
      getGatewayWsUrlFor,
      touchBackend: vi.fn(async () => undefined)
    }
    await ensureGatewayForProfile('default')

    const [fromA, fromB] = await Promise.all([
      requestGatewayForAgent('source-a', 'research', 'session.list', { limit: 1 }),
      requestGatewayForAgent('source-b', 'research', 'session.list', { limit: 2 })
    ])

    expect(fromA).toEqual({ method: 'session.list', params: { limit: 1 } })
    expect(fromB).toEqual({ method: 'session.list', params: { limit: 2 } })
    expect(getConnectionFor).toHaveBeenCalledWith({ connectionId: 'source-a', profile: 'research' })
    expect(getConnectionFor).toHaveBeenCalledWith({ connectionId: 'source-b', profile: 'research' })
    expect(getGatewayWsUrlFor).toHaveBeenCalledWith({ connectionId: 'source-a', profile: 'research' })
    expect(getGatewayWsUrlFor).toHaveBeenCalledWith({ connectionId: 'source-b', profile: 'research' })
    expect(getConnection).not.toHaveBeenCalled()
    expect(secondaryGateways).toHaveLength(2)
    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()
    expect(secondaryGateways[1].close).toHaveBeenCalledOnce()
    expect($gateway.get()).toBe(primary)
  })

  it('routes an explicit local registry descriptor through getConnectionFor', async () => {
    const primary = makePrimary()

    const getConnection = vi.fn(async (profile: null | string) => ({
      mode: 'remote',
      profile,
      wsUrl: 'wss://legacy-remote.invalid/api/ws?token=legacy'
    }))

    const getConnectionFor = vi.fn(async ({ connectionId, profile }) => ({
      connectionId,
      mode: 'local',
      port: 5151,
      profile
    }))

    setPrimaryGateway(primary as never, 'default')
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection,
      getConnectionFor,
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }
    await ensureGatewayForProfile('default')

    await expect(requestGatewayForAgent('local', 'worker', 'profiles.list')).resolves.toEqual({
      method: 'profiles.list',
      params: {}
    })
    expect(getConnectionFor).toHaveBeenCalledWith({ connectionId: 'local', profile: 'worker' })
    expect(getConnection).not.toHaveBeenCalled()
    expect($gateway.get()).toBe(primary)
  })

  it('evicts registry sockets when their source is edited or removed', async () => {
    const primary = makePrimary()
    const getConnectionFor = vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile }))
    const onActiveConnectionInvalidated = vi.fn()

    setPrimaryGateway(primary as never, 'default')
    configureGatewayRegistry({ onActiveConnectionInvalidated, onEvent: vi.fn() })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor,
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await openGatewayForAgent('source-a', 'research')
    await requestGatewayForAgent('source-a', 'research', 'session.list')
    disposeSecondariesForConnection('source-a')

    expect(secondaryGateways[0].close).toHaveBeenCalledOnce()
    expect(onActiveConnectionInvalidated).not.toHaveBeenCalled()

    await requestGatewayForAgent('source-a', 'research', 'session.list')
    expect(secondaryGateways).toHaveLength(2)
    expect(getConnectionFor).toHaveBeenCalledTimes(2)
  })

  it('invalidates an active pinned source with its window profile and a route epoch', async () => {
    const primary = makePrimary()
    const onActiveConnectionChanged = vi.fn()
    const onActiveConnectionInvalidated = vi.fn()

    setPrimaryGateway(primary as never, 'pinned')
    configureGatewayRegistry({ onActiveConnectionChanged, onActiveConnectionInvalidated, onEvent: vi.fn() })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }

    await ensureGatewayForAgent('source-a', 'pinned')
    disposeSecondariesForConnection('source-a')

    const invalidationEpoch = gatewayActivationEpoch()
    expect(onActiveConnectionInvalidated).toHaveBeenCalledWith('pinned', invalidationEpoch)
    expect($gateway.get()).toBe(primary)

    // Same profile, different source advances the guard as soon as activation
    // starts, before its deferred socket connect can finish.
    let releaseConnect: () => void = () => undefined
    connectGate = new Promise<void>(resolve => {
      releaseConnect = resolve
    })
    const sourceBActivation = ensureGatewayForAgent('source-b', 'pinned')
    await vi.waitFor(() => expect(secondaryGateways[1]?.connect).toHaveBeenCalledOnce())
    expect(gatewayActivationEpoch()).toBeGreaterThan(invalidationEpoch)
    releaseConnect()
    await sourceBActivation
    expect(onActiveConnectionChanged).toHaveBeenLastCalledWith(expect.objectContaining({ connectionId: 'source-b' }))
  })

  it('does not activate or publish a source invalidated while its dial is pending', async () => {
    const primary = makePrimary()
    const onActiveConnectionChanged = vi.fn()

    setPrimaryGateway(primary as never, 'default')
    configureGatewayRegistry({ onActiveConnectionChanged, onEvent: vi.fn() })
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      getConnection: vi.fn(async profile => ({ port: 4242, profile })),
      getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({ connectionId, port: 5151, profile })),
      getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
        ok: true as const,
        wsUrl: `ws://${connectionId}/${profile}`
      })),
      touchBackend: vi.fn(async () => undefined)
    }
    await ensureGatewayForProfile('default')

    let releaseConnect: () => void = () => undefined
    connectGate = new Promise<void>(resolve => {
      releaseConnect = resolve
    })
    const pendingActivation = ensureGatewayForAgent('source-b', 'default')
    await vi.waitFor(() => expect(secondaryGateways[0]?.connect).toHaveBeenCalledOnce())

    disposeSecondariesForConnection('source-b')
    releaseConnect()
    await pendingActivation

    expect(secondaryGateways[0].close).toHaveBeenCalled()
    expect(onActiveConnectionChanged).not.toHaveBeenCalled()
    expect($gateway.get()).toBe(primary)
  })
})
