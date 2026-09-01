import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rendererRuntimeKey } from '@/lib/session-runtime-key'

const secondaryGateways: Array<{
  close: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  connectionState: string
  emitState: (state: string) => void
  request: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/hermes', () => ({
  HermesGateway: class {
    private readonly stateListeners = new Set<(state: string) => void>()

    connectionState = 'closed'
    connect = vi.fn(async () => {
      this.connectionState = 'open'
    })
    request = vi.fn(async (method: string, params: Record<string, unknown>) => ({ method, params }))
    close = vi.fn()
    onEvent = vi.fn(() => () => undefined)
    onState = vi.fn((listener: (state: string) => void) => {
      this.stateListeners.add(listener)

      return () => this.stateListeners.delete(listener)
    })

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

vi.mock('@/store/notify-baseline', () => ({ markNativeNotifyBaseline: vi.fn() }))

const {
  $gateway,
  closeSecondaryGateways,
  configureGatewayRegistry,
  ensureGatewayForAgent,
  gatewayEpochForAgent,
  setPrimaryGateway
} = await import('./gateway')

const { GatewayEventSourceEpochMismatchError, GatewayEventSourceRequiredError, requestForGatewayEventSource } =
  await import('./gateway-event-source')

function installDesktop(): void {
  ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
    getConnection: vi.fn(async (profile: null | string) => ({ port: 4242, profile })),
    getConnectionFor: vi.fn(async ({ connectionId, profile }) => ({
      connectionId,
      port: connectionId === 'source-a' ? 5151 : 5252,
      profile
    })),
    getGatewayWsUrlFor: vi.fn(async ({ connectionId, profile }) => ({
      ok: true as const,
      wsUrl: `ws://${connectionId}/${profile}`
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
  setPrimaryGateway(makePrimary() as never, 'default')
  installDesktop()
})

afterEach(() => {
  closeSecondaryGateways()
  vi.clearAllMocks()
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

describe('requestForGatewayEventSource', () => {
  it('answers only the emitting connection when profile, runtime id, and request id collide', async () => {
    await ensureGatewayForAgent('source-a', 'mbc')
    await ensureGatewayForAgent('source-b', 'mbc')

    const sourceA = rendererRuntimeKey(
      {
        connectionId: 'source-a',
        gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc'),
        profile: 'mbc'
      },
      'runtime-shared'
    )

    // B is the ambient gateway after the second activation. A request-id-only
    // response from A must still go back to A, with only backend wire params.
    expect($gateway.get()).toBe(secondaryGateways[1])

    await requestForGatewayEventSource(sourceA, 'clarify.respond', {
      answer: 'A only',
      request_id: 'request-shared'
    })

    expect(secondaryGateways[0].request).toHaveBeenCalledWith('clarify.respond', {
      answer: 'A only',
      request_id: 'request-shared'
    })
    expect(secondaryGateways[1].request).not.toHaveBeenCalled()
  })

  it('fails closed for missing, raw, and stale source provenance', async () => {
    await ensureGatewayForAgent('source-a', 'mbc')

    const currentEpoch = gatewayEpochForAgent('source-a', 'mbc')

    const stale = rendererRuntimeKey(
      { connectionId: 'source-a', gatewayEpoch: currentEpoch - 1, profile: 'mbc' },
      'runtime-shared'
    )

    await expect(requestForGatewayEventSource(null, 'sudo.respond')).rejects.toBeInstanceOf(
      GatewayEventSourceRequiredError
    )
    await expect(requestForGatewayEventSource('runtime-shared', 'sudo.respond')).rejects.toBeInstanceOf(
      GatewayEventSourceRequiredError
    )
    await expect(requestForGatewayEventSource(stale, 'sudo.respond')).rejects.toBeInstanceOf(
      GatewayEventSourceEpochMismatchError
    )
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })

  it('rejects a source event when reopening changes its epoch before the response is sent', async () => {
    await ensureGatewayForAgent('source-a', 'mbc')
    const source = rendererRuntimeKey(
      {
        connectionId: 'source-a',
        gatewayEpoch: gatewayEpochForAgent('source-a', 'mbc'),
        profile: 'mbc'
      },
      'runtime-reused'
    )

    secondaryGateways[0].emitState('closed')

    await expect(
      requestForGatewayEventSource(source, 'clarify.respond', { answer: 'must not cross generations' })
    ).rejects.toBeInstanceOf(GatewayEventSourceEpochMismatchError)
    expect(secondaryGateways[0].request).not.toHaveBeenCalled()
  })
})
