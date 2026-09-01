import { describe, expect, it, vi } from 'vitest'

import { rendererRuntimeKey } from '@/lib/session-runtime-key'

import { resolveTargetSessionId } from './resolve-target-session'

vi.mock('../use-session-actions/utils', () => ({
  resolveSessionProfile: vi.fn(async () => 'work')
}))

const RECOVERED = 'rt-recovered'
const BACKEND = { connectionId: 'source-a', gatewayEpoch: 4, profile: 'work' } as const
const BOUND = rendererRuntimeKey(BACKEND, RECOVERED)
const STORED = 'stored-goal-session'

function deps(overrides: Partial<Parameters<typeof resolveTargetSessionId>[0]> = {}) {
  return {
    activeRuntimeId: null,
    bindSessionRuntime: vi.fn((_storedSessionId: string, runtimeSessionId: string) =>
      rendererRuntimeKey(BACKEND, runtimeSessionId)
    ),
    createSession: vi.fn(async () => 'rt-brand-new'),
    getRuntimeIdForStoredSession: () => null,
    requestStoredSession: vi.fn(async () => ({ session_id: RECOVERED })) as never,
    routedStoredSessionId: null,
    selectedStoredSessionId: null,
    ...overrides
  }
}

describe('resolveTargetSessionId', () => {
  it('resumes the routed stored session instead of minting a new one when the runtime binding is gone', async () => {
    // The exact condition behind "/goal status says No active goal": the
    // runtime binding was cleared (profile swap / reconnect / orphan-reap) but
    // the durable route still names the chat carrying the goal.
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')
    const requestStoredSession = vi.fn(async () => ({ session_id: RECOVERED }))

    const resolved = await resolveTargetSessionId(
      deps({ createSession, requestStoredSession: requestStoredSession as never, routedStoredSessionId: STORED })
    )

    expect(resolved).toBe(BOUND)
    expect(createSession).not.toHaveBeenCalled()
    expect(requestStoredSession).toHaveBeenCalledWith(STORED, 'session.resume', {
      session_id: STORED,
      source: 'desktop',
      profile: 'work'
    })
  })

  it('reuses the live runtime id when the cache confirms it owns the targeted stored session', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')
    const requestStoredSession = vi.fn(async () => ({ session_id: 'rt-resume-WRONG' }))

    const resolved = await resolveTargetSessionId(
      deps({
        activeRuntimeId: RECOVERED,
        createSession,
        getRuntimeIdForStoredSession: () => RECOVERED,
        requestStoredSession: requestStoredSession as never,
        selectedStoredSessionId: STORED
      })
    )

    expect(resolved).toBe(RECOVERED)
    expect(createSession).not.toHaveBeenCalled()
    expect(requestStoredSession).not.toHaveBeenCalled()
  })

  it('rejects a stale runtime id the route does not bind to the targeted session', async () => {
    // A stale ref left over from the previous profile must not capture the
    // command — that runs it against another profile's session. The durable
    // route outranks the ref here.
    const resolved = await resolveTargetSessionId(
      deps({
        activeRuntimeId: 'rt-wrong-profile',
        getRuntimeIdForStoredSession: () => null,
        routedStoredSessionId: STORED,
        selectedStoredSessionId: STORED
      })
    )

    expect(resolved).toBe(BOUND)
  })

  it('honors an explicit runtime id above everything else', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')
    const requestStoredSession = vi.fn(async () => ({ session_id: 'rt-resume-WRONG' }))

    const resolved = await resolveTargetSessionId(
      deps({
        createSession,
        explicitRuntimeId: 'rt-explicit',
        requestStoredSession: requestStoredSession as never,
        routedStoredSessionId: STORED
      })
    )

    expect(resolved).toBe('rt-explicit')
    expect(createSession).not.toHaveBeenCalled()
    expect(requestStoredSession).not.toHaveBeenCalled()
  })

  it('creates a session only for a genuine new-chat draft', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new')

    const resolved = await resolveTargetSessionId(deps({ createSession }))

    expect(resolved).toBe('rt-brand-new')
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('reuses the live runtime for a new-chat draft without creating a second session', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')

    const resolved = await resolveTargetSessionId(deps({ activeRuntimeId: 'rt-live', createSession }))

    expect(resolved).toBe('rt-live')
    expect(createSession).not.toHaveBeenCalled()
  })

  it('returns null rather than forking when a targeted durable session cannot be rebound', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')

    const requestStoredSession = vi.fn(async () => {
      throw new Error('4007 session not found')
    })

    const resolved = await resolveTargetSessionId(
      deps({ createSession, requestStoredSession: requestStoredSession as never, routedStoredSessionId: STORED })
    )

    expect(resolved).toBeNull()
    expect(createSession).not.toHaveBeenCalled()
  })

  it('fails closed before any resume when the durable owner profile is unresolved', async () => {
    const createSession = vi.fn(async () => 'rt-brand-new-WRONG')
    const requestStoredSession = vi.fn(async () => ({ session_id: RECOVERED }))

    const resolved = await resolveTargetSessionId(
      deps({
        createSession,
        requestStoredSession: requestStoredSession as never,
        resolveStoredSessionProfile: async () => undefined,
        routedStoredSessionId: STORED
      })
    )

    expect(resolved).toBeNull()
    expect(requestStoredSession).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
  })

  it('prefers the routed stored session over a differing selected one', async () => {
    const requestStoredSession = vi.fn(async () => ({ session_id: RECOVERED }))

    await resolveTargetSessionId(
      deps({
        requestStoredSession: requestStoredSession as never,
        routedStoredSessionId: STORED,
        selectedStoredSessionId: 'stored-stale-selection'
      })
    )

    expect(requestStoredSession).toHaveBeenCalledWith(
      STORED,
      'session.resume',
      expect.objectContaining({ session_id: STORED })
    )
  })
})
