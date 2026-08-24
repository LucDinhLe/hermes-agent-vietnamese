import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectsView } from './index'

const stores = vi.hoisted(() => {
  const { atom } = require('nanostores') as typeof Nanostores

  return {
    activeProject: atom<string | null>('p_alpha'),
    dismissed: atom<string[]>([]),
    pinned: atom<string[]>(['p_alpha']),
    tree: atom([
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
      sidebar: {
        projects: {
          emptyDescription: 'Create a project',
          emptyTitle: 'No projects',
          manageDescription: 'Manage related work',
          newButton: 'New project',
          open: 'Open project',
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
  filterVisibleProjects: (projects: unknown[]) => projects,
  pinProject: actions.pinProject,
  unpinProject: actions.unpinProject
}))

vi.mock('@/store/projects', () => ({
  $activeProjectId: stores.activeProject,
  $projectTree: stores.tree,
  $projectTreeLoading: stores.treeLoading,
  goToProject: actions.goToProject,
  openProjectCreate: actions.openProjectCreate,
  refreshProjectTree: actions.refreshProjectTree,
  refreshProjects: actions.refreshProjects
}))

vi.mock('../hooks/use-refresh-hotkey', () => ({ useRefreshHotkey: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
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
})
