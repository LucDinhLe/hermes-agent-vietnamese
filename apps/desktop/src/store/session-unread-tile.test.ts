import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesConnection } from '@/global'

// The completed-unread dot is keyed on the FOCUSED session, not the selected
// one. A tile is never $selectedStoredSessionId, so keying either half on the
// selection left a tiled session's dot green with no way to clear it.

describe('completed-unread dot follows the focused session', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function setup() {
    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')
    const { createClientSessionState } = await import('@/lib/chat-runtime')
    const profile = await import('./profile')
    const session = await import('./session')

    const owner = { connectionId: 'source-a', profile: 'default' }

    profile.$activeGatewayProfile.set(owner.profile)
    session.$connection.set({ ...owner, mode: 'remote' } as HermesConnection)

    const states = await import('./session-states')

    session.$unreadFinishedSessionIds.set([])
    session.$selectedStoredSessionId.set('primary')

    // Exercise the real source-qualified tile path. Since v3, the pane id is
    // derived from (connection, profile, stored id), and focused-session
    // resolution intentionally rejects a bare pane with no owning tile record.
    states.openSessionTile('tiled', 'right', 'workspace', undefined, owner)
    const tile = states.sessionTileForStoredId('tiled', owner)

    expect(tile).not.toBeNull()
    const tilePaneId = states.sessionTilePaneId(tile!)

    for (const id of ['workspace', tilePaneId]) {
      registry.register({
        area: 'panes',
        data: id === 'workspace' ? { placement: 'main', uncloseable: true } : { placement: 'main' },
        id,
        render: () => null,
        title: id
      })
    }

    // The workspace holds the primary chat, a second zone holds the tile.
    tree.declareDefaultTree(
      model.split('row', [
        model.group(['workspace'], { active: 'workspace', id: 'grp-main' }),
        model.group([tilePaneId], { active: tilePaneId, id: 'grp-tile' })
      ])
    )

    const finishTurn = (storedSessionId: string) => {
      const working = { ...createClientSessionState(null), busy: true, storedSessionId }
      states.publishSessionState(`rt-${storedSessionId}`, working)
      states.publishSessionState(`rt-${storedSessionId}`, { ...working, busy: false })
    }

    return { finishTurn, session, tree }
  }

  it('clears the dot when an already-open tile is fronted', async () => {
    const { finishTurn, session, tree } = await setup()

    tree.noteActiveTreeGroup('grp-main')
    finishTurn('tiled')
    expect(session.$unreadFinishedSessionIds.get()).toEqual(['tiled'])

    // Fronting the tile is what a tab click does. Before the fix nothing on
    // this path cleared the marker, so the dot stayed green.
    tree.noteActiveTreeGroup('grp-tile')
    expect(session.$unreadFinishedSessionIds.get()).toEqual([])
  })

  it('never marks a tile that finishes while it is the focused one', async () => {
    const { finishTurn, session, tree } = await setup()

    tree.noteActiveTreeGroup('grp-tile')
    finishTurn('tiled')

    expect(session.$unreadFinishedSessionIds.get()).toEqual([])
  })

  it('marks the primary session when a tile has focus', async () => {
    const { finishTurn, session, tree } = await setup()

    tree.noteActiveTreeGroup('grp-tile')
    finishTurn('primary')

    expect(session.$unreadFinishedSessionIds.get()).toEqual(['primary'])
  })
})
