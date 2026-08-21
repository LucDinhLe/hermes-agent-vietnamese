import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getActionStatus, getLogs, getStatus, restartGateway, runDoctor, startGateway, stopGateway } from '@/hermes'
import { HermesActionTimeoutError } from '@/store/system-actions'
import type { StatusResponse } from '@/types/hermes'

import { SessionGatewayControl } from './session-gateway-control'

const notifyError = vi.hoisted(() => vi.fn())

vi.mock('@/hermes', () => ({
  getActionStatus: vi.fn(),
  getLogs: vi.fn(),
  getStatus: vi.fn(),
  restartGateway: vi.fn(),
  runDoctor: vi.fn(),
  startGateway: vi.fn(),
  stopGateway: vi.fn()
}))

vi.mock('@/i18n', () => ({
  translateNow: (key: string) => key,
  useI18n: () => ({
    t: {
      common: { cancel: 'Cancel', confirm: 'Confirm', done: 'Done', loading: 'Loading' },
      errors: { genericFailure: 'Failed' },
      shell: {
        gatewayMenu: {
          actionFailed: (action: string) => `${action} failed.`,
          checkHealth: 'Check health',
          forceStopGateway: 'Force stop',
          forceStopUnavailable: 'Force stop unavailable',
          gateway: 'Gateway',
          healthHealthy: 'Gateway is healthy.',
          healthUnhealthy: 'Gateway is unhealthy.',
          lifecycleManagedBy: (profile: string) => `Managed by ${profile}.`,
          lifecycleOwnerUnknown: 'Gateway owner unknown.',
          logsEmpty: 'No logs',
          logsLoadFailed: 'Logs failed',
          pidLabel: (pid: number) => `PID ${pid}`,
          restartGateway: 'Restart',
          runDoctor: 'Run doctor',
          startGateway: 'Start',
          statusLoadFailed: 'Status failed',
          statusRunning: 'Running',
          statusStopped: 'Stopped',
          statusUnknown: 'Unknown',
          stopConfirmBody: (profile: string) => `Stop ${profile}`,
          stopSharedConfirmBody: 'Stop every shared profile',
          stopConfirmTitle: 'Stop this gateway?',
          stopGateway: 'Stop',
          sharedLifecycleWarning: 'Shared gateway warning.',
          viewLogs: 'View logs'
        }
      }
    }
  })
}))

vi.mock('@/store/notifications', () => ({ notifyError }))

function gatewayStatus(
  pid: number,
  running = true,
  lifecycleOwnerProfile: null | string | undefined = 'shared',
  lifecycleShared = false
): StatusResponse {
  return {
    active_sessions: 0,
    config_path: '',
    config_version: 1,
    env_path: '',
    gateway_exit_reason: null,
    gateway_health_url: null,
    gateway_lifecycle_owner_profile: lifecycleOwnerProfile,
    gateway_lifecycle_shared: lifecycleShared,
    gateway_pid: running ? pid : null,
    gateway_platforms: {},
    gateway_running: running,
    gateway_state: running ? 'running' : 'stopped',
    gateway_updated_at: null,
    hermes_home: '',
    latest_config_version: 1,
    version: 'test'
  }
}

