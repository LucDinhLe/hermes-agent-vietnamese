import { beforeEach, describe, expect, it } from 'vitest'

import {
  $fileBrowserOpen,
  FILE_BROWSER_DEFAULT_WIDTH,
  FILE_BROWSER_PANE_ID,
  migrateV32RightSidebarDefaultOpen
} from './layout'
import { $paneStates, setPaneOpen } from './panes'

describe('V32 right-sidebar inheritance', () => {
  beforeEach(() => {
    localStorage.removeItem('hermes.vietnamese.migrations.v32RightSidebarDefaultOpen.dev11')
    setPaneOpen(FILE_BROWSER_PANE_ID, false)
  })

  it('opens the fresh Files/Browser surface at the accepted responsive V32 width', () => {
    expect(FILE_BROWSER_DEFAULT_WIDTH).toBe('clamp(15rem, 27vw, 36rem)')
  })

  it('reopens the Files/Browser rail once for a dev.10 profile', () => {
    migrateV32RightSidebarDefaultOpen()

    expect($paneStates.get()[FILE_BROWSER_PANE_ID]?.open).toBe(true)
    expect($fileBrowserOpen.get()).toBe(true)
  })

  it('respects the user choice after the one-time migration', () => {
    migrateV32RightSidebarDefaultOpen()
    setPaneOpen(FILE_BROWSER_PANE_ID, false)
    migrateV32RightSidebarDefaultOpen()

    expect($fileBrowserOpen.get()).toBe(false)
  })
})
