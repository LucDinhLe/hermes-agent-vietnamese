import { parseRendererRuntimeKey, rendererRuntimeKey } from '@/lib/session-runtime-key'

export const SESSION_RUNTIME_NOT_FOUND_RPC_CODE = 4007 as const
export const SESSION_RUNTIME_RECOVERY_MESSAGE =
  'Hermes không còn giữ phiên đang chạy này. Cuộc trò chuyện và bản nháp vẫn được giữ.'

export class SessionRuntimeRecoveryError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super(SESSION_RUNTIME_RECOVERY_MESSAGE)
    this.name = 'SessionRuntimeRecoveryError'
    this.cause = cause
  }
}
export const DESKTOP_SESSION_GATEWAY_EPOCH = 'renderer-current' as const
export const SESSION_BINDING_OBSERVATION_EVENT = 'hermes:session-binding-observation' as const

export type GatewayEpoch = number | string

export interface BackendKey {
  readonly connectionId: null | string
  readonly gatewayEpoch: GatewayEpoch
  readonly profile: string
}

export interface DurableSessionTarget {
  readonly backend: BackendKey
  readonly durableSessionId: string
}

export interface SessionBinding {
  readonly backend: BackendKey
  readonly durableSessionId: string
  readonly generation: number
  readonly routeToken: string
  /** Backend-qualified identity used only by renderer state/maps. */
  readonly rendererRuntimeId: string
  /** Raw gateway id. Never use this as a renderer state key. */
  readonly runtimeSessionId: string
}

export interface ExactSessionResolveRequest extends DurableSessionTarget {
  readonly generation: number
  readonly routeToken: string
}

export type ExactSessionResolver = (
  request: ExactSessionResolveRequest
) => Promise<{ readonly runtimeSessionId: string }>

export type SessionBindingInvalidationReason =
  | 'gateway-closed'
  | 'gateway-epoch-changed'
  | 'manual'
  | 'runtime-not-found'
  | 'session-reclaimed'

export type SessionBindingObservationPhase =
  | 'bind'
  | 'invalidate-backend'
  | 'invalidate-runtime'
  | 'invalidate-runtime-miss'
  | 'resolve-failure'
  | 'resolve-late'
  | 'resolve-start'
  | 'resolve-success'
  | 'metric'

export type SessionBindingMetricName =
  | 'first_prompt_routed'
  | 'provisional_invalidated'
  | 'recovery_attempt'
  | 'resume_failed'
  | 'resume_success'
  | 'runtime_bound'
  | 'runtime_not_found_4007'
  | 'session_create_requested'

/**
 * Diagnostics deliberately contain only hashes of identity-bearing values.
 * Callers must not add prompt text, paths, URLs, credentials, or raw ids.
 */
export interface SessionBindingObservation {
  readonly connectionIdHash: string
  readonly durableSessionIdHash?: string
  readonly errorCode?: typeof SESSION_RUNTIME_NOT_FOUND_RPC_CODE
  readonly event: 'session_binding'
  readonly gatewayEpochHash: string
  readonly generation: number
  readonly metric?: SessionBindingMetricName
  readonly phase: SessionBindingObservationPhase
  readonly profileHash: string
  readonly reason?: SessionBindingInvalidationReason
  readonly routeTokenHash?: string
  readonly runtimeSessionIdHash?: string
}

export type SessionBindingObserver = (observation: SessionBindingObservation) => void

export interface SessionRuntimeNotFoundFailure {
  readonly code: typeof SESSION_RUNTIME_NOT_FOUND_RPC_CODE
  readonly kind: 'runtime-session-not-found'
}

export class InvalidSessionBindingIdentityError extends Error {
  constructor(field: string) {
    super(`Session binding requires an explicit, non-empty ${field}.`)
    this.name = 'InvalidSessionBindingIdentityError'
  }
}

export class SessionBindingConflictError extends Error {
  constructor() {
    super('The runtime session is already bound to another durable session on this backend.')
    this.name = 'SessionBindingConflictError'
  }
}

export class SessionBindingLateResultError extends Error {
  readonly currentGeneration: number
  readonly expectedGeneration: number
  readonly routeChanged: boolean

  constructor(expectedGeneration: number, currentGeneration: number, routeChanged: boolean) {
    super('Discarded a stale session binding result.')
    this.name = 'SessionBindingLateResultError'
    this.expectedGeneration = expectedGeneration
    this.currentGeneration = currentGeneration
    this.routeChanged = routeChanged
  }
}

