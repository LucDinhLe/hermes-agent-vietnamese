import { parseRendererRuntimeKey, rawRuntimeSessionId } from '@/lib/session-runtime-key'
import {
  activeGatewayProfileKey,
  gatewayEpochForAgent,
  GatewaySocketEpochMismatchError,
  requestGatewayForAgent,
  requestGatewayForProfile
} from '@/store/gateway'

// ── Session-scoped RPC routing (the #89206 class) ───────────────────────────
// A session-scoped RPC (session.resume / session.activate / session.usage)
// only means anything on the backend that OWNS the session's profile. The
// ambient "active gateway" is a moving target: between the profile-swap await
// and the RPC dispatch, a concurrent switch, an idle-reap eviction, a failed
// dial, or a connection edit can re-point the active route at another
// backend. Dispatching on it anyway lands the RPC on a backend that has never
// heard of the session — it 404s or times out, the renderer burns its bounded
// retries, and the user sees "retries gave up" while the session's own
// backend is healthy (blank Bot Chats, dead wake-ups; local pool and SSH
// alike). These helpers make the owning profile, resolved at REQUEST time,
// the routing authority.

const normKey = (profile: null | string | undefined): string => (profile ?? '').trim() || 'default'

export interface SessionRpcOwner {
  connectionId: null | string
  profile: string
}

export class UnresolvedSessionOwnerError extends Error {
  constructor() {
    super('The stored session owner could not be resolved.')
    this.name = 'UnresolvedSessionOwnerError'
  }
}

export class RendererRuntimeOwnerMismatchError extends Error {
  constructor() {
    super('The renderer runtime key belongs to a different backend owner.')
    this.name = 'RendererRuntimeOwnerMismatchError'
  }
}

export class RendererRuntimeKeyRequiredError extends Error {
  constructor() {
    super('A renderer runtime key is required for this session-scoped request.')
    this.name = 'RendererRuntimeKeyRequiredError'
  }
}

export class RendererRuntimeEpochMismatchError extends Error {
  constructor() {
    super('The renderer runtime key belongs to a stale gateway connection.')
    this.name = 'RendererRuntimeEpochMismatchError'
  }
}

export class RendererRuntimeSessionMismatchError extends Error {
  constructor() {
    super('The request session id does not match its renderer runtime key.')
    this.name = 'RendererRuntimeSessionMismatchError'
  }
}

/**
 * Dispatch on one explicit registry backend. This is the fail-closed boundary
 * for durable-session -> live-RPC translation: the caller must resolve the
 * owning row first, including its connection id. A missing owner is never
 * interpreted as permission to use whichever gateway happens to be active.
 */
export function requestForSessionOwner<T>(
  owner: null | SessionRpcOwner | undefined,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<T> {
  const profile = owner?.profile?.trim()

  if (!owner || !profile || (owner.connectionId !== null && !owner.connectionId.trim())) {
    return Promise.reject(new UnresolvedSessionOwnerError())
  }

  let exactParams = params
  let expectedGatewayEpoch: number | undefined

  if (typeof params.session_id === 'string') {
    try {
      const encoded = parseRendererRuntimeKey(params.session_id)

      if (
        encoded &&
        (encoded.backend.connectionId !== owner.connectionId || normKey(encoded.backend.profile) !== normKey(profile))
      ) {
        return Promise.reject(new RendererRuntimeOwnerMismatchError())
      }

      const currentGatewayEpoch = gatewayEpochForAgent(owner.connectionId, normKey(profile))

      if (encoded && encoded.backend.gatewayEpoch !== currentGatewayEpoch) {
        return Promise.reject(new RendererRuntimeEpochMismatchError())
      }

      expectedGatewayEpoch = encoded ? currentGatewayEpoch : undefined

      exactParams = { ...params, session_id: rawRuntimeSessionId(params.session_id) }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  return requestGatewayForAgent<T>(
    owner.connectionId,
    normKey(profile),
    method,
    exactParams,
    timeoutMs,
    signal,
    expectedGatewayEpoch
  ).catch(error => {
    if (error instanceof GatewaySocketEpochMismatchError) {
      throw new RendererRuntimeEpochMismatchError()
    }

    throw error
  })
}

/**
 * Dispatch a live-runtime RPC using the renderer key as the sole routing
 * authority. Unlike durable-session requests, callers here may not supply a
 * raw backend id: it has no connection/profile/epoch scope and would make an
 * ambient route indistinguishable from the intended owner. The encoded key
 * remains intact until requestForSessionOwner strips it at the gateway edge.
 */
export function requestForRendererRuntime<T>(
  runtimeKey: string,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<T> {
  let parsed

  try {
    parsed = parseRendererRuntimeKey(runtimeKey)
  } catch (error) {
    return Promise.reject(error)
  }

  if (!parsed) {
    return Promise.reject(new RendererRuntimeKeyRequiredError())
  }

  const owner = { connectionId: parsed.backend.connectionId, profile: parsed.backend.profile }

  if (parsed.backend.gatewayEpoch !== gatewayEpochForAgent(owner.connectionId, owner.profile)) {
    return Promise.reject(new RendererRuntimeEpochMismatchError())
  }

  if (params.session_id !== undefined && params.session_id !== runtimeKey) {
    return Promise.reject(new RendererRuntimeSessionMismatchError())
  }

  return requestForSessionOwner<T>(owner, method, { ...params, session_id: runtimeKey }, timeoutMs, signal)
}

/**
 * True when a session-scoped RPC must be pinned to `ownerProfile`'s own
 * socket because the active gateway currently serves a different profile.
 * A null/empty owner means the session's profile is unknown — route ambient
 * (the pre-multi-profile behavior) rather than guessing.
 */
export function sessionRpcNeedsProfileRoute(
  ownerProfile: null | string | undefined,
  activeProfile: string = activeGatewayProfileKey()
): boolean {
  if (ownerProfile == null || !String(ownerProfile).trim()) {
    return false
  }

  return normKey(ownerProfile) !== normKey(activeProfile)
}

/**
 * Dispatch a session-scoped RPC on the socket that owns `ownerProfile`,
 * falling back to the ambient dispatcher when the active gateway already
 * serves that profile (keeps the primary's reauth-aware reconnect path).
 * The route is decided at CALL time, not at swap time.
 */
export function requestForSessionProfile<T>(
  ownerProfile: null | string | undefined,
  ambientRequest: <R>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
    signal?: AbortSignal
  ) => Promise<R>,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<T> {
  if (!sessionRpcNeedsProfileRoute(ownerProfile)) {
    // Forward the extra args only when the caller actually supplied them. The
    // ambient dispatcher is a plain gateway request whose arity callers assert
    // on; handing it a trailing `undefined, undefined` on every session RPC
    // changes the observed call shape for the many callers that never asked
    // for a deadline (the plugin host bridge in contrib/wiring is the only one
    // that does).
    return timeoutMs === undefined && signal === undefined
      ? ambientRequest<T>(method, params)
      : ambientRequest<T>(method, params, timeoutMs, signal)
  }

  return requestGatewayForProfile<T>(normKey(ownerProfile), method, params, timeoutMs, signal)
}
