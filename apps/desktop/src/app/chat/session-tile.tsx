/**
 * SESSION TILES — a stored session rendered as a layout-tree pane BESIDE the
 * main thread (multi-session tiling). A tile IS the real chat surface: the
 * same ChatView/ChatBar/Thread tree the primary session renders, mounted
 * under a tile `SessionView` (its session's slice of `$sessionStates`) and a
 * tile `ComposerScope` (own attachment chips, own focus-bus key). Actions
 * (submit/slash/steer/edit/reload/restore/stop) come from
 * `useSessionTileActions`, all writing through the wiring cache.
 *
 * Lifecycle: `openSessionTile(storedId)` -> `watchSessionTiles` registers a
 * pane contribution docked right of the main zone -> tree adoption lands it
 * -> the pane mounts and asks the delegate for a live runtime id. Closing
 * the pane (tab Close) removes the tile + its zone; tiles persist across
 * restarts and re-resume on boot.
 */

import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { atom, computed } from 'nanostores'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import { useModelControls } from '@/app/session/hooks/use-model-controls'
import { blobToDataUrl } from '@/app/session/hooks/use-prompt-actions/utils'
import { resolveStoredSession } from '@/app/session/hooks/use-session-actions/utils'
import { ModelMenuPanel } from '@/app/shell/model-menu-panel'
import { formatRefValue } from '@/components/assistant-ui/directive-text'
import { CenteredThreadSpinner } from '@/components/assistant-ui/thread/status'
import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree, closeTreePane, moveTreePane, setTreeGroupHeaderHidden } from '@/components/pane-shell/tree/store'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { type HermesGateway, transcribeAudio } from '@/hermes'
import { translateNow, useI18n } from '@/i18n'
import type { ChatMessage } from '@/lib/chat-messages'
import { activeBackendOwner, sameBackendOwner } from '@/store/backend-owner'
import { createComposerAttachmentScope, draftTitleFor } from '@/store/composer'
import { requestGatewayForAgent } from '@/store/gateway'
import { $pinnedSessionIds, pinSession, unpinSession } from '@/store/layout'
import { $projectTree } from '@/store/projects'
import { sessionAwaitingInput } from '@/store/prompts'
import { $selectedStoredSessionId, $sessions, sessionMatchesStoredId, sessionPinId } from '@/store/session'
import {
  $sessionStates,
  $sessionTileDelegateEpoch,
  $sessionTiles,
  closeSessionTile,
  discardSessionTile,
  patchSessionTile,
  type SessionTile,
  sessionTileDelegate,
  sessionTileForKey,
  sessionTileKey,
  type SessionTileOwner,
  sessionTileOwner,
  sessionTilePaneId
} from '@/store/session-states'
import type { SessionInfo } from '@/types/hermes'

import type { SessionDragPayload } from './composer/inline-refs'
import { type ComposerScope, ComposerScopeProvider } from './composer/scope'
import { useComposerActions } from './hooks/use-composer-actions'
import { paneMirror } from './pane-mirror'
import { SessionDraftTitle } from './session-draft-title'
import { startSessionDrag } from './session-drag'
import { SessionStatusDot } from './session-status-dot'
import { sessionTabTitle } from './session-tab-title'
import { useSessionTileActions } from './session-tile-actions'
import { type SessionView, SessionViewProvider } from './session-view'
import { SessionContextMenu } from './sidebar/session-actions-menu'
import { lastVisibleMessageIsUser } from './thread-loading'

import { ChatView } from '.'

const NO_MESSAGES: ChatMessage[] = []

/** The tile's SessionView: the same atom shape the primary chat renders
 *  from, computed from this session's slice of `$sessionStates`. */
