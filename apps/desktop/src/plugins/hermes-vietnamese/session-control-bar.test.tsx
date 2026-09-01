import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SessionControlBar, type SessionControlBarProps } from './session-control-bar'

interface UsageSnapshot {
  calls: number
  context_max?: number
  context_percent?: number
  context_used?: number
  input: number
  output: number
  total: number
}

const gateway = atom('open')
const busy = atom(false)
const focusedSessionId = atom<string | null>('runtime-1')
const focusedSessionProfile = atom('default')
const usage = atom<UsageSnapshot | null>(null)
const model = atom('gpt-5.6-sol')
const profile = atom('default')

const copy: Record<string, string> = {
  'sessionControls.agents': 'Agents',
  'sessionControls.agentsHint': 'Chọn Agent để làm việc',
  'sessionControls.agentManager': 'Quản lý Agents…',
  'sessionControls.agentOpenFailed': 'Không thể mở Agent.',
  'sessionControls.activeAgent': 'Agent đang dùng',
  'sessionControls.activeAgentHint': 'Mở hồ sơ Agent đang dùng',
  'sessionControls.connected': 'Đã kết nối',
  'sessionControls.connecting': 'Đang kết nối',
  'sessionControls.context': 'Ngữ cảnh',
  'sessionControls.disconnected': 'Mất kết nối',
  'sessionControls.gateway': 'Gateway',
  'sessionControls.advisor': 'Advisor',
  'sessionControls.advisorDisabledNotice': 'Đã tắt Advisor.',
  'sessionControls.advisorEnabledNotice': 'Đã bật Advisor cho hồ sơ Experimental.',
  'sessionControls.advisorModel': 'Model đánh giá',
  'sessionControls.advisorOff': 'Đang tắt',
  'sessionControls.advisorOn': 'Đang bật',
  'sessionControls.advisorToggleFailed': 'Không thể thay đổi Advisor.',
  'sessionControls.mainModel': 'Model chính',
  'sessionControls.modelUnavailable': 'Chưa có model'
}

vi.mock('@hermes/plugin-sdk', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@hermes/plugin-sdk')

  return {
    ...actual,
    usePluginI18n: () => (key: string) => copy[key] ?? key
  }
})

vi.mock('@nanostores/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@nanostores/react')

  return {
    ...actual,
    useStore: (store: { get: () => unknown }) => store.get()
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  usage.set(null)
  busy.set(false)
  focusedSessionId.set('runtime-1')
  focusedSessionProfile.set('default')
})

const advisorOff = {
  distinct_from_main: true,
  enabled: false,
  model: 'gpt-5.6-sol',
  provider: 'openai-codex',
  value: 'off' as const
}

function renderBar(
  navigate = vi.fn(),
  request: NonNullable<SessionControlBarProps['request']> = vi.fn(async method =>
    method === 'profiles.list' ? { profiles: [{ name: 'default' }] } : advisorOff
  ),
  openSession: NonNullable<SessionControlBarProps['openSession']> = vi.fn(async () => undefined),
  newChat: NonNullable<SessionControlBarProps['newChat']> = vi.fn()
) {
  render(
    <SessionControlBar
      navigate={navigate}
      newChat={newChat}
      openSession={openSession}
      request={request}
      state={{ busy, focusedSessionId, focusedSessionProfile, focusedUsage: usage, gateway, model, profile }}
    />
  )

  return { navigate, newChat, openSession, request }
}

