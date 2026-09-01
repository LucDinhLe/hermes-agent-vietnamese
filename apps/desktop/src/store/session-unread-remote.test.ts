import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionInfo } from '@/types/hermes'

const patch = vi.fn<
  (id: string, unread: boolean, owner: { connectionId: null | string; profile: string }) => Promise<{ ok: boolean }>
>(() => Promise.resolve({ ok: true }))

vi.mock('@/hermes', () => ({
  // The store only needs the REST mutation; keep the mock minimal.
  sessionApiOwner: (row: SessionInfo) => ({
    connectionId: row.connection_id?.trim() || null,
    profile: row.profile?.trim() || 'default'
  }),
  setApiRequestProfile: () => {},
  setSessionUnreadRemoteForOwner: (
    id: string,
    unread: boolean,
    owner: { connectionId: null | string; profile: string }
  ) => patch(id, unread, owner)
}))

import { $sessions } from '@/store/session'
import { clearSessionRouteOwners, recordSessionRouteOwner } from '@/store/session-route-owner'

import { $unreadWriteGuard, clearUnreadOnOpen, markSessionUnread, watchUnreadWriteGuard } from './session-unread-remote'

const row = (id: string, extra: Partial<SessionInfo> = {}): SessionInfo =>
  ({ id, message_count: 1, source: 'cli', started_at: 0, title: id, ...extra }) as SessionInfo

beforeEach(() => {
  $sessions.set([])
  $unreadWriteGuard.set(new Map())
  clearSessionRouteOwners()
  patch.mockClear()
})

afterEach(() => {
  $sessions.set([])
  $unreadWriteGuard.set(new Map())
  clearSessionRouteOwners()
})

describe('markSessionUnread', () => {
  it('optimistically paints the row, then PATCHes with the exact backend owner', async () => {
    $sessions.set([row('a', { connection_id: 'source-a', profile: 'work', unread: false })])

    await markSessionUnread('a', true)

    expect(patch).toHaveBeenCalledWith('a', true, { connectionId: 'source-a', profile: 'work' })
    expect($sessions.get().find(s => s.id === 'a')?.unread).toBe(true)
  })

  it('no-ops for a runtime-only session with no persisted row', async () => {
    await markSessionUnread('ghost', true)

    expect(patch).not.toHaveBeenCalled()
  })

  it('uses only staged owner A when A and B share the same profile and id', async () => {
    $sessions.set([
      row('shared', { connection_id: 'source-b', profile: 'work', unread: false }),
      row('shared', { connection_id: 'source-a', profile: 'work', unread: false })
    ])
    recordSessionRouteOwner('shared', { connectionId: 'source-a', profile: 'work' })

    await markSessionUnread('shared', true)

    expect(patch).toHaveBeenCalledWith('shared', true, { connectionId: 'source-a', profile: 'work' })
    expect(patch).not.toHaveBeenCalledWith(
      'shared',
      expect.anything(),
      expect.objectContaining({ connectionId: 'source-b' })
    )
    expect($sessions.get().find(s => s.connection_id === 'source-a')?.unread).toBe(true)
    expect($sessions.get().find(s => s.connection_id === 'source-b')?.unread).toBe(false)
  })

  it('does no network work for an ownerless A/B collision', async () => {
    $sessions.set([
      row('shared', { connection_id: 'source-a', profile: 'work', unread: false }),
      row('shared', { connection_id: 'source-b', profile: 'work', unread: false })
    ])

    await markSessionUnread('shared', true)

    expect(patch).not.toHaveBeenCalled()
    expect($sessions.get().every(session => session.unread === false)).toBe(true)
  })

  it('rolls back the row and rethrows when the PATCH fails', async () => {
    $sessions.set([row('a', { unread: false })])
    patch.mockImplementationOnce(() => Promise.reject(new Error('offline')))

    await expect(markSessionUnread('a', true)).rejects.toThrow('offline')

    // The backend kept the old value, so the optimistic flip is undone and
    // the guard is released (nothing to fence a page about).
    expect($sessions.get().find(s => s.id === 'a')?.unread).toBe(false)
    expect($unreadWriteGuard.get().has('a')).toBe(false)
  })
})

describe('clearUnreadOnOpen', () => {
  it('no-ops for a session that is already read', async () => {
    $sessions.set([row('a', { unread: false })])

    await clearUnreadOnOpen('a')

    expect(patch).not.toHaveBeenCalled()
  })

  it('PATCHes read for an unread session, using its exact backend owner', async () => {
    $sessions.set([row('a', { connection_id: 'source-a', profile: 'p2', unread: true })])

    await clearUnreadOnOpen('a')

    expect(patch).toHaveBeenCalledWith('a', false, { connectionId: 'source-a', profile: 'p2' })
    expect($sessions.get().find(s => s.id === 'a')?.unread).toBe(false)
  })

  it('swallows a failed PATCH (the next honest refresh heals the dot)', async () => {
    $sessions.set([row('a', { unread: true })])
    patch.mockImplementationOnce(() => Promise.reject(new Error('offline')))

    await expect(clearUnreadOnOpen('a')).resolves.toBeUndefined()
  })
})

describe('watchUnreadWriteGuard', () => {
  it('drops a guard entry once a list page confirms the value we wrote', () => {
    watchUnreadWriteGuard()
    const guard = new Map<string, { at: number; value: boolean }>()
    guard.set('a', { at: Date.now(), value: true })
    $unreadWriteGuard.set(guard)

    // The server caught up and echoes our value back.
    $sessions.set([row('a', { unread: true })])

    expect($unreadWriteGuard.get().has('a')).toBe(false)
  })

  it('keeps the guard while a page contradicts a write still in flight', () => {
    watchUnreadWriteGuard()
    const guard = new Map<string, { at: number; value: boolean }>()
    guard.set('a', { at: Date.now(), value: true })
    $unreadWriteGuard.set(guard)

    // A list request issued before the PATCH still says read. Honouring it
    // would silently undo the mark the user just made.
    $sessions.set([row('a', { unread: false })])

    expect($unreadWriteGuard.get().has('a')).toBe(true)
  })
})
