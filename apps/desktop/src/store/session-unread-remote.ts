/**
 * Persisted unread flag sync (backend read-state watermark via
 * PATCH /api/sessions/{id} → SessionDB.set_session_read).
 *
 * The sidebar's dot is fed by TWO sources (see session-dot-state.ts): the
 * runtime "turn finished in background" marker ($unreadFinishedSessionIds,
 * transient) and the backend's derived `unread` key (last_read_at watermark
 * vs last_active — survives restarts and is visible to every surface). This
 * module owns the WRITE side of the persisted flag: the row-level
 * "Mark as unread"/"Mark as read" toggle and the automatic clear when a
 * session is opened. The read side lives in session-dot-state.ts.
 *
 * Optimistic, then honest (AGENTS.md): paint the row immediately, PATCH the
 * backend, roll back visibly on failure. A list page already in flight when
 * we PATCH can land after the ack carrying the OLD value — the write guard
 * lets our value outrank that stale page briefly (#74570 pattern, same as
 * session-pin-sync.ts).
 *
 * NOTE: import cycle with ./session is inert — both modules only touch each
 * other's exports inside function bodies, never at module evaluation time.
 */
import { atom } from 'nanostores'

import { sessionApiOwner, type SessionApiOwner, setSessionUnreadRemoteForOwner } from '@/hermes'

import { $sessions, sessionMatchesStoredId, setSessions } from './session'
import { sessionRouteOwner } from './session-route-owner'

export const UNREAD_WRITE_GUARD_MS = 10_000

/** id -> the value we wrote and when. Guarded rows outrank list pages. */
export const $unreadWriteGuard = atom<Map<string, { at: number; value: boolean }>>(new Map())

function sameOwner(a: SessionApiOwner, b: SessionApiOwner): boolean {
  return a.connectionId === b.connectionId && a.profile === b.profile
}

function rowFor(storedId: string) {
  const rows = $sessions.get().filter(row => sessionMatchesStoredId(row, storedId))
  const ownerHint = sessionRouteOwner(storedId)

  if (ownerHint) {
    return rows.find(row => sameOwner(sessionApiOwner(row), ownerHint))
  }

  const byOwner = new Map<string, (typeof rows)[number]>()

  for (const row of rows) {
    const owner = sessionApiOwner(row)
    byOwner.set(`${owner.connectionId ?? ''}\u0000${owner.profile}`, row)
  }

  return byOwner.size === 1 ? [...byOwner.values()][0] : undefined
}

/** Toggle the persisted unread flag: optimistic row update, then PATCH, then
 *  roll back visibly if the write fails. No-op for runtime-only sessions (a
 *  brand-new chat with no persisted row yet — there is nothing to flag). */
export async function markSessionUnread(storedId: string, unread: boolean): Promise<void> {
  const row = rowFor(storedId)

  if (!row) {
    return
  }

  const owner = sessionApiOwner(row)

  const isOwnedRow = (candidate: typeof row) =>
    sessionMatchesStoredId(candidate, storedId) && sameOwner(sessionApiOwner(candidate), owner)

  const guard = new Map($unreadWriteGuard.get())
  guard.set(storedId, { at: Date.now(), value: unread })
  $unreadWriteGuard.set(guard)

  setSessions(rows => rows.map(r => (isOwnedRow(r) ? { ...r, unread } : r)))

  try {
    await setSessionUnreadRemoteForOwner(storedId, unread, owner)
  } catch (err) {
    // Roll back visibly: the backend kept the old value.
    const guard2 = new Map($unreadWriteGuard.get())
    guard2.delete(storedId)
    $unreadWriteGuard.set(guard2)
    setSessions(rows => rows.map(r => (isOwnedRow(r) ? { ...r, unread: !unread } : r)))
    throw err
  }
}

/** Opening a session clears its persisted unread flag (auto-mark-read).
 *  Best-effort: a failed PATCH is healed by the next honest refresh. */
export async function clearUnreadOnOpen(storedId: string): Promise<void> {
  const row = rowFor(storedId)

  if (!row || row.unread !== true) {
    return
  }

  try {
    await markSessionUnread(storedId, false)
  } catch {
    // Ignore: the dot simply returns until a refresh reconciles.
  }
}

/** Release guard entries once a list page confirms the value we wrote. Call
 *  once at boot, next to watchSessionPins(). */
export function watchUnreadWriteGuard(): void {
  $sessions.listen(rows => {
    const guard = $unreadWriteGuard.get()
    let changed = false

    for (const [id, entry] of guard) {
      const row = rowFor(id)

      if (row && row.unread === entry.value) {
        guard.delete(id)
        changed = true
      }
    }

    if (changed) {
      $unreadWriteGuard.set(new Map(guard))
    }
  })
}
