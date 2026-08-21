import type { BackendOwner } from '@/store/backend-owner'

export function settingsBackendOwnerKey(owner: BackendOwner): string {
  return `${owner.connectionId}::${owner.profile}`
}

/** Keep a captured source while allowing Settings' profile override. */
export function scopedBackendOwner(owner: BackendOwner | null, profile?: null | string): BackendOwner | null {
  if (!owner) {
    return null
  }

  const normalized = profile?.trim() || owner.profile

  return normalized === owner.profile ? owner : { ...owner, profile: normalized }
}
