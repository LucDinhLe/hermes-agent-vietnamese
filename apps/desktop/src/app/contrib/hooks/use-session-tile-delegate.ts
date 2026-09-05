import { useEffect } from 'react'

import { getLatestSessionMessages, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '@/hermes'
import { toChatMessages } from '@/lib/chat-messages'
import { requestGatewayForAgent } from '@/store/gateway'
import {
  publishSessionState,
  recordSessionRuntimeOwner,
  sessionConnectionId,
  sessionEventProfile,
  type SessionTileOwner,
  setSessionTileDelegate
} from '@/store/session-states'
import type { SessionResumeResponse } from '@/types/hermes'

import type { usePromptActions } from '../../session/hooks/use-prompt-actions'
import { markSessionRecentlyInterrupted, withSessionNotFoundResume } from '../../session/hooks/use-prompt-actions/utils'
import type { useSessionStateCache } from '../../session/hooks/use-session-state-cache'
import type { GatewayRequester } from '../types'

type SessionStateCache = ReturnType<typeof useSessionStateCache>

interface SessionTileDelegateParams {
  archiveSession: (storedSessionId: string, owner?: SessionTileOwner) => Promise<unknown>
  branchStoredSession: (
    storedSessionId: string,
    sessionProfile?: string | null,
    owner?: SessionTileOwner
  ) => Promise<unknown>
  executeSlashCommand: ReturnType<typeof usePromptActions>['executeSlashCommand']
  removeSession: (storedSessionId: string, owner?: SessionTileOwner) => Promise<unknown>
  requestGateway: GatewayRequester
  runtimeIdByStoredSessionIdRef: SessionStateCache['runtimeIdByStoredSessionIdRef']
  sessionStateByRuntimeIdRef: SessionStateCache['sessionStateByRuntimeIdRef']
  updateSessionState: SessionStateCache['updateSessionState']
}

/**
 * Publishes the session-tile delegate: resume / submit / interrupt / slash for
 * tiled sessions WITHOUT touching the primary view ($activeSessionId /
 * $messages stay the main thread's). Resume reuses a live runtime binding when
 * one exists (incl. the main thread's own session); a cold tile binds +
 * hydrates the cache, which publishSessionState mirrors to the tile.
 */
export function useSessionTileDelegate({
  archiveSession,
  branchStoredSession,
  executeSlashCommand,
  removeSession,
  requestGateway,
  runtimeIdByStoredSessionIdRef,
  sessionStateByRuntimeIdRef,
  updateSessionState
}: SessionTileDelegateParams): void {
  useEffect(() => {
    const runtimeIdByTileKey = new Map<string, string>()

    const tileKey = (storedSessionId: string, owner: SessionTileOwner) =>
      `${owner.connectionId}\u0000${owner.profile}\u0000${storedSessionId}`

    const requestForOwner = (owner: SessionTileOwner): GatewayRequester =>
      (<T>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number, signal?: AbortSignal) =>
        requestGatewayForAgent<T>(
          owner.connectionId,
          owner.profile,
          method,
          params,
          timeoutMs,
          signal
        )) as GatewayRequester

    // A tile's runtime binding can die the same way the foreground's does
    // (sleep/wake, backend restart). The cache maps stored -> runtime, so walk
    // it backwards to find the durable id this runtime belongs to.
    const storedSessionIdForRuntime = (runtimeId: string): null | string => {
      const cached = sessionStateByRuntimeIdRef.current.get(runtimeId)?.storedSessionId

      if (cached) {
        return cached
      }

      for (const [storedId, mapped] of runtimeIdByStoredSessionIdRef.current) {
        if (mapped === runtimeId) {
          return storedId
        }
      }

      return null
    }

    // Repoint the stored -> runtime mapping at the recovered id so subsequent
    // tile actions use the live binding instead of re-recovering every call.
    const rebindTileRuntime = (deadRuntimeId: string, owner: SessionTileOwner) => (recoveredId: string) => {
      const storedId = storedSessionIdForRuntime(deadRuntimeId)

      if (storedId) {
        runtimeIdByStoredSessionIdRef.current.set(storedId, recoveredId)
        runtimeIdByTileKey.set(tileKey(storedId, owner), recoveredId)
      }

      recordSessionRuntimeOwner(recoveredId, owner)
    }

    setSessionTileDelegate({
      archiveSession: async (storedSessionId, owner) => {
        await archiveSession(storedSessionId, owner)
      },
      branchSession: async (storedSessionId, owner) => {
        await branchStoredSession(storedSessionId, owner.profile, owner)
      },
      deleteSession: async (storedSessionId, owner) => {
        await removeSession(storedSessionId, owner)
      },
      executeSlash: async (rawCommand, sessionId, owner) => {
        await executeSlashCommand(rawCommand, {
          connectionId: owner.connectionId,
          profile: owner.profile,
          remote: owner.connectionId !== 'local',
          requestGateway: requestForOwner(owner),
          sessionId
        })
      },
      // Gateway reconnect (sleep/wake, backend respawn): every stored→runtime
      // binding recorded pre-reconnect points at a runtime id the respawned
      // backend no longer knows. Drop the map so resumeTile's warm path can't
      // re-bind a tile to a dead runtime; live bindings re-record from
      // post-reconnect events and fresh resumes.
      invalidateRuntimeBindings: () => {
        runtimeIdByStoredSessionIdRef.current.clear()
        runtimeIdByTileKey.clear()
      },
      interruptSession: async (runtimeId, owner) => {
        const ownerRequest = requestForOwner(owner)
        // Same cooldown as the primary chat's Stop (#83855): the gateway may
        // still be winding down after this interrupt, so a quick edit/resend
        // on the tile must go interrupt-first even though busy already reads
        // false. Mark the runtime id (and any recovered id) before the RPC so
        // the window covers the whole wind-down.
        markSessionRecentlyInterrupted(runtimeId)
        await withSessionNotFoundResume(
          runtimeId,
          storedSessionIdForRuntime(runtimeId),
          liveId => ownerRequest('session.interrupt', { session_id: liveId }),
          {
            requestGateway: ownerRequest,
            onRecovered: recoveredId => {
              markSessionRecentlyInterrupted(recoveredId)
              rebindTileRuntime(runtimeId, owner)(recoveredId)
            }
          }
        )
      },
      resumeTile: async (storedSessionId, owner) => {
        const ownerRequest = requestForOwner(owner)
        const exactKey = tileKey(storedSessionId, owner)
        const sharedRuntime = runtimeIdByStoredSessionIdRef.current.get(storedSessionId)

        const sharedRuntimeMatchesOwner = Boolean(
          sharedRuntime &&
          sessionConnectionId(sharedRuntime) === owner.connectionId &&
          sessionEventProfile(sharedRuntime) === owner.profile
        )

        const existing = runtimeIdByTileKey.get(exactKey) ?? (sharedRuntimeMatchesOwner ? sharedRuntime : undefined)
        const cached = existing ? sessionStateByRuntimeIdRef.current.get(existing) : undefined

        // Warm path: reuse a live binding — but only when it still carries a
        // transcript (or is mid-turn, where messages legitimately stream in).
        // A binding whose cached state has no messages is either a released
        // transcript or a stale pre-reconnect survivor; reusing it painted the
        // post-sleep/wake tile permanently empty. Fall through to a real
        // resume instead — it's idempotent for a genuinely live session.
        if (existing && cached?.storedSessionId === storedSessionId && (cached.busy || cached.messages.length > 0)) {
          publishSessionState(existing, cached)

          return existing
        }

        const [prefetch, resumed] = await Promise.all([
          getLatestSessionMessages(storedSessionId, owner.profile, owner.connectionId).catch(() => null),
          ownerRequest<SessionResumeResponse>('session.resume', {
            session_id: storedSessionId,
            cols: 96,
            omit_messages: true,
            profile: owner.profile
          })
        ])

        const runtimeId = resumed?.session_id

        if (!runtimeId) {
          throw new Error('resume returned no session id')
        }

        runtimeIdByTileKey.set(exactKey, runtimeId)
        runtimeIdByStoredSessionIdRef.current.set(storedSessionId, runtimeId)
        recordSessionRuntimeOwner(runtimeId, owner)

        updateSessionState(
          runtimeId,
          state => ({
            ...state,
            busy: Boolean(resumed?.info?.running),
            messages:
              state.messages.length > 0 ? state.messages : toChatMessages(prefetch?.messages ?? resumed?.messages ?? [])
          }),
          storedSessionId
        )

        return runtimeId
      },
      submitToSession: async (runtimeId, text, owner) => {
        const ownerRequest = requestForOwner(owner)
        await withSessionNotFoundResume(
          runtimeId,
          storedSessionIdForRuntime(runtimeId),
          liveId => ownerRequest('prompt.submit', { session_id: liveId, text }, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS),
          { requestGateway: ownerRequest, onRecovered: rebindTileRuntime(runtimeId, owner) }
        )
      },
      updateSession: (runtimeId, updater) => updateSessionState(runtimeId, updater)
    })
  }, [
    archiveSession,
    branchStoredSession,
    executeSlashCommand,
    removeSession,
    requestGateway,
    runtimeIdByStoredSessionIdRef,
    sessionStateByRuntimeIdRef,
    updateSessionState
  ])
}
