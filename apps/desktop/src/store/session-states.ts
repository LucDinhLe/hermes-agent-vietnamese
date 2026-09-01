/**
 * MULTI-SESSION VIEW STATE — the reactive face of the per-runtime session
 * cache (`sessionStateByRuntimeIdRef` in use-session-state-cache).
 *
 * The cache already ingests EVERY session's gateway events; only the view
 * was single-session ($messages + the active-id gate). This store mirrors
 * the cache per runtime id so any number of surfaces (session tiles, future
 * pane windows) can each subscribe to one session's state without touching
 * the main chat's `$messages` pipeline — same pattern as `useSessionSlice`
 * over `$todosBySession`, applied to whole `ClientSessionState`s.
 *
 * TILES are the first consumer: sessions opened side-by-side with the main
 * thread, each in its own layout-tree pane. `$sessionTiles` holds the
 * stored-session ids (persisted — tiles survive restarts); the wiring layer
 * owns resume/submit (it has the gateway + cache internals) and registers
 * itself here as the delegate so tile UI stays dependency-light.
 */

import { registryBackendScopeKey } from '@hermes/shared'
import { atom, computed } from 'nanostores'

import type { ClientSessionState } from '@/app/types'
import { findGroup, findGroupOfPane, type LayoutNode } from '@/components/pane-shell/tree/model'
import {
  $activeTreeGroup,
  $layoutTree,
  focusedSessionTabAnchor,
  moveTreePane,
  noteActiveTreeGroup,
  revealTreePane
} from '@/components/pane-shell/tree/store'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'
import { stableArray } from '@/lib/stable-array'
import { readJson, writeJson } from '@/lib/storage'
import type { SessionInfo } from '@/types/hermes'

import { $activeGatewayProfile, normalizeProfileKey } from './profile'
import { clearAllProviderWaits, clearSessionProviderWait } from './provider-wait'
import {
  $activeSessionId,
  $lastReadAtBySessionId,
  $selectedStoredSessionId,
  $sessions,
  clearReadBaseline,
  lineageAliases,
  markSessionRead,
  sessionMatchesStoredId,
  setActiveSessionStoredIdRotation,
  setSessions
} from './session'
import { ackStoredSessionId, markSessionUnreadFinished } from './session-unread'
import { isSecondaryWindow } from './windows'

// ---------------------------------------------------------------------------
// Reactive per-runtime session state (view mirror of the wiring cache).
// ---------------------------------------------------------------------------

export const $sessionStates = atom<Record<string, ClientSessionState>>({})

// ---------------------------------------------------------------------------
// Event-source scopes: which registry connection's socket delivered a runtime
// session's events. Working/attention membership alone is profile-blind — two
// connected gateways can both expose a 'default' profile, so the gateway
// keep-set (pruneSecondaryGateways) must key live work by the composite
// (connectionId, profile) scope, not the bare profile name. Recorded at
// event fan-in (use-gateway-boot); local/primary events carry no connectionId
// and record nothing, so single-source behavior is untouched.
// ---------------------------------------------------------------------------

const sessionScopeByRuntimeId = new Map<string, string>()

export function recordSessionEventScope(event: {
  connectionId?: string
  gatewayEpoch?: number
  profile?: string
  session_id?: string
}): void {
  const connectionId = event.connectionId?.trim()
  const profile = event.profile?.trim()
  const runtimeSessionId = event.session_id?.trim()

  if (
    !connectionId ||
    !profile ||
    !runtimeSessionId ||
    typeof event.gatewayEpoch !== 'number' ||
    !Number.isFinite(event.gatewayEpoch)
  ) {
    return
  }

  const runtimeId = rendererRuntimeKey({ connectionId, gatewayEpoch: event.gatewayEpoch, profile }, runtimeSessionId)

  sessionScopeByRuntimeId.set(runtimeId, registryBackendScopeKey(connectionId, profile))
}

/** Composite scopes of registry-sourced sessions that are live (busy or
 * waiting on input) — the (connectionId, profile) half of the gateway
 * keep-set. Local-source live work keeps flowing through profile names. */
export function liveSessionScopes(): Set<string> {
  const scopes = new Set<string>()

  for (const [runtimeId, state] of Object.entries($sessionStates.get())) {
    if (!state || (!state.busy && !state.needsInput)) {
      continue
    }

    const scope = sessionScopeByRuntimeId.get(runtimeId)

    if (scope) {
      scopes.add(scope)
    }
  }

  return scopes
}

// Stored session ids whose authoritative state is still busy, but whose
// runtime has produced no state publish for the watchdog window. Silence is
// not completion: long tool calls can legitimately stay quiet, so this is a
// presentation hint and never mutates the backend-derived busy state.
export const $stalledSessionIds = atom<string[]>([])

export function setSessionStalled(storedSessionId: string | null | undefined, stalled: boolean) {
  if (!storedSessionId) {
    return
  }

  const current = $stalledSessionIds.get()
  const present = current.includes(storedSessionId)

  if (stalled && !present) {
    $stalledSessionIds.set([...current, storedSessionId])
  } else if (!stalled && present) {
    $stalledSessionIds.set(current.filter(id => id !== storedSessionId))
  }
}

// --- Watchdog: marks busy sessions quiet after a long stream silence -------
// Tuned against what this app actually does rather than a round number: a
// typecheck or a full test run here goes quiet for minutes at a stretch and is
// perfectly healthy, so anything under ~4 min would paint normal work as
// suspect. Eight minutes was the other failure — longer than a user is willing
// to sit and wonder, so the hint arrived after they had already given up on it.
export const SESSION_WATCHDOG_TIMEOUT_MS = 5 * 60 * 1000
const sessionWatchdogTimers = new Map<string, ReturnType<typeof setTimeout>>()

function armWatchdog(runtimeId: string) {
  const existing = sessionWatchdogTimers.get(runtimeId)

  if (existing) {
    clearTimeout(existing)
  }

  sessionWatchdogTimers.set(
    runtimeId,
    setTimeout(() => {
      sessionWatchdogTimers.delete(runtimeId)
      const current = $sessionStates.get()[runtimeId]

      if (current?.busy) {
        setSessionStalled(current.storedSessionId, true)
      }
    }, SESSION_WATCHDOG_TIMEOUT_MS)
  )
}

function clearWatchdog(runtimeId: string) {
  const t = sessionWatchdogTimers.get(runtimeId)

  if (t) {
    clearTimeout(t)
    sessionWatchdogTimers.delete(runtimeId)
  }
}

// --- Settle grace: keeps a just-finished session in the sidebar merge set ---
const SESSION_SETTLE_GRACE_MS = 30 * 1000
const settledExpiry = new Map<string, number>()

function markSettled(storedId: string) {
  settledExpiry.set(storedId, Date.now() + SESSION_SETTLE_GRACE_MS)
}

function clearSettled(storedId: string) {
  settledExpiry.delete(storedId)
}

/** Stored ids whose turn ended within the grace window. Prunes expired. */
export function getRecentlySettledSessionIds(now: number = Date.now()): string[] {
  const live: string[] = []

  for (const [id, expiry] of settledExpiry) {
    if (expiry > now) {
      live.push(id)
    } else {
      settledExpiry.delete(id)
    }
  }

  return live
}

