import { atom } from 'nanostores'

import type { SessionInfo } from '@/types/hermes'

import { $selectedStoredSessionId, $sessions } from './session'
import { explicitSessionRouteOwner, stageSessionRouteOwner } from './session-route-owner'

// Mac-style session switcher (^Tab). Quick tap jumps on keydown; the HUD opens
// only when Tab is held past REVEAL_MS or tapped again while Ctrl is down.

export const SWITCHER_REVEAL_MS = 220

export const $switcherOpen = atom(false)
export const $switcherSessions = atom<SessionInfo[]>([])
export const $switcherIndex = atom(0)

const wrap = (index: number, length: number): number => ((index % length) + length) % length

function idWithStagedOwner(session: SessionInfo | undefined): null | string {
  if (!session) {
    return null
  }

  const owner = explicitSessionRouteOwner(session)

  if (owner) {
    stageSessionRouteOwner(session.id, owner)
  }

  return session.id
}

let pendingBrowse = false
let revealTimer: ReturnType<typeof setTimeout> | null = null
let tabHeld = false
let closedAt = 0

function clearRevealTimer(): void {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}

function revealOverlay(): void {
  pendingBrowse = false
  $switcherOpen.set(true)
}

function scheduleReveal(): void {
  clearRevealTimer()
  revealTimer = setTimeout(() => {
    revealTimer = null

    if (pendingBrowse && tabHeld) {
      revealOverlay()
    }
  }, SWITCHER_REVEAL_MS)
}

export function onSwitcherTabDown(): void {
  tabHeld = true
}

export function onSwitcherTabUp(): void {
  tabHeld = false

  if (!$switcherOpen.get()) {
    clearRevealTimer()
  }
}

// First Tab returns a session id to jump to immediately; later Tabs move the
// highlight (Ctrl↑ commits when the HUD is open).
export function openOrAdvanceSwitcher(direction: 1 | -1): string | null {
  const sessions = $sessions.get()

  if (sessions.length < 2) {
    return null
  }

  if ($switcherOpen.get()) {
    const { length } = $switcherSessions.get()

    if (length) {
      $switcherIndex.set(wrap($switcherIndex.get() + direction, length))
    }

    return null
  }

  const current = sessions.findIndex(session => session.id === $selectedStoredSessionId.get())
  const start = current === -1 ? (direction === 1 ? -1 : 0) : current
  const nextIndex = wrap(start + direction, sessions.length)

  $switcherSessions.set(sessions)
  $switcherIndex.set(nextIndex)

  if (pendingBrowse) {
    clearRevealTimer()
    $switcherIndex.set(wrap($switcherIndex.get() + direction, sessions.length))
    revealOverlay()

    return null
  }

  pendingBrowse = true
  scheduleReveal()

  return idWithStagedOwner(sessions[nextIndex])
}

export const highlightedSessionId = (): string | null =>
  idWithStagedOwner($switcherSessions.get()[$switcherIndex.get()])

export const slotSessionId = (slot: number): string | null =>
  idWithStagedOwner(
    ($switcherOpen.get() || pendingBrowse ? $switcherSessions.get() : $sessions.get())[slot - 1]
  )

export function closeSwitcher(): void {
  closedAt = Date.now()
  clearRevealTimer()
  pendingBrowse = false
  tabHeld = false
  $switcherOpen.set(false)
}

export function commitOnCtrlUp(): string | null {
  clearRevealTimer()
  pendingBrowse = false

  if (!$switcherOpen.get()) {
    return null
  }

  const target = highlightedSessionId()
  closeSwitcher()

  return target
}

export const switcherJustClosed = (): boolean => Date.now() - closedAt < 400

export const switcherActive = (): boolean => $switcherOpen.get() || pendingBrowse
