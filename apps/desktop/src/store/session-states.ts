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
import type { HermesConnection } from '@/global'
import { stableArray } from '@/lib/stable-array'
import { readJson, writeJson } from '@/lib/storage'
import type { SessionInfo } from '@/types/hermes'

import { $activeGatewayProfile, normalizeProfileKey } from './profile'
import { clearAllProviderWaits, clearSessionProviderWait } from './provider-wait'
import {
  $activeSessionId,
  $connection,
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
import { clearAllWorkProgress, clearSessionWorkProgress } from './work-progress'

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
// event fan-in (use-gateway-boot). Secondary frames carry connectionId and
// populate both ledgers; primary frames use their boot descriptor to populate
// only the identity ledger, so they do not affect secondary pruning.
// ---------------------------------------------------------------------------

const sessionScopeByRuntimeId = new Map<string, string>()
const sessionConnectionByRuntimeId = new Map<string, string>()
const sessionProfileByRuntimeId = new Map<string, string>()

function recordSessionEventProfile(event: { profile?: string; session_id?: string }): void {
  const profile = event.profile?.trim()

  if (event.session_id && profile) {
    sessionProfileByRuntimeId.set(event.session_id, profile)
  }
}

export function recordSessionEventScope(event: { connectionId?: string; profile?: string; session_id?: string }): void {
  recordSessionEventProfile(event)

  if (event.session_id && event.connectionId) {
    const connectionId = event.connectionId.trim()

    if (!connectionId) {
      return
    }

    sessionScopeByRuntimeId.set(event.session_id, registryBackendScopeKey(connectionId, event.profile))
    sessionConnectionByRuntimeId.set(event.session_id, connectionId)
  }
}

/** Bind an event from the window-owned primary socket to its real registry
 * source without adding it to the secondary-gateway keep-set. Primary socket
 * frames do not carry connectionId, even when that primary is a registered
 * remote connection, so the boot descriptor is the authoritative source. */
export function recordPrimarySessionEventSource(
  event: { profile?: string; session_id?: string },
  connection: HermesConnection | null | undefined
): void {
  recordSessionEventProfile(event)

  if (!event.session_id || !connection) {
    return
  }

  const connectionId = connection.connectionId?.trim() || (connection.mode === 'local' ? 'local' : '')

  if (connectionId) {
    sessionConnectionByRuntimeId.set(event.session_id, connectionId)
  }
}

/** Registry source that owns one live runtime session. Null means the source
 * is not known yet (a draft, a cold legacy tile, or a legacy remote descriptor
 * without a registry id); callers may then use an explicit compatibility
 * fallback. */
export function sessionConnectionId(runtimeId: null | string | undefined): string | null {
  return runtimeId ? (sessionConnectionByRuntimeId.get(runtimeId) ?? null) : null
}

/** Profile carried by the runtime event stream. Unlike the active profile or
 * session-list cache, this remains exact for a background split tile while the
 * foreground switches sources and replaces its session list. */
export function sessionEventProfile(runtimeId: null | string | undefined): string | null {
  return runtimeId ? (sessionProfileByRuntimeId.get(runtimeId) ?? null) : null
}

/** Stamp a runtime created/resumed through an owner-routed request immediately;
 * the first event will confirm the same identity later. Never replace a known
 * source: a late foreground change is not evidence of runtime ownership. */
export function recordSessionRuntimeOwner(runtimeId: string, owner: SessionTileOwner): void {
  if (!runtimeId) {
    return
  }

  sessionConnectionByRuntimeId.set(runtimeId, sessionConnectionByRuntimeId.get(runtimeId) ?? owner.connectionId)
  sessionProfileByRuntimeId.set(
    runtimeId,
    sessionProfileByRuntimeId.get(runtimeId) ?? normalizeProfileKey(owner.profile)
  )
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
  clearSessionWorkProgress(runtimeId)
  sessionScopeByRuntimeId.delete(runtimeId)
  sessionConnectionByRuntimeId.delete(runtimeId)
  sessionProfileByRuntimeId.delete(runtimeId)

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
  clearAllWorkProgress()
  sessionScopeByRuntimeId.clear()
  sessionConnectionByRuntimeId.clear()
  sessionProfileByRuntimeId.clear()
  $stalledSessionIds.set([])
  $sessionStates.set({})
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

export interface SessionTile {
  /** Composite renderer identity. Older in-memory test fixtures may omit it;
   * persisted v3 records and every newly opened tile always carry it. */
  tileId?: string
  /** Stored session id — the durable identity (runtime ids are ephemeral). */
  storedSessionId: string
  /** Registry source + profile that own this session. These two fields are
   * durable and immutable once known: the foreground may switch to another
   * source exposing the same profile name while this tile stays live. */
  connectionId?: string
  profile?: string
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

/** Concrete durable owner of a session tile. Kept structural (rather than
 * importing backend-owner.ts) because that module reads the runtime ledgers in
 * this store. */
export interface SessionTileOwner {
  connectionId: string
  profile: string
}

export function sessionTileIdentity(owner: SessionTileOwner, storedSessionId: string): string {
  return encodeURIComponent(JSON.stringify([owner.connectionId, normalizeProfileKey(owner.profile), storedSessionId]))
}

export function parseSessionTileIdentity(tileId: string): null | { owner: SessionTileOwner; storedSessionId: string } {
  try {
    const decoded = JSON.parse(decodeURIComponent(tileId)) as unknown

    if (
      !Array.isArray(decoded) ||
      decoded.length !== 3 ||
      decoded.some(value => typeof value !== 'string' || !value.trim())
    ) {
      return null
    }

    const [connectionId, profile, storedSessionId] = decoded

    return {
      owner: { connectionId, profile: normalizeProfileKey(profile) },
      storedSessionId
    }
  } catch {
    return null
  }
}

export function sessionTileKey(tile: SessionTile): string {
  const owner = sessionTileOwner(tile)

  return tile.tileId || (owner ? sessionTileIdentity(owner, tile.storedSessionId) : tile.storedSessionId)
}

export function sessionTilePaneId(tile: SessionTile): string {
  return `${TILE_PANE_PREFIX}${sessionTileKey(tile)}`
}

export function sessionTileOwner(tile: null | SessionTile | undefined): SessionTileOwner | null {
  const connectionId = tile?.connectionId?.trim()
  const profile = tile?.profile?.trim()

  return connectionId && profile ? { connectionId, profile: normalizeProfileKey(profile) } : null
}

function activeSessionTileOwner(): SessionTileOwner | null {
  const connection = $connection.get()
  const profile = normalizeProfileKey($activeGatewayProfile.get())
  const descriptorProfile = connection?.profile?.trim()

  // Profile activation publishes before the primary/shared descriptor swap in
  // a few legacy paths. During that gap `$connection` still names the source
  // we are leaving; treating the mixed pair as coherent would permanently bind
  // a profile-only v2 payload to the wrong registry source.
  if (descriptorProfile && normalizeProfileKey(descriptorProfile) !== profile) {
    return null
  }

  const connectionId = connection?.connectionId?.trim() || (connection?.mode === 'local' ? 'local' : '')

  return connectionId ? { connectionId, profile } : null
}

// v3 persists the concrete source on every tile. v2 is intentionally retained:
// its profile-only ownership is unknowable until a real connection descriptor
// arrives at boot, and keeping the old payload makes the migration reversible
// for a downgrade. The v3 envelope records which ONE source adopted each v2
// profile, so a later same-profile source can never adopt it again.
const TILES_KEY = 'hermes.desktop.sessionTiles.v3'
const LEGACY_V2_TILES_KEY = 'hermes.desktop.sessionTiles.v2'
const LEGACY_V1_TILES_KEY = 'hermes.desktop.sessionTiles.v1'
const TILE_PANE_PREFIX = 'session-tile:'

/** Persisted placement — `dir` + strip slot (`before`) + dock `anchor` so a
 *  restart / profile swap re-adopts tiles in the same order, not all stacked
 *  right of workspace. */
type StoredTile = Pick<
  SessionTile,
  'anchor' | 'before' | 'connectionId' | 'dir' | 'profile' | 'storedSessionId' | 'tileId'
>

type LegacyStoredTile = Pick<SessionTile, 'anchor' | 'before' | 'dir' | 'storedSessionId'>

interface StoredTilesV3 {
  legacyV2OwnerByProfile: Record<string, SessionTileOwner>
  tilesByProfile: Record<string, StoredTile[]>
  version: 3
}

const toStored = (t: SessionTile): StoredTile => ({
  anchor: t.anchor,
  before: t.before,
  connectionId: t.connectionId,
  dir: t.dir,
  profile: t.profile,
  storedSessionId: t.storedSessionId,
  tileId: sessionTileKey(t)
})

function parseLegacyTileList(value: unknown): LegacyStoredTile[] {
  return Array.isArray(value)
    ? value
        .filter((t): t is SessionTile => Boolean(t && typeof (t as SessionTile).storedSessionId === 'string'))
        .map(t => {
          const raw = t as SessionTile

          return {
            anchor: typeof raw.anchor === 'string' ? raw.anchor : undefined,
            before: typeof raw.before === 'string' || raw.before === null ? raw.before : undefined,
            dir: raw.dir,
            storedSessionId: raw.storedSessionId
          }
        })
    : []
}

function parseStoredTileList(value: unknown): StoredTile[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') {
      return []
    }

    const raw = candidate as Partial<SessionTile>
    const connectionId = raw.connectionId?.trim()
    const profile = raw.profile?.trim()

    if (!connectionId || !profile || typeof raw.storedSessionId !== 'string') {
      return []
    }

    const owner = { connectionId, profile: normalizeProfileKey(profile) }

    return [
      {
        anchor: typeof raw.anchor === 'string' ? raw.anchor : undefined,
        before: typeof raw.before === 'string' || raw.before === null ? raw.before : undefined,
        connectionId,
        dir: raw.dir,
        profile: owner.profile,
        storedSessionId: raw.storedSessionId,
        tileId: sessionTileIdentity(owner, raw.storedSessionId)
      }
    ]
  })
}