function openAgentMenu(name: string) {
  const trigger = screen.getByRole('button', { name })

  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

describe('V32 session control bar on the upstream SDK', () => {
  it('shows model-specific token usage and removes the duplicate main-model control', () => {
    usage.set({ calls: 1, context_max: 120_000, context_used: 30_000, input: 30_000, output: 0, total: 30_000 })
    renderBar()

    expect(screen.getByRole('button', { name: 'Gateway: Đã kết nối' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agents · Agent đang dùng: Hermes' })).toBeTruthy()
    expect(screen.getByLabelText('Ngữ cảnh gpt-5.6-sol: 30.000 / 120.000 token (25%)')).toBeTruthy()
    expect(screen.getByText('30k/120k · 25%')).toBeTruthy()
    // eslint-disable-next-line no-restricted-globals -- asserting the control is absent from the rendered surface
    expect(document.querySelector('[data-session-model-control]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Advisor: Đang tắt · Model đánh giá: gpt-5.6-sol' })).toBeTruthy()
  })

  it('opens only upstream-owned routes', () => {
    const { navigate } = renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Gateway: Đã kết nối' }))

    expect(navigate.mock.calls).toEqual([['/command-center?section=system']])
    expect(navigate).not.toHaveBeenCalledWith('/agents')
  })

  it('uses the Agents control to choose a persistent profile and open its existing session', async () => {
    focusedSessionProfile.set('mbc')

    const request = vi.fn(async (method: string) =>
      method === 'profiles.list'
        ? {
            profiles: [
              { name: 'default' },
              {
                name: 'mbc',
                preferred_session: { id: 'stored-mbc', title: 'Bot Chat' },
                ui_meta: { 'hermes-bots': { chat: 'stored-mbc', title: 'MBC' } }
              }
            ]
          }
        : advisorOff
    )

    const openSession = vi.fn(async () => undefined)
    const { navigate } = renderBar(vi.fn(), request, openSession)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Agents · Agent đang dùng: MBC' })).toBeTruthy())
    openAgentMenu('Agents · Agent đang dùng: MBC')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'MBC · đang dùng' }))

    await waitFor(() =>
      expect(openSession).toHaveBeenCalledWith('stored-mbc', {
        awaitHydration: true,
        expectHistory: true,
        intent: 'main',
        keepAllProfilesScope: true,
        profile: 'mbc',
        retryHydrationTimeoutOnce: true
      })
    )
    expect(navigate).not.toHaveBeenCalledWith('/agents')
    // eslint-disable-next-line no-restricted-globals -- the former duplicate chip must not exist anywhere in the surface
    expect(document.querySelector('[data-session-active-agent-control]')).toBeNull()
  })

  it('starts a profile-scoped session when the selected Agent has no history yet', async () => {
    const request = vi.fn(async (method: string) =>
      method === 'profiles.list'
        ? { profiles: [{ name: 'default' }, { name: 'new-agent', display_name: 'Agent mới' }] }
        : advisorOff
    )

    const newChat = vi.fn()
    renderBar(
      vi.fn(),
      request,
      vi.fn(async () => undefined),
      newChat
    )

    await screen.findByRole('button', { name: 'Agents · Agent đang dùng: Hermes' })
    openAgentMenu('Agents · Agent đang dùng: Hermes')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Agent mới' }))

    await waitFor(() => expect(newChat).toHaveBeenCalledWith('new-agent'))
  })

  it('keeps Agent management in the selector without exposing the temporary subagent tree', async () => {
    const { navigate } = renderBar()

    await screen.findByRole('button', { name: 'Agents · Agent đang dùng: Hermes' })
    openAgentMenu('Agents · Agent đang dùng: Hermes')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Quản lý Agents…' }))

    expect(navigate).toHaveBeenCalledWith('/agents/manage')
    expect(navigate).not.toHaveBeenCalledWith('/agents')
  })

  it('toggles the real profile-local review runner through gateway RPC', async () => {
    const request = vi.fn(async (method: string) =>
      method === 'config.set' ? { ...advisorOff, enabled: true, value: 'on' as const } : advisorOff
    )

    renderBar(vi.fn(), request)

    await waitFor(() => expect(request).toHaveBeenCalledWith('config.get', { key: 'advisor', session_id: 'runtime-1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advisor: Đang tắt · Model đánh giá: gpt-5.6-sol' }))

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('config.set', {
        key: 'advisor',
        session_id: 'runtime-1',
        value: 'on'
      })
    )
    expect(
      screen
        .getByRole('button', { name: 'Advisor: Đang bật · Model đánh giá: gpt-5.6-sol' })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('retries the bounded startup race and restores the persisted Advisor state', async () => {
    let reads = 0

    const request = vi.fn(async (method: string) => {
      if (method === 'config.get' && reads++ === 0) {
        throw new Error('gateway instance not published yet')
      }

      return { ...advisorOff, enabled: true, value: 'on' as const }
    })

    renderBar(vi.fn(), request)

    await waitFor(
      () =>
        expect(
          screen
            .getByRole('button', { name: 'Advisor: Đang bật · Model đánh giá: gpt-5.6-sol' })
            .getAttribute('aria-pressed')
        ).toBe('true'),
      { timeout: 2_000 }
    )
    expect(request.mock.calls.filter(([method]) => method === 'config.get')).toHaveLength(2)
  })
})
