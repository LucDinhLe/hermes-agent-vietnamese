import type { PluginContext } from '@hermes/plugin-sdk'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { useContributions } from '@/contrib/react/use-contributions'
import { I18nProvider } from '@/i18n/context'
import { registerPluginLocales } from '@/i18n/plugin-i18n'
import { VIETNAMESE_EDITION_LOCALES } from '@/plugins/hermes-vietnamese/i18n'
import plugin from '@/plugins/hermes-vietnamese/plugin'
import { $pinnedProjectIds, $pinnedSessionIds, $sidebarGrouping, setSidebarGrouping } from '@/store/layout'
import { $projectTree, $projectTreeLoading } from '@/store/projects'
import { $sessions, $sessionsLoading } from '@/store/session'

import { ChatSidebar } from './index'

vi.mock('@/contrib/react/use-contributions', () => ({ useContributions: vi.fn() }))

let disposeLocales = () => {}

beforeEach(() => {
  disposeLocales = registerPluginLocales('hermes-vietnamese', VIETNAMESE_EDITION_LOCALES)
  $pinnedProjectIds.set([])
  $pinnedSessionIds.set([])
  $projectTree.set([])
  $projectTreeLoading.set(false)
  $sessions.set([])
  $sessionsLoading.set(false)
})

afterEach(() => {
  cleanup()
  disposeLocales()
  vi.clearAllMocks()
  setSidebarGrouping('date')
})

function editionNavigation() {
  const contributions: Parameters<PluginContext['registerMany']>[0] = []

  const labels: Record<string, string> = {
    nav: 'Bản tiếng Việt',
    navAgents: 'Agents',
    navUsage: 'Thống kê sử dụng'
  }

  const context = {
    i18n: { register: vi.fn(), t: (key: string) => labels[key] ?? key },
    registerMany: vi.fn(items => {
      contributions.push(...items)

      return () => undefined
    }),
    os: {}
  } as unknown as PluginContext

  plugin.register(context)

  return contributions.filter(item => item.area === 'sidebar.nav')
}

function renderSidebar(initialEntry = '/') {
  const onNavigate = vi.fn()

  vi.mocked(useContributions).mockReturnValue(editionNavigation())

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <I18nProvider configClient={null} initialLocale="vi">
        <SidebarProvider>
          <ChatSidebar
            currentView="chat"
            onArchiveSession={vi.fn()}
            onBranchSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onLoadMoreSessions={vi.fn()}
            onManageCronJob={vi.fn()}
            onNavigate={onNavigate}
            onNewSessionInWorkspace={vi.fn()}
            onNewSessionSplit={vi.fn()}
            onResumeSession={vi.fn()}
            onTriggerCronJob={vi.fn(async () => undefined)}
          />
        </SidebarProvider>
      </I18nProvider>
    </MemoryRouter>
  )

  return onNavigate
}

describe('Vietnamese direct navigation', () => {
  it('keeps the V32 session chrome visible for a fresh empty profile', () => {
    renderSidebar()

    expect(screen.getByRole('textbox', { name: 'Tìm phiên' })).toBeTruthy()

    const sessionArea = globalThis.document.querySelector('[data-sessions-mode="flat"]')

    expect(sessionArea).toBeTruthy()

    const sessionChrome = within(sessionArea as HTMLElement)

    expect(sessionChrome.getByText('Đã ghim', { exact: true })).toBeTruthy()
    expect(sessionChrome.getByText('Shift + nhấp vào cuộc trò chuyện để ghim')).toBeTruthy()
    expect(sessionChrome.getByText('Dự án đã ghim', { exact: true })).toBeTruthy()
    expect(sessionChrome.getByText('Ghim dự án để truy cập nhanh tại đây.')).toBeTruthy()
    expect(sessionChrome.getByText('Phiên', { exact: true })).toBeTruthy()
    expect(sessionChrome.getByText('Chưa có phiên nào', { exact: true })).toBeTruthy()
  })

  it('resolves a persisted pinned project through the existing upstream project tree', () => {
    $projectTree.set([
      {
        id: 'project-alpha',
        label: 'Dự án Alpha',
        path: 'C:/workspace/alpha',
        repos: [],
        sessionCount: 0
      }
    ])
    $pinnedProjectIds.set(['project-alpha'])

    renderSidebar()

    const shortcut = globalThis.document.querySelector('[data-sessions-project="project-alpha"]')

    expect(shortcut).toBeTruthy()
    expect(within(shortcut as HTMLElement).getByText('Dự án Alpha', { exact: true })).toBeTruthy()
  })

  it('renders Usage in the exact V32 nav order and sends its upstream target', () => {
    const onNavigate = renderSidebar()

    const navRows = Array.from(globalThis.document.querySelectorAll('[data-sidebar-nav-id]'))

    expect(navRows.map(node => node.getAttribute('data-sidebar-nav-id'))).toEqual([
      'new-session',
      'projects',
      'usage-nav',
      'skills',
      'messaging',
      'artifacts',
      'cron'
    ])
    expect(navRows.map(node => node.querySelector('span.min-w-0')?.textContent)).toEqual([
      'Phiên mới',
      'Dự án',
      'Thống kê sử dụng',
      'Kỹ năng',
      'Nhắn tin',
      'Tệp kết quả',
      'Tác vụ định kỳ'
    ])
    expect(screen.queryByRole('button', { name: 'Agents' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bản tiếng Việt' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Thống kê sử dụng' }))

    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ route: '/command-center?section=usage' }))
  })

  it('opens the existing upstream project overview instead of inventing a route', () => {
    const onNavigate = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Dự án' }))

    expect($sidebarGrouping.get()).toBe('project')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('returns from the project overview to the V32 session home when starting a new session', () => {
    const onNavigate = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Dự án' }))
    expect($sidebarGrouping.get()).toBe('project')

    fireEvent.click(screen.getByRole('button', { name: /^Phiên mới/u }))

    expect($sidebarGrouping.get()).toBe('date')
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ action: 'new-session' }))
  })

  it('keeps the query-backed usage row active and localizes standing sidebar controls', () => {
    renderSidebar('/command-center?section=usage')

    const usage = screen.getByRole('button', { name: 'Thống kê sử dụng' })

    expect(usage.className).toContain('bg-(--ui-control-active-background)')
    expect(screen.getByRole('button', { name: 'Bộ lọc' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quản lý Gateway…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage gateways…' })).toBeNull()
  })
})