// --- Transition detection (called automatically from publishSessionState) ---
function handleTransition(previous: ClientSessionState | null, next: ClientSessionState, runtimeId: string) {
  // Compression id rotation: signal the route-follow effect with enough
  // provenance (previous id + runtime) that the consumer can reject the event
  // if the user navigated elsewhere before React handled it. A bare next id
  // could let a background session's delayed rotation steal the foreground
  // route.
  if (previous?.storedSessionId && next.storedSessionId && previous.storedSessionId !== next.storedSessionId) {
    if (runtimeId === $activeSessionId.get()) {
      setActiveSessionStoredIdRotation({
        nextStoredSessionId: next.storedSessionId,
        previousStoredSessionId: previous.storedSessionId,
        runtimeSessionId: runtimeId
      })
    }

    clearSettled(previous.storedSessionId)
    setSessionStalled(previous.storedSessionId, false)
  }

  // Every busy publish is stream activity: clear the quiet hint and restart
  // the silence window. A real terminal transition clears both the timer and
  // any hint, but only that authoritative transition clears working/busy.
  if (next.busy) {
    setSessionStalled(next.storedSessionId, false)
    armWatchdog(runtimeId)
  } else {
    clearWatchdog(runtimeId)
    setSessionStalled(next.storedSessionId, false)
    setSessionStalled(previous?.storedSessionId, false)
  }

  const storedId = next.storedSessionId

  if (!storedId) {
    return
  }

  const wasWorking = previous?.busy ?? false

  if (next.busy && !wasWorking) {
    clearSettled(storedId)
    // A NEW turn is starting: the read baseline guarded the PREVIOUS
    // completion's re-asserts. Dropping it here means this turn's finish
    // re-lights even if it lands within the same millisecond as the last
    // read (same-tick submit → finish in tests and fast local models).
    clearReadBaseline(storedId)
  } else if (!next.busy && wasWorking) {
    markSettled(storedId)

    // FOCUSED, not selected: a session finishing in the tile the user is
    // watching is already seen, and a tile is never the primary selection.
    if (storedId !== $focusedStoredSessionId.get()) {
      // Re-light only genuinely new completions: if the user already viewed
      // this session (or its family) at or after this settle moment, a
      // re-assert of the same completion must not re-arm the dot. `-1` for
      // "never read" (not `0`) so fake-timer tests pinned to t=0 still light.
      const lastReadAt = $lastReadAtBySessionId.get()[storedId] ?? -1

      if (Date.now() > lastReadAt) {
        // Flags the transient atom AND persists a marker, so the green dot
        // survives an app restart (see session-unread.ts).
        markSessionUnreadFinished(storedId)
      }
    }
  }
}

/** Is any surface on THIS window still holding the runtime — the primary view
 *  or an open tile? (A tile mid-resume references by stored id only; its
 *  runtime binding is patched in after `resumeTile` returns.) */
function runtimeReferenced(runtimeId: string, storedSessionId: null | string): boolean {
  if (runtimeId === $activeSessionId.get()) {
    return true
  }

  return $sessionTiles
    .get()
    .some(t => t.runtimeId === runtimeId || (storedSessionId !== null && t.storedSessionId === storedSessionId))
}

/** A state no surface needs anymore: its turn is over (not busy, not waiting
 *  on the user) and neither the primary view nor any tile holds the runtime.
 *  `needsInput` states stay — the sidebar's attention dot reads them. */
function evictable(runtimeId: string, state: ClientSessionState): boolean {
  return (
    !state.busy && !state.needsInput && !state.awaitingResponse && !runtimeReferenced(runtimeId, state.storedSessionId)
  )
}

/** Publish one session's state. Automatically fires transition side-effects
 *  (watchdog arm/disarm, settle grace, unread marker, compression id rotation)
 *  by diffing previous vs next — callers never need to manually call a
 *  transition handler.
 *
 *  Skips the publish when the new state is identical to the existing one
 *  (same reference) to avoid churning `$sessionStates` on periodic
 *  `session.info` heartbeats that carry no change — otherwise every ~1/s
 *  heartbeat creates a new Record spread, triggering computed atoms
 *  ($workingSessionIds, $attentionSessionIds) and their subscribers
 *  unnecessarily. The runtime-id→state cache (sessionStateByRuntimeIdRef)
 *  is updated independently by the caller, so the visual path stays live
 *  without the store churn.
 *
 *  A settled state nothing references releases its transcript instead of
 *  republishing it. Gateway events keep flowing for sessions whose tile was
 *  closed mid-turn, and parking each one's full transcript here forever is the
 *  leak that made the app crawl after a day of tile use. Transition side
 *  effects still fire, so lightweight status and the unread dot survive. A
 *  FIRST publish always lands in full because a resume can publish its idle
 *  state a beat before `$activeSessionId` / the tile binding points at it. */
export function publishSessionState(runtimeId: string, state: ClientSessionState) {
  const current = $sessionStates.get()
  const prev = current[runtimeId] ?? null

  if (prev === state) {
    return
  }

  if (prev && evictable(runtimeId, state)) {
    handleTransition(prev, state, runtimeId)
    releaseSessionTranscript(runtimeId, state)

    return
  }

  $sessionStates.set({ ...current, [runtimeId]: state })
  handleTransition(prev, state, runtimeId)
}

/** Keep the cheap status projection for a cold session while releasing its
 * transcript. Unread completion is stored separately, so it survives too. */
export function releaseSessionTranscript(runtimeId: string, state?: ClientSessionState) {
  const current = $sessionStates.get()

  if (!(runtimeId in current)) {
    return
  }

  const retained = state ?? current[runtimeId]

  // Older persisted snapshots can contain an undefined state or omit the
  // messages field. Treat either shape as already cold instead of throwing
  // while memory pressure is being relieved.
  if (!retained) {
    return
  }

  const lightweight =
    Array.isArray(retained.messages) && retained.messages.length === 0 ? retained : { ...retained, messages: [] }

  $sessionStates.set({ ...current, [runtimeId]: lightweight })
}

export function dropSessionState(runtimeId: string) {
  // Disarm the watchdog — a dropped runtime must not fire a stale clear later.
  // Settle-grace entries are keyed by stored id and self-expire; leave them so
  // a just-finished session's row survives merge eviction even if its tile or
  // cached runtime is dropped in the meantime.
  clearWatchdog(runtimeId)
  clearSessionProviderWait(runtimeId)
  sessionScopeByRuntimeId.delete(runtimeId)

  const current = $sessionStates.get()
  setSessionStalled(current[runtimeId]?.storedSessionId, false)

  if (!(runtimeId in current)) {
    return
  }

  const { [runtimeId]: _dropped, ...rest } = current
  $sessionStates.set(rest)
}

/** Drop every cached session state — used on soft gateway-mode apply so the
 *  computed working / attention sets drain to empty alongside the session list.
 *  Also disarms every watchdog timer and drops all settle-grace entries: a
 *  wiped gateway's sessions must not fire stale clears or linger in the
 *  sidebar merge keep-set after the switch. */
export function clearAllSessionStates() {
  for (const timer of sessionWatchdogTimers.values()) {
    clearTimeout(timer)
  }

  sessionWatchdogTimers.clear()
  settledExpiry.clear()
  clearAllProviderWaits()
  sessionScopeByRuntimeId.clear()
  $stalledSessionIds.set([])
  $sessionStates.set({})
}

/** Downgrade cached busy/awaiting states after a gateway reconnect.
 *
 *  A respawned backend re-mints runtime ids (the same fact that drives
 *  resetTileRuntimeBindings), so a pre-reconnect `busy` can never receive its
 *  terminal `busy: false` publish — the runtime id it would arrive under is
 *  dead. Left alone, that state keeps its session in $workingSessionIds
 *  forever: the sidebar running arc and agents-panel "running" chrome lie for
 *  hours after the turn actually ended (#53902, #73082 — stale-flag half).
 *
 *  `scope` picks which socket's sessions to reconcile, keyed by the event-
 *  source scope recorded at fan-in: a SECONDARY (registry) reconnect passes
 *  its composite scope and touches only runtimes that arrived on that socket;
 *  the PRIMARY reconnect passes undefined and touches only scope-less
 *  runtimes (primary/local events record no scope). Neither can clear live
 *  work riding a different, still-healthy connection.
 *
 *  Direction of failure is deliberate: a turn that IS still live (transient
 *  socket blip, same backend) re-asserts busy on its next event or inflight
 *  snapshot within a beat, so at worst its arc blinks once. A dead turn's
 *  state, by contrast, would never clear on its own. `needsInput` is left
 *  untouched — a blocking prompt is the one claim the user must explicitly
 *  answer, and post-reconnect refresh re-asserts or retires it via its own
 *  path. Transition side-effects run through publishSessionState, so
 *  watchdogs disarm, stall hints drop, and settle/unread bookkeeping stays
 *  consistent. */
export function reconcileBusyStatesOnReconnect(scope?: string) {
  const states = $sessionStates.get()

  for (const [runtimeId, state] of Object.entries(states)) {
    if (!state || (!state.busy && !state.awaitingResponse)) {
      continue
    }

    const recorded = sessionScopeByRuntimeId.get(runtimeId)

    if (scope === undefined ? recorded !== undefined : recorded !== scope) {
      continue
    }

    publishSessionState(runtimeId, { ...state, awaitingResponse: false, busy: false })
  }
}

