import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'

import { ProjectsView } from './index'

const stores = vi.hoisted(() => {
  const { atom } = require('nanostores') as typeof Nanostores

  return {
    activeProject: atom<string | null>('p_alpha'),
    dismissed: atom<string[]>([]),
    pinned: atom<string[]>(['p_alpha']),
    tree: atom<SidebarProjectTree[]>([
      {
        id: 'p_alpha',
        label: 'Hermes Vietnamese',
        path: 'C:/work/hermes',
        repos: [],
        sessionCount: 12,
        totalTokens: 42_000
      }
    ]),
    treeLoading: atom(false)
  }
})

const actions = vi.hoisted(() => ({
  archiveProject: vi.fn(async () => undefined),
  deleteProject: vi.fn(async () => undefined),
  dismissAutoProject: vi.fn(),
  goToProject: vi.fn(),
  openProjectCreate: vi.fn(),
  pinProject: vi.fn(),
  refreshProjectTree: vi.fn(async () => undefined),
  refreshProjects: vi.fn(async () => undefined),
  unpinProject: vi.fn()
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { cancel: 'Cancel', done: 'Done', loading: 'Loading' },
      sidebar: {
        projects: {
          emptyDescription: 'Create a project',
          emptyTitle: 'No projects',
          manageDescription: 'Manage related work',
          newButton: 'New project',
          open: 'Open project',
          autoDiscovered: 'Found automatically',
          deleteConfirm: 'Files and sessions stay safe.',
          menuDelete: 'Delete project',
          removeFromSidebar: 'Hide from projects',
          searchPlaceholder: 'Search projects',
          sectionLabel: 'Projects',
          sessionsCount: (count: number) => `${count} sessions`,
          tokensCount: (tokens: string) => `${tokens} tokens`
        },
        row: { pin: 'Pin', unpin: 'Unpin' }
      }
    }
  })
}))

vi.mock('@/store/layout', () => ({
  $dismissedAutoProjectIds: stores.dismissed,
  $pinnedProjectIds: stores.pinned,
  dismissAutoProject: actions.dismissAutoProject,
  filterVisibleProjects: (projects: unknown[]) => projects,
  pinProject: actions.pinProject,
  unpinProject: actions.unpinProject
}))

vi.mock('@/store/projects', () => ({
  $activeProjectId: stores.activeProject,
  $projectTree: stores.tree,
  $projectTreeLoading: stores.treeLoading,
  archiveProject: actions.archiveProject,
  deleteProject: actions.deleteProject,
  goToProject: actions.goToProject,
  openProjectCreate: actions.openProjectCreate,
  refreshProjectTree: actions.refreshProjectTree,
  refreshProjects: actions.refreshProjects
}))

vi.mock('../hooks/use-refresh-hotkey', () => ({ useRefreshHotkey: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  stores.activeProject.set('p_alpha')
  stores.dismissed.set([])
  stores.pinned.set(['p_alpha'])
  stores.tree.set([
    {
      id: 'p_alpha',
      label: 'Hermes Vietnamese',
      path: 'C:/work/hermes',
      repos: [],
      sessionCount: 12,
      totalTokens: 42_000
    }
  ])
})

describe('ProjectsView', () => {
  it('shows project usage and opens or unpins the project', () => {
    render(
      <MemoryRouter>
        <ProjectsView />
      </MemoryRouter>
    )

    expect(screen.getByText('Hermes Vietnamese')).toBeTruthy()
    expect(screen.getByText('12 sessions')).toBeTruthy()
    expect(screen.getByText('42k tokens')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }))
    expect(actions.unpinProject).toHaveBeenCalledWith('p_alpha')

    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    expect(actions.goToProject).toHaveBeenCalledWith('p_alpha')
  })

  it('offers explicit hide and delete actions without coupling them to sessions', async () => {
    render(
      <MemoryRouter>
        <ProjectsView />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hide from projects' }))
    expect(actions.archiveProject).toHaveBeenCalledWith('p_alpha')

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete project' }).at(-1)!)
    expect(screen.getByText('Files and sessions stay safe.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }))

    await vi.waitFor(() => expect(actions.deleteProject).toHaveBeenCalledWith('p_alpha'))
  })

  it('labels an automatically discovered repository and lets the user hide it', () => {
    stores.activeProject.set(null)
    stores.pinned.set([])
    stores.tree.set([
      {
        id: 'C:/Users/alice/work/legacy-repo',
        isAuto: true,
        label: 'legacy-repo',
        path: 'C:/Users/alice/work/legacy-repo',
        repos: [],
        sessionCount: 0,
        totalTokens: 0
      }
    ])

    render(
      <MemoryRouter>
        <ProjectsView />
      </MemoryRouter>
    )

    expect(screen.getByText('Found automatically')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide from projects' }))
    expect(actions.dismissAutoProject).toHaveBeenCalledWith('C:/Users/alice/work/legacy-repo')
  })
})
