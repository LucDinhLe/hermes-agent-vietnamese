import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackendOwner } from './backend-owner'

const getActionStatus = vi.fn()
const notifyError = vi.fn()
const restartGateway = vi.fn()

vi.mock('@/hermes', () => ({
  getActionStatus: (...args: unknown[]) => getActionStatus(...args),
  restartGateway: (...args: unknown[]) => restartGateway(...args)
}))

vi.mock('@/i18n', () => ({
  translateNow: (key: string) => key
}))

vi.mock('@/store/notifications', () => ({ notifyError }))

const started = { name: 'gateway-restart', ok: true, pid: 42 }

const finished = {
  exit_code: 0,
  lines: ['Gateway restarted'],
  name: started.name,
  pid: started.pid,
  running: false
}

beforeEach(async () => {
  vi.clearAllMocks()
  restartGateway.mockResolvedValue(started)
  getActionStatus.mockResolvedValue(finished)

  const { $gatewayRestarting } = await import('./system-actions')
  $gatewayRestarting.set(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('gateway system actions', () => {
  it('keeps the exact backend owner across restart and status polling', async () => {
    const owner: BackendOwner = { connectionId: 'source-b', profile: 'shared' }
    const { runGatewayRestart } = await import('./system-actions')

    await runGatewayRestart(owner)

    expect(restartGateway).toHaveBeenCalledWith('shared', 'source-b')
    expect(getActionStatus).toHaveBeenCalledWith(started.name, 180, 'shared', 'source-b')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('routes direct action polling through the supplied backend owner', async () => {
    const owner: BackendOwner = { connectionId: 'remote-primary', profile: 'writer' }
    const { awaitHermesAction } = await import('./system-actions')

    await expect(awaitHermesAction(started, owner)).resolves.toEqual(finished)
    expect(getActionStatus).toHaveBeenCalledWith(started.name, 180, 'writer', 'remote-primary')
  })

  it('fails closed when the final bounded poll still reports the action running', async () => {
    vi.useFakeTimers()
    const owner: BackendOwner = { connectionId: 'source-b', profile: 'shared' }
    const running = { ...finished, exit_code: null, running: true }
    getActionStatus.mockResolvedValue(running)
    const { awaitHermesAction, HermesActionTimeoutError } = await import('./system-actions')

    const outcome = awaitHermesAction(started, owner).then(
      value => ({ error: null, value }),
      error => ({ error, value: null })
    )

    await vi.runAllTimersAsync()
    const settled = await outcome

    expect(settled.value).toBeNull()
    expect(settled.error).toBeInstanceOf(HermesActionTimeoutError)
    expect(settled.error).toMatchObject({
      message: 'shell.gatewayMenu.actionTimedOut',
      name: 'HermesActionTimeoutError'
    })

    expect(getActionStatus).toHaveBeenCalledTimes(18)
    expect(getActionStatus).toHaveBeenLastCalledWith(started.name, 180, 'shared', 'source-b')
  })

  it('keeps the zero-argument restart entry point on ambient routing', async () => {
    const { runGatewayRestart } = await import('./system-actions')

    await runGatewayRestart()

    expect(restartGateway).toHaveBeenCalledWith(undefined, undefined)
    expect(getActionStatus).toHaveBeenCalledWith(started.name, 180, undefined, undefined)
    expect(notifyError).not.toHaveBeenCalled()
  })
})
