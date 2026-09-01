import { parseRendererRuntimeKey } from '@/lib/session-runtime-key'
import { gatewayEpochForAgent, GatewaySocketEpochMismatchError, requestGatewayForAgent } from '@/store/gateway'

/**
 * A blocking gateway event is answered by request id, so its response carries
 * no session id for the registry to route on. The qualified renderer runtime
 * id stamped onto the event is therefore the response's source capability:
 * parse its exact backend owner, verify the socket generation is still live,
 * and dispatch without adding renderer-only identity to the wire params.
 */
export class GatewayEventSourceRequiredError extends Error {
  constructor() {
    super('A backend-qualified gateway event source is required for this response.')
    this.name = 'GatewayEventSourceRequiredError'
  }
}

export class GatewayEventSourceEpochMismatchError extends Error {
  constructor() {
    super('The gateway event came from a stale socket generation.')
    this.name = 'GatewayEventSourceEpochMismatchError'
  }
}

export function requestForGatewayEventSource<T>(
  sourceRuntimeId: null | string | undefined,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<T> {
  let source

  try {
    source = sourceRuntimeId ? parseRendererRuntimeKey(sourceRuntimeId) : null
  } catch (error) {
    return Promise.reject(error)
  }

  if (!source) {
    return Promise.reject(new GatewayEventSourceRequiredError())
  }

  const { connectionId, gatewayEpoch, profile } = source.backend
  const currentGatewayEpoch = gatewayEpochForAgent(connectionId, profile)

  if (gatewayEpoch !== currentGatewayEpoch) {
    return Promise.reject(new GatewayEventSourceEpochMismatchError())
  }

  return requestGatewayForAgent<T>(connectionId, profile, method, params, timeoutMs, signal, currentGatewayEpoch).catch(
    error => {
      if (error instanceof GatewaySocketEpochMismatchError) {
        throw new GatewayEventSourceEpochMismatchError()
      }

      throw error
    }
  )
}