// Derived per-session status sets — pure projections of `$sessionStates` (which
// holds `busy`/`needsInput` per runtime), keeping the data flow one-directional:
// gateway event → cache → $sessionStates → computed views.
//
// Perf: `$sessionStates` is republished on EVERY message delta (tens/sec during
// a turn), but these sets only change on busy/needsInput edges. `stableArray`
// keeps the prior reference when membership is unchanged so `computed` skips the
// emit — otherwise the whole sidebar + every row re-renders per token.
// Published under every id the conversation answers to, not just its current
// tip: consumers hold whichever id they were created with, and compression
// rotates the tip out from under them (see lineageAliases).
//
// A conversation that has not been persisted yet has no stored id at all, and
// dropping it here is what left the FIRST turn of a new chat with no running
// indicator anywhere — no dot, no row arc — for as long as it took the backend
// to hand one back. Its runtime id is the right fallback because until a stored
// id exists the two are the same value (submit.ts: "an unpersisted
// conversation's queue key IS its runtime id"), so the row matches; once a
// session is persisted its runtime id is nobody's key and the fallback is inert.
const storedIds = (
  states: Record<string, ClientSessionState>,
  sessions: readonly SessionInfo[],
  pred: (s: ClientSessionState) => boolean
) => {
  const ids = new Set<string>()

  for (const [runtimeId, state] of Object.entries(states)) {
    if (!pred(state)) {
      continue
    }

    for (const alias of lineageAliases(state.storedSessionId ?? runtimeId, sessions)) {
      ids.add(alias)
    }
  }

  return [...ids]
}

let workingIds: readonly string[] = []
export const $workingSessionIds = computed(
  [$sessionStates, $sessions],
  (states, sessions) =>
    (workingIds = stableArray(
      workingIds,
      storedIds(states, sessions, s => s.busy)
    ))
)

let attentionIds: readonly string[] = []
export const $attentionSessionIds = computed(
  [$sessionStates, $sessions],
  (states, sessions) =>
    (attentionIds = stableArray(
      attentionIds,
      storedIds(states, sessions, s => s.needsInput)
    ))
)

// An open session nothing has ever been sent to — the ⌘T tab whose backend
// session exists but is unlisted, or a tile still waiting on its first send.
// `blankDraftTile`'s predicate, read as a status rather than as a slot to spend.
//
// The row's own `message_count` is the tiebreaker, and it is load-bearing: a
// session RESUMING also holds an empty message list for the moment between
// binding its runtime and loading its transcript, and calling that a draft
// would flash the wrong mark on a conversation with years of history in it.
let draftIds: readonly string[] = []
export const $draftSessionIds = computed([$sessionStates, $sessions], (states, sessions) => {
  const unsent = (state: ClientSessionState) => {
    if (state.busy || state.messages.length > 0) {
      return false
    }

    const storedId = state.storedSessionId

    // No stored id is the ⌘T tab that hasn't reached the backend yet: a draft
    // by definition, and no row to consult. Asking anyway would match a row on
    // an empty lineage root.
    if (!storedId) {
      return true
    }

    const row = sessions.find(session => sessionMatchesStoredId(session, storedId))

    return !row || row.message_count === 0
  }

  return (draftIds = stableArray(draftIds, storedIds(states, sessions, unsent)))
})

// ---------------------------------------------------------------------------
// Session tiles.
// ---------------------------------------------------------------------------

/** Edge a tile docks against main when it first joins the tree. Shared by
 *  session tiles and route (page) tiles. */
export type SplitDir = 'bottom' | 'left' | 'right' | 'top'

/** Where a tile lands on adoption: an edge split, or `center` = stack into
 *  the anchor's zone as a tab (a drop on the zone's tab strip). */
export type TileDock = 'center' | SplitDir

export interface SessionTileOwner {
  /** Registry connection that owns the backend. Null is the local/legacy path. */
  connectionId: null | string
  /** Normalized backend profile name. */
  profile: string
}

interface SessionTileBase {
  /**
   * Pane identity used by the existing layout/UI integration. Durable tiles use
   * the DB id. Provisional tiles use their stable draft id and MUST be narrowed
   * with `isDurableSessionTile` before any DB-backed resume/delete operation.
   */
  storedSessionId: string
  /** Dock against `anchor` on adoption (default right; center = stack). */
  dir?: TileDock
  /** Pane to dock against (a drop's target zone) — default the workspace.
   *  Persisted so a restart re-docks in place; a stale id falls back to the
   *  workspace (findGroupOfPane misses → the move is skipped). */
  anchor?: string
  /** Center docks: stack BEFORE this pane id (`null`/omitted = append) — the
   *  strip divider's slot. Persisted, like `anchor`; a stale id appends. */
  before?: null | string
  /** Live runtime id once the tile's resume has bound one. */
  runtimeId?: string
  /** Resume failed terminally (shown in the tile; retryable). */
  error?: string
}

/** Existing callers may still construct an untagged tile in memory. Persistence
 * normalizes every such legacy value to an explicit durable tile. */
export interface DurableSessionTile extends SessionTileBase {
  kind?: 'durable'
  owner?: SessionTileOwner
  draftId?: never
  provisionalStoredSessionId?: never
}

/** A backend has minted a candidate key/runtime, but no durable DB row has been
 * confirmed yet. `draftId` is renderer-owned and stable across relaunches;
 * `provisionalStoredSessionId` is only a candidate backend key, never proof of a
 * persisted session. */
export interface ProvisionalSessionTile extends SessionTileBase {
  kind: 'provisional'
  owner: SessionTileOwner
  draftId: string
  provisionalStoredSessionId?: string
}

export type SessionTile = DurableSessionTile | ProvisionalSessionTile
export type SessionTilePatch = Partial<Pick<SessionTileBase, 'anchor' | 'before' | 'dir' | 'error' | 'runtimeId'>>

export interface SessionTilePromotionPlan {
  owner: SessionTileOwner
  draftId: string
  provisionalStoredSessionId: null | string
  durableSessionId: string
  /** Existing layout integration must rekey this pane atomically with the tile. */
  layout: { fromPaneId: string; toPaneId: string }
  /** Composer integration must move the unsent draft between these scopes. */
  draft: { fromScope: string; toScope: string }
}

export interface ProvisionalSessionTileRecovery {
  action: 'create-fresh-runtime'
  /** Stable composer scope retained across the relaunch. */
  draft: { scope: string }
  owner: SessionTileOwner
  draftId: string
  /** Relaunch recovery never exposes a previous candidate or runtime binding. */
  tile: ProvisionalSessionTile
}

export interface RebindProvisionalSessionTileInput {
  owner: SessionTileOwner
  draftId: string
  /** Fresh candidate returned by the post-relaunch session.create. */
  provisionalStoredSessionId: string
  /** Fresh runtime paired with the new candidate. */
  runtimeId: string
}

export interface ProvisionalSessionTileRebind {
  owner: SessionTileOwner
  draftId: string
  /** The draft remains in the same composer scope; no migration is required. */
  draft: { scope: string }
  provisionalStoredSessionId: string
  runtimeId: string
  tile: ProvisionalSessionTile
}

// Tiles are persisted PER BACKEND OWNER, not just profile. Two registry
// connections can both expose `default`; collapsing them into one profile key
// makes a tile from machine A resume on machine B. The owner captured at create
// time is carried by every provisional tile and is the only scope used by its
// mutations — no late `$activeGatewayProfile` read is allowed.
const TILES_KEY = 'hermes.desktop.sessionTiles.v3'
const LEGACY_PROFILE_TILES_KEY = 'hermes.desktop.sessionTiles.v2'
const LEGACY_TILES_KEY = 'hermes.desktop.sessionTiles.v1'
const TILE_PANE_PREFIX = 'session-tile:'

/** Persisted placement — `dir` + strip slot (`before`) + dock `anchor` so a
 *  restart / profile swap re-adopts tiles in the same order, not all stacked
 *  right of workspace. */
type StoredTile =
  | (Pick<DurableSessionTile, 'anchor' | 'before' | 'dir' | 'storedSessionId'> & {
      kind: 'durable'
      owner: SessionTileOwner
    })
  | (Pick<ProvisionalSessionTile, 'anchor' | 'before' | 'dir' | 'draftId' | 'storedSessionId'> & {
      kind: 'provisional'
      owner: SessionTileOwner
    })

