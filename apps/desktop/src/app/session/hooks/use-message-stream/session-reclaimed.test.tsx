import { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSessionState } from '@/app/types'
import { createClientSessionState } from '@/lib/chat-runtime'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import { $sessionStates, $sessionTiles, publishSessionState } from '@/store/session-states'
import type { RpcEvent } from '@/types/hermes'

import {
  createBackendKey,
  SessionBindingRegistry
} from '../../session-binding-registry'

import { type MessageStreamHarness, renderMessageStream } from './test-harness'

// `session.reclaimed`: the backend tore down a live session we're still
// holding (idle TTL, LRU cap, WS-orphan reap). Before this event the runtime id
// stayed cached until something failed against it, which read to the user as
// the session vanishing rather than being reclaimed.

const ACTIVE_SID = 'session-active'
const ACTIVE_PROFILE = 'compass'
let stream: MessageStreamHarness
let queryClient: QueryClient
let wiringCache: Map<string, ClientSessionState>

function mountStream() {
  stream = renderMessageStream(ACTIVE_SID, { activeGatewayProfile: ACTIVE_PROFILE, queryClient })
  wiringCache = stream.states
}

const reclaim = (sessionId: string, reason = 'ws_orphan_reap') =>
  act(() =>
    stream.handleEvent({
      payload: { reason, session_id: sessionId, stored_session_id: 'stored-1' },
      session_id: '',
      type: 'session.reclaimed'
    } as RpcEvent)
  )

beforeEach(() => {
  queryClient = new QueryClient()
  $sessionStates.set({})
  $sessionTiles.set([])
})

afterEach(() => {
  cleanup()
  $sessionStates.set({})
  $sessionTiles.set([])
  vi.restoreAllMocks()
})

