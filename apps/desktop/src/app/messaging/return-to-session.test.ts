import { describe, expect, it } from 'vitest'

import { type SessionTile, sessionTileIdentity } from '@/store/session-states'
import type { SessionInfo } from '@/types/hermes'

import { messagingReturnPlan } from './return-to-session'

const session = (id: string, root: string | null = null) => ({ id, _lineage_root_id: root }) as SessionInfo

describe('messagingReturnPlan', () => {
  it('returns to the focused session tile and transfers its draft to the durable primary scope', () => {
    const owner = { connectionId: 'local', profile: 'default' }
    const tileId = sessionTileIdentity(owner, 'session-a')

    const tile: SessionTile = {
      ...owner,
      dir: 'center',
      storedSessionId: 'session-a',
      tileId
    }

    expect(
      messagingReturnPlan({
        composerTarget: `tile:${tileId}`,
        selectedStoredSessionId: 'primary-session',
        sessions: [session('session-a')],
        tiles: [tile]
      })
    ).toEqual({
      destinationDraftScope: 'session-a',
      route: '/session-a',
      sourceDraftScope: tileId
    })
  })

  it('uses the lineage root for both sides after a compacted tile rotates tips', () => {
    const owner = { connectionId: 'local', profile: 'default' }
    const tileId = sessionTileIdentity(owner, 'tip-new')

    const tile: SessionTile = {
      ...owner,
      dir: 'center',
      storedSessionId: 'tip-new',
      tileId
    }

    expect(
      messagingReturnPlan({
        composerTarget: `tile:${tileId}`,
        selectedStoredSessionId: null,
        sessions: [session('tip-new', 'root')],
        tiles: [tile]
      })
    ).toEqual({
      destinationDraftScope: 'root',
      route: '/tip-new',
      sourceDraftScope: sessionTileIdentity(owner, 'root')
    })
  })

  it('keeps the existing primary return path when no session tile owned focus', () => {
    expect(
      messagingReturnPlan({
        composerTarget: 'main',
        selectedStoredSessionId: 'primary-session',
        sessions: [session('primary-session')],
        tiles: []
      })
    ).toEqual({
      destinationDraftScope: 'primary-session',
      route: '/primary-session',
      sourceDraftScope: null
    })
  })
})