export function normalizeSessionTileOwner(owner: SessionTileOwner): SessionTileOwner {
  const connectionId = String(owner.connectionId ?? '').trim() || null

  return { connectionId, profile: normalizeProfileKey(owner.profile) }
}

export function sessionTileOwnerKey(owner: SessionTileOwner): string {
  const normalized = normalizeSessionTileOwner(owner)

  return registryBackendScopeKey(normalized.connectionId, normalized.profile)
}

export function isProvisionalSessionTile(tile: SessionTile): tile is ProvisionalSessionTile {
  return tile.kind === 'provisional'
}

export function isDurableSessionTile(tile: SessionTile): tile is DurableSessionTile {
  return tile.kind !== 'provisional'
}

const toStored = (tile: SessionTile, fallbackOwner: SessionTileOwner): StoredTile => {
  const owner = normalizeSessionTileOwner(tile.owner ?? fallbackOwner)

  if (isProvisionalSessionTile(tile)) {
    return {
      anchor: tile.anchor,
      before: tile.before,
      dir: tile.dir,
      draftId: tile.draftId,
      kind: 'provisional',
      owner,
      storedSessionId: tile.draftId
    }
  }

  return {
    anchor: tile.anchor,
    before: tile.before,
    dir: tile.dir,
    kind: 'durable',
    owner,
    storedSessionId: tile.storedSessionId
  }
}

function parseTileList(value: unknown, fallbackOwner: SessionTileOwner): StoredTile[] {
  return Array.isArray(value)
    ? value
        .filter((t): t is SessionTile => Boolean(t && typeof (t as SessionTile).storedSessionId === 'string'))
        .flatMap<StoredTile>(t => {
          const raw = t as SessionTile
          const rawKind = (raw as { kind?: unknown }).kind
          const owner = normalizeSessionTileOwner(raw.owner ?? fallbackOwner)

          if (rawKind === 'provisional') {
            if (typeof raw.draftId !== 'string' || !raw.draftId.trim() || raw.storedSessionId !== raw.draftId) {
              // Never reinterpret a malformed provisional record as durable.
              return []
            }

            return [
              {
                anchor: typeof raw.anchor === 'string' ? raw.anchor : undefined,
                before: typeof raw.before === 'string' || raw.before === null ? raw.before : undefined,
                dir: raw.dir,
                draftId: raw.draftId,
                kind: 'provisional' as const,
                owner,
                storedSessionId: raw.draftId
              }
            ]
          }

          if (rawKind !== undefined && rawKind !== 'durable') {
            return []
          }

          return [
            {
              anchor: typeof raw.anchor === 'string' ? raw.anchor : undefined,
              before: typeof raw.before === 'string' || raw.before === null ? raw.before : undefined,
              dir: raw.dir,
              kind: 'durable' as const,
              owner,
              storedSessionId: raw.storedSessionId
            }
          ]
        })
    : []
}

function mergeStoredTiles(current: StoredTile[], incoming: StoredTile[]): StoredTile[] {
  const seen = new Set(current.map(tile => tile.storedSessionId))

  return [...current, ...incoming.filter(tile => !seen.has(tile.storedSessionId))]
}

function loadTilesByOwner(): Record<string, StoredTile[]> {
  const byOwner: Record<string, StoredTile[]> = {}
  let shouldRewriteStoredTiles = false
  const parsed = readJson<unknown>(TILES_KEY)

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // Rewrite v3 through StoredTile so older experimental records cannot leave
    // a candidate/runtime pair on disk even when the user takes no next action.
    shouldRewriteStoredTiles = true

    for (const [scope, list] of Object.entries(parsed as Record<string, unknown>)) {
      const fallbackOwner = scope.startsWith('conn:')
        ? (() => {
            const [connectionId = '', profile = 'default'] = scope.slice(5).split('::', 2)

            return normalizeSessionTileOwner({ connectionId, profile })
          })()
        : normalizeSessionTileOwner({ connectionId: null, profile: scope })

      const tiles = parseTileList(list, fallbackOwner)

      if (tiles.length > 0) {
        for (const tile of tiles) {
          const ownerKey = sessionTileOwnerKey(tile.owner)
          byOwner[ownerKey] = mergeStoredTiles(byOwner[ownerKey] ?? [], [tile])
        }
      }
    }
  }

  // v2 grouped only by profile; every entry is a confirmed durable tile on the
  // local/legacy connection. v1 is the older flat default-profile list.
  const legacyProfiles = readJson<unknown>(LEGACY_PROFILE_TILES_KEY)

  if (legacyProfiles && typeof legacyProfiles === 'object' && !Array.isArray(legacyProfiles)) {
    shouldRewriteStoredTiles = true

    for (const [profile, list] of Object.entries(legacyProfiles as Record<string, unknown>)) {
      const owner = normalizeSessionTileOwner({ connectionId: null, profile })
      const key = sessionTileOwnerKey(owner)

      byOwner[key] = mergeStoredTiles(byOwner[key] ?? [], parseTileList(list, owner))
    }
  }

  const defaultOwner = normalizeSessionTileOwner({ connectionId: null, profile: 'default' })
  const legacy = parseTileList(readJson<unknown>(LEGACY_TILES_KEY), defaultOwner)

  if (legacy.length > 0) {
    shouldRewriteStoredTiles = true
    const key = sessionTileOwnerKey(defaultOwner)

    byOwner[key] = mergeStoredTiles(byOwner[key] ?? [], legacy)
  }

  if (shouldRewriteStoredTiles) {
    writeJson(TILES_KEY, Object.keys(byOwner).length === 0 ? null : byOwner)
  }

  writeJson(LEGACY_PROFILE_TILES_KEY, null)
  writeJson(LEGACY_TILES_KEY, null)

  return byOwner
}

const tilesByOwner = loadTilesByOwner()
let activeTileOwner = normalizeSessionTileOwner({ connectionId: null, profile: $activeGatewayProfile.get() })
const activeOwnerKey = () => sessionTileOwnerKey(activeTileOwner)

// Runtime ids are process-scoped — never trust a persisted one, so the live
// atom hydrates from the stored (runtime-less) tiles for the active profile.
// A secondary window (single-chat pop-out) shows ONLY its routed session — no
// tiles, and no repopulation on a profile switch.
export const $sessionTiles = atom<SessionTile[]>(isSecondaryWindow() ? [] : [...(tilesByOwner[activeOwnerKey()] ?? [])])

function persistTiles() {
  // Shares the origin's storage; a secondary window holds no tiles, so a write
  // back would only wipe the primary's set.
  if (isSecondaryWindow()) {
    return
  }

  writeJson(TILES_KEY, Object.keys(tilesByOwner).length === 0 ? null : tilesByOwner)
}

function saveTilesForOwner(owner: SessionTileOwner, tiles: SessionTile[]) {
  const capturedOwner = normalizeSessionTileOwner(owner)
  const ownerKey = sessionTileOwnerKey(capturedOwner)
  const stored = tiles.map(tile => toStored(tile, capturedOwner))

  if (stored.length > 0) {
    tilesByOwner[ownerKey] = stored
  } else {
    delete tilesByOwner[ownerKey]
  }

  if (ownerKey === activeOwnerKey()) {
    $sessionTiles.set(tiles)
  }

  persistTiles()
}

function saveTiles(tiles: SessionTile[]) {
  saveTilesForOwner(activeTileOwner, tiles)
}

/** Make one exact backend owner visible. Connection switching code must call
 * this even when the profile name does not change. Runtime ids are intentionally
 * absent because owner records are persistence-shaped. */
export function activateSessionTileOwner(owner: SessionTileOwner): void {
  activeTileOwner = normalizeSessionTileOwner(owner)

  if (!isSecondaryWindow()) {
    $sessionTiles.set([...(tilesByOwner[activeOwnerKey()] ?? [])])
  }
}

export function sessionTilesForOwner(owner: SessionTileOwner): SessionTile[] {
  const key = sessionTileOwnerKey(owner)

  return key === activeOwnerKey() ? [...$sessionTiles.get()] : [...(tilesByOwner[key] ?? [])]
}