function buildTileView(tileId: string, storedSessionId: string): SessionView {
  const $runtimeId = computed($sessionTiles, tiles => tiles.find(t => sessionTileKey(t) === tileId)?.runtimeId ?? null)

  const $state = computed([$runtimeId, $sessionStates], (runtimeId, states) =>
    runtimeId ? states[runtimeId] : undefined
  )

  const $messages = computed($state, state => state?.messages ?? NO_MESSAGES)

  return {
    kind: 'tile',
    $advisorEnabled: computed($state, state => Boolean(state?.advisorEnabled)),
    $awaitingResponse: computed($state, state => Boolean(state?.awaitingResponse)),
    $busy: computed($state, state => Boolean(state?.busy)),
    $cwd: computed($state, state => state?.cwd ?? ''),
    $fast: computed($state, state => Boolean(state?.fast)),
    $lastVisibleIsUser: computed($messages, lastVisibleMessageIsUser),
    $messages,
    $messagesEmpty: computed($messages, messages => messages.length === 0),
    $model: computed($state, state => state?.model ?? ''),
    $provider: computed($state, state => state?.provider ?? ''),
    $reasoningEffort: computed($state, state => state?.reasoningEffort ?? ''),
    $runtimeId,
    // Constant for the tile's lifetime — a plain atom, not a computed.
    $storedId: atom(storedSessionId),
    $usage: computed($state, state => state?.usage ?? null)
  }
}

// Module-level constants so these ChatView props are referentially stable —
// tiles have no pin/delete affordance, and transcription needs no per-tile state.
const noop = () => undefined

