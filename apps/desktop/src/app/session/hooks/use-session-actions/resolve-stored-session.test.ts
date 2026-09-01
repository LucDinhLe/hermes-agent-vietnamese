import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesModule from '@/hermes'
import { getSessionForOwner } from '@/hermes'
import { $cronSessions, $messagingSessions, $sessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { resolveSessionOwner, resolveSessionProfile, resolveStoredSession } from './utils'

vi.mock('@/hermes', async importActual => ({
  ...(await importActual<typeof HermesModule>()),
  getSessionForOwner: vi.fn()
}))

const mockGetSessionForOwner = vi.mocked(getSessionForOwner)
const session = (over: Partial<SessionInfo>): SessionInfo => over as SessionInfo

describe('resolveStoredSession exact ownership', () => {
  beforeEach(() => {
    $cronSessions.set([])
    $messagingSessions.set([])
    $sessions.set([])
    mockGetSessionForOwner.mockReset()
  })

  afterEach(() => {
    $cronSessions.set([])
    $messagingSessions.set([])
    $sessions.set([])
  })

  it('returns one cached row with an explicit local profile without a network probe', async () => {
    $sessions.set([session({ id: 's1', profile: 'default' })])

    await expect(resolveStoredSession('s1')).resolves.toMatchObject({ id: 's1', profile: 'default' })
    await expect(resolveSessionOwner('s1')).resolves.toEqual({ connectionId: null, profile: 'default' })
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it.each([
    ['cron', $cronSessions],
    ['messaging', $messagingSessions]
  ])('resolves one explicitly owned %s row without duplicating it into regular sessions', async (_source, store) => {
    store.set([session({ connection_id: 'source-a', id: 's1', profile: 'mbc' })])

    await expect(resolveSessionOwner('s1')).resolves.toEqual({ connectionId: 'source-a', profile: 'mbc' })
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
    expect($sessions.get()).toEqual([])
  })

  it('fails closed without a cached owner and performs no ambient or profile probe', async () => {
    await expect(resolveStoredSession('same-id')).resolves.toBeUndefined()
    await expect(resolveSessionOwner('same-id')).resolves.toBeUndefined()
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it('fails closed for a profile-less cached row, even when it is the only row', async () => {
    $sessions.set([session({ id: 'same-id' })])

    await expect(resolveStoredSession('same-id')).resolves.toBeUndefined()
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it('fails closed when A and B share the same profile and durable id', async () => {
    $sessions.set([
      session({ connection_id: 'source-a', id: 'same-id', profile: 'mbc' }),
      session({ connection_id: 'source-b', id: 'same-id', profile: 'mbc' })
    ])

    await expect(resolveStoredSession('same-id')).resolves.toBeUndefined()
    await expect(resolveSessionOwner('same-id')).resolves.toBeUndefined()
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it('accepts duplicate lineage rows only when they resolve to one exact owner', async () => {
    $sessions.set([
      session({ _lineage_root_id: 'same-id', connection_id: 'source-a', id: 'tip-a', profile: 'mbc' }),
      session({ connection_id: 'source-a', id: 'same-id', profile: 'mbc' })
    ])

    await expect(resolveSessionOwner('same-id')).resolves.toEqual({ connectionId: 'source-a', profile: 'mbc' })
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it('validates only the supplied owner A and preserves a colliding cached B row', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'mbc' }
    $sessions.set([session({ connection_id: 'source-b', id: 'same-id', profile: 'mbc', title: 'B' })])
    mockGetSessionForOwner.mockResolvedValueOnce(session({ id: 'same-id', profile: 'default', title: 'A' }))

    await expect(resolveStoredSession('same-id', ownerA)).resolves.toMatchObject({
      connection_id: 'source-a',
      id: 'same-id',
      profile: 'mbc',
      title: 'A'
    })
    expect(mockGetSessionForOwner).toHaveBeenCalledWith('same-id', ownerA)
    expect($sessions.get()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ connection_id: 'source-a', id: 'same-id', title: 'A' }),
        expect.objectContaining({ connection_id: 'source-b', id: 'same-id', title: 'B' })
      ])
    )
  })

  it('does not try another owner when exact owner validation fails', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'mbc' }
    mockGetSessionForOwner.mockRejectedValueOnce(new Error('404: Session not found'))

    await expect(resolveStoredSession('same-id', ownerA)).resolves.toBeUndefined()
    expect(mockGetSessionForOwner).toHaveBeenCalledTimes(1)
    expect(mockGetSessionForOwner).toHaveBeenCalledWith('same-id', ownerA)
  })

  it('rejects a malformed owner hint without touching the network', async () => {
    await expect(resolveStoredSession('same-id', { connectionId: 'source-a', profile: ' ' })).resolves.toBeUndefined()
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })

  it('resolves a profile only from the unique exact cached owner', async () => {
    $sessions.set([session({ connection_id: 'source-a', id: 's1', profile: 'mbc' })])

    await expect(resolveSessionProfile('s1')).resolves.toBe('mbc')
    expect(mockGetSessionForOwner).not.toHaveBeenCalled()
  })
})