export interface ProvisionSessionTileInput {
  owner: SessionTileOwner
  /** Stable renderer identity used for the pane and unsent composer draft. */
  draftId: string
  /** Candidate key returned by session.create; still not a confirmed DB row. */
  provisionalStoredSessionId?: string
  runtimeId?: string
  anchor?: string
  before?: null | string
  dir?: TileDock
}

function requiredTileIdentity(value: string, label: string): string {
  const normalized = String(value || '').trim()

  if (!normalized) {
    throw new Error(`${label} is required`)
  }

  return normalized
}

/** Build a provisional tile without mutating the store. This is useful at the
 * async create boundary: capture the owner before awaiting, then provision/open
 * with that same value even if the ambient profile changes meanwhile. */
export function provisionSessionTile(input: ProvisionSessionTileInput): ProvisionalSessionTile {
  const draftId = requiredTileIdentity(input.draftId, 'draftId')
  const provisionalStoredSessionId = String(input.provisionalStoredSessionId ?? '').trim() || undefined

  return {
    anchor: input.anchor,
    before: input.before,
    dir: input.dir,
    draftId,
    kind: 'provisional',
    owner: normalizeSessionTileOwner(input.owner),
    provisionalStoredSessionId,
    runtimeId: input.runtimeId,
    storedSessionId: draftId
  }
}

/** Persist/open a provisional tile under its CAPTURED owner. It never consults
 * the ambient profile and never upgrades the candidate key to durable. */
export function openProvisionalSessionTile(input: ProvisionSessionTileInput): ProvisionalSessionTile {
  const tile = provisionSessionTile(input)
  const tiles = sessionTilesForOwner(tile.owner)
  const existing = tiles.find(item => item.storedSessionId === tile.draftId)

  if (existing && isDurableSessionTile(existing)) {
    throw new Error(`draft identity already belongs to a durable tile: ${tile.draftId}`)
  }

  saveTilesForOwner(
    tile.owner,
    existing ? tiles.map(item => (item.storedSessionId === tile.draftId ? tile : item)) : [...tiles, tile]
  )

  return tile
}

/** Return the relaunch recovery description for a provisional tile. No backend
 * call is made; consumers decide when to create a fresh runtime. */
export function recoverProvisionalSessionTile(
  owner: SessionTileOwner,
  draftId: string
): null | ProvisionalSessionTileRecovery {
  const id = requiredTileIdentity(draftId, 'draftId')

  const tile = sessionTilesForOwner(owner).find(
    (candidate): candidate is ProvisionalSessionTile => isProvisionalSessionTile(candidate) && candidate.draftId === id
  )

  if (!tile) {
    return null
  }

  return {
    action: 'create-fresh-runtime',
    draft: { scope: tile.draftId },
    draftId: tile.draftId,
    owner: normalizeSessionTileOwner(tile.owner),
    tile: { ...tile, error: undefined, provisionalStoredSessionId: undefined, runtimeId: undefined }
  }
}

/** Attach a fresh post-relaunch candidate/runtime pair to an unbound
 * provisional tile. This deliberately accepts only the exact active owner and
 * a tile with no live binding, so a stale candidate, a second bind, or an
 * owner/profile race fails closed. The live pair is never persisted. */
export function rebindProvisionalSessionTile(
  input: RebindProvisionalSessionTileInput
): null | ProvisionalSessionTileRebind {
  const owner = normalizeSessionTileOwner(input.owner)

  const draftId = requiredTileIdentity(input.draftId, 'draftId')

  const provisionalStoredSessionId = requiredTileIdentity(
    input.provisionalStoredSessionId,
    'provisionalStoredSessionId'
  )

  const runtimeId = requiredTileIdentity(input.runtimeId, 'runtimeId')

  if (sessionTileOwnerKey(owner) !== activeOwnerKey()) {
    return null
  }

  const tiles = $sessionTiles.get()

  const index = tiles.findIndex(
    tile =>
      isProvisionalSessionTile(tile) &&
      tile.draftId === draftId &&
      sessionTileOwnerKey(tile.owner) === sessionTileOwnerKey(owner)
  )

  if (index < 0) {
    return null
  }

  const provisional = tiles[index] as ProvisionalSessionTile

  if (provisional.runtimeId || provisional.provisionalStoredSessionId) {
    return null
  }

  const rebound: ProvisionalSessionTile = {
    ...provisional,
    owner,
    provisionalStoredSessionId,
    runtimeId
  }

  const next = [...tiles]

  next[index] = rebound
  saveTilesForOwner(owner, next)

  return {
    draft: { scope: draftId },
    draftId,
    owner,
    provisionalStoredSessionId,
    runtimeId,
    tile: rebound
  }
}

/** Invalidate one exact provisional runtime without deleting its stable draft
 * tile. Used for structural 4007: the dead candidate may never be resumed, but
 * the preserved draft can explicitly create a fresh runtime on the same owner. */
export function invalidateProvisionalSessionTileRuntime(input: {
  draftId: string
  error: string
  owner: SessionTileOwner
  runtimeId: string
}): boolean {
  const owner = normalizeSessionTileOwner(input.owner)
  const draftId = requiredTileIdentity(input.draftId, 'draftId')
  const runtimeId = requiredTileIdentity(input.runtimeId, 'runtimeId')
  const tiles = sessionTilesForOwner(owner)
  const index = tiles.findIndex(
    tile =>
      isProvisionalSessionTile(tile) &&
      tile.draftId === draftId &&
      tile.runtimeId === runtimeId &&
      sessionTileOwnerKey(tile.owner) === sessionTileOwnerKey(owner)
  )

  if (index < 0) {
    return false
  }

  const next = [...tiles]
  const current = tiles[index] as ProvisionalSessionTile

  next[index] = {
    ...current,
    error: input.error,
    provisionalStoredSessionId: undefined,
    runtimeId: undefined
  }
  saveTilesForOwner(owner, next)

  return true
}

/** Drop every provisional capability owned by one disconnected backend while
 * keeping its pane, draft scope, attachments and recovery affordance intact. */
export function invalidateProvisionalSessionTileRuntimesForOwner(
  inputOwner: SessionTileOwner,
  error: string
): readonly string[] {
  const owner = normalizeSessionTileOwner(inputOwner)
  const tiles = sessionTilesForOwner(owner)
  const invalidated: string[] = []
  const next = tiles.map(tile => {
    if (!isProvisionalSessionTile(tile) || !tile.runtimeId) {
      return tile
    }

    invalidated.push(tile.runtimeId)

    return {
      ...tile,
      error,
      provisionalStoredSessionId: undefined,
      runtimeId: undefined
    }
  })

  if (invalidated.length > 0) {
    saveTilesForOwner(owner, next)
  }

  return Object.freeze(invalidated)
}

export function dropProvisionalSessionTile(owner: SessionTileOwner, draftId: string): boolean {
  const id = requiredTileIdentity(draftId, 'draftId')
  const tiles = sessionTilesForOwner(owner)
  const next = tiles.filter(tile => !(isProvisionalSessionTile(tile) && tile.draftId === id))

  if (next.length === tiles.length) {
    return false
  }

  saveTilesForOwner(owner, next)

  return true
}

/** Confirm a provisional tile as durable in one synchronous store write. The
 * returned pure plan is intentionally not executed here: layout and composer
 * own their respective rekey operations outside this store. */
export function promoteProvisionalSessionTile(input: {
  owner: SessionTileOwner
  draftId: string
  durableSessionId: string
  runtimeId?: string
}): null | SessionTilePromotionPlan {
  const owner = normalizeSessionTileOwner(input.owner)
  const draftId = requiredTileIdentity(input.draftId, 'draftId')
  const durableSessionId = requiredTileIdentity(input.durableSessionId, 'durableSessionId')
  const tiles = sessionTilesForOwner(owner)
  const index = tiles.findIndex(tile => isProvisionalSessionTile(tile) && tile.draftId === draftId)

  if (index < 0) {
    return null
  }

  if (tiles.some((tile, tileIndex) => tileIndex !== index && tile.storedSessionId === durableSessionId)) {
    throw new Error(`durable session already has a tile: ${durableSessionId}`)
  }

  const provisional = tiles[index] as ProvisionalSessionTile

  const durable: DurableSessionTile = {
    anchor: provisional.anchor,
    before: provisional.before,
    dir: provisional.dir,
    kind: 'durable',
    owner,
    runtimeId: input.runtimeId ?? provisional.runtimeId,
    storedSessionId: durableSessionId
  }

  const next = [...tiles]

  next[index] = durable
  saveTilesForOwner(owner, next)

  return {
    draft: { fromScope: draftId, toScope: durableSessionId },
    draftId,
    durableSessionId,
    layout: {
      fromPaneId: `${TILE_PANE_PREFIX}${draftId}`,
      toPaneId: `${TILE_PANE_PREFIX}${durableSessionId}`
    },
    owner,
    provisionalStoredSessionId: provisional.provisionalStoredSessionId ?? null
  }
}

