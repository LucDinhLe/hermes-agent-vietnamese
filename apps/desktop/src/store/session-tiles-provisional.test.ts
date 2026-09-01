import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionTileOwner } from '@/store/session-states'

const TILES_V3 = 'hermes.desktop.sessionTiles.v3'
const TILES_V2 = 'hermes.desktop.sessionTiles.v2'
const TILES_V1 = 'hermes.desktop.sessionTiles.v1'

const localDefault: SessionTileOwner = { connectionId: null, profile: 'default' }
const localMbc: SessionTileOwner = { connectionId: null, profile: 'mbc-fixture' }

async function loadStore(profile = 'default') {
  const profileStore = await import('@/store/profile')

  profileStore.$activeGatewayProfile.set(profile)

  return import('@/store/session-states')
}

describe('provisional session tile ownership and persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('keeps an MBC create under its captured owner when ambient switches to default across the create barrier', async () => {
    const states = await loadStore('mbc-fixture')
    const capturedOwner = { ...localMbc }

    // session.create is in flight; meanwhile the visible/ambient gateway moves.
    states.activateSessionTileOwner(localDefault)

    const tile = states.openProvisionalSessionTile({
      draftId: 'draft-mbc-1',
      owner: capturedOwner,
      provisionalStoredSessionId: 'candidate-from-mbc',
      runtimeId: 'runtime-from-mbc'
    })

    expect(tile.owner).toEqual(localMbc)
    expect(states.sessionTilesForOwner(localDefault)).toEqual([])
    expect(states.sessionTilesForOwner(localMbc)).toEqual([
      expect.objectContaining({
        draftId: 'draft-mbc-1',
        kind: 'provisional',
        owner: localMbc
      })
    ])

    const persisted = JSON.parse(window.localStorage.getItem(TILES_V3)!) as Record<string, unknown[]>

    expect(persisted.default).toBeUndefined()
    expect(persisted['mbc-fixture']).toEqual([
      expect.objectContaining({ draftId: 'draft-mbc-1', kind: 'provisional', owner: localMbc })
    ])
  })

  it('isolates the same profile name on two registry connections', async () => {
    const states = await loadStore()
    const ownerA: SessionTileOwner = { connectionId: 'machine-a', profile: 'default' }
    const ownerB: SessionTileOwner = { connectionId: 'machine-b', profile: 'default' }

    states.openProvisionalSessionTile({ draftId: 'same-draft', owner: ownerA })
    states.openProvisionalSessionTile({ draftId: 'same-draft', owner: ownerB })

    expect(states.sessionTileOwnerKey(ownerA)).toBe('conn:machine-a::default')
    expect(states.sessionTileOwnerKey(ownerB)).toBe('conn:machine-b::default')
    expect(states.sessionTilesForOwner(ownerA)).toEqual([
      expect.objectContaining({ kind: 'provisional', owner: ownerA })
    ])
    expect(states.sessionTilesForOwner(ownerB)).toEqual([
      expect.objectContaining({ kind: 'provisional', owner: ownerB })
    ])

    states.activateSessionTileOwner(ownerA)
    expect(states.$sessionTiles.get()).toEqual([expect.objectContaining({ owner: ownerA })])
    states.activateSessionTileOwner(ownerB)
    expect(states.$sessionTiles.get()).toEqual([expect.objectContaining({ owner: ownerB })])

    const persisted = JSON.parse(window.localStorage.getItem(TILES_V3)!) as Record<string, unknown[]>

    expect(Object.keys(persisted).sort()).toEqual(['conn:machine-a::default', 'conn:machine-b::default'])
  })

  it('restores a provisional tile after reload as a draft with no runtime and never classifies it durable', async () => {
    const first = await loadStore()

    first.openProvisionalSessionTile({
      draftId: 'draft-reload',
      owner: localDefault,
      provisionalStoredSessionId: 'candidate-before-reload',
      runtimeId: 'dead-process-runtime'
    })

    vi.resetModules()
    const restored = await loadStore()

    restored.activateSessionTileOwner(localDefault)
    const [tile] = restored.$sessionTiles.get()

    expect(tile).toEqual(
      expect.objectContaining({
        draftId: 'draft-reload',
        kind: 'provisional',
        owner: localDefault,
        storedSessionId: 'draft-reload'
      })
    )
    expect(tile?.runtimeId).toBeUndefined()
    expect(tile?.provisionalStoredSessionId).toBeUndefined()
    expect(restored.isProvisionalSessionTile(tile!)).toBe(true)
    expect(restored.isDurableSessionTile(tile!)).toBe(false)
    expect(restored.recoverProvisionalSessionTile(localDefault, 'draft-reload')).toEqual(
      expect.objectContaining({
        action: 'create-fresh-runtime',
        draft: { scope: 'draft-reload' },
        draftId: 'draft-reload',
        owner: localDefault,
        tile: expect.objectContaining({
          kind: 'provisional',
          provisionalStoredSessionId: undefined,
          runtimeId: undefined
        })
      })
    )
  })

  it('discards a persisted stale candidate and rebinds once with a fresh runtime without persisting either id', async () => {
    window.localStorage.setItem(
      TILES_V3,
      JSON.stringify({
        default: [
          {
            draftId: 'draft-rebind',
            kind: 'provisional',
            owner: localDefault,
            provisionalStoredSessionId: 'candidate-from-dead-process',
            runtimeId: 'runtime-from-dead-process',
            storedSessionId: 'draft-rebind'
          }
        ]
      })
    )

    const states = await loadStore()
    const [recovered] = states.$sessionTiles.get()

    expect(recovered).toEqual(
      expect.objectContaining({
        draftId: 'draft-rebind',
        kind: 'provisional',
        owner: localDefault,
        storedSessionId: 'draft-rebind'
      })
    )
    expect(recovered?.provisionalStoredSessionId).toBeUndefined()
    expect(recovered?.runtimeId).toBeUndefined()

    const scrubbedAtLoad = window.localStorage.getItem(TILES_V3)!

    expect(scrubbedAtLoad).not.toContain('candidate-from-dead-process')
    expect(scrubbedAtLoad).not.toContain('runtime-from-dead-process')

    const rebound = states.rebindProvisionalSessionTile({
      draftId: 'draft-rebind',
      owner: localDefault,
      provisionalStoredSessionId: 'candidate-fresh',
      runtimeId: 'runtime-fresh'
    })

    expect(rebound).toEqual(
      expect.objectContaining({
        draft: { scope: 'draft-rebind' },
        draftId: 'draft-rebind',
        owner: localDefault,
        provisionalStoredSessionId: 'candidate-fresh',
        runtimeId: 'runtime-fresh',
        tile: expect.objectContaining({
          draftId: 'draft-rebind',
          provisionalStoredSessionId: 'candidate-fresh',
          runtimeId: 'runtime-fresh',
          storedSessionId: 'draft-rebind'
        })
      })
    )
    expect(
      states.rebindProvisionalSessionTile({
        draftId: 'draft-rebind',
        owner: localDefault,
        provisionalStoredSessionId: 'candidate-second',
        runtimeId: 'runtime-second'
      })
    ).toBeNull()

    const persisted = window.localStorage.getItem(TILES_V3)!

    expect(persisted).not.toContain('candidate-from-dead-process')
    expect(persisted).not.toContain('runtime-from-dead-process')
    expect(persisted).not.toContain('candidate-fresh')
    expect(persisted).not.toContain('runtime-fresh')

    vi.resetModules()
    const relaunched = await loadStore()
    const [again] = relaunched.$sessionTiles.get()

    expect(again).toEqual(
      expect.objectContaining({ draftId: 'draft-rebind', kind: 'provisional', owner: localDefault })
    )
    expect(again?.provisionalStoredSessionId).toBeUndefined()
    expect(again?.runtimeId).toBeUndefined()
  })

  it('invalidates only the exact provisional runtime and retains its stable recovery draft', async () => {
    const states = await loadStore()

    states.activateSessionTileOwner(localDefault)
    states.openProvisionalSessionTile({
      draftId: 'draft-4007',
      owner: localDefault,
      provisionalStoredSessionId: 'candidate-dead',
      runtimeId: 'runtime-dead'
    })

    expect(
      states.invalidateProvisionalSessionTileRuntime({
        draftId: 'draft-4007',
        error: 'runtime reclaimed',
        owner: localDefault,
        runtimeId: 'runtime-other'
      })
    ).toBe(false)

    expect(
      states.invalidateProvisionalSessionTileRuntime({
        draftId: 'draft-4007',
        error: 'runtime reclaimed',
        owner: localDefault,
        runtimeId: 'runtime-dead'
      })
    ).toBe(true)

    expect(states.$sessionTiles.get()).toEqual([
      expect.objectContaining({
        draftId: 'draft-4007',
        error: 'runtime reclaimed',
        kind: 'provisional',
        provisionalStoredSessionId: undefined,
        runtimeId: undefined,
        storedSessionId: 'draft-4007'
      })
    ])
  })

  it('invalidates provisional runtimes only for the disconnected backend owner', async () => {
    const states = await loadStore()
    const ownerA: SessionTileOwner = { connectionId: 'machine-a', profile: 'default' }
    const ownerB: SessionTileOwner = { connectionId: 'machine-b', profile: 'default' }

    states.openProvisionalSessionTile({ draftId: 'draft-a', owner: ownerA })
    states.openProvisionalSessionTile({ draftId: 'draft-b', owner: ownerB })
    states.activateSessionTileOwner(ownerA)
    states.rebindProvisionalSessionTile({
      draftId: 'draft-a',
      owner: ownerA,
      provisionalStoredSessionId: 'candidate-a',
      runtimeId: 'runtime-shared'
    })

    expect(states.invalidateProvisionalSessionTileRuntimesForOwner(ownerA, 'socket closed')).toEqual([
      'runtime-shared'
    ])
    expect(states.sessionTilesForOwner(ownerA)).toEqual([
      expect.objectContaining({ draftId: 'draft-a', error: 'socket closed', runtimeId: undefined })
    ])
    const [untouchedB] = states.sessionTilesForOwner(ownerB)

    expect(untouchedB).toMatchObject({ draftId: 'draft-b' })
    expect(untouchedB).not.toHaveProperty('error')
    expect(untouchedB).not.toHaveProperty('runtimeId')
  })

  it('refuses cross-owner rebinds even when two connections share a profile and draft id', async () => {
    const states = await loadStore()
    const ownerA: SessionTileOwner = { connectionId: 'machine-a', profile: 'default' }
    const ownerB: SessionTileOwner = { connectionId: 'machine-b', profile: 'default' }

    states.openProvisionalSessionTile({ draftId: 'shared-draft', owner: ownerA })
    states.openProvisionalSessionTile({ draftId: 'shared-draft', owner: ownerB })
    states.activateSessionTileOwner(ownerB)

    expect(
      states.rebindProvisionalSessionTile({
        draftId: 'shared-draft',
        owner: ownerA,
        provisionalStoredSessionId: 'candidate-a',
        runtimeId: 'runtime-a'
      })
    ).toBeNull()
    expect(states.$sessionTiles.get()[0]).toEqual(expect.objectContaining({ owner: ownerB }))
    expect(states.$sessionTiles.get()[0]?.provisionalStoredSessionId).toBeUndefined()
    expect(states.$sessionTiles.get()[0]?.runtimeId).toBeUndefined()

    const boundB = states.rebindProvisionalSessionTile({
      draftId: 'shared-draft',
      owner: ownerB,
      provisionalStoredSessionId: 'candidate-b',
      runtimeId: 'runtime-b'
    })

    expect(boundB?.tile).toEqual(
      expect.objectContaining({
        draftId: 'shared-draft',
        owner: ownerB,
        provisionalStoredSessionId: 'candidate-b',
        runtimeId: 'runtime-b'
      })
    )

    states.activateSessionTileOwner(ownerA)
    expect(states.$sessionTiles.get()[0]).toEqual(expect.objectContaining({ owner: ownerA }))
    expect(states.$sessionTiles.get()[0]?.provisionalStoredSessionId).toBeUndefined()
    expect(states.$sessionTiles.get()[0]?.runtimeId).toBeUndefined()
  })

  it('can provision purely, then open and drop only the matching provisional draft', async () => {
    const states = await loadStore()
    const provisional = states.provisionSessionTile({ draftId: 'draft-drop', owner: localDefault })

    expect(provisional).toEqual(
      expect.objectContaining({ draftId: 'draft-drop', kind: 'provisional', owner: localDefault })
    )
    expect(states.$sessionTiles.get()).toEqual([])

    states.openProvisionalSessionTile({ draftId: 'draft-drop', owner: localDefault })
    states.openSessionTile('durable-kept')

    expect(states.dropProvisionalSessionTile(localDefault, 'draft-drop')).toBe(true)
    expect(states.dropProvisionalSessionTile(localDefault, 'draft-drop')).toBe(false)
    expect(states.$sessionTiles.get()).toEqual([
      expect.objectContaining({ kind: 'durable', storedSessionId: 'durable-kept' })
    ])
  })

  it('promotes in one tile-store write and returns the layout/draft rekey plan without calling a backend', async () => {
    const states = await loadStore('mbc-fixture')

    states.activateSessionTileOwner(localMbc)
    states.openProvisionalSessionTile({
      anchor: 'workspace',
      dir: 'center',
      draftId: 'draft-promote',
      owner: localMbc,
      provisionalStoredSessionId: 'candidate-promote',
      runtimeId: 'runtime-promote'
    })

    const plan = states.promoteProvisionalSessionTile({
      draftId: 'draft-promote',
      durableSessionId: 'durable-42',
      owner: localMbc
    })

    expect(plan).toEqual({
      draft: { fromScope: 'draft-promote', toScope: 'durable-42' },
      draftId: 'draft-promote',
      durableSessionId: 'durable-42',
      layout: {
        fromPaneId: 'session-tile:draft-promote',
        toPaneId: 'session-tile:durable-42'
      },
      owner: localMbc,
      provisionalStoredSessionId: 'candidate-promote'
    })
    expect(states.$sessionTiles.get()).toEqual([
      expect.objectContaining({
        anchor: 'workspace',
        kind: 'durable',
        owner: localMbc,
        runtimeId: 'runtime-promote',
        storedSessionId: 'durable-42'
      })
    ])
    expect(states.$sessionTiles.get().some(states.isProvisionalSessionTile)).toBe(false)

    const persisted = JSON.parse(window.localStorage.getItem(TILES_V3)!) as Record<string, unknown[]>

    expect(persisted['mbc-fixture']).toEqual([
      expect.objectContaining({ kind: 'durable', owner: localMbc, storedSessionId: 'durable-42' })
    ])
  })

  it('migrates v2 profile groups and v1 flat entries as explicit local durable tiles', async () => {
    window.localStorage.setItem(
      TILES_V2,
      JSON.stringify({ 'mbc-fixture': [{ runtimeId: 'never-restore', storedSessionId: 'legacy-mbc' }] })
    )
    window.localStorage.setItem(TILES_V1, JSON.stringify([{ storedSessionId: 'legacy-default' }]))

    const states = await loadStore()

    expect(states.sessionTilesForOwner(localMbc)).toEqual([
      expect.objectContaining({ kind: 'durable', owner: localMbc, storedSessionId: 'legacy-mbc' })
    ])
    expect(states.sessionTilesForOwner(localDefault)).toEqual([
      expect.objectContaining({ kind: 'durable', owner: localDefault, storedSessionId: 'legacy-default' })
    ])
    expect(states.sessionTilesForOwner(localMbc)[0]?.runtimeId).toBeUndefined()
    expect(window.localStorage.getItem(TILES_V2)).toBeNull()
    expect(window.localStorage.getItem(TILES_V1)).toBeNull()

    const persisted = JSON.parse(window.localStorage.getItem(TILES_V3)!) as Record<string, unknown[]>

    expect(persisted['mbc-fixture']).toEqual([
      expect.objectContaining({ kind: 'durable', owner: localMbc, storedSessionId: 'legacy-mbc' })
    ])
    expect(persisted.default).toEqual([
      expect.objectContaining({ kind: 'durable', owner: localDefault, storedSessionId: 'legacy-default' })
    ])
  })
})