function TileChat({
  owner,
  runtimeId,
  storedSessionId,
  tileId,
  view
}: {
  owner: SessionTileOwner
  runtimeId: string
  storedSessionId: string
  tileId: string
  view: SessionView
}) {
  const queryClient = useQueryClient()

  const requestGateway = useCallback(
    <T,>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number, signal?: AbortSignal) =>
      requestGatewayForAgent<T>(owner.connectionId, owner.profile, method, params, timeoutMs, signal),
    [owner.connectionId, owner.profile]
  )

  // ChatView descendants accept a HermesGateway value but only consume its
  // request method. This immutable adapter keeps advisor/context/model/editor
  // actions on the tile owner even while another gateway is foregrounded.
  const gateway = useMemo(
    () =>
      ({
        connectionState: 'open',
        request: requestGateway
      }) as unknown as HermesGateway,
    [requestGateway]
  )

  const { selectModel } = useModelControls({ owner, queryClient, requestGateway })
  const cwd = useStore(view.$cwd)

  // One attachment set + focus key per tile, stable for the tile's lifetime.
  const attachments = useRef(createComposerAttachmentScope()).current

  const scope = useMemo<ComposerScope>(
    () => ({
      $awaitingInput: sessionAwaitingInput(runtimeId),
      $messages: view.$messages,
      attachments,
      target: `tile:${tileId}`
    }),
    [attachments, runtimeId, tileId, view.$messages]
  )

  const actions = useSessionTileActions({ owner, runtimeId, scope, storedSessionId })

  // The same attach/pick/paste/drop pipeline the primary composer uses,
  // pointed at this tile's chips + session.
  const composer = useComposerActions({
    activeSessionId: runtimeId,
    currentCwd: cwd,
    requestGateway,
    scope: {
      add: attachments.add,
      remove: attachments.remove,
      target: scope.target,
      update: attachments.update,
      updateIfCurrent: attachments.updateIfCurrent
    }
  })

  // ChatView is memo()d — every callback prop must be referentially stable or
  // the memo never holds and each tile-level render (idle ticks, unrelated
  // store updates) re-renders the whole chat shell. The individual composer
  // functions are useCallback'd inside useComposerActions, so hoisting these
  // wrappers onto them keeps identity stable across renders.
  const { addContextRefAttachment, pasteClipboardImage, pickContextPaths, pickImages, removeAttachment } = composer

  const onAddUrl = useCallback(
    (url: string) => addContextRefAttachment(`@url:${formatRefValue(url)}`, url),
    [addContextRefAttachment]
  )

  const onPasteClipboardImage = useCallback(
    (opts?: { silent?: boolean }) => pasteClipboardImage(opts),
    [pasteClipboardImage]
  )

  const onPickFiles = useCallback(() => void pickContextPaths('file'), [pickContextPaths])
  const onPickFolders = useCallback(() => void pickContextPaths('folder'), [pickContextPaths])
  const onPickImages = useCallback(() => void pickImages(), [pickImages])
  const onRemoveAttachment = useCallback((id: string) => void removeAttachment(id), [removeAttachment])
  const onRetryResume = useCallback(() => patchSessionTile(tileId, { error: undefined }), [tileId])

  const onTranscribeAudio = useCallback(
    async (audio: Blob) =>
      (await transcribeAudio(await blobToDataUrl(audio), audio.type, owner.profile, owner.connectionId)).transcript,
    [owner.connectionId, owner.profile]
  )

  // Per-tile model menu — rendered under this tile's SessionView so the pill
  // + switch target THIS runtime, not the primary (which may be mid-turn).
  const modelMenuContent = useMemo(
    () => (
      <ModelMenuPanel
        connectionId={owner.connectionId}
        gateway={gateway}
        onSelectModel={selectModel}
        profile={owner.profile}
        requestGateway={requestGateway}
      />
    ),
    [gateway, owner.connectionId, owner.profile, requestGateway, selectModel]
  )

  return (
    <SessionViewProvider value={view}>
      <ComposerScopeProvider value={scope}>
        <ChatView
          backendOwner={owner}
          gateway={gateway}
          gatewayReady
          modelMenuContent={modelMenuContent}
          onAddContextRef={addContextRefAttachment}
          onAddUrl={onAddUrl}
          onAttachDroppedItems={composer.attachDroppedItems}
          onAttachImageBlob={composer.attachImageBlob}
          onAttachPrCommentUrl={composer.attachPrCommentUrl}
          onCancel={actions.cancelRun}
          onDeleteSelectedSession={noop}
          onDismissError={actions.dismissError}
          onEdit={actions.editMessage}
          onPasteClipboardImage={onPasteClipboardImage}
          onPickFiles={onPickFiles}
          onPickFolders={onPickFolders}
          onPickImages={onPickImages}
          onReload={actions.reloadFromMessage}
          onRemoveAttachment={onRemoveAttachment}
          onRestoreToMessage={actions.restoreToMessage}
          onRetryResume={onRetryResume}
          onSteer={actions.steerPrompt}
          onSubmit={actions.submitText}
          onThreadMessagesChange={actions.handleThreadMessagesChange}
          onToggleSelectedPin={noop}
          onTranscribeAudio={onTranscribeAudio}
          paneId={`session-tile:${tileId}`}
        />
      </ComposerScopeProvider>
    </SessionViewProvider>
  )
}

