import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TREE_KEY = 'hermes.desktop.layoutTree.v2'

const BROWSER_PANE = 'preview-tile:url:browser'

const initialTree = {
  type: 'split',
  id: 'root',
  orientation: 'row',
  weights: [3, 1],
  children: [
    { type: 'group', id: 'g-main', panes: ['workspace'], active: 'workspace' },
    { type: 'group', id: 'g-files', panes: ['files', BROWSER_PANE], active: 'files' }
  ]
}

describe('locked center dock', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(TREE_KEY, JSON.stringify(initialTree))
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function setup() {
    const tree = await import('./store')
    const model = await import('./model')
    const { registry } = await import('@/contrib/registry')

    registry.registerMany([
      {
        id: 'workspace',
        area: 'panes',
        title: 'Chat',
        data: { placement: 'main', uncloseable: true },
        render: () => null
      },
      {
        id: 'files',
        area: 'panes',
        title: 'Files',
        data: { placement: 'right' },
        render: () => null
      },
      {
        id: BROWSER_PANE,
        area: 'panes',
        title: 'Browser',
        data: {
          placement: 'main',
          dock: { pane: 'files', pos: 'center', enforce: true, locked: true }
        },
        render: () => null
      }
    ])

    tree.watchContributedPanes()

    return { model, tree }
  }

  it('rejects dragging the locked pane away from its center-dock anchor', async () => {
    const { model, tree } = await setup()

    tree.moveTreePane(BROWSER_PANE, { groupId: 'g-main', pos: 'right' })

    const browserGroup = model.findGroupOfPane(tree.$layoutTree.get()!, BROWSER_PANE)

    expect(browserGroup?.panes).toEqual(['files', BROWSER_PANE])
    expect(tree.$userPlacedPanes.get().has(BROWSER_PANE)).toBe(false)
  })

  it('rejects dragging the anchor away from its locked pane', async () => {
    const { model, tree } = await setup()

    tree.moveTreePane('files', { groupId: 'g-main', pos: 'right' })

    const filesGroup = model.findGroupOfPane(tree.$layoutTree.get()!, 'files')

    expect(filesGroup?.panes).toEqual(['files', BROWSER_PANE])
    expect(tree.$userPlacedPanes.get().has('files')).toBe(false)
  })

  it('allows the whole locked pair to move together', async () => {
    const { model, tree } = await setup()

    tree.moveTreePanes(['files', BROWSER_PANE], { groupId: 'g-main', pos: 'right' }, BROWSER_PANE)

    const filesGroup = model.findGroupOfPane(tree.$layoutTree.get()!, 'files')
    const browserGroup = model.findGroupOfPane(tree.$layoutTree.get()!, BROWSER_PANE)

    expect(filesGroup?.id).toBe(browserGroup?.id)
    expect(filesGroup?.panes).toEqual(['files', BROWSER_PANE])
  })
})
