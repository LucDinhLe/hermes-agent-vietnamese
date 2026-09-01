import { beforeEach, describe, expect, it } from 'vitest'

import { $fileBrowserOpen, $rightRailActiveTabId, $rightSidebarView, setFileBrowserOpen } from './layout'
import {
  $previewTabs,
  closeRightRail,
  closeRightRailTab,
  openBrowserTab,
  openNewBrowserTab,
  openPreview
} from './preview'

beforeEach(() => {
  closeRightRail()
  setFileBrowserOpen(false)
})

describe('openBrowserTab', () => {
  it('opens the V32 Browser home in the visible right rail', () => {
    openBrowserTab()

    const tabs = $previewTabs.get()

    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.target.url).toBe('https://www.google.com/')
    expect($rightSidebarView.get()).toBe('browser')
    expect($fileBrowserOpen.get()).toBe(true)
  })

  // The hotkey is "show me the browser", not "reset the browser" — pressing it
  // while a page is loaded must not throw that page away.
  it('re-fronts the existing page instead of blanking it', () => {
    openPreview({ kind: 'url', label: 'Example', source: 'https://example.com', url: 'https://example.com' })
    openBrowserTab()

    const tabs = $previewTabs.get()

    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.target.url).toBe('https://example.com')
  })

  it('reuses the selected Browser tab from the public hotkey command', () => {
    openBrowserTab()
    openBrowserTab()
    openBrowserTab()

    expect($previewTabs.get()).toHaveLength(1)
  })

  it('adds and closes independent Browser tabs through the V32 plus action', () => {
    openBrowserTab()
    const firstId = $rightRailActiveTabId.get()
    openNewBrowserTab()
    const secondId = $rightRailActiveTabId.get()

    expect(secondId).not.toBe(firstId)
    expect($previewTabs.get().filter(tab => tab.target.kind === 'url')).toHaveLength(2)

    closeRightRailTab(secondId!)

    expect($rightRailActiveTabId.get()).toBe(firstId)
    expect($previewTabs.get().filter(tab => tab.target.kind === 'url')).toHaveLength(1)
  })

  // A file tab is keyed by identity; only the web surface is a singleton.
  it('leaves other preview tabs alone', () => {
    openPreview({ kind: 'file', label: 'notes.md', source: '/work/notes.md', url: 'file:///work/notes.md' })
    openBrowserTab()

    const tabs = $previewTabs.get()

    expect(tabs).toHaveLength(2)
    expect(tabs.map(tab => tab.target.url)).toContain('file:///work/notes.md')
  })

  it('returns to Files when the final Browser tab closes', () => {
    openBrowserTab()
    closeRightRailTab($rightRailActiveTabId.get()!)

    expect($rightSidebarView.get()).toBe('files')
  })
})