interface ResolutionLease extends ExactSessionResolveRequest {
  readonly durableKey: string
}

const RPC_ERROR_LINKS = ['cause', 'data', 'error'] as const

function isRpcCode4007(value: unknown): boolean {
  return value === SESSION_RUNTIME_NOT_FOUND_RPC_CODE || value === String(SESSION_RUNTIME_NOT_FOUND_RPC_CODE)
}

/** Classify JSON-RPC 4007 structurally. Error messages are never parsed. */
export function classifySessionRuntimeNotFound(error: unknown): SessionRuntimeNotFoundFailure | null {
  const seen = new Set<object>()
  const pending: unknown[] = [error]

  while (pending.length > 0) {
    const candidate = pending.pop()

    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) {
      continue
    }

    seen.add(candidate)
    const record = candidate as Record<string, unknown>

    if (isRpcCode4007(record.code) || isRpcCode4007(record.errorCode) || isRpcCode4007(record.error_code)) {
      return Object.freeze({ code: SESSION_RUNTIME_NOT_FOUND_RPC_CODE, kind: 'runtime-session-not-found' })
    }

    for (const key of RPC_ERROR_LINKS) {
      const linked = record[key]

      if (key === 'data' && isRpcCode4007(linked)) {
        return Object.freeze({ code: SESSION_RUNTIME_NOT_FOUND_RPC_CODE, kind: 'runtime-session-not-found' })
      }

      pending.push(linked)
    }
  }

  return null
}

/** Structural transport/runtime recovery class shared by every UI surface.
 * Raw backend text is deliberately ignored so localized or attacker-controlled
 * messages can never decide recovery behavior or leak through notifications. */
export function isSessionRuntimeRecoveryFailure(error: unknown): boolean {
  if (classifySessionRuntimeNotFound(error)) {
    return true
  }

  const seen = new Set<object>()
  const pending: unknown[] = [error]

  while (pending.length > 0) {
    const candidate = pending.pop()

    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) {
      continue
    }

    seen.add(candidate)
    const record = candidate as Record<string, unknown>

    if (
      record.name === 'GatewaySocketEpochMismatchError' ||
      record.name === 'RendererRuntimeEpochMismatchError' ||
      record.name === 'SessionRuntimeRecoveryError'
    ) {
      return true
    }

    pending.push(record.cause, record.error)
  }

  return false
}

function explicitText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidSessionBindingIdentityError(field)
  }

  return value.trim()
}

/**
 * Construct the only backend identity accepted by the registry. Empty values
 * are rejected instead of being converted to an ambient/default route.
 */
export function createBackendKey(input: BackendKey): BackendKey {
  const connectionId =
    input.connectionId === null ? null : explicitText(input.connectionId, 'connectionId (or explicit null)')

  const profile = explicitText(input.profile, 'profile')
  const epoch = input.gatewayEpoch

  if (
    (typeof epoch !== 'string' && typeof epoch !== 'number') ||
    (typeof epoch === 'string' && !epoch.trim()) ||
    (typeof epoch === 'number' && !Number.isFinite(epoch))
  ) {
    throw new InvalidSessionBindingIdentityError('gatewayEpoch')
  }

  return Object.freeze({
    connectionId,
    gatewayEpoch: typeof epoch === 'string' ? epoch.trim() : epoch,
    profile
  })
}

function backendStorageKey(backend: BackendKey): string {
  return JSON.stringify([backend.connectionId, backend.profile, typeof backend.gatewayEpoch, backend.gatewayEpoch])
}

function durableStorageKey(target: DurableSessionTarget): string {
  return JSON.stringify([backendStorageKey(target.backend), target.durableSessionId])
}

function runtimeStorageKey(backend: BackendKey, runtimeSessionId: string): string {
  return JSON.stringify([backendStorageKey(backend), runtimeSessionId])
}

