import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $rightRailActiveTabId, selectRightRailTab } from '@/store/layout'
import { closeRightRail, openPreview, type PreviewTarget } from '@/store/preview'

import {
  interactActivePreview,
  PREVIEW_READ_MAX_CHARS,
  readActivePreview,
  registerPreviewPageController,
  registerPreviewPageReader
} from './preview-reader'

function urlTarget(url: string): PreviewTarget {
  return { kind: 'url', label: 'Browser', source: url, url }
}

function fileTarget(path: string): PreviewTarget {
  return { kind: 'file', label: path, path, previewKind: 'text', source: path, url: `file://${path}` }
}

describe('readActivePreview (read_preview tool)', () => {
  // All URL targets share the singleton Browser tab id, so a reader registered
  // in one test would answer the next — unregister whatever a test installed.
  let cleanups: Array<() => void> = []

  const register = (tabId: string, reader: Parameters<typeof registerPreviewPageReader>[1]) => {
    const unregister = registerPreviewPageReader(tabId, reader)

    cleanups.push(unregister)

    return unregister
  }

  beforeEach(() => {
    for (const cleanup of cleanups) {
      cleanup()
    }

    cleanups = []
    closeRightRail()
    window.localStorage.clear()
  })

  it('answers null when nothing is open, so the tool reports it cleanly', async () => {
    expect(await readActivePreview()).toBeNull()
  })

  it('serializes the Browser tab through its registered page reader', async () => {
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    register($rightRailActiveTabId.get()!, async () => ({
      text: 'Top stories…',
      title: 'Hacker News',
      url: 'https://news.ycombinator.com/news'
    }))

    expect(await readActivePreview()).toMatchObject({
      kind: 'url',
      text: 'Top stories…',
      title: 'Hacker News',
      total_chars: 12,
      // The live address wins over the target (in-page navigation).
      url: 'https://news.ycombinator.com/news'
    })
  })

  it('includes interactive refs from the same visible page', async () => {
    openPreview(urlTarget('https://example.com/login'), 'tool-result')
    register($rightRailActiveTabId.get()!, async () => ({
      elements: [
        { disabled: false, name: 'Email', ref: '@p1', role: 'textbox' },
        { disabled: false, name: 'Continue', ref: '@p2', role: 'button' }
      ],
      text: 'Sign in',
      title: 'Example',
      url: 'https://example.com/login'
    }))

    expect(await readActivePreview()).toMatchObject({
      elements: [
        { name: 'Email', ref: '@p1', role: 'textbox' },
        { name: 'Continue', ref: '@p2', role: 'button' }
      ]
    })
  })

  it('routes browser interaction to the controller behind the active tab', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')

    const interact = vi.fn().mockResolvedValue({
      action: 'click',
      message: 'Clicked Continue',
      ok: true,
      title: 'Example',
      url: 'https://example.com/next'
    })

    const unregister = registerPreviewPageController($rightRailActiveTabId.get()!, {
      interact,
      read: async () => ({ text: '', title: '', url: '' })
    })

    cleanups.push(unregister)

    await expect(interactActivePreview({ action: 'click', ref: '@p2' })).resolves.toMatchObject({
      ok: true,
      url: 'https://example.com/next'
    })
    expect(interact).toHaveBeenCalledWith({ action: 'click', ref: '@p2' })
  })

  it('reports that interaction is unavailable when no live Browser pane is mounted', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')

    await expect(interactActivePreview({ action: 'reload' })).resolves.toMatchObject({
      action: 'reload',
      ok: false
    })
  })

  it('windows long pages with start/count and reports the full length', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    register($rightRailActiveTabId.get()!, async () => ({
      text: 'abcdefghij',
      title: 't',
      url: ''
    }))

    expect(await readActivePreview({ count: 4, start: 2 })).toMatchObject({
      end: 6,
      start: 2,
      text: 'cdef',
      total_chars: 10
    })
  })

  it('caps a single read at PREVIEW_READ_MAX_CHARS even when asked for more', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    register($rightRailActiveTabId.get()!, async () => ({
      text: 'x'.repeat(PREVIEW_READ_MAX_CHARS + 5000),
      title: 't',
      url: ''
    }))

    const result = await readActivePreview({ count: PREVIEW_READ_MAX_CHARS + 5000 })

    expect(result?.text).toHaveLength(PREVIEW_READ_MAX_CHARS)
    expect(result?.total_chars).toBe(PREVIEW_READ_MAX_CHARS + 5000)
  })

  it('answers identity + retry note for a Browser tab whose pane is not mounted', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')

    expect(await readActivePreview()).toMatchObject({
      kind: 'url',
      note: expect.stringContaining('retry') as string,
      text: '',
      url: 'https://example.com'
    })
  })

  it('answers a file tab with its identity and points at read_file', async () => {
    openPreview(fileTarget('/work/notes.md'), 'file-browser')

    expect(await readActivePreview()).toMatchObject({
      kind: 'file',
      note: expect.stringContaining('read_file') as string,
      path: '/work/notes.md'
    })
  })

  it('reads the tab the user is LOOKING at, not the last one opened', async () => {
    openPreview(fileTarget('/work/one.md'), 'file-browser')
    openPreview(fileTarget('/work/two.md'), 'file-browser')
    selectRightRailTab('file:file:///work/one.md')

    expect(await readActivePreview()).toMatchObject({ path: '/work/one.md' })
  })

  it('falls back to the identity answer when the reader throws (webview booting)', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    register($rightRailActiveTabId.get()!, async () => {
      throw new Error('webview gone')
    })

    expect(await readActivePreview()).toMatchObject({ note: expect.stringContaining('retry') as string, text: '' })
  })

  it('unregister is idempotent and scoped to the same reader', async () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    const tabId = $rightRailActiveTabId.get()!
    const first = register(tabId, async () => ({ text: 'first', title: '', url: '' }))

    register(tabId, async () => ({ text: 'second', title: '', url: '' }))
    // Unregistering the STALE reader must not evict the live one.
    first()

    expect(await readActivePreview()).toMatchObject({ text: 'second' })
  })
})