export function SessionTilePane({ tileId }: { tileId: string }) {
  const { t } = useI18n()
  const tiles = useStore($sessionTiles)
  const tile = tiles.find(t => sessionTileKey(t) === tileId)
  const storedSessionId = tile?.storedSessionId ?? ''
  const owner = useMemo(() => sessionTileOwner(tile), [tile?.connectionId, tile?.profile])
  const runtimeId = tile?.runtimeId ?? null
  const delegateEpoch = useStore($sessionTileDelegateEpoch)
  const resumingRef = useRef(false)
  const view = useMemo(() => buildTileView(tileId, storedSessionId), [storedSessionId, tileId])

  // A tab-strip "+"/⌘T tab is created UNLISTED — its session stays out of
  // $sessions (no sidebar clutter) until it's actually used, so the tab shows
  // "New session". The moment this tile has a message, pull its row into
  // $sessions via the lightweight by-id lookup so the tab (and a sidebar row)
  // resolve the real title. `resolveStoredSession` no-ops when it's already
  // listed, and 404s harmlessly for an in-memory draft that hasn't persisted a
  // turn yet — so we retry across that brief persist lag and stop as soon as it
  // lands (a global turn-complete refresh may beat us to it).
  const hasMessages = useStore(view.$messagesEmpty) === false

  useEffect(() => {
    const alreadyListed = () => $sessions.get().some(s => sessionMatchesStoredId(s, storedSessionId))

    if (!runtimeId || !hasMessages || alreadyListed()) {
      return
    }

    let cancelled = false
    let timer: number | undefined

    const attempt = (remaining: number) => {
      if (cancelled || alreadyListed()) {
        return
      }

      if (!owner) {
        return
      }

      void resolveStoredSession(storedSessionId, owner)
        .then(resolved => {
          if (cancelled || resolved || remaining <= 0) {
            return
          }

          timer = window.setTimeout(() => attempt(remaining - 1), 500)
        })
        .catch(() => undefined)
    }

    attempt(6)

    return () => {
      cancelled = true

      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }, [hasMessages, owner, runtimeId, storedSessionId])

  // The exact-owner requester opens/dials its own registry socket. Ambient
  // gateway state belongs to the foreground source and must not gate an A tile
  // while B is closed (or trigger retries when only B changes).
  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (runtimeId || tile?.error || resumingRef.current || !owner || !storedSessionId) {
      return
    }

    const delegate = sessionTileDelegate()

    if (!delegate) {
      return
    }

    resumingRef.current = true

    delegate
      .resumeTile(storedSessionId, owner)
      .then(id => patchSessionTile(tileId, { error: undefined, runtimeId: id }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)

        // A gone session (404 / "Session not found") is terminal — a stale or
        // cross-profile persisted tile. Discard it instead of latching an error
        // that re-retries on every reconnect (the "Session not found" spam).
        if (/session not found|\b404\b/i.test(message)) {
          discardSessionTile(tileId)
        } else {
          patchSessionTile(tileId, { error: message })
        }
      })
      .finally(() => {
        resumingRef.current = false
      })
  }, [delegateEpoch, owner, runtimeId, storedSessionId, tile?.error, tileId])

  if (tile?.error) {
    return (
      <div className="grid h-full place-items-center p-4">
        <div className="max-w-[24rem] space-y-2 text-center font-mono text-[11px]">
          <div className="text-(--ui-danger,#f87171)">{t.desktop.resumeStrandedTitle}</div>
          <div className="break-words text-(--ui-text-quaternary)">{tile.error}</div>
          <Button onClick={() => patchSessionTile(tileId, { error: undefined })} size="sm" variant="outline">
            {t.common.retry}
          </Button>
        </div>
      </div>
    )
  }

  if (!runtimeId) {
    // The SAME session loader the primary thread shows (Thread's
    // loading === 'session' branch) — one loading language everywhere.
    return (
      <div className="relative h-full">
        <CenteredThreadSpinner />
      </div>
    )
  }

  if (!owner) {
    return null
  }

  return <TileChat owner={owner} runtimeId={runtimeId} storedSessionId={storedSessionId} tileId={tileId} view={view} />
}

// ---------------------------------------------------------------------------
// Tile -> pane contribution sync (call once from the app root).
// ---------------------------------------------------------------------------

/** Resolve a tile's stored row: the recents list first, then the project
 *  tree. A session opened as a tab from a project group is often older than
 *  the paginated recents page, so it has no `$sessions` row at all until new
 *  activity lands it there — resolving through the tree keeps its tab titled
 *  and tinted instead of a grey "Session" placeholder. */
function tileForRef(ref: string): SessionTile | null {
  const exact = sessionTileForKey(ref)

  if (exact) {
    return exact
  }

  const matches = $sessionTiles.get().filter(tile => tile.storedSessionId === ref)

  return matches.length === 1 ? matches[0] : null
}

