import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { $activeGatewayProfile } from '@/store/profile'
import { $connection } from '@/store/session'

/** Run `onSwitch` when the active gateway source or profile changes — never on first
 *  mount. For dropping per-profile view state (probes, cached usage, drafts)
 *  when the backend the app talks to swaps underneath a still-mounted view. */
export function useOnProfileSwitch(onSwitch: () => void): void {
  const profile = useStore($activeGatewayProfile)
  const connection = useStore($connection)
  const source = connection?.connectionId?.trim() || (connection?.mode === 'local' ? 'local' : '')
  const first = useRef(true)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (first.current) {
      first.current = false

      return
    }

    onSwitch()
    // Fire on backend-owner change only; onSwitch identity is intentionally ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, source])
}
