import { useCallback, useLayoutEffect, useRef } from 'react'

import type { BackendOwner } from '@/store/backend-owner'

import { settingsBackendOwnerKey } from './backend-owner-scope'

/** Ignore async completions after their backend/profile owner changes. */
export function useBackendOwnerGuard(owner: BackendOwner | null): () => boolean {
  const key = owner ? settingsBackendOwnerKey(owner) : '__ambient__'
  const currentKeyRef = useRef<null | string>(null)

  useLayoutEffect(() => {
    currentKeyRef.current = key

    return () => {
      if (currentKeyRef.current === key) {
        currentKeyRef.current = null
      }
    }
  }, [key])

  return useCallback(() => currentKeyRef.current === key, [key])
}