export function tileStoredRow(ref: string): SessionInfo | undefined {
  const tile = tileForRef(ref)
  const owner = sessionTileOwner(tile)

  if (owner && !sameBackendOwner(activeBackendOwner(), owner)) {
    return undefined
  }

  const storedSessionId = tile?.storedSessionId ?? ref
  const match = (s: SessionInfo) => sessionMatchesStoredId(s, storedSessionId)

  return (
    $sessions.get().find(match) ??
    $projectTree
      .get()
      .flatMap(p => [...p.repos.flatMap(r => r.groups.flatMap(g => g.sessions)), ...(p.previewSessions ?? [])])
      .find(match)
  )
}

/** The tab's REGISTERED name. Deliberately the bare placeholder for a draft
 *  rather than its live composer title (`tabTitle` renders that): re-registering
 *  per keystroke would re-render the strip, and holding the draft's text here
 *  would let the registered name already match the row that lands on send —
 *  skipping the re-register that hands the tab back to this string. */
function tileTitle(tileId: string): string {
  const stored = tileStoredRow(tileId)

  return stored ? sessionTabTitle(stored) : translateNow('commandCenter.nav.newChat.title')
}

/** The `@session` link payload for a tile tab drag — id + owning profile + title.
 *  Resolved at drag time, so an unsent tab drags under its draft name. */
function tileDragPayload(tileId: string): SessionDragPayload {
  const tile = tileForRef(tileId)
  const owner = sessionTileOwner(tile)
  const storedSessionId = tile?.storedSessionId ?? tileId
  const stored = tileStoredRow(tileId)

  const title = stored
    ? sessionTabTitle(stored)
    : draftTitleFor(tileId) || translateNow('commandCenter.nav.newChat.title')

  return {
    connectionId: owner?.connectionId,
    id: storedSessionId,
    profile: owner?.profile ?? stored?.profile ?? '',
    title
  }
}

// ---------------------------------------------------------------------------
// Close confirmation — a BUSY tab (streaming, or blocked on clarify/approval
// input) doesn't close silently.
// ---------------------------------------------------------------------------

/** Stored id awaiting close confirmation (null = no dialog). */
const $confirmCloseTile = atom<null | string>(null)

/** The tile closer, gated: a quiet session closes immediately; a busy or
 *  input-blocked one asks first. One state read — the tile's runtime slice. */
export function requestCloseSessionTile(tileId: string): void {
  const runtimeId = tileForRef(tileId)?.runtimeId
  const state = runtimeId ? $sessionStates.get()[runtimeId] : undefined

  if (state?.busy || state?.awaitingResponse || state?.needsInput) {
    $confirmCloseTile.set(tileId)
  } else {
    closeSessionTile(tileId)
  }
}

/** Mounted once at the shell root: the "Close running tab?" confirmation. */
export function SessionTileCloseConfirm() {
  const { t } = useI18n()
  const tileId = useStore($confirmCloseTile)

  return (
    <ConfirmDialog
      confirmLabel={t.zones.closeRunningConfirm}
      description={t.zones.closeRunningBody}
      destructive
      onClose={() => $confirmCloseTile.set(null)}
      onConfirm={() => {
        if (tileId) {
          closeSessionTile(tileId)
        }
      }}
      open={tileId !== null}
      title={t.zones.closeRunningTitle}
    />
  )
}

/** Layout reset → every session tile collapses into the MAIN zone as a tab
 *  after the workspace (the primary session stays the first tab), the "smart"
 *  reset: N scattered tiles become one tab bar over the chat instead of
 *  re-docking to their old edges.
 *
 *  Runs BEFORE generic adoption (see registerLayoutResetHandler) — the tiles
 *  aren't in the fresh tree yet, so each `moveTreePane` ADDS the tile into the
 *  workspace group as a tab (append). The main group id is re-read each pass
 *  because appending returns a new tree. */
