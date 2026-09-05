import { beforeEach, describe, expect, it } from 'vitest'

import { createClientSessionState } from '@/lib/chat-runtime'
import {
  $sessionStates,
  clearAllSessionStates,
  dropSessionState,
  liveSessionScopes,
  publishSessionState,
  recordPrimarySessionEventSource,
  recordSessionEventScope,
  sessionConnectionId,
  sessionEventProfile
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

beforeEach(() => {
  clearAllSessionStates()
  $sessionStates.set({})
})

describe('liveSessionScopes', () => {
  it('maps a registry-tagged busy session to its composite scope', () => {
    recordSessionEventScope({ connectionId: 'homelab', profile: 'default', session_id: 'rt-1' })
    publishSessionState('rt-1', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default']))
    expect(sessionConnectionId('rt-1')).toBe('homelab')
    expect(sessionEventProfile('rt-1')).toBe('default')
  })

  it('keeps an explicit local registry session on its composite scope', () => {
    recordSessionEventScope({ connectionId: 'local', profile: 'default', session_id: 'rt-local' })
    publishSessionState('rt-local', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:local::default']))
  })

  it('includes needs-input sessions and drops settled ones', () => {
    recordSessionEventScope({ connectionId: 'homelab', profile: 'default', session_id: 'rt-1' })
    publishSessionState('rt-1', state({ busy: false, needsInput: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default']))

    publishSessionState('rt-1', state({ busy: false, needsInput: false }))

    expect(liveSessionScopes()).toEqual(new Set())
    expect(sessionConnectionId('rt-1')).toBe('homelab')
  })

  it('ignores untagged (local/primary) events — no connectionId, no scope', () => {
    recordSessionEventScope({ profile: 'default', session_id: 'rt-1' })
    publishSessionState('rt-1', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set())
    expect(sessionConnectionId('rt-1')).toBeNull()
  })

  it('binds primary events to a registered remote descriptor without adding a keep scope', () => {
    recordPrimarySessionEventSource({ session_id: 'rt-primary-remote' }, {
      connectionId: 'cloud-main',
      mode: 'remote'
    } as never)
    publishSessionState('rt-primary-remote', state({ busy: true }))

    expect(sessionConnectionId('rt-primary-remote')).toBe('cloud-main')
    expect(liveSessionScopes()).toEqual(new Set())
  })

  it('binds primary local events to the explicit local source', () => {
    recordPrimarySessionEventSource({ profile: 'writer', session_id: 'rt-primary-local' }, { mode: 'local' } as never)

    expect(sessionConnectionId('rt-primary-local')).toBe('local')
    expect(sessionEventProfile('rt-primary-local')).toBe('writer')
  })

  it("keeps two sources' same-named 'default' profiles distinct", () => {
    recordSessionEventScope({ connectionId: 'homelab', profile: 'default', session_id: 'rt-a' })
    recordSessionEventScope({ connectionId: 'spark', profile: 'default', session_id: 'rt-b' })
    publishSessionState('rt-a', state({ busy: true }))
    publishSessionState('rt-b', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set(['conn:homelab::default', 'conn:spark::default']))
  })

  it('forgets a dropped runtime session', () => {
    recordSessionEventScope({ connectionId: 'homelab', profile: 'default', session_id: 'rt-1' })
    publishSessionState('rt-1', state({ busy: true }))
    dropSessionState('rt-1')
    publishSessionState('rt-1', state({ busy: true }))

    expect(liveSessionScopes()).toEqual(new Set())
    expect(sessionConnectionId('rt-1')).toBeNull()
    expect(sessionEventProfile('rt-1')).toBeNull()
  })
})