function openGateway(index = 0) {
  const trigger = screen.getAllByRole('button', { name: 'Gateway' })[index]
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

beforeEach(() => {
  vi.mocked(getStatus).mockImplementation(async (_profile, connectionId) =>
    gatewayStatus(connectionId === 'source-b' ? 202 : 101)
  )
  vi.mocked(getLogs).mockResolvedValue({ file: 'gateway', lines: ['source-b gateway log'] })
  vi.mocked(getActionStatus).mockResolvedValue({
    exit_code: 0,
    lines: ['doctor complete'],
    name: 'test-action',
    pid: 303,
    running: false
  })
  vi.mocked(startGateway).mockResolvedValue({ name: 'gateway-start', ok: true, pid: 301 })
  vi.mocked(restartGateway).mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 302 })
  vi.mocked(stopGateway).mockResolvedValue({ name: 'gateway-stop', ok: true, pid: 303 })
  vi.mocked(runDoctor).mockResolvedValue({ name: 'doctor', ok: true, pid: 304 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SessionGatewayControl', () => {
  it('routes every exposed action to the exact same-profile source', async () => {
    render(
      <>
        <SessionGatewayControl backendReady connectionId="source-a" profile="shared" />
        <SessionGatewayControl backendReady connectionId="source-b" profile="shared" />
      </>
    )

    openGateway(1)

    expect(await screen.findByText(/PID 202/)).toBeTruthy()
    expect(getStatus).toHaveBeenCalledWith('shared', 'source-b')
    expect(getStatus).not.toHaveBeenCalledWith('shared', 'source-a')

    const forceStop = screen.getByRole('menuitem', { name: /Force stop/ })
    expect(forceStop.hasAttribute('data-disabled')).toBe(true)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Restart' }))

    await waitFor(() => expect(restartGateway).toHaveBeenCalledWith('shared', 'source-b'))
    expect(getActionStatus).toHaveBeenCalledWith('gateway-restart', 180, 'shared', 'source-b')

    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Run doctor' }).hasAttribute('data-disabled')).toBe(false)
    )

    fireEvent.click(screen.getByRole('menuitem', { name: 'View logs' }))
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith({ file: 'gateway', lines: 160 }, 'shared', 'source-b'))
    expect(await screen.findByText('source-b gateway log')).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run doctor' }))
    await waitFor(() => expect(runDoctor).toHaveBeenCalledWith('shared', 'source-b'))
    expect(getActionStatus).toHaveBeenCalledWith('doctor', 180, 'shared', 'source-b')
    expect(await screen.findByText('doctor complete')).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Check health' }))
    expect(await screen.findByText('Gateway is healthy.')).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop' }))

    await waitFor(() => expect(stopGateway).toHaveBeenCalledWith('shared', 'source-b'))
    expect(getActionStatus).toHaveBeenCalledWith('gateway-stop', 180, 'shared', 'source-b')

    expect(startGateway).not.toHaveBeenCalled()
    expect(restartGateway).not.toHaveBeenCalledWith('shared', 'source-a')
    expect(stopGateway).not.toHaveBeenCalledWith('shared', 'source-a')
    expect(runDoctor).not.toHaveBeenCalledWith('shared', 'source-a')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('strands a late status reply after the owning source changes', async () => {
    let resolveSourceA: ((value: StatusResponse) => void) | undefined

    vi.mocked(getStatus).mockImplementation((_profile, connectionId) => {
      if (connectionId === 'source-a') {
        return new Promise(resolve => {
          resolveSourceA = resolve
        })
      }

      return Promise.resolve(gatewayStatus(202))
    })

    const view = render(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)
    openGateway()

    await waitFor(() => expect(getStatus).toHaveBeenCalledWith('shared', 'source-a'))

    view.rerender(<SessionGatewayControl backendReady connectionId="source-b" profile="shared" />)
    await act(async () => resolveSourceA?.(gatewayStatus(101)))
    openGateway()

    expect(await screen.findByText(/PID 202/)).toBeTruthy()
    expect(screen.queryByText(/PID 101/)).toBeNull()
  })

  it('strands a late status reply across an A to B to A owner cycle', async () => {
    let resolveFirstSourceA: ((value: StatusResponse) => void) | undefined
    let sourceACalls = 0

    vi.mocked(getStatus).mockImplementation((_profile, connectionId) => {
      if (connectionId === 'source-a') {
        sourceACalls += 1

        if (sourceACalls === 1) {
          return new Promise(resolve => {
            resolveFirstSourceA = resolve
          })
        }

        return Promise.resolve(gatewayStatus(303))
      }

      return Promise.resolve(gatewayStatus(202))
    })

    const view = render(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)
    openGateway()
    await waitFor(() => expect(getStatus).toHaveBeenCalledWith('shared', 'source-a'))

    view.rerender(<SessionGatewayControl backendReady connectionId="source-b" profile="shared" />)
    view.rerender(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)
    await act(async () => resolveFirstSourceA?.(gatewayStatus(101)))

    openGateway()
    expect(await screen.findByText(/PID 303/)).toBeTruthy()
    expect(screen.queryByText(/PID 101/)).toBeNull()
  })

  it('keeps a newer same-owner status reply when an older request finishes last', async () => {
    let resolveFirst: ((value: StatusResponse) => void) | undefined
    let calls = 0

    vi.mocked(getStatus).mockImplementation(() => {
      calls += 1

      if (calls === 1) {
        return new Promise(resolve => {
          resolveFirst = resolve
        })
      }

      return Promise.resolve(gatewayStatus(202))
    })

    const view = render(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)
    openGateway()
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1))

    view.rerender(<SessionGatewayControl backendReady={false} connectionId="source-a" profile="shared" />)
    view.rerender(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)

    expect(await screen.findByText(/PID 202/)).toBeTruthy()
    await act(async () => resolveFirst?.(gatewayStatus(101)))

    expect(screen.getByText(/PID 202/)).toBeTruthy()
    expect(screen.queryByText(/PID 101/)).toBeNull()
  })

  it('preserves the actionable timeout instead of replacing it with a generic action failure', async () => {
    const timeout = new HermesActionTimeoutError('The gateway action is still running.')
    vi.mocked(restartGateway).mockRejectedValueOnce(timeout)
    render(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)

    openGateway()
    expect(await screen.findByText(/PID 101/)).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restart' }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(timeout, 'Restart failed.'))
  })

  it('does not leave logs disabled when their owning source changes mid-request', async () => {
    let resolveSourceA: ((value: { file: string; lines: string[] }) => void) | undefined

    vi.mocked(getLogs).mockImplementation((_params, _profile, connectionId) => {
      if (connectionId === 'source-a') {
        return new Promise(resolve => {
          resolveSourceA = resolve
        })
      }

      return Promise.resolve({ file: 'gateway', lines: ['source-b gateway log'] })
    })

    const view = render(<SessionGatewayControl backendReady connectionId="source-a" profile="shared" />)
    openGateway()
    expect(await screen.findByText(/PID 101/)).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'View logs' }))
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith({ file: 'gateway', lines: 160 }, 'shared', 'source-a'))

    view.rerender(<SessionGatewayControl backendReady connectionId="source-b" profile="shared" />)
    await act(async () => resolveSourceA?.({ file: 'gateway', lines: ['source-a gateway log'] }))
    openGateway()
    expect(await screen.findByText(/PID 202/)).toBeTruthy()

    const viewLogs = screen.getByRole('menuitem', { name: 'View logs' })
    expect(viewLogs.hasAttribute('data-disabled')).toBe(false)
    fireEvent.click(viewLogs)

    await waitFor(() => expect(getLogs).toHaveBeenCalledWith({ file: 'gateway', lines: 160 }, 'shared', 'source-b'))
    expect(await screen.findByText('source-b gateway log')).toBeTruthy()
    expect(screen.queryByText('source-a gateway log')).toBeNull()
  })

  it('starts an explicitly stopped gateway on its captured owner', async () => {
    vi.mocked(getStatus).mockResolvedValue(gatewayStatus(0, false, 'writer'))
    render(<SessionGatewayControl backendReady connectionId="source-c" profile="writer" />)

    openGateway()
    expect(await screen.findByText('Stopped')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start' }))

    await waitFor(() => expect(startGateway).toHaveBeenCalledWith('writer', 'source-c'))
    expect(getActionStatus).toHaveBeenCalledWith('gateway-start', 180, 'writer', 'source-c')
  })

  it('keeps diagnostics but hides lifecycle mutations for a shared non-owner profile', async () => {
    vi.mocked(getStatus).mockResolvedValue(gatewayStatus(4242, true, 'default', true))
    render(<SessionGatewayControl backendReady connectionId="source-c" profile="worker" />)

    openGateway()
    expect(await screen.findByText('Managed by default.')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Start' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Restart' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Stop' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'View logs' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Run doctor' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Check health' })).toBeTruthy()
  })

  it('warns before controlling the shared lifecycle from its real owner', async () => {
    vi.mocked(getStatus).mockResolvedValue(gatewayStatus(4242, true, 'default', true))
    render(<SessionGatewayControl backendReady connectionId="source-c" profile="default" />)

    openGateway()
    expect(await screen.findByText('Shared gateway warning.')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Stop every shared profile')).toBeTruthy()
  })

  it('fails closed for a named profile when an older backend omits lifecycle ownership', async () => {
    const legacyStatus = gatewayStatus(4242)
    delete legacyStatus.gateway_lifecycle_owner_profile
    delete legacyStatus.gateway_lifecycle_shared
    vi.mocked(getStatus).mockResolvedValue(legacyStatus)
    render(<SessionGatewayControl backendReady connectionId="source-c" profile="worker" />)

    openGateway()
    expect(await screen.findByText('Gateway owner unknown.')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Restart' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Stop' })).toBeNull()
  })

  it('fails closed when the backend reports ambiguous lifecycle ownership', async () => {
    vi.mocked(getStatus).mockResolvedValue(gatewayStatus(4242, true, null, true))
    render(<SessionGatewayControl backendReady connectionId="source-c" profile="default" />)

    openGateway()
    expect(await screen.findByText('Gateway owner unknown.')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Restart' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Stop' })).toBeNull()
  })

  it('fails closed when the chat owner cannot be resolved', () => {
    render(<SessionGatewayControl backendReady connectionId={null} profile="default" />)

    const trigger = screen.getByRole('button', { name: 'Gateway' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    fireEvent.click(trigger)
    expect(getStatus).not.toHaveBeenCalled()
  })
})
