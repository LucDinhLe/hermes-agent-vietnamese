import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesConnection } from '@/global'

const V2_KEY = 'hermes.desktop.sessionTiles.v2'
const V3_KEY = 'hermes.desktop.sessionTiles.v3'

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('source-qualified session tile persistence', () => {
  it('hydrates, addresses, mutates, and restarts same-id A/B tiles independently', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'default' }
    const ownerB = { connectionId: 'source-b', profile: 'default' }
    window.localStorage.setItem(
      V3_KEY,
      JSON.stringify({
        legacyV2OwnerByProfile: {},
        tilesByProfile: {
          default: [
            { ...ownerA, storedSessionId: 'same-id', tileId: 'ignored-a' },
            { ...ownerB, storedSessionId: 'same-id', tileId: 'ignored-b' }
          ]
        },
        version: 3
      })
    )

    let states = await import('@/store/session-states')
    const tileA = states.sessionTileForStoredId('same-id', ownerA)
    const tileB = states.sessionTileForStoredId('same-id', ownerB)

    expect(tileA?.tileId).toBe(states.sessionTileIdentity(ownerA, 'same-id'))
    expect(tileB?.tileId).toBe(states.sessionTileIdentity(ownerB, 'same-id'))
    expect(states.sessionTileForStoredId('same-id')).toBeNull()
    expect(states.sessionTilePaneId(tileA!)).not.toBe(states.sessionTilePaneId(tileB!))

    states.patchSessionTile(states.sessionTileKey(tileA!), { runtimeId: 'runtime-a' })
    expect(states.sessionTileForStoredId('same-id', ownerA)?.runtimeId).toBe('runtime-a')
    expect(states.sessionTileForStoredId('same-id', ownerB)?.runtimeId).toBeUndefined()

    states.closeSessionTile(states.sessionTileKey(tileA!))
    expect(states.sessionTileForStoredId('same-id', ownerA)).toBeNull()
    expect(states.sessionTileForStoredId('same-id', ownerB)).not.toBeNull()

    vi.resetModules()
    states = await import('@/store/session-states')
    expect(states.sessionTileForStoredId('same-id', ownerA)).toBeNull()
    expect(states.sessionTileForStoredId('same-id', ownerB)?.connectionId).toBe('source-b')
  })

  it('does not suppress an A tile just because active B selected the same stored id', async () => {
    const profile = await import('@/store/profile')
    const session = await import('@/store/session')

    profile.$activeGatewayProfile.set('default')
    session.$connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'default' } as HermesConnection)
    session.$selectedStoredSessionId.set('same-id')

    const states = await import('@/store/session-states')
    const ownerA = { connectionId: 'source-a', profile: 'default' }

    states.openSessionTile('same-id', 'right', undefined, undefined, ownerA)

    expect(states.sessionTileForStoredId('same-id', ownerA)).not.toBeNull()
  })

  it('waits for a coherent profile/source pair before adopting v2 and never rebinds it', async () => {
    window.localStorage.setItem(V2_KEY, JSON.stringify({ reviewer: [{ storedSessionId: 'legacy-id' }] }))

    const profile = await import('@/store/profile')
    const session = await import('@/store/session')

    profile.$activeGatewayProfile.set('reviewer')
    session.$connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'writer' } as HermesConnection)

    let states = await import('@/store/session-states')
    expect(states.$sessionTiles.get()).toEqual([])

    session.$connection.set({ connectionId: 'source-a', mode: 'remote', profile: 'reviewer' } as HermesConnection)
    expect(states.sessionTileForStoredId('legacy-id', { connectionId: 'source-a', profile: 'reviewer' })).not.toBeNull()

    session.$connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'reviewer' } as HermesConnection)
    expect(states.sessionTileForStoredId('legacy-id', { connectionId: 'source-b', profile: 'reviewer' })).toBeNull()

    const persisted = JSON.parse(window.localStorage.getItem(V3_KEY)!) as {
      legacyV2OwnerByProfile: Record<string, { connectionId: string; profile: string }>
    }

    expect(persisted.legacyV2OwnerByProfile.reviewer).toEqual({ connectionId: 'source-a', profile: 'reviewer' })

    vi.resetModules()
    const nextProfile = await import('@/store/profile')
    const nextSession = await import('@/store/session')
    nextProfile.$activeGatewayProfile.set('reviewer')
    nextSession.$connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'reviewer' } as HermesConnection)
    states = await import('@/store/session-states')

    expect(states.$sessionTiles.get()).toHaveLength(1)
    expect(states.$sessionTiles.get()[0]).toMatchObject({ connectionId: 'source-a', storedSessionId: 'legacy-id' })
  })
})
