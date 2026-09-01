import { registryBackendScopeKey } from '@hermes/shared'
import { useCallback, useEffect, useRef } from 'react'

import type { GatewayEventPayload } from '@/lib/chat-messages'
import {
  approvalReplaySessionId,
  resolveGatewayEventSessionId,
  UNSCOPED_STREAM_EVENT_TYPES
} from '@/lib/gateway-events'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import { setSessionCompacting } from '@/store/compaction'
import { $gateway, activeGatewayConnectionId } from '@/store/gateway'
import { requestForGatewayEventSource } from '@/store/gateway-event-source'
import { $activeGatewayProfile, normalizeProfileKey } from '@/store/profile'
import { replayPendingApproval } from '@/store/prompts'
import { setSessionProviderWait } from '@/store/provider-wait'
import { setSessionDraftingTool } from '@/store/tool-drafting'
import type { RpcEvent } from '@/types/hermes'

import { createBackendKey } from '../../../session-binding-registry'

import { handleDesktopBridgeEvent } from './desktop-bridge'
import { handleInputRequestEvent } from './input-requests'
import { handleLifecycleEvent } from './lifecycle'
import { handleMessageStreamEvent } from './message-stream'
import { handleSessionInfoEvent } from './session-info'
import { handleStatusEvent } from './status'
import { handleToolEvent } from './tools'
import type { GatewayEventContext, GatewayEventDeps, GatewayEventHandler } from './types'

export type { GatewayEventDeps } from './types'

/**
 * Events that retire a "drafting a tool call" claim.
 *
 * `tool.generating` opens the claim and nothing closes it — a draft can be
 * abandoned without ever reaching `tool.start`, so enumerating the ways one
 * *ends* left the label on screen for the rest of the turn. Inverted: the
 * claim only covers what the model is emitting right now, and any other output
 * from the session proves it moved on. Same rule the TUI applies to its
 * transient trail lines (`turnController.pruneTransient`).
 */
const DRAFT_SUPERSEDING_EVENT_TYPES = new Set([
  'error',
  'message.complete',
  'message.delta',
  'message.start',
  'reasoning.delta',
  'thinking.delta',
  'tool.complete',
  'tool.progress',
  'tool.start'
])

const COMPACTION_RESUME_EVENT_TYPES = new Set([
  'message.delta',
  'message.interim',
  'thinking.delta',
  'reasoning.delta',
  'reasoning.available',
  'moa.reference',
  'moa.aggregating',
  'moa.progress',
  'moa.phase',
  'tool.start',
  'tool.progress',
  'tool.generating',
  'tool.complete'
])

const PROVIDER_WAIT_SUPERSEDING_EVENT_TYPES = new Set([
  'error',
  'message.complete',
  'message.delta',
  'message.interim',
  'message.start',
  'reasoning.available',
  'reasoning.delta',
  'tool.complete',
  'tool.generating',
  'tool.progress',
  'tool.start'
])

// These events block a backend caller until the renderer answers a raw
// request id. Unlike session RPCs, the response payload has no identity for a
// router to recover from, so an exact event source is mandatory. Never park a
// prompt against the active-session fallback: a later click would answer the
// foreground backend rather than the backend that is actually waiting.
const EVENT_SOURCE_REQUIRED_TYPES = new Set([
  'approval.request',
  'clarify.request',
  'mcp.setup.request',
  'preview.act.request',
  'preview.read.request',
  'secret.request',
  'sudo.request',
  'terminal.read.request',
  'tour.request',
  'window.read.request'
])

// Ordered family handlers; each consumes its own event types and reports
// whether it did, so dispatch stops at the first taker.
const HANDLERS: GatewayEventHandler[] = [
  handleLifecycleEvent,
  handleSessionInfoEvent,
  handleMessageStreamEvent,
  handleToolEvent,
  handleInputRequestEvent,
  handleDesktopBridgeEvent,
  handleStatusEvent
]

