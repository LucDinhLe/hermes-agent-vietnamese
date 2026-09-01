import type { QueryClient } from '@tanstack/react-query'
import type { MutableRefObject } from 'react'

import type { GatewayEventPayload } from '@/lib/chat-messages'
import type { RpcEvent } from '@/types/hermes'

import type { ClientSessionState } from '../../../../types'
import type { SessionBindingRegistry } from '../../../session-binding-registry'

export interface GatewayEventDeps {
  activeGatewayProfile: string
  activeSessionIdRef: MutableRefObject<string | null>
  compactedTurnRef: MutableRefObject<Set<string>>
  lastCwdInfoSessionRef: MutableRefObject<string | null>
  nativeSubagentSessionsRef: MutableRefObject<Set<string>>
  appendAssistantDelta: (sessionId: string, delta: string, occurredAt?: number) => void
  appendReasoningDelta: (sessionId: string, delta: string, replace?: boolean, occurredAt?: number) => void
  completeAssistantMessage: (
    sessionId: string,
    text: string,
    responsePreviewed?: boolean,
    failure?: { error: string; partial: boolean },
    occurredAt?: number
  ) => void
  failAssistantMessage: (sessionId: string, errorMessage: string, occurredAt?: number) => void
  flushQueuedDeltas: (sessionId?: string) => void
  finalizeInterimAssistantMessage: (sessionId: string, text: string, occurredAt?: number) => void
  hydrateFromStoredSession: (
    attempts?: number,
    storedSessionId?: string | null,
    runtimeSessionId?: string | null
  ) => Promise<void>
  queryClient: QueryClient
  qualifyRuntimeIds: boolean
  refreshHermesConfig: () => Promise<void>
  runtimeIdByStoredSessionIdRef: MutableRefObject<Map<string, string>>
  scheduleSessionsRefresh: () => void
  sessionBindingRegistry: SessionBindingRegistry
  sessionInterrupted: (sessionId: string) => boolean
  sessionStateByRuntimeIdRef: MutableRefObject<Map<string, ClientSessionState>>
  updateSessionState: (
    sessionId: string,
    updater: (state: ClientSessionState) => ClientSessionState,
    storedSessionId?: string | null
  ) => ClientSessionState
  upsertToolCall: (
    sessionId: string,
    payload: GatewayEventPayload | undefined,
    phase: 'running' | 'complete',
    sourceEventType?: string,
    occurredAt?: number
  ) => void
}

/** Everything a per-family handler needs about the event being dispatched —
 *  the routing preamble in index.ts computes it once per event. */
export interface GatewayEventContext {
  deps: GatewayEventDeps
  event: RpcEvent
  payload: GatewayEventPayload | undefined
  /** Routed session id (explicit, pinned unscoped stream, or active fallback). */
  sessionId: null | string
  /** Backend-qualified renderer id on the event ('' when unscoped). */
  explicitSid: string
  /**
   * Answer a request-id-only event on the exact backend socket that emitted
   * it. This never consults the ambient/active gateway and fails closed when
   * the event did not carry a backend-qualified runtime identity.
   */
  requestEventSource: <T>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
    signal?: AbortSignal
  ) => Promise<T>
  /** The routed session is the one on screen. */
  isActiveEvent: boolean
  /** Event timestamp in epoch seconds (payload timestamp or receipt time). */
  occurredAt: number
  /** The event came from the active (connection, profile) source. */
  fromActiveSource: () => boolean
  /** Coalesced trailing refreshHermesConfig (one per session.info burst). */
  scheduleConfigRefresh: () => void
}

/** A family handler consumes matching event types and reports whether it did. */
export type GatewayEventHandler = (ctx: GatewayEventContext) => boolean
