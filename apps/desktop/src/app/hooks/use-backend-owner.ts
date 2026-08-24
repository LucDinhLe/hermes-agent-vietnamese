import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { type BackendOwner, connectionOwnerId } from '@/store/backend-owner'
import { $activeGatewayProfile, normalizeProfileKey } from '@/store/profile'
import { $connection } from '@/store/session'

/** The concrete backend/profile pair owning active Settings data. */
export function useActiveBackendOwner(): BackendOwner | null {
  const connection = useStore($connection)
  const profile = useStore($activeGatewayProfile)
  const connectionId = connectionOwnerId(connection)

  return useMemo(
    () => (connectionId ? { connectionId, profile: normalizeProfileKey(profile) } : null),
    [connectionId, profile]
  )
}