/**
 * Restore the exact provisional tile when a coordinated layout rekey fails
 * after the tile-store promotion. This is deliberately narrow: it accepts
 * only the durable row produced by the immediately preceding promotion and
 * refuses to overwrite any newer tile state.
 */
export function rollbackProvisionalSessionTilePromotion(input: {
  owner: SessionTileOwner
  durableSessionId: string
  provisionalTile: ProvisionalSessionTile
}): boolean {
  const owner = normalizeSessionTileOwner(input.owner)
  const durableSessionId = requiredTileIdentity(input.durableSessionId, 'durableSessionId')
  const draftId = requiredTileIdentity(input.provisionalTile.draftId, 'draftId')

  if (input.provisionalTile.storedSessionId !== draftId) {
    return false
  }

  const provisionalTile: ProvisionalSessionTile = {
    ...input.provisionalTile,
    draftId,
    kind: 'provisional',
    owner,
    storedSessionId: draftId
  }
  const tiles = sessionTilesForOwner(owner)
  const index = tiles.findIndex(
    tile => !isProvisionalSessionTile(tile) && tile.storedSessionId === durableSessionId
  )

  if (
    index < 0 ||
    tiles.some(
      (tile, tileIndex) =>
        tileIndex !== index && isProvisionalSessionTile(tile) && tile.draftId === provisionalTile.draftId
    )
  ) {
    return false
  }

  const next = [...tiles]

  next[index] = provisionalTile
  saveTilesForOwner(owner, next)

  return true
}

// Profile switch: surface the new profile's tiles with runtime ids cleared so
// they re-resume against the now-current gateway. (Fires immediately on
// subscribe; harmless — the init value already matches.) A secondary window
// never carries tiles, so it stays out of this entirely.
if (!isSecondaryWindow()) {
  $activeGatewayProfile.subscribe(profile => {
    // The app wiring immediately upgrades this legacy local scope with the
    // exact registry connection, including same-profile source switches.
    activateSessionTileOwner({ connectionId: null, profile })
  })
}

export function patchSessionTile(
  storedSessionId: string,
  patch: SessionTilePatch,
  owner: SessionTileOwner = activeTileOwner
) {
  const tiles = sessionTilesForOwner(owner)

  saveTilesForOwner(
    owner,
    tiles.map(t => (t.storedSessionId === storedSessionId ? { ...t, ...patch } : t))
  )
}

/** Drop live runtime bindings so every tile re-resumes — used on gateway
 *  reconnect, where a respawned backend re-mints (recycles) runtime ids.
 *  Also invalidates the wiring cache's stored→runtime map: clearing only the
 *  tile atoms left `resumeTile`'s warm path free to re-bind the same dead
 *  runtime id from the cache, so post-wake tiles repainted empty and never
 *  actually re-resumed. */
export function resetTileRuntimeBindings() {
  sessionTileDelegate()?.invalidateRuntimeBindings?.()

  const tiles = $sessionTiles.get()

  if (tiles.some(t => t.runtimeId)) {
    $sessionTiles.set(tiles.map(tile => toStored(tile, activeTileOwner)))
  }
}

/** Unbind ONE reclaimed runtime from whichever tile holds it — the targeted
 *  sibling of resetTileRuntimeBindings. The reconnect-time reset can't cover a
 *  backend reclaim: the WS re-dials immediately, but the orphan reaper fires a
 *  grace window LATER, so the reclaim lands after every reconnect-path unbind
 *  already ran. Without this, the tile keeps pointing at the dead runtime whose
 *  state `session.reclaimed` just dropped — an empty transcript under live
 *  chrome — and SessionTilePane's resume effect (gated on `!runtimeId`) never
 *  re-resumes. Clearing the binding re-arms that effect, which rebinds a fresh
 *  runtime from the stored row. The pane itself stays: the stored session is
 *  intact, only its live runtime was reclaimed. */
export function unbindTileRuntime(runtimeId: string) {
  const tiles = $sessionTiles.get()

  if (tiles.some(t => t.runtimeId === runtimeId)) {
    $sessionTiles.set(tiles.map(t => (t.runtimeId === runtimeId ? { ...t, runtimeId: undefined } : t)))
  }
}

// ---------------------------------------------------------------------------
// Delegate — the wiring layer (which owns the gateway + session cache) plugs
// its actions in; tile UI calls through here. Same inversion as the tree
// store's pane closers.
// ---------------------------------------------------------------------------

export interface SessionTileDelegate {
  /** Archive a stored session (the sidebar's archive, incl. tile cleanup). */
  archiveSession(storedSessionId: string): Promise<void>
  /** Branch a stored session into a new chat (the sidebar's branch). */
  branchSession(storedSessionId: string): Promise<void>
  /** Register a confirmed durable/runtime pair in the shell binding authority. */
  bindSessionRuntime?(storedSessionId: string, runtimeSessionId: string): null | string
  /** Relaunch an unsent draft by creating a fresh runtime on its captured owner;
   * the stale provisional candidate must never be sent to session.resume. */
  createProvisionalRuntime?(tile: ProvisionalSessionTile): Promise<string>
  /** Delete a stored session (the sidebar's delete, incl. tile cleanup). */
  deleteSession(storedSessionId: string): Promise<void>
  /** Run a slash command against a tile's session (app-level effects — e.g.
   *  branch/handoff — act on the main surface, as they should). */
  executeSlash(rawCommand: string, sessionId: string): Promise<void>
  /** Interrupt a tile's running turn. */
  interruptSession(runtimeId: string): Promise<void>
  /** Drop the wiring cache's stored→runtime bindings. Called on gateway
   *  reconnect: a respawned backend re-mints runtime ids, so every binding
   *  recorded before the reconnect is suspect — without this, `resumeTile`'s
   *  warm path re-binds tiles to dead runtime ids (the sleep/wake "empty
   *  right pane" bug). Bindings re-record from live post-reconnect events. */
  invalidateRuntimeBindings?(): void
  /** Invalidate one exact durable/runtime pair after structural RPC 4007. */
  invalidateSessionRuntimeBinding?(storedSessionId: string, runtimeSessionId: string): void
  /** Bind a live runtime id for a stored session (resume without touching
   *  the main view). Returns the runtime id, or throws. */
  resumeTile(storedSessionId: string): Promise<string>
  /** Submit a prompt to a tile's live session. */
  submitToSession(runtimeId: string, text: string): Promise<void>
  /** THE session-state write path — routes through the wiring cache so the
   *  cache, the primary view (when active), and every tile mirror agree. */
  updateSession(runtimeId: string, updater: (state: ClientSessionState) => ClientSessionState): ClientSessionState
}

let delegate: SessionTileDelegate | null = null

export function setSessionTileDelegate(next: SessionTileDelegate) {
  delegate = next
}

export function sessionTileDelegate(): SessionTileDelegate | null {
  return delegate
}

/** Reorder tiles to match layout-tree encounter order (stored ids in the order
 *  their `session-tile:` panes are walked). Restore replays the array through
 *  sequential adoption (each center tile APPENDS after the ones before it), so
 *  array order IS strip order — no `before` stamping needed; a stale `before`
 *  naming an absent pane falls back to append anyway (see insertAtGroup). Tiles
 *  not yet adopted sort after placed ones, stably. Returns `null` when nothing
 *  moves so callers can skip a needless persist. */