function parseLegacyOwners(value: unknown): Record<string, SessionTileOwner> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, SessionTileOwner> = {}

  for (const [rawProfile, rawOwner] of Object.entries(value as Record<string, unknown>)) {
    if (!rawOwner || typeof rawOwner !== 'object' || Array.isArray(rawOwner)) {
      continue
    }

    const owner = rawOwner as Partial<SessionTileOwner>
    const connectionId = owner.connectionId?.trim()
    const profile = owner.profile?.trim()

    if (connectionId && profile) {
      result[normalizeProfileKey(rawProfile)] = { connectionId, profile: normalizeProfileKey(profile) }
    }
  }

  return result
}

function loadTilesV3(): StoredTilesV3 {
  const tilesByProfile: Record<string, StoredTile[]> = {}
  const parsed = readJson<unknown>(TILES_KEY)

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const envelope = parsed as Partial<StoredTilesV3>
    const rawTiles = envelope.version === 3 ? envelope.tilesByProfile : undefined

    if (rawTiles && typeof rawTiles === 'object' && !Array.isArray(rawTiles)) {
      for (const [profile, list] of Object.entries(rawTiles)) {
        const tiles = parseStoredTileList(list)

        if (tiles.length > 0) {
          tilesByProfile[normalizeProfileKey(profile)] = tiles
        }
      }
    }

    return {
      legacyV2OwnerByProfile: parseLegacyOwners(envelope.legacyV2OwnerByProfile),
      tilesByProfile,
      version: 3
    }
  }

  return { legacyV2OwnerByProfile: {}, tilesByProfile, version: 3 }
}

