const RENDERER_RUNTIME_KEY_PREFIX = 'hermes-runtime-v1:'

export interface RuntimeBackendIdentity {
  readonly connectionId: null | string
  readonly gatewayEpoch: number | string
  readonly profile: string
}

export class InvalidRendererRuntimeKeyError extends Error {
  constructor() {
    super('The renderer runtime key is malformed.')
    this.name = 'InvalidRendererRuntimeKeyError'
  }
}

export interface ParsedRendererRuntimeKey {
  readonly backend: RuntimeBackendIdentity
  readonly runtimeSessionId: string
}

const explicit = (value: string): string => {
  const normalized = value.trim()

  if (!normalized) {
    throw new InvalidRendererRuntimeKeyError()
  }

  return normalized
}

/** Build the collision-free identity used by renderer state and UI stores. */
export function rendererRuntimeKey(backend: RuntimeBackendIdentity, runtimeSessionId: string): string {
  const connectionId = backend.connectionId === null ? null : explicit(backend.connectionId)
  const profile = explicit(backend.profile)
  const runtime = explicit(runtimeSessionId)
  const epoch = backend.gatewayEpoch

  if (
    (typeof epoch !== 'string' && typeof epoch !== 'number') ||
    (typeof epoch === 'string' && !epoch.trim()) ||
    (typeof epoch === 'number' && !Number.isFinite(epoch))
  ) {
    throw new InvalidRendererRuntimeKeyError()
  }

  return `${RENDERER_RUNTIME_KEY_PREFIX}${encodeURIComponent(
    JSON.stringify([connectionId, profile, typeof epoch, typeof epoch === 'string' ? epoch.trim() : epoch, runtime])
  )}`
}

/**
 * Translate a renderer identity back to the raw gateway id at the RPC edge.
 * Ordinary raw ids pass through. A value claiming to be a renderer key fails
 * closed when malformed instead of being sent verbatim to a backend.
 */
export function rawRuntimeSessionId(runtimeId: string): string {
  const normalized = explicit(runtimeId)

  if (!normalized.startsWith(RENDERER_RUNTIME_KEY_PREFIX)) {
    return normalized
  }

  const parsed = parseRendererRuntimeKey(normalized)

  if (!parsed) {
    throw new InvalidRendererRuntimeKeyError()
  }

  return parsed.runtimeSessionId
}

export function parseRendererRuntimeKey(runtimeId: string): ParsedRendererRuntimeKey | null {
  const normalized = explicit(runtimeId)

  if (!normalized.startsWith(RENDERER_RUNTIME_KEY_PREFIX)) {
    return null
  }

  try {
    const tuple = JSON.parse(decodeURIComponent(normalized.slice(RENDERER_RUNTIME_KEY_PREFIX.length))) as unknown

    if (
      !Array.isArray(tuple) ||
      tuple.length !== 5 ||
      (tuple[0] !== null && typeof tuple[0] !== 'string') ||
      typeof tuple[1] !== 'string' ||
      (tuple[2] !== 'string' && tuple[2] !== 'number') ||
      typeof tuple[3] !== tuple[2] ||
      typeof tuple[4] !== 'string'
    ) {
      throw new InvalidRendererRuntimeKeyError()
    }

    const backend = {
      connectionId: tuple[0] === null ? null : explicit(tuple[0]),
      gatewayEpoch: tuple[2] === 'string' ? explicit(String(tuple[3])) : Number(tuple[3]),
      profile: explicit(tuple[1])
    }

    if (tuple[2] === 'number' && !Number.isFinite(backend.gatewayEpoch)) {
      throw new InvalidRendererRuntimeKeyError()
    }

    return Object.freeze({ backend: Object.freeze(backend), runtimeSessionId: explicit(tuple[4]) })
  } catch (error) {
    if (error instanceof InvalidRendererRuntimeKeyError) {
      throw error
    }

    throw new InvalidRendererRuntimeKeyError()
  }
}

export function rendererDurableKey(backend: RuntimeBackendIdentity, durableSessionId: string): string {
  const normalized = rendererRuntimeKey(backend, durableSessionId)

  return `hermes-durable-v1:${normalized.slice(RENDERER_RUNTIME_KEY_PREFIX.length)}`
}