export function orderTilesByTree<T extends { storedSessionId: string }>(
  tree: LayoutNode | null,
  tiles: readonly T[]
): null | T[] {
  if (!tree || tiles.length < 2) {
    return null
  }

  const order: string[] = []

  const walk = (node: LayoutNode) => {
    if (node.type === 'group') {
      for (const id of node.panes) {
        if (id.startsWith(TILE_PANE_PREFIX)) {
          order.push(id.slice(TILE_PANE_PREFIX.length))
        }
      }

      return
    }

    node.children.forEach(walk)
  }

  walk(tree)

  const rank = new Map(order.map((id, i) => [id, i]))

  const next = [...tiles].sort(
    (a, b) => (rank.get(a.storedSessionId) ?? Infinity) - (rank.get(b.storedSessionId) ?? Infinity)
  )

  return next.some((t, i) => t !== tiles[i]) ? next : null
}

function syncTileStripOrder() {
  const next = orderTilesByTree($layoutTree.get(), $sessionTiles.get())

  if (next) {
    saveTiles(next)
  }
}

/** Open a tile for a stored session, or MOVE an existing one to the new dock
 *  (`dir`; `center` = stack into the anchor's zone, `before` = strip slot). The
 *  move path is what lets a tile's own TAB be dragged like a sidebar row — drop
 *  it on a zone/edge/strip and the tile goes there (drop-on-a-composer links
 *  instead, handled by the drag resolver). The session LOADED IN MAIN never
 *  opens as a tile (same transcript twice, fighting one runtime — silly).
 *
 *  An unanchored open (⌘T, ⌘⇧T on a tile that predates anchors) docks into the
 *  FOCUSED chat zone — the same zone ⌘1…⌘9 and ⌘W act on — so a new tab lands
 *  in the strip the user is looking at, not always main's. */
export function openSessionTile(
  storedSessionId: string,
  dir: TileDock = 'right',
  anchor?: string,
  before?: null | string
) {
  const owner = activeTileOwner
  const tiles = $sessionTiles.get()

  // Opening a session in a tab/tile is "reading" it — clear its unread dot
  // exactly like main-thread resume does. Previously only
  // setSelectedStoredSessionId cleared unread, so tile-opened sessions kept
  // their green dot even while the user was reading them. Acks the persisted
  // watermark/marker too so a later list refresh doesn't repaint it.
  markSessionRead(storedSessionId)
  ackStoredSessionId(storedSessionId)

  if (storedSessionId === $selectedStoredSessionId.get()) {
    return
  }

  const dock = anchor ?? focusedSessionTabAnchor() ?? undefined

  if (!tiles.some(t => t.storedSessionId === storedSessionId)) {
    saveTilesForOwner(owner, [...tiles, { anchor: dock, before, dir, kind: 'durable', owner, storedSessionId }])
    // Adoption is async via the registry — order sync runs after the move path
    // below; a brand-new tile's strip slot is already in `before`.

    return
  }

  // Already open: relocate the existing pane to the drop target (pane-mirror
  // only docks on first adoption, so a re-drag must move the tree pane itself).
  const tree = $layoutTree.get()
  const target = tree ? findGroupOfPane(tree, dock ?? 'workspace')?.id : null

  if (target) {
    moveTreePane(`${TILE_PANE_PREFIX}${storedSessionId}`, { before: before ?? null, groupId: target, pos: dir })
    patchSessionTile(storedSessionId, { anchor: dock, before: before ?? undefined, dir }, owner)
    syncTileStripOrder()
  }
}

/** ⌘W on the MAIN tab: the next session tab stacked WITH the workspace, to
 *  shift into main. Walks the workspace group's strip from the workspace tab
 *  outward (the tab after it first, then wrapping to the ones before), and
 *  returns the first session tile's stored id. Null when the workspace has no
 *  session tab stacked beside it (⌘W then stays the no-op it was). */
export function nextSessionTileForWorkspace(): null | string {
  const tree = $layoutTree.get()
  const group = tree ? findGroupOfPane(tree, 'workspace') : null

  if (!group) {
    return null
  }

  const tiles = $sessionTiles.get()
  const idx = group.panes.indexOf('workspace')
  // After the workspace tab first, then the ones before it (nearest-out).
  const ordered = [...group.panes.slice(idx + 1), ...group.panes.slice(0, idx).reverse()]

  for (const paneId of ordered) {
    if (paneId.startsWith(TILE_PANE_PREFIX)) {
      const storedSessionId = paneId.slice(TILE_PANE_PREFIX.length)

      if (tiles.some(t => t.storedSessionId === storedSessionId)) {
        return storedSessionId
      }
    }
  }

  // Nothing stacked WITH main — but a session tile in another zone can still
  // shift in. Without this, closing main in a side-by-side layout skipped
  // promotion entirely and dropped to a fresh "New session" draft, which read
  // as "closing a pane gave me a new session" (#88924). Promoting the tile
  // also collapses its zone, so Close is how a multi-pane layout shrinks.
  for (const tile of tiles) {
    if (tree && findGroupOfPane(tree, `${TILE_PANE_PREFIX}${tile.storedSessionId}`)) {
      return tile.storedSessionId
    }
  }

  return null
}

/** If a session is already ON SCREEN — an open tile OR the one loaded in main —
 *  front its tab (and focus its zone) and report WHICH. A sidebar click on an
 *  already-open chat JUMPS to its tab instead of reloading it; `null` means the
 *  caller must load it into main. Covers the two dead clicks: an open tile, and
 *  the main session while focus sits on a tile (route unchanged → no reload).
 *  Callers that own the router need the `'main'` vs `'tile'` distinction: a
 *  `'main'` hit only reaches the screen if the workspace pane is actually
 *  showing the chat, whereas a tile renders in its own pane regardless. */
export function focusOpenSession(storedSessionId: string): 'main' | 'tile' | null {
  if ($sessionTiles.get().some(t => t.storedSessionId === storedSessionId)) {
    const paneId = `${TILE_PANE_PREFIX}${storedSessionId}`
    revealTreePane(paneId) // un-dismiss + adopt + front in its group
    const tree = $layoutTree.get()
    const group = tree ? findGroupOfPane(tree, paneId) : null

    if (group) {
      noteActiveTreeGroup(group.id)
    }

    return 'tile'
  }

  // Already the main session: front the workspace tab and drop tile focus so
  // the readouts + sidebar highlight come home (a no-op when main is focused).
  if (storedSessionId === $selectedStoredSessionId.get()) {
    revealTreePane('workspace')
    noteActiveTreeGroup(null)

    return 'main'
  }

  return null
}

/** Does a sidebar click still need to navigate after `focusOpenSession`? A miss
 *  always does. A `'main'` hit does too while the workspace pane is showing a
 *  full page (artifacts, skills, …): fronting the workspace tab doesn't put the
 *  chat back on screen — only a route change back to the session does. A tile
 *  hit never does; its pane renders the chat regardless of the route. */
export function focusedSessionNeedsRoute(focused: 'main' | 'tile' | null, workspaceIsPage: boolean): boolean {
  return !focused || (focused === 'main' && workspaceIsPage)
}

/** The open tab that's still an empty "New session" draft, if there is one.
 *  That tab is the one the user would have typed into, so an open-from-nowhere
 *  spends it instead of stacking a second blank tab beside it. Most recent
 *  wins; a tile whose runtime hasn't bound (or whose state hasn't published) is
 *  unknown rather than empty, so it's left alone. */
export function blankDraftTile(
  tiles: readonly SessionTile[],
  states: Record<string, ClientSessionState>
): null | SessionTile {
  return (
    tiles.findLast(({ runtimeId }) => {
      const state = runtimeId ? states[runtimeId] : undefined

      return Boolean(state && !state.busy && state.messages.length === 0)
    }) ?? null
  )
}

/** Hand an open blank draft tab over to `storedSessionId`, keeping its slot.
 *  False when there's no such tab, so the caller can fall back. The spent draft
 *  is DISCARDED rather than closed: it never held a conversation, so ⌘⇧T
 *  resurrecting it would just restore an empty tab. */
export function reuseBlankDraftTile(storedSessionId: string): boolean {
  const tile = blankDraftTile($sessionTiles.get(), $sessionStates.get())

  if (!tile || tile.storedSessionId === storedSessionId) {
    return false
  }

  discardSessionTile(tile.storedSessionId)
  openSessionTile(storedSessionId, tile.dir, tile.anchor, tile.before)
  revealTreePane(`${TILE_PANE_PREFIX}${storedSessionId}`)

  return true
}

