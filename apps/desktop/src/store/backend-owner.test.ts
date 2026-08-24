import { beforeEach, describe, expect, it } from 'vitest'

import type { HermesConnection } from '@/global'

import { activeBackendOwner, backendOwnerKey, sessionBackendOwner } from './backend-owner'
import { $activeGatewayProfile } from './profile'
import { $connection } from './session'
import { clearAllSessionStates, recordSessionEventScope } from './session-states'

describe('backend owner capture', () => {
  beforeEach(() => {
    clearAllSessionStates()
    $activeGatewayProfile.set('default')
    $connection.set(null)
  })

  it('keeps explicit local distinct from a registered remote primary', () => {
    $connection.set({ connectionId: 'remote-primary', mode: 'remote', profile: 'writer' } as HermesConnection)
    $activeGatewayProfile.set('writer')
    expect(activeBackendOwner()).toEqual({ connectionId: 'remote-primary', profile: 'writer' })

    $connection.set({ mode: 'local', profile: 'writer' } as HermesConnection)
    expect(activeBackendOwner()).toEqual({ connectionId: 'local', profile: 'writer' })
  })

  it('resolves background sessions independently of the active source', () => {
    recordSessionEventScope({ connectionId: 'source-a', profile: 'researcher', session_id: 'runtime-a' })
    $connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'researcher' } as HermesConnection)
    $activeGatewayProfile.set('researcher')

    const owner = sessionBackendOwner('runtime-a')
    expect(owner).toEqual({ connectionId: 'source-a', profile: 'researcher' })
    expect(backendOwnerKey(owner!)).toBe('source-a::researcher')
  })
})
