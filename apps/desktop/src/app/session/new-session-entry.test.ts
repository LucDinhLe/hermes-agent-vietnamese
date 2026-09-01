import { describe, expect, it, vi } from 'vitest'

import { routeNewSessionNavigation } from './new-session-entry'

describe('new session entry contract', () => {
  it('routes the sidebar row to one primary draft instead of adding a second tab', () => {
    const startFreshSessionDraft = vi.fn()
    const navigateNormally = vi.fn()
    const item = { action: 'new-session', id: 'new-session' }

    routeNewSessionNavigation(item, startFreshSessionDraft, navigateNormally)

    expect(startFreshSessionDraft).toHaveBeenCalledOnce()
    expect(navigateNormally).not.toHaveBeenCalled()
  })

  it('preserves every non-session navigation item', () => {
    const startFreshSessionDraft = vi.fn()
    const navigateNormally = vi.fn()
    const item = { action: 'open', id: 'projects' }

    routeNewSessionNavigation(item, startFreshSessionDraft, navigateNormally)

    expect(startFreshSessionDraft).not.toHaveBeenCalled()
    expect(navigateNormally).toHaveBeenCalledWith(item)
  })
})
