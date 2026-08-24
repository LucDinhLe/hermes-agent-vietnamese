import { describe, expect, it } from 'vitest'

import {
  $fileBrowserOpen,
  FILE_BROWSER_MAX_WIDTH,
  FILE_BROWSER_PANE_ID,
  migrateRightSidebarDefaultOpen
} from './layout'
import { $paneStates } from './panes'

const RIGHT_SIDEBAR_DEFAULT_OPEN_MIGRATION_STORAGE_KEY = 'hermes.desktop.migrations.rightSidebarDefaultOpen.v29'

describe('right workspace rail sizing', () => {
  it('opens the Files and Browser rail for a fresh desktop profile', () => {
    expect($fileBrowserOpen.get()).toBe(true)
  })

  it('reopens an old persisted closed default once, then preserves later user choices', () => {
    const original = $paneStates.get()
    const originalMigration = window.localStorage.getItem(RIGHT_SIDEBAR_DEFAULT_OPEN_MIGRATION_STORAGE_KEY)

    try {
      window.localStorage.removeItem(RIGHT_SIDEBAR_DEFAULT_OPEN_MIGRATION_STORAGE_KEY)
      $paneStates.set({ ...original, [FILE_BROWSER_PANE_ID]: { open: false } })

      migrateRightSidebarDefaultOpen()
      expect($fileBrowserOpen.get()).toBe(true)

      $paneStates.set({ ...$paneStates.get(), [FILE_BROWSER_PANE_ID]: { open: false } })
      migrateRightSidebarDefaultOpen()
      expect($fileBrowserOpen.get()).toBe(false)
    } finally {
      $paneStates.set(original)

      if (originalMigration === null) {
        window.localStorage.removeItem(RIGHT_SIDEBAR_DEFAULT_OPEN_MIGRATION_STORAGE_KEY)
      } else {
        window.localStorage.setItem(RIGHT_SIDEBAR_DEFAULT_OPEN_MIGRATION_STORAGE_KEY, originalMigration)
      }
    }
  })

  it('can expand beyond the old 20rem cap while remaining viewport-bounded', () => {
    expect(FILE_BROWSER_MAX_WIDTH).toBe('min(65vw, 90rem)')
  })
})
