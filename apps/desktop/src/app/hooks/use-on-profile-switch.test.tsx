import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesConnection } from '@/global'
import { $activeGatewayProfile } from '@/store/profile'
import { $connection } from '@/store/session'

import { useOnProfileSwitch } from './use-on-profile-switch'

function Probe({ onSwitch }: { onSwitch: () => void }) {
  useOnProfileSwitch(onSwitch)

  return null
}

describe('useOnProfileSwitch', () => {
  beforeEach(() => {
    $activeGatewayProfile.set('default')
    $connection.set({ connectionId: 'source-a', mode: 'remote', profile: 'default' } as HermesConnection)
  })

  it('fires when the connection changes while the profile name stays the same', async () => {
    const onSwitch = vi.fn()
    render(<Probe onSwitch={onSwitch} />)

    expect(onSwitch).not.toHaveBeenCalled()
    $connection.set({ connectionId: 'source-b', mode: 'remote', profile: 'default' } as HermesConnection)

    await waitFor(() => expect(onSwitch).toHaveBeenCalledTimes(1))
  })
})