function loadLegacyTilesByProfile(): Record<string, LegacyStoredTile[]> {
  const byProfile: Record<string, LegacyStoredTile[]> = {}
  const parsed = readJson<unknown>(LEGACY_V2_TILES_KEY)

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [profile, list] of Object.entries(parsed as Record<string, unknown>)) {
      const tiles = parseLegacyTileList(list)

      if (tiles.length > 0) {
        byProfile[normalizeProfileKey(profile)] = tiles
      }
    }
  }

  // v1 was a flat default-profile list. Keep both legacy keys untouched so a
  // downgrade can still read them; v3's binding marker prevents re-adoption.
  const legacyV1 = parseLegacyTileList(readJson<unknown>(LEGACY_V1_TILES_KEY))

  if (legacyV1.length > 0) {
    const key = normalizeProfileKey('default')
    byProfile[key] = [...(byProfile[key] ?? []), ...legacyV1]
  }

  return byProfile
}

const storedTilesV3 = loadTilesV3()
const tilesByProfile = storedTilesV3.tilesByProfile
const legacyTilesByProfile = loadLegacyTilesByProfile()
// Keyed by the GATEWAY profile: the rail's profile switch is a soft swap
// ($activeGatewayProfile moves, no reload) — $activeProfile mirrors the
// window's primary backend and never changes on a rail switch, so keying on
// it left the previous profile's tiles registered (phantom "Session" tabs).
const profileKey = () => normalizeProfileKey($activeGatewayProfile.get())

