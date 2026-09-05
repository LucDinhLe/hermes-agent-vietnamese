import type { HermesConnection } from '@/global'

import { $activeGatewayProfile, normalizeProfileKey } from './profile'
import { $connection } from './session'
import { sessionConnectionId, sessionEventProfile } from './session-states'

export interface BackendOwner {
  connectionId: string
  profile: string
}

export function connectionOwnerId(connection: HermesConnection | null | undefined): string | null {
  const explicit = connection?.connectionId?.trim()

  if (explicit) {
    return explicit
  }

  return connection?.mode === 'local' ? 'local' : null
}

export function activeBackendOwner(): BackendOwner | null {
  const connectionId = connectionOwnerId($connection.get())

  return connectionId ? { connectionId, profile: normalizeProfileKey($activeGatewayProfile.get()) } : null
}

export function sessionBackendOwner(runtimeId: null | string | undefined): BackendOwner | null {
  if (!runtimeId) {
    return activeBackendOwner()
  }

  const connectionId = sessionConnectionId(runtimeId)
  const profile = sessionEventProfile(runtimeId)

  return connectionId && profile ? { connectionId, profile: normalizeProfileKey(profile) } : null
}

export function backendOwnerKey(owner: BackendOwner): string {
  return `${owner.connectionId}::${owner.profile}`
}

export function sameBackendOwner(left: BackendOwner | null, right: BackendOwner | null): boolean {
  return Boolean(left && right && left.connectionId === right.connectionId && left.profile === right.profile)
}
