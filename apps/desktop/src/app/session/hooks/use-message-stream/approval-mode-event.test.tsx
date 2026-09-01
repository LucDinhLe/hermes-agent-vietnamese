import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import { $approvalModes, approvalModeForProfile } from '@/store/approval-mode'
import { $activeGatewayProfile } from '@/store/profile'

import { type MessageStreamHarness, renderMessageStream } from './test-harness'

const ACTIVE_SID = 'session-active'
const ACTIVE_BACKEND = { connectionId: null, gatewayEpoch: 7, profile: 'work' } as const
const ACTIVE_RUNTIME_KEY = rendererRuntimeKey(ACTIVE_BACKEND, ACTIVE_SID)
let stream: MessageStreamHarness

function mountStream() {
  stream = renderMessageStream(ACTIVE_RUNTIME_KEY, {
    activeGatewayProfile: ACTIVE_BACKEND.profile,
    qualifyRuntimeIds: true
  })
}

describe('live session.info approval mode reconciliation', () => {
  beforeEach(() => {
    $approvalModes.set({})
    $activeGatewayProfile.set(ACTIVE_BACKEND.profile)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('reconciles an active-session event under its source gateway profile', () => {
    mountStream()

    act(() =>
      stream.handleEvent({
        gatewayEpoch: ACTIVE_BACKEND.gatewayEpoch,
        payload: { approval_mode: 'off' },
        profile: ACTIVE_BACKEND.profile,
        session_id: ACTIVE_SID,
        type: 'session.info'
      })
    )

    expect(approvalModeForProfile('work')).toBe('off')
    expect(approvalModeForProfile('default')).toBe('smart')
  })

  it('ignores stale session.info from a non-active session on the active gateway', () => {
    mountStream()

    act(() =>
      stream.handleEvent({
        gatewayEpoch: ACTIVE_BACKEND.gatewayEpoch,
        payload: { approval_mode: 'off' },
        profile: ACTIVE_BACKEND.profile,
        session_id: 'session-stale',
        type: 'session.info'
      })
    )

    expect(approvalModeForProfile('work')).toBe('smart')
  })

  it('does not cache an event under a different active profile when its source profile is absent', () => {
    mountStream()
    $activeGatewayProfile.set('personal')

    act(() => stream.handleEvent({ payload: { approval_mode: 'off' }, session_id: ACTIVE_SID, type: 'session.info' }))

    expect(approvalModeForProfile('personal')).toBe('smart')
    expect(approvalModeForProfile('work')).toBe('smart')
  })
})
