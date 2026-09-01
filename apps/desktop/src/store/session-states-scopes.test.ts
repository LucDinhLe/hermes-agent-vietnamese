import { beforeEach, describe, expect, it } from 'vitest'

import { createClientSessionState } from '@/lib/chat-runtime'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import {
  $sessionStates,
  clearAllSessionStates,
  dropSessionState,
  liveSessionScopes,
  publishSessionState,
  recordSessionEventScope
} from '@/store/session-states'

/**
 * The (connectionId, profile) half of the gateway keep-set. Working/attention
 * ids are profile-blind, and every registered source exposes a 'default'
 * profile — so registry-sourced live work must surface as composite
 * backendScopeKey scopes, while untagged local/primary events contribute
 * nothing (their liveness keeps flowing through bare profile names).
 */

const state = (patch: Partial<ReturnType<typeof createClientSessionState>> = {}) => ({
  ...createClientSessionState('stored-1'),
  ...patch
})

const source = (connectionId: string, gatewayEpoch = 1, profile = 'default') => ({
  connectionId,
  gatewayEpoch,
  profile
})

const scopedRuntime = (connectionId: string, runtimeSessionId: string, gatewayEpoch = 1, profile = 'default') =>
  rendererRuntimeKey(source(connectionId, gatewayEpoch, profile), runtimeSessionId)

const recordScope = (connectionId: string, runtimeSessionId: string, gatewayEpoch = 1, profile = 'default') =>
  recordSessionEventScope({ ...source(connectionId, gatewayEpoch, profile), session_id: runtimeSessionId })

beforeEach(() => {
  clearAllSessionStates()
  $sessionStates.set({})
})

describe('liveSessionScopes', () => {
  it('maps a registry-tagged busy session to its composite scope', () => {
    recordScope('homelab', 'rt-1')
    publishSessionState(scopedRuntime('homelab', 'rt-1'), state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default']))
  })

  it('keeps an explicit local registry session on its composite scope', () => {
    recordScope('local', 'rt-local')
    publishSessionState(scopedRuntime('local', 'rt-local'), state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:local::default']))
  })

  it('includes needs-input sessions and drops settled ones', () => {
    const runtimeId = scopedRuntime('homelab', 'rt-1')

    recordScope('homelab', 'rt-1')
    publishSessionState(runtimeId, state({ busy: false, needsInput: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default']))

    publishSessionState(runtimeId, state({ busy: false, needsInput: false }))

    expect(liveSessionScopes()).toEqual(new Set())
  })

  it('ignores untagged (local/primary) events — no connectionId, no scope', () => {
    recordSessionEventScope({ profile: 'default', session_id: 'rt-1' })
    publishSessionState('rt-1', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set())
  })

  it("keeps two sources' same-named 'default' profiles distinct", () => {
    recordScope('homelab', 'rt-a')
    recordScope('spark', 'rt-b')
    publishSessionState(scopedRuntime('homelab', 'rt-a'), state({ busy: true }))
    publishSessionState(scopedRuntime('spark', 'rt-b'), state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default', 'conn:spark::default']))
  })

  it('keeps identical raw runtime ids on A/B independently live and prunes only the dropped owner', () => {
    const runtimeA = scopedRuntime('source-a', 'rt-shared', 7, 'mbc')
    const runtimeB = scopedRuntime('source-b', 'rt-shared', 11, 'mbc')

    recordScope('source-a', 'rt-shared', 7, 'mbc')
    recordScope('source-b', 'rt-shared', 11, 'mbc')
    publishSessionState(runtimeA, state({ busy: true, storedSessionId: 'stored-a' }))
    publishSessionState(runtimeB, state({ busy: true, storedSessionId: 'stored-b' }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:source-a::mbc', 'conn:source-b::mbc']))

    dropSessionState(runtimeA)

    expect(liveSessionScopes()).toEqual(new Set(['conn:source-b::mbc']))
  })

  it('keeps the current epoch live after dropping an older same-owner same-raw runtime', () => {
    const staleRuntime = scopedRuntime('source-a', 'rt-shared', 7, 'mbc')
    const currentRuntime = scopedRuntime('source-a', 'rt-shared', 8, 'mbc')

    recordScope('source-a', 'rt-shared', 7, 'mbc')
    recordScope('source-a', 'rt-shared', 8, 'mbc')
    publishSessionState(staleRuntime, state({ busy: true, storedSessionId: 'stored-old' }))
    publishSessionState(currentRuntime, state({ busy: true, storedSessionId: 'stored-current' }))

    dropSessionState(staleRuntime)

    expect(liveSessionScopes()).toEqual(new Set(['conn:source-a::mbc']))
  })

  it('forgets a dropped runtime session', () => {
    const runtimeId = scopedRuntime('homelab', 'rt-1')

    recordScope('homelab', 'rt-1')
    publishSessionState(runtimeId, state({ busy: true }))
    dropSessionState(runtimeId)
    publishSessionState(runtimeId, state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set())
  })
})
