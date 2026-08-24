import { describe, expect, it } from 'vitest'

import {
  NEW_CHAT_ROUTE,
  primaryRouteSelectedSessionId,
  sessionRoute,
  SETTINGS_ROUTE,
  sidebarActiveSessionId,
  workspaceChatReturnRoute
} from './routes'

const SESS_A = 'sess-a'
const SESS_B = 'sess-b'

describe('primaryRouteSelectedSessionId', () => {
  it('prefers the routed session id over a stale/different store selection (#59305)', () => {
    // The route already committed to B while the store selection hasn't
    // caught up yet (still reads A) — the route wins.
    expect(primaryRouteSelectedSessionId(sessionRoute(SESS_B), SESS_A)).toBe(SESS_B)
  })

  it('returns null on the new-chat route even with a leftover selection from the previous chat', () => {
    expect(primaryRouteSelectedSessionId(NEW_CHAT_ROUTE, SESS_A)).toBeNull()
  })

  it('falls back to the store selection on a non-chat route (settings, overlays)', () => {
    expect(primaryRouteSelectedSessionId(SETTINGS_ROUTE, SESS_A)).toBe(SESS_A)
  })

  it('falls back to the store selection when the route matches the same session', () => {
    expect(primaryRouteSelectedSessionId(sessionRoute(SESS_A), SESS_A)).toBe(SESS_A)
  })

  it('returns null on a non-chat route with no store selection', () => {
    expect(primaryRouteSelectedSessionId(SETTINGS_ROUTE, null)).toBeNull()
  })
})

describe('workspaceChatReturnRoute', () => {
  it('returns to the selected durable session', () => {
    expect(workspaceChatReturnRoute('stored/session')).toBe('/stored%2Fsession')
  })

  it('falls back to Home without inventing a session', () => {
    expect(workspaceChatReturnRoute(null)).toBe(NEW_CHAT_ROUTE)
  })
})

describe('sidebarActiveSessionId', () => {
  it('keeps Messaging highlighted on the durable session its Back action targets', () => {
    expect(sidebarActiveSessionId('messaging', 'focused-tile', 'primary-session')).toBe('primary-session')
  })

  it('continues following tile focus in chat and clears selection on unrelated pages', () => {
    expect(sidebarActiveSessionId('chat', 'focused-tile', 'primary-session')).toBe('focused-tile')
    expect(sidebarActiveSessionId('skills', 'focused-tile', 'primary-session')).toBeNull()
  })
})
