import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// This is a pane-registration contract test; rendering Chromium/file-preview
// surfaces would pull their full browser stack into an otherwise store-only
// assertion and make the test needlessly slow.
vi.mock('@/components/ui/file-type-icon', () => ({ FileTypeIcon: () => null }))
vi.mock('@/components/ui/tool-icon', () => ({ ToolIcon: () => null }))
vi.mock('./right-rail/preview', () => ({ PreviewTilePane: () => null }))

const TREE_KEY = 'hermes.desktop.layoutTree.v2'

const initialTree = {
  type: 'split',
  id: 'root',
  orientation: 'row',
  weights: [3, 1],
  children: [
    { type: 'group', id: 'g-main', panes: ['workspace'], active: 'workspace' },
    {
      type: 'group',
      id: 'g-files',
      panes: ['files', 'preview-tile:url:browser'],
      active: 'files'
    }
  ]
}

describe('V32 Browser rail boundary', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(TREE_KEY, JSON.stringify(initialTree))
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('keeps URL previews out of the layout tree while file previews remain panes', async () => {
    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')
    const preview = await import('@/store/preview')
    const { watchPreviewTiles } = await import('./preview-tile')

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
      }
    ])
    tree.watchContributedPanes()

    preview.openBrowserTab()
    watchPreviewTiles()

    const browserTab = preview.$previewTabs.get()[0]
    const browserPaneId = `preview-tile:${browserTab.id}`

    expect(browserTab.target.kind).toBe('url')
    expect(registry.getArea('panes').some(pane => pane.id === browserPaneId)).toBe(false)
    expect(model.findGroupOfPane(tree.$layoutTree.get()!, browserPaneId)).toBeNull()
    expect(model.findGroupOfPane(tree.$layoutTree.get()!, 'preview-tile:url:browser')).toBeNull()

    preview.openPreview({
      kind: 'file',
      label: 'notes.md',
      path: '/work/notes.md',
      source: '/work/notes.md',
      url: 'file:///work/notes.md'
    })

    const filePaneId = 'preview-tile:file:file:///work/notes.md'

    const paneData = registry.getArea('panes').find(pane => pane.id === filePaneId)?.data as
      | { minWidth?: string }
      | undefined

    expect(paneData?.minWidth).toBe('22rem')
    expect(model.findGroupOfPane(tree.$layoutTree.get()!, filePaneId)).not.toBeNull()
  })
})
