import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { retireAgentPaneList, retireAgentPaneRecord, retireAgentPanes } from './legacy-agent-pane-migration'
import { allPaneIds, type LayoutNode } from './model'

const TREE_KEY = 'hermes.desktop.layoutTree.v2'
const DISMISSED_KEY = 'hermes.desktop.dismissedPanes.v1'
const PANE_SHARE_KEY = 'hermes.desktop.paneShare.v1'
const USER_PLACED_KEY = 'hermes.desktop.userPlacedPanes.v1'

function readStoredJson<T>(key: string): T {
  return JSON.parse(window.localStorage.getItem(key) ?? 'null') as T
}

describe('Hermes v31 retired Agents panes migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('removes only the old Bots and Routines panes while retaining Sessions, workspace, and the right panel', () => {
    const tree: LayoutNode = {
      id: 'root',
      type: 'split',
      orientation: 'row',
      weights: [1, 3, 1],
      children: [
        {
          id: 'left',
          type: 'group',
          panes: ['sessions', 'hermes-bots:pane'],
          active: 'hermes-bots:pane'
        },
        {
          id: 'main',
          type: 'group',
          panes: ['workspace', 'hermes-bots:routines'],
          active: 'hermes-bots:routines'
        },
        {
          id: 'right',
          type: 'group',
          panes: ['files', 'review'],
          active: 'files'
        }
      ]
    }

    expect(retireAgentPanes(tree)).toEqual({
      ...tree,
      children: [
        { id: 'left', type: 'group', panes: ['sessions'], active: 'sessions' },
        { id: 'main', type: 'group', panes: ['workspace'], active: 'workspace' },
        { id: 'right', type: 'group', panes: ['files', 'review'], active: 'files' }
      ]
    })
  })

  it('cleans retired ids from dismissal, placement, and size bookkeeping only', () => {
    expect(retireAgentPaneList(['sessions', 'hermes-bots:pane', 'files', 'hermes-bots:routines'])).toEqual([
      'sessions',
      'files'
    ])
    expect(retireAgentPaneRecord({ files: 0.25, 'hermes-bots:pane': 0.2, 'hermes-bots:routines': 0.3 })).toEqual({
      files: 0.25
    })
  })

  it('removes a retired-only group without changing the remaining panel weights', () => {
    const tree: LayoutNode = {
      id: 'root',
      type: 'split',
      orientation: 'row',
      weights: [0.8, 0.4, 2.6, 1.1],
      children: [
        { id: 'sessions', type: 'group', panes: ['sessions'], active: 'sessions' },
        {
          id: 'retired-agents',
          type: 'group',
          panes: ['hermes-bots:pane', 'hermes-bots:routines'],
          active: 'hermes-bots:pane'
        },
        { id: 'workspace', type: 'group', panes: ['workspace'], active: 'workspace' },
        { id: 'right', type: 'group', panes: ['files', 'review'], active: 'review' }
      ]
    }

    expect(retireAgentPanes(tree)).toEqual({
      ...tree,
      weights: [0.8, 2.6, 1.1],
      children: [tree.children[0], tree.children[2], tree.children[3]]
    })
  })

  it('migrates persisted layout bookkeeping and self-heals after a rollback writes retired panes again', async () => {
    const legacyTree: LayoutNode = {
      id: 'root',
      type: 'split',
      orientation: 'row',
      weights: [1, 3, 1],
      children: [
        {
          id: 'left',
          type: 'group',
          panes: ['sessions', 'hermes-bots:pane'],
          active: 'hermes-bots:pane'
        },
        {
          id: 'main',
          type: 'group',
          panes: ['workspace', 'hermes-bots:routines'],
          active: 'hermes-bots:routines'
        },
        { id: 'right', type: 'group', panes: ['files', 'review'], active: 'review' }
      ]
    }

    window.localStorage.setItem(TREE_KEY, JSON.stringify(legacyTree))
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(['files', 'hermes-bots:pane']))
    window.localStorage.setItem(USER_PLACED_KEY, JSON.stringify(['sessions', 'hermes-bots:routines']))
    window.localStorage.setItem(
      PANE_SHARE_KEY,
      JSON.stringify({ files: 0.25, 'hermes-bots:pane': 0.2, 'hermes-bots:routines': 0.3 })
    )

    await import('./store')

    expect(allPaneIds(readStoredJson<LayoutNode>(TREE_KEY))).toEqual(['sessions', 'workspace', 'files', 'review'])
    expect(readStoredJson(DISMISSED_KEY)).toEqual(['files'])
    expect(readStoredJson(USER_PLACED_KEY)).toEqual(['sessions'])
    expect(readStoredJson(PANE_SHARE_KEY)).toEqual({ files: 0.25 })

    // A supported rollback can reintroduce the legacy panes while the v31
    // marker remains. Re-importing v31 must detect and clean that data again.
    window.localStorage.setItem(TREE_KEY, JSON.stringify(legacyTree))
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(['review', 'hermes-bots:pane']))
    vi.resetModules()

    await import('./store')

    expect(allPaneIds(readStoredJson<LayoutNode>(TREE_KEY))).toEqual(['sessions', 'workspace', 'files', 'review'])
    expect(readStoredJson(DISMISSED_KEY)).toEqual(['review'])
  })
})
