import { describe, expect, it, vi } from 'vitest'

import {
  type BackendKey,
  classifySessionRuntimeNotFound,
  createBackendKey,
  InvalidSessionBindingIdentityError,
  SessionBindingConflictError,
  SessionBindingLateResultError,
  type SessionBindingObservation,
  SessionBindingRegistry
} from './session-binding-registry'

const backend = (connectionId: null | string, gatewayEpoch: string): BackendKey =>
  createBackendKey({ connectionId, gatewayEpoch, profile: 'mbc' })

const target = (owner: BackendKey, durableSessionId: string) => ({ backend: owner, durableSessionId })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })

  return { promise, reject, resolve }
}

describe('SessionBindingRegistry', () => {
  it('reverse-resolves a renderer runtime through the exact binding instead of a durable-map key', () => {
    const registry = new SessionBindingRegistry()
    const owner = backend('connection-a', 'epoch-1')
    const binding = registry.bind(target(owner, 'durable-a'), 'shared-runtime', 'route-a')

    expect(registry.getByRendererRuntime(binding.rendererRuntimeId)).toEqual(binding)
    expect(registry.getByRendererRuntime('shared-runtime')).toBeNull()

    const other = registry.bind(
      target(backend('connection-b', 'epoch-1'), 'durable-b'),
      'shared-runtime',
      'route-b'
    )

    expect(registry.getByRendererRuntime(binding.rendererRuntimeId)?.durableSessionId).toBe('durable-a')
    expect(registry.getByRendererRuntime(other.rendererRuntimeId)?.durableSessionId).toBe('durable-b')
  })

  it('keeps same-profile, same-runtime bindings isolated across exact backends', () => {
    const registry = new SessionBindingRegistry()
    const left = backend('connection-a', 'epoch-1')
    const right = backend('connection-b', 'epoch-1')
    const leftTarget = target(left, 'durable-left')
    const rightTarget = target(right, 'durable-right')

    const leftBinding = registry.bind(leftTarget, 'runtime-shared', 'route-left')
    const rightBinding = registry.bind(rightTarget, 'runtime-shared', 'route-right')

    expect(leftBinding.rendererRuntimeId).not.toBe(rightBinding.rendererRuntimeId)
    expect(leftBinding.rendererRuntimeId).not.toBe('runtime-shared')

    expect(registry.getByRuntime(left, 'runtime-shared')?.durableSessionId).toBe('durable-left')
    expect(registry.getByRuntime(right, 'runtime-shared')?.durableSessionId).toBe('durable-right')

    registry.invalidateRuntime(left, 'runtime-shared', 'session-reclaimed')

    expect(registry.getByDurable(leftTarget)).toBeNull()
    expect(registry.getByDurable(rightTarget)?.runtimeSessionId).toBe('runtime-shared')
  })

  it('replaces both indexes atomically when one durable session gets a new runtime', () => {
    const registry = new SessionBindingRegistry()
    const owner = backend(null, 'epoch-1')
    const durable = target(owner, 'durable-a')

    registry.bind(durable, 'runtime-old', 'route-a')
    const rebound = registry.bind(durable, 'runtime-new', 'route-a')

    expect(registry.getByRuntime(owner, 'runtime-old')).toBeNull()
    expect(registry.getByRuntime(owner, 'runtime-new')).toBe(rebound)
    expect(registry.getByDurable(durable)).toBe(rebound)
    expect(registry.size).toBe(1)
  })

  it('rejects a runtime collision inside one backend without damaging existing ownership', () => {
    const registry = new SessionBindingRegistry()
    const owner = backend(null, 'epoch-1')
    const first = target(owner, 'durable-a')
    const second = target(owner, 'durable-b')

    registry.bind(first, 'runtime-shared', 'route-a')

    expect(() => registry.bind(second, 'runtime-shared', 'route-b')).toThrow(SessionBindingConflictError)
    expect(registry.getByRuntime(owner, 'runtime-shared')?.durableSessionId).toBe('durable-a')
    expect(registry.getByDurable(second)).toBeNull()
  })

  it('passes the exact backend to the resolver and never invents a default route', async () => {
    const registry = new SessionBindingRegistry()
    const owner = backend('registry-source', 'gateway-process-7')
    const durable = target(owner, 'durable-a')
    const resolver = vi.fn(async () => ({ runtimeSessionId: 'runtime-a' }))

    const binding = await registry.resolve(durable, 'route-a', resolver, () => 'route-a')

    expect(resolver).toHaveBeenCalledWith({
      backend: owner,
      durableSessionId: 'durable-a',
      generation: 1,
      routeToken: 'route-a'
    })
    expect(binding.backend).toEqual(owner)
    expect(() => createBackendKey({ connectionId: null, gatewayEpoch: 'epoch-1', profile: '' })).toThrow(
      InvalidSessionBindingIdentityError
    )
    expect(() => createBackendKey({ connectionId: '', gatewayEpoch: 'epoch-1', profile: 'default' })).toThrow(
      InvalidSessionBindingIdentityError
    )
  })

  it('rejects a result whose generation was superseded while resolve was in flight', async () => {
    const registry = new SessionBindingRegistry()
    const owner = backend(null, 'epoch-1')
    const durable = target(owner, 'durable-a')
    const first = deferred<{ runtimeSessionId: string }>()

    const resolving = registry.resolve(
      durable,
      'route-a',
      () => first.promise,
      () => 'route-a'
    )

    registry.bind(durable, 'runtime-newer', 'route-a')
    first.resolve({ runtimeSessionId: 'runtime-late' })

    await expect(resolving).rejects.toMatchObject({
      currentGeneration: 2,
      expectedGeneration: 1,
      routeChanged: false
    })
    expect(registry.getByDurable(durable)?.runtimeSessionId).toBe('runtime-newer')
    expect(registry.getByRuntime(owner, 'runtime-late')).toBeNull()
  })

  it('rejects a result after its route token changes', async () => {
    const registry = new SessionBindingRegistry()
    const owner = backend(null, 'epoch-1')
    const durable = target(owner, 'durable-a')
    const pending = deferred<{ runtimeSessionId: string }>()
    let route = 'route-a'

    const resolving = registry.resolve(
      durable,
      route,
      () => pending.promise,
      () => route
    )

    route = 'route-b'
    pending.resolve({ runtimeSessionId: 'runtime-late' })

    await expect(resolving).rejects.toBeInstanceOf(SessionBindingLateResultError)
    await expect(resolving).rejects.toMatchObject({ routeChanged: true })
    expect(registry.getByDurable(durable)).toBeNull()
  })

  it('invalidates only the exact backend epoch and cancels its pending resolves', async () => {
    const registry = new SessionBindingRegistry()
    const oldBackend = backend('connection-a', 'epoch-old')
    const newBackend = backend('connection-a', 'epoch-new')
    const oldBound = target(oldBackend, 'durable-bound')
    const oldPending = target(oldBackend, 'durable-pending')
    const newBound = target(newBackend, 'durable-bound')
    const pending = deferred<{ runtimeSessionId: string }>()

    const resolving = registry.resolve(
      oldPending,
      'route-old',
      () => pending.promise,
      () => 'route-old'
    )

    registry.bind(oldBound, 'runtime-old', 'route-old')
    registry.bind(newBound, 'runtime-new', 'route-new')

    const removed = registry.invalidateBackend(oldBackend, 'gateway-epoch-changed')
    pending.resolve({ runtimeSessionId: 'runtime-too-late' })

    expect(removed.map(binding => binding.runtimeSessionId)).toEqual(['runtime-old'])
    expect(registry.getByDurable(oldBound)).toBeNull()
    expect(registry.getByDurable(newBound)?.runtimeSessionId).toBe('runtime-new')
    await expect(resolving).rejects.toBeInstanceOf(SessionBindingLateResultError)
  })

  it('isolates a reused runtime across socket epochs and invalidates the replaced owner scope', () => {
    const registry = new SessionBindingRegistry()
    const oldBackend = createBackendKey({ connectionId: 'connection-a', gatewayEpoch: 1, profile: 'mbc' })
    const newBackend = createBackendKey({ connectionId: 'connection-a', gatewayEpoch: 2, profile: 'mbc' })
    const otherBackend = createBackendKey({ connectionId: 'connection-b', gatewayEpoch: 2, profile: 'mbc' })
    const oldTarget = target(oldBackend, 'durable-old')
    const newTarget = target(newBackend, 'durable-new')
    const otherTarget = target(otherBackend, 'durable-other')

    const oldBinding = registry.bind(oldTarget, 'runtime-reused', 'route-old')
    const newBinding = registry.bind(newTarget, 'runtime-reused', 'route-new')
    registry.bind(otherTarget, 'runtime-reused', 'route-other')

    expect(oldBinding.rendererRuntimeId).not.toBe(newBinding.rendererRuntimeId)

    const removed = registry.invalidateBackendScope(newBackend, 'gateway-epoch-changed')

    expect(removed.map(binding => binding.durableSessionId).sort()).toEqual(['durable-new', 'durable-old'])
    expect(registry.getByDurable(oldTarget)).toBeNull()
    expect(registry.getByDurable(newTarget)).toBeNull()
    expect(registry.getByDurable(otherTarget)?.runtimeSessionId).toBe('runtime-reused')
  })

  it('classifies typed JSON-RPC 4007 from code/data but ignores message text', () => {
    const messageOnly = new Error('4007 session not found')
    const direct = Object.assign(new Error('opaque'), { code: 4007 })
    const nestedData = { code: -32_000, data: { error_code: '4007' } }
    const nestedCause = { cause: { data: { code: 4007 } } }

    expect(classifySessionRuntimeNotFound(direct)).toEqual({ code: 4007, kind: 'runtime-session-not-found' })
    expect(classifySessionRuntimeNotFound(nestedData)).toEqual({ code: 4007, kind: 'runtime-session-not-found' })
    expect(classifySessionRuntimeNotFound(nestedCause)).toEqual({ code: 4007, kind: 'runtime-session-not-found' })
    expect(classifySessionRuntimeNotFound(messageOnly)).toBeNull()
    expect(classifySessionRuntimeNotFound({ code: 404, data: { message: 'session not found' } })).toBeNull()
  })

  it('emits useful observations without exposing raw binding identities', async () => {
    const observations: SessionBindingObservation[] = []
    const registry = new SessionBindingRegistry({ observer: observation => observations.push(observation) })

    const owner = createBackendKey({
      connectionId: 'private-connection',
      gatewayEpoch: 'private-epoch',
      profile: 'private-profile'
    })

    const durable = target(owner, 'private-durable')

    await registry.resolve(
      durable,
      'private-route',
      async () => ({ runtimeSessionId: 'private-runtime' }),
      () => 'private-route'
    )
    registry.invalidateRuntime(owner, 'private-runtime', 'session-reclaimed')

    expect(observations.map(event => event.phase)).toEqual(['resolve-start', 'resolve-success', 'invalidate-runtime'])
    expect(observations[1]).toMatchObject({ event: 'session_binding', generation: 1, metric: 'resume_success' })
    expect(JSON.stringify(observations)).not.toMatch(/private-(?:connection|epoch|profile|durable|route|runtime)/)
    expect(observations.every(event => event.profileHash.startsWith('sb_'))).toBe(true)
  })

  it('reports typed 4007 in the sanitized failure tuple', async () => {
    const observations: SessionBindingObservation[] = []
    const registry = new SessionBindingRegistry({ observer: observation => observations.push(observation) })
    const owner = backend(null, 'epoch-1')

    await expect(
      registry.resolve(
        target(owner, 'durable-a'),
        'route-a',
        async () => {
          throw { data: { code: 4007 } }
        },
        () => 'route-a'
      )
    ).rejects.toEqual({ data: { code: 4007 } })

    expect(observations).toContainEqual(expect.objectContaining({ errorCode: 4007, phase: 'resolve-failure' }))
    expect(observations.at(-1)).toMatchObject({
      errorCode: 4007,
      metric: 'runtime_not_found_4007',
      phase: 'metric'
    })
  })

  it('exposes the complete sanitized lifecycle counter contract and deduplicates first prompt per generation', () => {
    const observations: SessionBindingObservation[] = []
    const registry = new SessionBindingRegistry({ observer: observation => observations.push(observation) })
    const owner = createBackendKey({
      connectionId: 'private-connection',
      gatewayEpoch: 'private-epoch',
      profile: 'private-profile'
    })
    const context = {
      backend: owner,
      durableSessionId: 'private-durable',
      routeToken: 'private-route',
      runtimeSessionId: 'private-runtime'
    }

    registry.observe('session_create_requested', { backend: owner })
    registry.bind(target(owner, 'private-durable'), 'private-runtime', 'private-route')
    registry.observe('first_prompt_routed', context)
    registry.observe('first_prompt_routed', context)
    registry.observe('runtime_not_found_4007', context)
    registry.observe('recovery_attempt', context)
    registry.observe('resume_success', context)
    registry.observe('resume_failed', context)
    registry.observe('provisional_invalidated', { backend: owner, routeToken: 'private-route' })

    expect(observations.map(event => event.metric)).toEqual([
      'session_create_requested',
      'runtime_bound',
      'first_prompt_routed',
      'runtime_not_found_4007',
      'recovery_attempt',
      'resume_success',
      'resume_failed',
      'provisional_invalidated'
    ])
    expect(observations[3]).toMatchObject({ errorCode: 4007 })
    expect(JSON.stringify(observations)).not.toMatch(/private-(?:connection|epoch|profile|durable|route|runtime)/)
  })
})
