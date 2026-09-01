export interface NewSessionNavigationItem {
  action?: string
}

/**
 * The sidebar owns the primary workspace draft. Opening an additional tab is
 * a separate tab-strip action: reusing it here creates both the primary draft
 * and a tile when the user enters chat from another page.
 */
export function routeNewSessionNavigation<T extends NewSessionNavigationItem>(
  item: T,
  startFreshSessionDraft: () => void,
  navigateNormally: (item: T) => void
): void {
  if (item.action === 'new-session') {
    startFreshSessionDraft()

    return
  }

  navigateNormally(item)
}