describe('session.reclaimed', () => {
  it('drops the cached state for the reclaimed runtime', () => {
    mountStream()
    publishSessionState('live-gone', createClientSessionState())
    expect($sessionStates.get()['live-gone']).toBeDefined()

    reclaim('live-gone')

    expect($sessionStates.get()['live-gone']).toBeUndefined()
  })

  it('leaves every other live session alone', () => {
    mountStream()
    publishSessionState('live-gone', createClientSessionState())
    publishSessionState('live-kept', createClientSessionState())

    reclaim('live-gone')

    // Both halves matter: the target went, the bystander stayed. Asserting
    // only the survivor would pass with no handler at all.
    expect($sessionStates.get()['live-gone']).toBeUndefined()
    expect($sessionStates.get()['live-kept']).toBeDefined()
  })

  it('ignores a payload with no runtime id instead of clearing everything', () => {
    mountStream()
    publishSessionState('live-a', createClientSessionState())
    publishSessionState('live-b', createClientSessionState())

    reclaim('')

    // A malformed/empty id must be a no-op, never a blanket wipe.
    expect(Object.keys($sessionStates.get()).sort()).toEqual(['live-a', 'live-b'])
  })

  it('drops the runtime regardless of which reclaim reason fired', () => {
    for (const reason of ['idle_timeout', 'lru_evict', 'ws_orphan_reap']) {
      $sessionStates.set({})
      cleanup()
      mountStream()
      publishSessionState('live-gone', createClientSessionState())

      reclaim('live-gone', reason)

      expect($sessionStates.get()['live-gone'], reason).toBeUndefined()
    }
  })

  // A TILE bound to the reclaimed runtime is the #82620 blank-pane case: the
  // state drop above empties the tile's view, but with `runtimeId` still set
  // the tile's resume effect (gated on !runtimeId) never refires — an empty
  // transcript under live chrome, unrecoverable without closing the tab.
  it('unbinds a tile holding the reclaimed runtime so its resume can refire', () => {
    mountStream()
    publishSessionState('live-gone', createClientSessionState('stored-1'))
    $sessionTiles.set([
      { runtimeId: 'live-gone', storedSessionId: 'stored-1' },
      { runtimeId: 'live-kept', storedSessionId: 'stored-2' }
    ])

    reclaim('live-gone')

    const tiles = $sessionTiles.get()
    // The reclaimed tile survives as a pane (its stored session is intact) but
    // sheds the dead runtime; the bystander tile keeps its live binding.
    expect(tiles.find(t => t.storedSessionId === 'stored-1')?.runtimeId).toBeUndefined()
    expect(tiles.find(t => t.storedSessionId === 'stored-2')?.runtimeId).toBe('live-kept')
  })

  // The wiring cache is resumeTile's warm path: a leftover entry for the dead
  // runtime would be handed straight back on the re-resume, rebinding the tile
  // to the same reclaimed id the backend just forgot.
  it('purges the wiring cache entry for the reclaimed runtime', () => {
    mountStream()
    wiringCache.set('live-gone', createClientSessionState('stored-1'))
    wiringCache.set('live-kept', createClientSessionState('stored-2'))

    reclaim('live-gone')

    expect(wiringCache.has('live-gone')).toBe(false)
    expect(wiringCache.has('live-kept')).toBe(true)
  })

  it('invalidates only the exact backend when two connections reuse one profile and runtime id', () => {
    const registry = new SessionBindingRegistry()

    const left = createBackendKey({
      connectionId: 'connection-left',
      gatewayEpoch: 1,
      profile: ACTIVE_PROFILE
    })

    const right = createBackendKey({
      connectionId: 'connection-right',
      gatewayEpoch: 1,
      profile: ACTIVE_PROFILE
    })

    const leftTarget = { backend: left, durableSessionId: 'stored-left' }
    const rightTarget = { backend: right, durableSessionId: 'stored-right' }

    const leftRuntime = rendererRuntimeKey(left, 'runtime-shared')
    const rightRuntime = rendererRuntimeKey(right, 'runtime-shared')

    const states = new Map([
      [leftRuntime, createClientSessionState('stored-left')],
      [rightRuntime, createClientSessionState('stored-right')]
    ])

    registry.bind(leftTarget, 'runtime-shared', 'route-left')
    registry.bind(rightTarget, 'runtime-shared', 'route-right')
    $sessionStates.set(Object.fromEntries(states))
    $sessionTiles.set([
      { runtimeId: leftRuntime, storedSessionId: 'stored-left' },
      { runtimeId: rightRuntime, storedSessionId: 'stored-right' }
    ])
    stream = renderMessageStream(ACTIVE_SID, {
      activeGatewayProfile: ACTIVE_PROFILE,
      queryClient,
      qualifyRuntimeIds: true,
      sessionBindingRegistry: registry,
      states
    })

    act(() =>
      stream.handleEvent({
        connectionId: 'connection-left',
        gatewayEpoch: 1,
        payload: { running: true, stored_session_id: 'stored-left' },
        profile: ACTIVE_PROFILE,
        session_id: 'runtime-shared',
        type: 'session.info'
      } as RpcEvent)
    )

    expect(stream.states.get(leftRuntime)?.busy).toBe(true)
    expect(stream.states.get(rightRuntime)?.busy).toBe(false)

    act(() =>
      stream.handleEvent({
        connectionId: 'connection-left',
        gatewayEpoch: 1,
        payload: { reason: 'ws_orphan_reap', session_id: 'runtime-shared', stored_session_id: 'stored-left' },
        profile: ACTIVE_PROFILE,
        session_id: '',
        type: 'session.reclaimed'
      } as RpcEvent)
    )

    expect(registry.getByDurable(leftTarget)).toBeNull()
    expect(registry.getByDurable(rightTarget)?.runtimeSessionId).toBe('runtime-shared')
    expect(stream.states.has(leftRuntime)).toBe(false)
    expect(stream.states.has(rightRuntime)).toBe(true)
    expect($sessionStates.get()[leftRuntime]).toBeUndefined()
    expect($sessionStates.get()[rightRuntime]).toBeDefined()
    expect($sessionTiles.get().find(tile => tile.storedSessionId === 'stored-left')?.runtimeId).toBeUndefined()
    expect($sessionTiles.get().find(tile => tile.storedSessionId === 'stored-right')?.runtimeId).toBe(rightRuntime)
  })
})
