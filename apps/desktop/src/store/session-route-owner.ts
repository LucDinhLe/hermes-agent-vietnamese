import type { SessionInfo } from '@/types/hermes'

export interface SessionRouteOwner {
  connectionId: null | string
  profile: string
}

const ownerByStoredSessionId = new Map<string, SessionRouteOwner>()
let stagedOwner: null | { owner: SessionRouteOwner; storedSessionId: string } = null

function normalizeOwner(owner: SessionRouteOwner | null | undefined): SessionRouteOwner | null {
  if (!owner) {
    return null
  }

  const profile = owner.profile?.trim()

  if (!profile) {
    return null
  }

  const rawConnectionId = owner.connectionId?.trim() || ''

  return {
    connectionId: !rawConnectionId || rawConnectionId === 'local' ? null : rawConnectionId,
    profile
  }
}

export function explicitSessionRouteOwner(
  session: Pick<SessionInfo, 'connection_id' | 'profile'>
): SessionRouteOwner | undefined {
  const profile = session.profile?.trim()

  return profile
    ? { connectionId: session.connection_id?.trim() || null, profile }
    : undefined
}

/** Stable renderer-list identity. A raw durable id is only unique inside its
 * exact backend owner and is unsafe as a React key in aggregated lists. */
export function sessionRouteKey(
  session: Pick<SessionInfo, 'connection_id' | 'id' | 'profile'>
): string {
  const owner = explicitSessionRouteOwner(session)

  return `${owner?.connectionId ?? 'local'}\u0000${owner?.profile ?? ''}\u0000${session.id}`
}

/** Stage the owner carried by a rendered row before its legacy id-only resume
 * callback synchronously enters `openSession`. */
export function stageSessionRouteOwner(storedSessionId: string, owner: SessionRouteOwner): void {
  const exactOwner = normalizeOwner(owner)

  stagedOwner = storedSessionId && exactOwner ? { owner: exactOwner, storedSessionId } : null
}

/** Record one route intent. An explicit owner wins; otherwise a synchronously
 * staged row owner is consumed. A truly raw/id-only open clears stale state. */
export function recordSessionRouteOwner(
  storedSessionId: string,
  owner?: SessionRouteOwner | null
): SessionRouteOwner | undefined {
  const explicitOwner = normalizeOwner(owner)
  const staged = stagedOwner?.storedSessionId === storedSessionId ? stagedOwner.owner : null
  const exactOwner = explicitOwner ?? staged

  stagedOwner = null

  if (!storedSessionId || !exactOwner) {
    ownerByStoredSessionId.delete(storedSessionId)

    return undefined
  }

  ownerByStoredSessionId.set(storedSessionId, exactOwner)

  return exactOwner
}

export function sessionRouteOwner(storedSessionId: null | string): SessionRouteOwner | undefined {
  return storedSessionId ? ownerByStoredSessionId.get(storedSessionId) : undefined
}

/** @internal Test/reset seam. */
export function clearSessionRouteOwners(): void {
  ownerByStoredSessionId.clear()
  stagedOwner = null
}