// Runtime ids are process-scoped — never trust a persisted one, so the live
// atom hydrates from the stored (runtime-less) tiles for the active profile.
// A secondary window (single-chat pop-out) shows ONLY its routed session — no
// tiles, and no repopulation on a profile switch.
export const $sessionTiles = atom<SessionTile[]>(isSecondaryWindow() ? [] : [...(tilesByProfile[profileKey()] ?? [])])

export function sessionTileForStoredId(storedSessionId: string, owner?: null | SessionTileOwner): SessionTile | null {
  const matches = $sessionTiles
    .get()
    .filter(
      tile => tile.storedSessionId === storedSessionId && (!owner || sameTileOwner(sessionTileOwner(tile), owner))
    )

  // A bare id is backward-compatible only while it is unambiguous. If two
  // sources legally expose the same id, guessing would target one at random.
  return matches.length === 1 ? matches[0] : null
}

export function sessionTileForKey(tileId: string): SessionTile | null {
  return $sessionTiles.get().find(tile => sessionTileKey(tile) === tileId) ?? null
}

function resolveSessionTile(ref: string, owner?: null | SessionTileOwner): SessionTile | null {
  return sessionTileForKey(ref) ?? sessionTileForStoredId(ref, owner)
}

function persistTiles() {
  // Shares the origin's storage; a secondary window holds no tiles, so a write
  // back would only wipe the primary's set.
  if (isSecondaryWindow()) {
    return
  }

  writeJson(TILES_KEY, storedTilesV3)
}

function sameTileOwner(left: null | SessionTileOwner, right: null | SessionTileOwner): boolean {
  return Boolean(left && right && left.connectionId === right.connectionId && left.profile === right.profile)
}

/** Bind a profile-only v2 payload exactly once, after boot publishes a concrete
 * connection. A missing descriptor or a later different source is a hard
 * no-op: guessing here would resurrect A's sessions on same-profile B. */
function adoptLegacyTilesForActiveOwner(): void {
  if (isSecondaryWindow()) {
    return
  }

  const owner = activeSessionTileOwner()

  if (!owner) {
    return
  }

  const key = owner.profile
  const legacy = legacyTilesByProfile[key]

  if (!legacy?.length) {
    return
  }

  const bound = storedTilesV3.legacyV2OwnerByProfile[key]

  if (bound && !sameTileOwner(bound, owner)) {
    return
  }

  if (!bound) {
    storedTilesV3.legacyV2OwnerByProfile[key] = owner
    const existing = tilesByProfile[key] ?? []
    const existingIds = new Set(existing.map(sessionTileKey))

    const adopted = legacy
      .map(tile => ({
        ...tile,
        connectionId: owner.connectionId,
        profile: owner.profile,
        tileId: sessionTileIdentity(owner, tile.storedSessionId)
      }))
      .filter(tile => !existingIds.has(tile.tileId))

    if (adopted.length > 0) {
      tilesByProfile[key] = [...existing, ...adopted]
    }

    persistTiles()
  }

  if (profileKey() === key) {
    $sessionTiles.set([...(tilesByProfile[key] ?? [])])
  }
}

