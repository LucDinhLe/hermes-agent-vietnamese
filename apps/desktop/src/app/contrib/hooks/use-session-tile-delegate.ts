import { useEffect } from 'react'

import { getLatestSessionMessagesForOwner, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '@/hermes'
import { toChatMessages } from '@/lib/chat-messages'
import {
  $sessionTiles,
  type ProvisionalSessionTile,
  publishSessionState,
  setSessionTileDelegate
} from '@/store/session-states'
import type { SessionResumeResponse } from '@/types/hermes'

import type { usePromptActions } from '../../session/hooks/use-prompt-actions'
import { markSessionRecentlyInterrupted, withSessionNotFoundResume } from '../../session/hooks/use-prompt-actions/utils'
import type { useSessionStateCache } from '../../session/hooks/use-session-state-cache'
import type { GatewayRequester } from '../types'

type SessionStateCache = ReturnType<typeof useSessionStateCache>

interface SessionTileDelegateParams {
  archiveSession: (storedSessionId: string) => Promise<unknown>
  bindSessionRuntime: (storedSessionId: string, runtimeSessionId: string) => null | string
  branchStoredSession: (storedSessionId: string) => Promise<unknown>
  createProvisionalTileRuntime: (tile: ProvisionalSessionTile) => Promise<string>
  executeSlashCommand: ReturnType<typeof usePromptActions>['executeSlashCommand']
  getRuntimeIdForStoredSession: (storedSessionId: string) => null | string
  getStoredSessionIdForRuntime: (runtimeSessionId: string) => null | string
  invalidateSessionRuntimeBinding: (storedSessionId: string, runtimeSessionId: string) => void
  removeSession: (storedSessionId: string) => Promise<unknown>
  requestForStoredSession: <T>(
    storedSessionId: string,
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number
  ) => Promise<T>
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
  bindSessionRuntime,
  branchStoredSession,
  createProvisionalTileRuntime,
  executeSlashCommand,
  getRuntimeIdForStoredSession,
  getStoredSessionIdForRuntime,
  invalidateSessionRuntimeBinding,
  removeSession,
  requestForStoredSession,
  runtimeIdByStoredSessionIdRef,
  sessionStateByRuntimeIdRef,
  updateSessionState
}: SessionTileDelegateParams): void {
  useEffect(() => {
    const requestForStoredTile = <T,>(
      storedSessionId: null | string,
      method: string,
      params: Record<string, unknown> = {},
      timeoutMs?: number
    ): Promise<T> => {
      if (!storedSessionId) {
        return Promise.reject(new Error(`Cannot route ${method}: tile has no durable session owner`))
      }

      return requestForStoredSession<T>(storedSessionId, method, params, timeoutMs)
    }
    const resolveTileProfile = async (storedSessionId: string): Promise<string | undefined> =>
      $sessionTiles
        .get()
        .find(tile => tile.storedSessionId === storedSessionId)
        ?.owner?.profile?.trim() || undefined

    // A tile's runtime binding can die the same way the foreground's does
    // (sleep/wake, backend restart). Prefer the state slice, then reverse the
    // backend-qualified runtime through the binding registry. The stored →
    // runtime cache is keyed by rendererDurableKey, so treating that map key
    // as a raw durable id would leak `hermes-durable-v1:*` into DB/RPC lookup.
    const storedSessionIdForRuntime = (runtimeId: string): null | string => {
      const cached = sessionStateByRuntimeIdRef.current.get(runtimeId)?.storedSessionId

      if (cached) {
        return cached
      }

      return getStoredSessionIdForRuntime(runtimeId)
    }

    // Repoint the stored -> runtime mapping at the recovered id so subsequent
    // tile actions use the live binding instead of re-recovering every call.
    const rebindTileRuntime = (deadRuntimeId: string) => (recoveredId: string) => {
      const storedId = storedSessionIdForRuntime(deadRuntimeId)

      if (!storedId) {
        throw new Error('Recovered tile runtime has no durable session owner.')
      }

      const rendererRuntimeId = bindSessionRuntime(storedId, recoveredId)

      if (!rendererRuntimeId) {
        throw new Error('Recovered tile runtime could not be bound to its exact owner.')
      }

      return rendererRuntimeId
    }

    setSessionTileDelegate({
      archiveSession: async storedSessionId => {
        await archiveSession(storedSessionId)
      },
      branchSession: async storedSessionId => {
        await branchStoredSession(storedSessionId)
      },
      bindSessionRuntime,
      createProvisionalRuntime: createProvisionalTileRuntime,
      deleteSession: async storedSessionId => {
        await removeSession(storedSessionId)
      },
      executeSlash: async (rawCommand, sessionId) => {
        await executeSlashCommand(rawCommand, { sessionId })
      },
      // Gateway reconnect (sleep/wake, backend respawn): every stored→runtime
      // binding recorded pre-reconnect points at a runtime id the respawned
      // backend no longer knows. Drop the map so resumeTile's warm path can't
      // re-bind a tile to a dead runtime; live bindings re-record from
      // post-reconnect events and fresh resumes.
      invalidateRuntimeBindings: () => {
        runtimeIdByStoredSessionIdRef.current.clear()
      },
      invalidateSessionRuntimeBinding,
      interruptSession: async runtimeId => {
        // Same cooldown as the primary chat's Stop (#83855): the gateway may
        // still be winding down after this interrupt, so a quick edit/resend
        // on the tile must go interrupt-first even though busy already reads
        // false. Mark the runtime id (and any recovered id) before the RPC so
        // the window covers the whole wind-down.
        markSessionRecentlyInterrupted(runtimeId)
        const storedSessionId = storedSessionIdForRuntime(runtimeId)
        const requestTile: GatewayRequester = (method, params, timeoutMs) =>
          requestForStoredTile(storedSessionId, method, params, timeoutMs)

        await withSessionNotFoundResume(
          runtimeId,
          storedSessionId,
          liveId => requestTile('session.interrupt', { session_id: liveId }),
          {
            requestGateway: requestTile,
            onRecovered: recoveredId => {
              const rendererRuntimeId = rebindTileRuntime(runtimeId)(recoveredId)

              markSessionRecentlyInterrupted(rendererRuntimeId)

              return rendererRuntimeId
            },
            resolveProfile: resolveTileProfile
          }
        )
      },
      resumeTile: async storedSessionId => {
        const existing = getRuntimeIdForStoredSession(storedSessionId)
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

        // Resolve the owning profile before binding a runtime. A tile can open a
        // session from any profile, not just the active one; resuming (or
        // reading messages) without a profile lets the gateway fall back to the
        // launch-profile DB and fork the conversation into the wrong profile —
        // the same cross-profile bleed the recovery resumes had (#67603).
        const owner = $sessionTiles.get().find(tile => tile.storedSessionId === storedSessionId)?.owner

        if (!owner) {
          throw new Error('Cannot resume tile: durable session owner is unresolved')
        }

        const [prefetch, resumed] = await Promise.all([
          getLatestSessionMessagesForOwner(storedSessionId, owner).catch(() => null),
          requestForStoredTile<SessionResumeResponse>(storedSessionId, 'session.resume', {
            session_id: storedSessionId,
            cols: 96,
            omit_messages: true,
            profile: owner.profile
          })
        ])

        const rawRuntimeId = resumed?.session_id

        if (!rawRuntimeId) {
          throw new Error('resume returned no session id')
        }

        const runtimeId = bindSessionRuntime(storedSessionId, rawRuntimeId)

        if (!runtimeId) {
          throw new Error('resume returned a runtime without an exact durable owner')
        }

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
      submitToSession: async (runtimeId, text) => {
        const storedSessionId = storedSessionIdForRuntime(runtimeId)
        const requestTile: GatewayRequester = (method, params, timeoutMs) =>
          requestForStoredTile(storedSessionId, method, params, timeoutMs)

        await withSessionNotFoundResume(
          runtimeId,
          storedSessionId,
          liveId => requestTile('prompt.submit', { session_id: liveId, text }, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS),
          {
            requestGateway: requestTile,
            onRecovered: rebindTileRuntime(runtimeId),
            resolveProfile: resolveTileProfile
          }
        )
      },
      updateSession: (runtimeId, updater) => updateSessionState(runtimeId, updater)
    })
  }, [
    archiveSession,
    bindSessionRuntime,
    branchStoredSession,
    createProvisionalTileRuntime,
    executeSlashCommand,
    getRuntimeIdForStoredSession,
    getStoredSessionIdForRuntime,
    invalidateSessionRuntimeBinding,
    removeSession,
    requestForStoredSession,
    runtimeIdByStoredSessionIdRef,
    sessionStateByRuntimeIdRef,
    updateSessionState
  ])
}