export function stackSessionTilesIntoMain(): void {
  for (const tile of $sessionTiles.get()) {
    const tree = $layoutTree.get()
    const mainGroup = tree ? findGroupOfPane(tree, 'workspace')?.id : null

    if (mainGroup) {
      moveTreePane(sessionTilePaneId(tile), { groupId: mainGroup, pos: 'center' })
    }
  }
}

/** The three scalars the tab menu actually renders, derived from the stored
 *  row. Subscribing to `$sessions` + `$projectTree` wholesale re-rendered
 *  every tab's menu wrapper on ANY session-list or tree churn (polls, title
 *  updates in other sessions) — for a context menu that's almost never open.
 *  Same class as the TreeGroup fix (#72245): derive narrowly, bail out unless
 *  the derived values change. */
function useTileMenuRow(tileId: string, tileScoped = true): { pinId: string; profile?: string; title: string } {
  const cache = useRef<{ key: string; value: { pinId: string; profile?: string; title: string } } | null>(null)

  const subscribe = useCallback((onChange: () => void) => {
    const offSessions = $sessions.listen(onChange)
    const offTree = $projectTree.listen(onChange)

    return () => {
      offSessions()
      offTree()
    }
  }, [])

  return useSyncExternalStore(subscribe, () => {
    const tile = tileScoped ? tileForRef(tileId) : null
    const storedSessionId = tile?.storedSessionId ?? tileId

    const stored = tileScoped
      ? tileStoredRow(tileId)
      : $sessions.get().find(session => sessionMatchesStoredId(session, storedSessionId))

    const pinId = stored ? sessionPinId(stored) : storedSessionId
    const title = stored ? sessionTabTitle(stored) : translateNow('commandCenter.nav.newChat.title')
    const profile = sessionTileOwner(tile)?.profile ?? stored?.profile
    const key = `${pinId}\u0000${title}\u0000${profile ?? ''}`

    if (cache.current?.key !== key) {
      cache.current = { key, value: { pinId, profile, title } }
    }

    return cache.current.value
  })
}

/** A session TAB's context menu: the full session verb set (pin, copy id, new
 *  window, branch, rename, archive, delete) — the SAME menu a sidebar row
 *  gets, targeted through the tile delegate (whose verbs are generic over
 *  stored ids, primary included). The wrapper stops the contextmenu from also
 *  opening the zone strip's menu. Shared by tile tabs AND the main tab. */
export function SessionTabMenu({
  children,
  onClose,
  onHideTabBar,
  storedSessionId,
  tileId,
  tabPaneId
}: {
  children: React.ReactElement
  /** Close this tab (tiles; the main tab passes nothing). */
  onClose?: () => void
  /** Hide the zone's tab bar (main tab only — the sticky bar's off switch). */
  onHideTabBar?: () => void
  storedSessionId: string
  /** Composite tile key. Omitted only by the foreground workspace tab. */
  tileId?: string
  /** Layout-tree pane id — powers the Close-others/right/all verbs. */
  tabPaneId: string
}) {
  const ref = tileId ?? storedSessionId
  const tile = tileId ? tileForRef(tileId) : null
  const owner = tileId ? sessionTileOwner(tile) : activeBackendOwner()
  const foregroundOwnsTile = !tileId || sameBackendOwner(activeBackendOwner(), owner)
  const { pinId, profile, title } = useTileMenuRow(ref, Boolean(tileId))
  const pinnedSessionIds = useStore($pinnedSessionIds)
  const pinned = pinnedSessionIds.includes(pinId)

  return (
    <span className="contents" onContextMenu={event => event.stopPropagation()}>
      <SessionContextMenu
        ambientActionsEnabled={foregroundOwnsTile}
        connectionId={owner?.connectionId}
        onArchive={owner ? () => void sessionTileDelegate()?.archiveSession(storedSessionId, owner) : undefined}
        onBranch={owner ? () => void sessionTileDelegate()?.branchSession(storedSessionId, owner) : undefined}
        onClose={onClose}
        onDelete={owner ? () => void sessionTileDelegate()?.deleteSession(storedSessionId, owner) : undefined}
        onHideTabBar={onHideTabBar}
        onPin={foregroundOwnsTile ? () => (pinned ? unpinSession(pinId) : pinSession(pinId)) : undefined}
        pinned={foregroundOwnsTile && pinned}
        profile={profile}
        runtimeId={tile?.runtimeId}
        sessionId={storedSessionId}
        surface="tab"
        tabPaneId={tabPaneId}
        title={title}
      >
        {children}
      </SessionContextMenu>
    </span>
  )
}