function saveTiles(tiles: SessionTile[]) {
  $sessionTiles.set(tiles)
  const stored = tiles.map(toStored)

  if (stored.length > 0) {
    tilesByProfile[profileKey()] = stored
  } else {
    delete tilesByProfile[profileKey()]
  }

  persistTiles()
}

// Profile switch: surface the new profile's tiles with runtime ids cleared so
// they re-resume against the now-current gateway. (Fires immediately on
// subscribe; harmless — the init value already matches.) A secondary window
// never carries tiles, so it stays out of this entirely.
if (!isSecondaryWindow()) {
  $activeGatewayProfile.subscribe(() => {
    adoptLegacyTilesForActiveOwner()
    $sessionTiles.set([...(tilesByProfile[profileKey()] ?? [])])
  })
  $connection.subscribe(() => adoptLegacyTilesForActiveOwner())
}

export function patchSessionTile(ref: string, patch: Partial<SessionTile>, owner?: null | SessionTileOwner) {
  const target = resolveSessionTile(ref, owner)

  if (!target) {
    return
  }

  const targetKey = sessionTileKey(target)

  saveTiles(
    $sessionTiles.get().map(t => {
      if (sessionTileKey(t) !== targetKey) {
        return t
      }

      // Runtime discovery may fill an unknown legacy owner, but it can never
      // overwrite a durable one after the foreground switches sources.
      const owner = sessionTileOwner(t)
      const next = { ...t, ...patch }

      return owner ? { ...next, connectionId: owner.connectionId, profile: owner.profile } : next
    })
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
    $sessionTiles.set(
      tiles.map(tile => {
        const { runtimeId: _runtimeId, ...stored } = tile

        return stored
      })
    )
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
  archiveSession(storedSessionId: string, owner: SessionTileOwner): Promise<void>
  /** Branch a stored session into a new chat (the sidebar's branch). */
  branchSession(storedSessionId: string, owner: SessionTileOwner): Promise<void>
  /** Delete a stored session (the sidebar's delete, incl. tile cleanup). */
  deleteSession(storedSessionId: string, owner: SessionTileOwner): Promise<void>
  /** Run a slash command against a tile's session (app-level effects — e.g.
   *  branch/handoff — act on the main surface, as they should). */
  executeSlash(rawCommand: string, sessionId: string, owner: SessionTileOwner): Promise<void>
  /** Interrupt a tile's running turn. */
  interruptSession(runtimeId: string, owner: SessionTileOwner): Promise<void>
  /** Drop the wiring cache's stored→runtime bindings. Called on gateway
   *  reconnect: a respawned backend re-mints runtime ids, so every binding
   *  recorded before the reconnect is suspect — without this, `resumeTile`'s
   *  warm path re-binds tiles to dead runtime ids (the sleep/wake "empty
   *  right pane" bug). Bindings re-record from live post-reconnect events. */
  invalidateRuntimeBindings?(): void
  /** Bind a live runtime id for a stored session (resume without touching
   *  the main view). Returns the runtime id, or throws. */
  resumeTile(storedSessionId: string, owner: SessionTileOwner): Promise<string>
  /** Submit a prompt to a tile's live session. */
  submitToSession(runtimeId: string, text: string, owner: SessionTileOwner): Promise<void>
  /** THE session-state write path — routes through the wiring cache so the
   *  cache, the primary view (when active), and every tile mirror agree. */
  updateSession(runtimeId: string, updater: (state: ClientSessionState) => ClientSessionState): ClientSessionState
}

let delegate: SessionTileDelegate | null = null
export const $sessionTileDelegateEpoch = atom(0)

export function setSessionTileDelegate(next: SessionTileDelegate) {
  delegate = next
  $sessionTileDelegateEpoch.set($sessionTileDelegateEpoch.get() + 1)
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
export function orderTilesByTree<T extends SessionTile>(tree: LayoutNode | null, tiles: readonly T[]): null | T[] {
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
    (a, b) => (rank.get(sessionTileKey(a)) ?? Infinity) - (rank.get(sessionTileKey(b)) ?? Infinity)
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
  before?: null | string,
  owner: SessionTileOwner | null = activeSessionTileOwner()
) {
  const tiles = $sessionTiles.get()

  // Opening a session in a tab/tile is "reading" it — clear its unread dot
  // exactly like main-thread resume does. Previously only
  // setSelectedStoredSessionId cleared unread, so tile-opened sessions kept
  // their green dot even while the user was reading them. Acks the persisted
  // watermark/marker too so a later list refresh doesn't repaint it.
  if (owner && sameTileOwner(owner, activeSessionTileOwner())) {
    markSessionRead(storedSessionId)
    ackStoredSessionId(storedSessionId)
  }

  if (
    storedSessionId === $selectedStoredSessionId.get() &&
    (!owner || sameTileOwner(owner, activeSessionTileOwner()))
  ) {
    return
  }

  const dock = anchor ?? focusedSessionTabAnchor() ?? undefined
  const tileId = owner ? sessionTileIdentity(owner, storedSessionId) : ''

  if (!tileId || !tiles.some(t => sessionTileKey(t) === tileId)) {
    // A new tile without a concrete source would be free to resume on whatever
    // gateway becomes ambient later. Fail closed; callers can retry once boot
    // has published the connection descriptor.
    if (!owner) {
      return
    }

    saveTiles([
      ...tiles,
      {
        anchor: dock,
        before,
        connectionId: owner.connectionId,
        dir,
        profile: normalizeProfileKey(owner.profile),
        storedSessionId,
        tileId
      }
    ])
    // Adoption is async via the registry — order sync runs after the move path
    // below; a brand-new tile's strip slot is already in `before`.

    return
  }

  // Already open: relocate the existing pane to the drop target (pane-mirror
  // only docks on first adoption, so a re-drag must move the tree pane itself).
  const tree = $layoutTree.get()
  const target = tree ? findGroupOfPane(tree, dock ?? 'workspace')?.id : null

  if (target) {
    moveTreePane(`${TILE_PANE_PREFIX}${tileId}`, { before: before ?? null, groupId: target, pos: dir })
    patchSessionTile(tileId, { anchor: dock, before: before ?? undefined, dir })
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
      const tileId = paneId.slice(TILE_PANE_PREFIX.length)
      const tile = tiles.find(candidate => sessionTileKey(candidate) === tileId)

      if (tile) {
        return sessionTileKey(tile)
      }
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
export function focusOpenSession(
  storedSessionId: string,
  owner: SessionTileOwner | null = activeSessionTileOwner()
): 'main' | 'tile' | null {
  const tile = resolveSessionTile(storedSessionId, owner)

  if (tile) {
    const paneId = sessionTilePaneId(tile)
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
  states: Record<string, ClientSessionState>,
  owner?: null | SessionTileOwner
): null | SessionTile {
  return (
    tiles.findLast(tile => {
      if (owner && !sameTileOwner(sessionTileOwner(tile), owner)) {
        return false
      }

      const { runtimeId } = tile
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
  const owner = activeSessionTileOwner()
  const tile = blankDraftTile($sessionTiles.get(), $sessionStates.get(), owner)

  if (!tile || tile.storedSessionId === storedSessionId) {
    return false
  }

  discardSessionTile(sessionTileKey(tile))
  openSessionTile(storedSessionId, tile.dir, tile.anchor, tile.before, owner)
  const replacement = sessionTileForStoredId(storedSessionId, owner)

  if (replacement) {
    revealTreePane(sessionTilePaneId(replacement))
  }

  return true
}

// Closed-tab stack for ⌘⇧T reopen (in-memory) — keyed PER PROFILE like the
// tiles themselves, so ⌘⇧T after a profile switch never resurrects the other
// profile's session. The tile's placement is remembered so it returns in place.
const closedTilesByProfile: Record<string, SessionTile[]> = {}
const closedStack = (): SessionTile[] => (closedTilesByProfile[profileKey()] ??= [])

export function closeSessionTile(ref: string, owner?: null | SessionTileOwner) {
  const tile = resolveSessionTile(ref, owner)

  if (!tile) {
    return
  }

  const tileId = sessionTileKey(tile)

  if (tile) {
    closedStack().push(toStored(tile))
  }

  saveTiles($sessionTiles.get().filter(t => sessionTileKey(t) !== tileId))

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
export function discardSessionTile(ref: string, owner?: null | SessionTileOwner) {
  const tile = resolveSessionTile(ref, owner)

  if (!tile) {
    return
  }

  const runtimeId = tile.runtimeId

  if (runtimeId) {
    dropSessionState(runtimeId)
  }

  saveTiles($sessionTiles.get().filter(t => sessionTileKey(t) !== sessionTileKey(tile)))
}

/** ⌘⇧T — reopen the most recently closed tab where it was, then focus it.
 *  Adoption alone is silent (won't steal the active tab), so restore has to
 *  front the pane explicitly. Skips ids that are live again (reopened / now
 *  the primary). */
export function reopenLastClosedTile(): void {
  const stack = closedStack()

  for (let tile = stack.pop(); tile; tile = stack.pop()) {
    const { storedSessionId } = tile

    const tileOwner = sessionTileOwner(tile)

    if (
      storedSessionId === $selectedStoredSessionId.get() &&
      (!tileOwner || sameTileOwner(tileOwner, activeSessionTileOwner()))
    ) {
      continue
    }

    if (!sessionTileForStoredId(storedSessionId, sessionTileOwner(tile))) {
      openSessionTile(storedSessionId, tile.dir, tile.anchor, tile.before, sessionTileOwner(tile))
      focusOpenSession(storedSessionId, sessionTileOwner(tile))

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
  [$activeTreeGroup, $layoutTree, $selectedStoredSessionId, $sessionTiles],
  (groupId, tree, selected, tiles) => {
    const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

    if (active?.startsWith(TILE_PANE_PREFIX)) {
      const tileId = active.slice(TILE_PANE_PREFIX.length)

      return tiles.find(tile => sessionTileKey(tile) === tileId)?.storedSessionId ?? null
    }

    return selected
  }
)

/** Live runtime id of the focused session (a tile's bound runtime, else the
 *  primary's active session). */
export const $focusedRuntimeId = computed(
  [$activeTreeGroup, $layoutTree, $activeSessionId, $sessionTiles],
  (groupId, tree, primaryRuntime, tiles) => {
    const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

    if (active?.startsWith(TILE_PANE_PREFIX)) {
      const tileId = active.slice(TILE_PANE_PREFIX.length)

      return tiles.find(tile => sessionTileKey(tile) === tileId)?.runtimeId ?? null
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
  !(
    selected &&
    tiles.some(tile => {
      if (tile.storedSessionId !== selected) {
        return false
      }

      const owner = activeSessionTileOwner()
      const tileOwner = sessionTileOwner(tile)

      return !owner || !tileOwner || sameTileOwner(tileOwner, owner)
    })
  )

// Bringing a finished session to the front clears its green dot. Keyed on the
// FOCUSED session, not the selected one: a tile is never $selectedStoredSessionId,
// and a tile tab click goes through activateTreePane rather than focusOpenSession,
// so this is the one hook that catches every way a tile reaches the front.
// Clears the whole conversation family (markSessionRead) AND acks the
// persisted watermark/marker (ackStoredSessionId) so the next list refresh
// doesn't repaint the dot the user just cleared by looking at it.
$focusedStoredSessionId.listen(focused => {
  if (focused) {
    const groupId = $activeTreeGroup.get()
    const tree = $layoutTree.get()
    const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

    const tile = active?.startsWith(TILE_PANE_PREFIX) ? sessionTileForKey(active.slice(TILE_PANE_PREFIX.length)) : null

    // Unread persistence is legacy profile+id scoped. Until that store gains a
    // source dimension, a background A tile must fail closed instead of
    // clearing B's same-profile/same-id marker through ambient row lookup.
    if (tile && !sameTileOwner(sessionTileOwner(tile), activeSessionTileOwner())) {
      return
    }

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