/** The gateway-event dispatcher, extracted from useMessageStream. */
export function useGatewayEventHandler(deps: GatewayEventDeps) {
  const { activeSessionIdRef, compactedTurnRef, refreshHermesConfig, sessionStateByRuntimeIdRef } = deps

  const unscopedStreamSessionIdRef = useRef<string | null>(null)

  // session.info arrives in bursts (agent build ready + turn end + title /
  // MCP / compress edges within the same second). Each used to fire its own
  // refreshHermesConfig — two REST calls (config + defaults) per event, per
  // turn, including for BACKGROUND sessions whose values the fetch can't even
  // apply. Coalesce to one trailing fetch per burst; the caller gates on
  // `apply` so background traffic doesn't schedule anything.
  const configRefreshTimerRef = useRef<null | number>(null)

  const scheduleConfigRefresh = useCallback(() => {
    if (configRefreshTimerRef.current !== null) {
      return
    }

    if (typeof window === 'undefined') {
      void refreshHermesConfig()

      return
    }

    configRefreshTimerRef.current = window.setTimeout(() => {
      configRefreshTimerRef.current = null
      void refreshHermesConfig()
    }, 300)
  }, [refreshHermesConfig])

  useEffect(
    () => () => {
      if (configRefreshTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(configRefreshTimerRef.current)
        configRefreshTimerRef.current = null
      }
    },
    []
  )

  return useCallback(
    (event: RpcEvent) => {
      const payload = event.payload as GatewayEventPayload | undefined

      // "From the active profile" must mean "from the active SOURCE": every
      // registered connection exposes a 'default' profile, so a bare profile
      // comparison attributes gateway B's 'default' events to gateway A's
      // 'default'. Compare the composite (connectionId, profile) scope with
      // registryBackendScopeKey — untagged primary events keep the legacy
      // bare-profile behavior byte-identical.
      const eventProfile = event.profile?.trim()

      const eventBackend =
        eventProfile && typeof event.gatewayEpoch === 'number'
          ? createBackendKey({
              connectionId: event.connectionId?.trim() || null,
              gatewayEpoch: event.gatewayEpoch,
              profile: eventProfile
            })
          : null

      const fromActiveSource = (): boolean =>
        Boolean(
          eventBackend &&
          normalizeProfileKey(eventBackend.profile) === normalizeProfileKey($activeGatewayProfile.get()) &&
          registryBackendScopeKey(eventBackend.connectionId, eventBackend.profile) ===
            registryBackendScopeKey(activeGatewayConnectionId(), eventBackend.profile)
        )

      const occurredAt =
        typeof payload?.timestamp === 'number' && Number.isFinite(payload.timestamp)
          ? payload.timestamp
          : Date.now() / 1000

      const rawExplicitSid = event.session_id || ''

      // Every production gateway fan-in stamps profile (and connectionId for
      // registry sources). A scoped event without that owner is ambiguous and
      // must not mutate whichever raw runtime happens to share its id.
      if (deps.qualifyRuntimeIds && rawExplicitSid && !eventBackend) {
        return
      }

      const explicitSid =
        deps.qualifyRuntimeIds && rawExplicitSid && eventBackend
          ? rendererRuntimeKey(eventBackend, rawExplicitSid)
          : rawExplicitSid

      if (EVENT_SOURCE_REQUIRED_TYPES.has(event.type) && !explicitSid) {
        return
      }

      const route = resolveGatewayEventSessionId({
        activeSessionId: activeSessionIdRef.current,
        eventType: event.type,
        explicitSessionId: explicitSid,
        unscopedStreamSessionId: unscopedStreamSessionIdRef.current
      })

      unscopedStreamSessionIdRef.current = route.nextUnscopedStreamSessionId

      if (route.drop) {
        return
      }

      const sessionId = route.sessionId

      const requestEventSource = <T>(
        method: string,
        params: Record<string, unknown> = {},
        timeoutMs?: number,
        signal?: AbortSignal
      ): Promise<T> => {
        const sourceRuntimeId = deps.qualifyRuntimeIds ? explicitSid || null : null

        return timeoutMs === undefined && signal === undefined
          ? requestForGatewayEventSource<T>(sourceRuntimeId, method, params)
          : requestForGatewayEventSource<T>(sourceRuntimeId, method, params, timeoutMs, signal)
      }

      // Late stragglers: an unscoped stream event attributed via the
      // active-session fallback (no pin) to a session that has no live turn
      // belongs to a turn that already ended elsewhere. Dropping it keeps the
      // previous session's tail events (a delayed `thinking.delta` or
      // `status.update`) from landing in a freshly opened chat (#43142 family:
      // busy/streaming UI inherited when switching sessions).
      if (
        sessionId &&
        !explicitSid &&
        !route.pinned &&
        event.type &&
        event.type !== 'message.start' &&
        UNSCOPED_STREAM_EVENT_TYPES.has(event.type)
      ) {
        const state = sessionStateByRuntimeIdRef.current.get(sessionId)

        const hasLiveTurn = Boolean(
          state && (state.awaitingResponse || state.busy || state.streamId || state.sawAssistantPayload)
        )

        if (!hasLiveTurn) {
          return
        }
      }

      const isActiveEvent = !!sessionId && sessionId === activeSessionIdRef.current

      const replaySessionId = approvalReplaySessionId(event.type, activeSessionIdRef.current, sessionId, eventBackend)

      if (replaySessionId) {
        void replayPendingApproval($gateway.get(), replaySessionId).catch(() => undefined)
      }

      // Mid-turn compaction does not emit another message.start. The first
      // model output or tool event proves summarization has finished and the
      // turn has resumed, so retire the phase label without waiting for the
      // whole turn to complete.
      if (sessionId && COMPACTION_RESUME_EVENT_TYPES.has(event.type) && compactedTurnRef.current.has(sessionId)) {
        setSessionCompacting(sessionId, false)
      }

      if (sessionId && DRAFT_SUPERSEDING_EVENT_TYPES.has(event.type)) {
        setSessionDraftingTool(sessionId, '')
      }

      if (sessionId && PROVIDER_WAIT_SUPERSEDING_EVENT_TYPES.has(event.type)) {
        setSessionProviderWait(sessionId, '')
      }

      const ctx: GatewayEventContext = {
        deps,
        event,
        payload,
        sessionId,
        explicitSid,
        requestEventSource,
        isActiveEvent,
        occurredAt,
        fromActiveSource,
        scheduleConfigRefresh
      }

      for (const handler of HANDLERS) {
        if (handler(ctx)) {
          return
        }
      }
    },
    // The deps object is rebuilt by the caller each render, but every field it
    // carries is stable (refs, useCallback-wrapped fns, queryClient), so
    // depending on the individual fields keeps the handler identity stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      deps.appendAssistantDelta,
      deps.appendReasoningDelta,
      deps.activeSessionIdRef,
      deps.activeGatewayProfile,
      deps.compactedTurnRef,
      deps.completeAssistantMessage,
      deps.failAssistantMessage,
      deps.finalizeInterimAssistantMessage,
      deps.flushQueuedDeltas,
      deps.hydrateFromStoredSession,
      deps.lastCwdInfoSessionRef,
      deps.nativeSubagentSessionsRef,
      deps.queryClient,
      deps.qualifyRuntimeIds,
      scheduleConfigRefresh,
      deps.scheduleSessionsRefresh,
      deps.runtimeIdByStoredSessionIdRef,
      deps.sessionBindingRegistry,
      deps.sessionInterrupted,
      deps.sessionStateByRuntimeIdRef,
      deps.updateSessionState,
      deps.upsertToolCall
    ]
  )
}
