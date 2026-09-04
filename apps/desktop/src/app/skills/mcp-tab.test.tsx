// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryClient } from '@/lib/query-client'
import { $activeSessionId } from '@/store/session'

import { McpTab } from './mcp-tab'

const { getMcpAssignments, saveMcpServers } = vi.hoisted(() => ({
  getMcpAssignments: vi.fn(),
  saveMcpServers: vi.fn()
}))

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getLogs: vi.fn().mockResolvedValue({ lines: [] }),
  getMcpAssignments: (...args: unknown[]) => getMcpAssignments(...args),
  getMcpCatalog: vi.fn().mockResolvedValue({ diagnostics: [], entries: [] }),
  getUsageAnalytics: vi.fn().mockResolvedValue({ tools: [] }),
  saveMcpServers
}))

vi.mock('../hooks/use-config-record', () => ({
  hermesConfigCacheWriter: () => vi.fn(),
  useHermesConfigRecord: () => ({
    data: {
      mcp_servers: {
        crm: { enabled: true, url: 'https://crm.example/mcp' },
        docs: { enabled: true, url: 'https://docs.example/mcp' }
      }
    },
    dataUpdatedAt: 1,
    error: null,
    errorUpdatedAt: 0,
    isError: false,
    isLoading: false,
    refetch: vi.fn()
  })
}))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
// Bảng phân công MCP cần route /api/mcp/assignments, lõi nguyên bản không có
// (engine.lock). Test này kiểm hành vi khi cờ vỏ bật.
vi.mock('@/lib/vi-features', () => ({ viFeature: () => true }))

function view(profile: string) {
  return (
    <QueryClientProvider client={queryClient}>
      <McpTab connectionId="remote-a" gateway={null} profile={profile} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  $activeSessionId.set('session-a')
  getMcpAssignments.mockImplementation(async (sessionId: string, profile: string) => {
    const server = sessionId === 'session-a' ? (profile === 'work' ? 'crm' : 'docs') : null

    return {
      assigned: !!server,
      reasons: {},
      servers: server ? { [server]: [`mcp__${server}__search`] } : {},
      session_id: sessionId,
      tools: server ? [`mcp__${server}__search`] : []
    }
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  $activeSessionId.set(null)
  vi.clearAllMocks()
})

describe('McpTab assigned state', () => {
  it('follows the active session and profile without mutating MCP config', async () => {
    const rendered = render(view('default'))

    const docs = await screen.findByText('Docs')
    await waitFor(() => expect(within(docs.closest('[id^="mcp-server-"]')!).getByText('Assigned')).toBeTruthy())
    expect(getMcpAssignments).toHaveBeenCalledWith('session-a', 'default', 'remote-a')

    await act(async () => $activeSessionId.set('session-empty'))
    await waitFor(() => expect(screen.queryByText('Assigned')).toBeNull())

    await act(async () => $activeSessionId.set('session-a'))
    rendered.rerender(view('work'))
    const crm = await screen.findByText('Crm')
    await waitFor(() => expect(within(crm.closest('[id^="mcp-server-"]')!).getByText('Assigned')).toBeTruthy())
    expect(getMcpAssignments).toHaveBeenCalledWith('session-a', 'work', 'remote-a')
    expect(saveMcpServers).not.toHaveBeenCalled()
  })
})
