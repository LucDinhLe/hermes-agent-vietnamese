import type { ComposerTarget } from '@/app/chat/composer/focus'
import { workspaceChatReturnRoute } from '@/app/routes'
import { resolveComposerSessionKey } from '@/store/session'
import { type SessionTile, sessionTileIdentity, sessionTileKey, sessionTileOwner } from '@/store/session-states'
import type { SessionInfo } from '@/types/hermes'

export interface MessagingReturnPlan {
  destinationDraftScope: string | null
  route: string
  sourceDraftScope: string | null
}

/**
 * Resolve Back from Messaging to the chat surface that owned focus before the
 * page covered the workspace. The composer focus bus deliberately retains a
 * hidden tile's target while no chat is visible, which gives us an exact,
 * non-heuristic return point even when the primary selection is different.
 */
export function messagingReturnPlan({
  composerTarget,
  selectedStoredSessionId,
  sessions,
  tiles
}: {
  composerTarget: ComposerTarget
  selectedStoredSessionId: string | null
  sessions: readonly SessionInfo[]
  tiles: readonly SessionTile[]
}): MessagingReturnPlan {
  const tileKey = composerTarget.startsWith('tile:') ? composerTarget.slice('tile:'.length) : null
  const tile = tileKey ? tiles.find(candidate => sessionTileKey(candidate) === tileKey) : undefined
  const returnSessionId = tile?.storedSessionId ?? selectedStoredSessionId
  const destinationDraftScope = resolveComposerSessionKey(returnSessionId, sessions)
  const owner = sessionTileOwner(tile)

  const sourceDraftScope =
    tile && owner && destinationDraftScope ? sessionTileIdentity(owner, destinationDraftScope) : null

  return {
    destinationDraftScope,
    route: workspaceChatReturnRoute(returnSessionId),
    sourceDraftScope
  }
}