// Closed-tab stack for ⌘⇧T reopen (in-memory) — keyed PER OWNER like the
// tiles themselves, so a source/profile switch never resurrects another
// backend's tile. The tile's placement is remembered so it returns in place.
const closedTilesByOwner: Record<string, SessionTile[]> = {}
const closedStack = (): SessionTile[] => (closedTilesByOwner[activeOwnerKey()] ??= [])

export function closeSessionTile(storedSessionId: string) {
  const tile = $sessionTiles.get().find(t => t.storedSessionId === storedSessionId)

  if (tile) {
    closedStack().push(toStored(tile, activeTileOwner))
  }

  saveTiles($sessionTiles.get().filter(t => t.storedSessionId !== storedSessionId))

  // A settled session may never publish again, so the publish-time eviction
  // in publishSessionState can't reach it — drop its cached state here. A
  // BUSY one stays: its turn keeps streaming in the background, the sidebar
  // dot reads it, and settle evicts it. ⌘⇧T reopen re-publishes from the
  // wiring cache (resumeTile's warm path), so nothing is lost.
  const runtimeId = tile?.runtimeId
  const state = runtimeId ? $sessionStates.get()[runtimeId] : undefined

  if (runtimeId && state && evictable(runtimeId, state)) {
    dropSessionState(runtimeId)
  }
}

/** Drop a DEAD tile — a persisted tile whose session no longer exists on the
 *  backend (resume 404s). Unlike close, it leaves no ⌘⇧T undo (resurrecting it
 *  would just 404 again) and evicts any cached state. This is what clears the
 *  "Session not found" resume spam from stale/cross-profile persisted tiles. */
export function discardSessionTile(storedSessionId: string) {
  const runtimeId = $sessionTiles.get().find(t => t.storedSessionId === storedSessionId)?.runtimeId

  if (runtimeId) {
    dropSessionState(runtimeId)
  }

  saveTiles($sessionTiles.get().filter(t => t.storedSessionId !== storedSessionId))
}

/** ⌘⇧T — reopen the most recently closed tab where it was, then focus it.
 *  Adoption alone is silent (won't steal the active tab), so restore has to
 *  front the pane explicitly. Skips ids that are live again (reopened / now
 *  the primary). */
export function reopenLastClosedTile(): void {
  const stack = closedStack()

  for (let tile = stack.pop(); tile; tile = stack.pop()) {
    const { storedSessionId } = tile

    if (storedSessionId === $selectedStoredSessionId.get()) {
      continue
    }

    if (!$sessionTiles.get().some(t => t.storedSessionId === storedSessionId)) {
      if (isProvisionalSessionTile(tile)) {
        openProvisionalSessionTile({
          anchor: tile.anchor,
          before: tile.before,
          dir: tile.dir,
          draftId: tile.draftId,
          owner: tile.owner,
          provisionalStoredSessionId: tile.provisionalStoredSessionId
        })
      } else {
        openSessionTile(storedSessionId, tile.dir, tile.anchor, tile.before)
      }

      focusOpenSession(storedSessionId)

      return
    }
  }
}

// ---------------------------------------------------------------------------
// The FOCUSED session — one derivation, not another hand-maintained
// "$activeSession" sibling. The layout's interaction tracker ($activeTreeGroup:
// last click/focus, the same source ⌘W uses) resolves to a zone; its active
// pane names the session: a `session-tile:<storedId>` pane IS that session,
// anything else falls back to the route-driven primary. Chrome that should
// follow the user between tiles (titlebar session title, statusbar context /
// timer / model) reads these instead of the primary-only atoms.
// ---------------------------------------------------------------------------

/** Stored id of the focused session (the interacted zone's tile, else the
 *  primary's selection). Null on a fresh draft. */
export const $focusedStoredSessionId = computed(
  [$activeTreeGroup, $layoutTree, $selectedStoredSessionId],
  (groupId, tree, selected) => {
    const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

    return active?.startsWith(TILE_PANE_PREFIX) ? active.slice(TILE_PANE_PREFIX.length) : selected
  }
)

/** Every session currently OPEN as a surface: the primary's selection plus
 *  every tile's stored id. The sidebar highlights all of them (the focused one
 *  at full strength, the rest dimmed) so a multi-pane workspace shows which
 *  chats are on screen, not just the one being typed into. */
export const $openStoredSessionIds = computed(
  [$selectedStoredSessionId, $sessionTiles],
  (selected, tiles) => new Set([...(selected ? [selected] : []), ...tiles.map(t => t.storedSessionId)])
)

/** Live runtime id of the focused session (a tile's bound runtime, else the
 *  primary's active session). */
export const $focusedRuntimeId = computed(
  [$focusedStoredSessionId, $selectedStoredSessionId, $activeSessionId, $sessionTiles],
  (focused, selected, primaryRuntime, tiles) => {
    if (focused && focused !== selected) {
      return tiles.find(t => t.storedSessionId === focused)?.runtimeId ?? null
    }

    return primaryRuntime
  }
)

/** The focused session's state slice (undefined while unresolved/unbound). */
export const $focusedSessionState = computed([$focusedRuntimeId, $sessionStates], (runtimeId, states) =>
  runtimeId ? states[runtimeId] : undefined
)

/** A PRIMARY navigation (sidebar resume, route change, new chat) homes focus to
 *  the workspace — UNLESS the selected id is already an open TILE, where
 *  `focusOpenSession` owns the move and homing would yank every stacked tile
 *  behind the workspace (A+B "disappear" when switching to C). */
export const selectionHomesToWorkspace = (selected: null | string, tiles: readonly SessionTile[]): boolean =>
  !(selected && tiles.some(t => t.storedSessionId === selected))

// Bringing a finished session to the front clears its green dot. Keyed on the
// FOCUSED session, not the selected one: a tile is never $selectedStoredSessionId,
// and a tile tab click goes through activateTreePane rather than focusOpenSession,
// so this is the one hook that catches every way a tile reaches the front.
// Clears the whole conversation family (markSessionRead) AND acks the
// persisted watermark/marker (ackStoredSessionId) so the next list refresh
// doesn't repaint the dot the user just cleared by looking at it.
$focusedStoredSessionId.listen(focused => {
  if (focused) {
    markSessionRead(focused)
    ackStoredSessionId(focused)
  }
})

// Cold-start restore is the one selection change that is NOT a navigation: the
// route already pointed at the primary session before the window loaded, and
// homing on it would front the workspace tab over the PERSISTED active tab —
// then persist that clobber, so the tab you reloaded on never comes back
// (⌘R always landing on main). use-route-resume arms this one-shot right
// before dispatching the boot resume; the very next selection change skips
// homing and the restored layout tree keeps its say.
let selectionRestoreInFlight = false

export function markSelectionRestore() {
  selectionRestoreInFlight = true
}

// Homing also FRONTS the workspace tab: the resumed chat loads in the workspace
// pane, so a zone parked on a tile tab must switch back or the click looks dead.
$selectedStoredSessionId.listen(selected => {
  const restoring = selectionRestoreInFlight
  selectionRestoreInFlight = false

  if (restoring || !selectionHomesToWorkspace(selected, $sessionTiles.get())) {
    return
  }

  noteActiveTreeGroup(null)
  revealTreePane('workspace')
})

// Dev hook for automation (mirrors __HERMES_LAYOUT_TREE__).
if ((import.meta.env.DEV || import.meta.env.VITE_PERF_PROBE === '1') && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__HERMES_SESSION_TILES__ = {
    close: closeSessionTile,
    drop: dropSessionState,
    open: openSessionTile,
    patch: patchSessionTile,
    publish: publishSessionState,
    /** Seed the recents list — models a populated sessions DB in perf runs. */
    seedSessions: (rows: SessionInfo[]) => setSessions(rows),
    sessions: () => $sessions.get(),
    states: () => $sessionStates.get(),
    tiles: () => $sessionTiles.get(),
    /** THE real gateway write path (wiring cache + journal + publish + view
     *  sync), unlike `publish` which only touches the store. Perf scenarios
     *  must drive this or they under-model streaming cost. */
    update: (runtimeId: string, updater: (state: ClientSessionState) => ClientSessionState) =>
      sessionTileDelegate()?.updateSession(runtimeId, updater)
  }
}