/** The MAIN tab's menu: the same session verbs targeting the primary's loaded
 *  session, plus Close (the tab empties to a fresh draft — the workspace pane
 *  itself never leaves the tree) and the bar's off switch (the bar sticky-shows
 *  once a tab is ever gained; this is the explicit way back). A fresh draft has
 *  no session — no menu. */
export function WorkspaceTabMenu({ children }: { children: React.ReactElement }) {
  const selected = useStore($selectedStoredSessionId)

  const hideTabBar = () => {
    const tree = $layoutTree.get()
    const group = tree ? findGroupOfPane(tree, 'workspace') : null

    if (group) {
      setTreeGroupHeaderHidden(group.id, true)
    }
  }

  if (!selected) {
    return children
  }

  return (
    <SessionTabMenu
      onClose={() => closeTreePane('workspace')}
      onHideTabBar={hideTabBar}
      storedSessionId={selected}
      tabPaneId="workspace"
    >
      {children}
    </SessionTabMenu>
  )
}

/** Keep pane contributions mirroring `$sessionTiles` (+ titles from
 *  `$sessions`). Tiles dock against main on the chosen edge, flex width. */
export const watchSessionTiles = paneMirror<SessionTile>({
  source: $sessionTiles,
  // $projectTree: a tile whose session is older than the recents page resolves
  // its title through the tree, which loads after the tiles register. (The tab's
  // status dot subscribes to color/state itself, so it needs no `also` entry.)
  also: [$sessions, $projectTree],
  key: sessionTileKey,
  prefix: 'session-tile',
  dir: t => t.dir,
  anchor: t => t.anchor,
  before: t => t.before,
  minWidth: '20rem',
  title: tileTitle,
  // The tab's status dot — the SAME primitive the sidebar row renders, keyed by
  // the stored id, so a session's status/color can never disagree between the
  // two surfaces. Self-subscribing (live state + resolved color), so the strip
  // needn't re-sync when it changes.
  tabLead: tileId => {
    const tile = tileForRef(tileId)

    return <SessionStatusDot session={tileStoredRow(tileId)} storedSessionId={tile?.storedSessionId ?? null} />
  },
  // Until the first turn lists a row there is no title to register, so the tab
  // takes its name from the composer instead — live, without re-registering.
  tabTitle: tileId => (tileStoredRow(tileId) ? null : <SessionDraftTitle scope={tileId} />),
  render: tileId => <SessionTilePane tileId={tileId} />,
  tabWrap: (tileId, tab) => {
    const tile = tileForRef(tileId)

    return tile ? (
      <SessionTabMenu
        onClose={() => requestCloseSessionTile(tileId)}
        storedSessionId={tile.storedSessionId}
        tabPaneId={`session-tile:${tileId}`}
        tileId={tileId}
      >
        {tab}
      </SessionTabMenu>
    ) : (
      tab
    )
  },
  // A tile's tab drags like a sidebar row — stack / split / drop-to-link — with
  // its tap (activate) + double-tap (hide bar) preserved. Always takes the drag.
  tabDrag: (tileId, event, onTap, double) => {
    startSessionDrag(tileDragPayload(tileId), event, { double, onTap })

    return true
  },
  close: requestCloseSessionTile
})