function sanitizedHash(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `sb_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function exactBackend(left: BackendKey, right: BackendKey): boolean {
  return backendStorageKey(left) === backendStorageKey(right)
}

/**
 * Shell-owned, in-memory authority for durable <-> runtime session bindings.
 * Every operation requires an exact backend key; there is no ambient route and
 * no default-profile fallback in this API.
 */
export class SessionBindingRegistry {
  readonly #firstPromptByGeneration = new Set<string>()
  readonly #forward = new Map<string, SessionBinding>()
  readonly #generationByDurable = new Map<string, number>()
  readonly #observer?: SessionBindingObserver
  readonly #reverse = new Map<string, string>()
  readonly #targetByDurable = new Map<string, DurableSessionTarget>()

  constructor(options: { observer?: SessionBindingObserver } = {}) {
    this.#observer = options.observer
  }

  get size(): number {
    return this.#forward.size
  }

  /**
   * Emit a product-level counter using only an exact backend plus hashed
   * optional identities. This is the integration surface for lifecycle steps
   * which do not themselves mutate the registry (create/send/recovery).
   */
  observe(
    metric: SessionBindingMetricName,
    context: {
      readonly backend: BackendKey
      readonly durableSessionId?: string
      readonly routeToken?: string
      readonly runtimeSessionId?: string
    }
  ): void {
    const normalizedBackend = createBackendKey(context.backend)
    const durableSessionId = context.durableSessionId
      ? explicitText(context.durableSessionId, 'durableSessionId')
      : undefined
    const durableKey = durableSessionId
      ? durableStorageKey({ backend: normalizedBackend, durableSessionId })
      : undefined
    const generation = durableKey ? (this.#generationByDurable.get(durableKey) ?? 0) : 0

    if (metric === 'first_prompt_routed' && durableKey) {
      const onceKey = `${durableKey}:${generation}`

      if (this.#firstPromptByGeneration.has(onceKey)) {
        return
      }

      this.#firstPromptByGeneration.add(onceKey)
    }

    this.#emitForIdentity(
      'metric',
      normalizedBackend,
      generation,
      durableSessionId,
      context.runtimeSessionId,
      context.routeToken,
      undefined,
      metric === 'runtime_not_found_4007' ? SESSION_RUNTIME_NOT_FOUND_RPC_CODE : undefined,
      metric
    )
  }

  bind(target: DurableSessionTarget, runtimeSessionId: string, routeToken: string): SessionBinding {
    const normalized = this.#normalizeTarget(target)
    const runtime = explicitText(runtimeSessionId, 'runtimeSessionId')
    const route = explicitText(routeToken, 'routeToken')
    const key = durableStorageKey(normalized)
    const generation = this.#nextGeneration(key)
    const binding = this.#install(normalized, key, runtime, route, generation)

    this.#emit('bind', binding)

    return binding
  }

  getByDurable(target: DurableSessionTarget): SessionBinding | null {
    const normalized = this.#normalizeTarget(target)

    return this.#forward.get(durableStorageKey(normalized)) ?? null
  }

  getByRuntime(backend: BackendKey, runtimeSessionId: string): SessionBinding | null {
    const normalizedBackend = createBackendKey(backend)
    const runtime = explicitText(runtimeSessionId, 'runtimeSessionId')
    const durableKey = this.#reverse.get(runtimeStorageKey(normalizedBackend, runtime))

    return durableKey ? (this.#forward.get(durableKey) ?? null) : null
  }

  /** Reverse a renderer-qualified runtime identity without trusting a durable-map key. */
  getByRendererRuntime(rendererRuntimeId: string): SessionBinding | null {
    const parsed = parseRendererRuntimeKey(rendererRuntimeId)

    if (!parsed) {
      return null
    }

    const binding = this.getByRuntime(createBackendKey(parsed.backend), parsed.runtimeSessionId)

    return binding?.rendererRuntimeId === rendererRuntimeId ? binding : null
  }

  /**
   * Resolve on the supplied backend and bind only if generation and route are
   * still current when the asynchronous result returns.
   */
  async resolve(
    target: DurableSessionTarget,
    routeToken: string,
    resolver: ExactSessionResolver,
    currentRouteToken: () => string
  ): Promise<SessionBinding> {
    const lease = this.#beginResolution(target, routeToken)

    try {
      const result = await resolver(
        Object.freeze({
          backend: lease.backend,
          durableSessionId: lease.durableSessionId,
          generation: lease.generation,
          routeToken: lease.routeToken
        })
      )

      const runtime = explicitText(result?.runtimeSessionId, 'runtimeSessionId')
      const currentGeneration = this.#generationByDurable.get(lease.durableKey) ?? 0
      const routeChanged = currentRouteToken() !== lease.routeToken

      if (currentGeneration !== lease.generation || routeChanged) {
        this.#emit('resolve-late', lease, runtime)
        throw new SessionBindingLateResultError(lease.generation, currentGeneration, routeChanged)
      }

      const binding = this.#install(lease, lease.durableKey, runtime, lease.routeToken, lease.generation)

      this.#emit('resolve-success', binding)

      return binding
    } catch (error) {
      if (!(error instanceof SessionBindingLateResultError)) {
        this.#emit('resolve-failure', lease, undefined, undefined, classifySessionRuntimeNotFound(error)?.code)
      }

      throw error
    }
  }

  invalidateRuntime(
    backend: BackendKey,
    runtimeSessionId: string,
    reason: SessionBindingInvalidationReason
  ): SessionBinding | null {
    const normalizedBackend = createBackendKey(backend)
    const runtime = explicitText(runtimeSessionId, 'runtimeSessionId')
    const reverseKey = runtimeStorageKey(normalizedBackend, runtime)
    const durableKey = this.#reverse.get(reverseKey)

    if (!durableKey) {
      this.#emitForIdentity('invalidate-runtime-miss', normalizedBackend, 0, undefined, runtime, undefined, reason)

      return null
    }

    const binding = this.#forward.get(durableKey)

    if (!binding) {
      this.#reverse.delete(reverseKey)

      return null
    }

    // Mutate every index before notifying observers, so re-entrant reads see a
    // complete invalidation rather than one half of the forward/reverse pair.
    this.#generationByDurable.set(durableKey, binding.generation + 1)
    this.#forward.delete(durableKey)
    this.#reverse.delete(reverseKey)
    this.#emit('invalidate-runtime', binding, undefined, reason)

    return binding
  }

  invalidateBackend(backend: BackendKey, reason: SessionBindingInvalidationReason): readonly SessionBinding[] {
    const normalizedBackend = createBackendKey(backend)

    const affected = [...this.#targetByDurable.entries()].filter(([, target]) =>
      exactBackend(target.backend, normalizedBackend)
    )

    return this.#invalidateTargets(affected, reason)
  }

  /**
   * Invalidate every socket generation for one physical backend owner. A
   * gateway.ready frame is tagged with the *new* epoch, so exact-epoch
   * invalidation alone cannot find bindings left by the socket it replaced.
   */
  invalidateBackendScope(
    owner: Pick<BackendKey, 'connectionId' | 'profile'>,
    reason: SessionBindingInvalidationReason
  ): readonly SessionBinding[] {
    const normalized = createBackendKey({ ...owner, gatewayEpoch: 0 })
    const affected = [...this.#targetByDurable.entries()].filter(
      ([, target]) =>
        target.backend.connectionId === normalized.connectionId && target.backend.profile === normalized.profile
    )

    return this.#invalidateTargets(affected, reason)
  }

  #invalidateTargets(
    affected: readonly (readonly [string, DurableSessionTarget])[],
    reason: SessionBindingInvalidationReason
  ): readonly SessionBinding[] {
    const removed: SessionBinding[] = []

    // Complete all mutations first. This also bumps pending resolution leases
    // that have not produced a runtime id yet.
    for (const [durableKey] of affected) {
      const currentGeneration = this.#generationByDurable.get(durableKey) ?? 0
      const binding = this.#forward.get(durableKey)

      this.#generationByDurable.set(durableKey, currentGeneration + 1)

      if (binding) {
        this.#forward.delete(durableKey)
        this.#reverse.delete(runtimeStorageKey(binding.backend, binding.runtimeSessionId))
        removed.push(binding)
      }
    }

    for (const [durableKey, target] of affected) {
      const binding = removed.find(candidate => durableStorageKey(candidate) === durableKey)

      this.#emitForIdentity(
        'invalidate-backend',
        target.backend,
        this.#generationByDurable.get(durableKey) ?? 0,
        target.durableSessionId,
        binding?.runtimeSessionId,
        binding?.routeToken,
        reason
      )
    }

    return Object.freeze(removed)
  }

  #beginResolution(target: DurableSessionTarget, routeToken: string): ResolutionLease {
    const normalized = this.#normalizeTarget(target)
    const route = explicitText(routeToken, 'routeToken')
    const durableKey = durableStorageKey(normalized)

    const lease = Object.freeze({
      ...normalized,
      durableKey,
      generation: this.#nextGeneration(durableKey),
      routeToken: route
    })

    this.#emit('resolve-start', lease)

    return lease
  }

  #emit(
    phase: SessionBindingObservationPhase,
    value: DurableSessionTarget & { generation: number; routeToken?: string; runtimeSessionId?: string },
    runtimeSessionId?: string,
    reason?: SessionBindingInvalidationReason,
    errorCode?: typeof SESSION_RUNTIME_NOT_FOUND_RPC_CODE
  ): void {
    this.#emitForIdentity(
      phase,
      value.backend,
      value.generation,
      value.durableSessionId,
      runtimeSessionId ?? value.runtimeSessionId,
      value.routeToken,
      reason,
      errorCode,
      phase === 'bind'
        ? 'runtime_bound'
        : phase === 'resolve-start'
          ? 'recovery_attempt'
          : phase === 'resolve-success'
            ? 'resume_success'
            : phase === 'resolve-failure'
              ? 'resume_failed'
              : undefined
    )

    if (phase === 'resolve-failure' && errorCode === SESSION_RUNTIME_NOT_FOUND_RPC_CODE) {
      this.#emitForIdentity(
        'metric',
        value.backend,
        value.generation,
        value.durableSessionId,
        runtimeSessionId ?? value.runtimeSessionId,
        value.routeToken,
        reason,
        errorCode,
        'runtime_not_found_4007'
      )
    }
  }

  #emitForIdentity(
    phase: SessionBindingObservationPhase,
    backend: BackendKey,
    generation: number,
    durableSessionId?: string,
    runtimeSessionId?: string,
    routeToken?: string,
    reason?: SessionBindingInvalidationReason,
    errorCode?: typeof SESSION_RUNTIME_NOT_FOUND_RPC_CODE,
    metric?: SessionBindingMetricName
  ): void {
    if (!this.#observer) {
      return
    }

    const observation = Object.freeze({
      connectionIdHash: sanitizedHash(backend.connectionId),
      ...(durableSessionId ? { durableSessionIdHash: sanitizedHash(durableSessionId) } : {}),
      ...(errorCode ? { errorCode } : {}),
      event: 'session_binding' as const,
      gatewayEpochHash: sanitizedHash([typeof backend.gatewayEpoch, backend.gatewayEpoch]),
      generation,
      ...(metric ? { metric } : {}),
      phase,
      profileHash: sanitizedHash(backend.profile),
      ...(reason ? { reason } : {}),
      ...(routeToken ? { routeTokenHash: sanitizedHash(routeToken) } : {}),
      ...(runtimeSessionId ? { runtimeSessionIdHash: sanitizedHash(runtimeSessionId) } : {})
    })

    try {
      this.#observer(observation)
    } catch {
      // Diagnostics must never alter binding behavior.
    }
  }

  #install(
    target: DurableSessionTarget,
    durableKey: string,
    runtimeSessionId: string,
    routeToken: string,
    generation: number
  ): SessionBinding {
    const reverseKey = runtimeStorageKey(target.backend, runtimeSessionId)
    const reverseOwner = this.#reverse.get(reverseKey)

    if (reverseOwner && reverseOwner !== durableKey) {
      throw new SessionBindingConflictError()
    }

    const previous = this.#forward.get(durableKey)

    if (previous) {
      this.#reverse.delete(runtimeStorageKey(previous.backend, previous.runtimeSessionId))
    }

    const binding = Object.freeze({
      backend: target.backend,
      durableSessionId: target.durableSessionId,
      generation,
      rendererRuntimeId: rendererRuntimeKey(target.backend, runtimeSessionId),
      routeToken,
      runtimeSessionId
    })

    this.#forward.set(durableKey, binding)
    this.#reverse.set(reverseKey, durableKey)

    return binding
  }

  #nextGeneration(durableKey: string): number {
    const generation = (this.#generationByDurable.get(durableKey) ?? 0) + 1
    this.#generationByDurable.set(durableKey, generation)

    return generation
  }

  #normalizeTarget(target: DurableSessionTarget): DurableSessionTarget {
    const normalized = Object.freeze({
      backend: createBackendKey(target.backend),
      durableSessionId: explicitText(target.durableSessionId, 'durableSessionId')
    })

    const key = durableStorageKey(normalized)

    this.#targetByDurable.set(key, normalized)

    return normalized
  }
}
