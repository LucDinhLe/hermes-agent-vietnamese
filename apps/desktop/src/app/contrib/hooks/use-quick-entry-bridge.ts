import { useEffect, useRef } from 'react'

import { activeBackendOwner } from '@/store/backend-owner'
import {
  initQuickEntryBridge,
  QUICK_TARGET_CURRENT,
  QUICK_TARGET_NEW,
  type QuickEntrySessionOption,
  quickEntrySessionTarget,
  setQuickEntrySubmitHandler
} from '@/store/quick-entry'
import { $gatewayState, $sessions } from '@/store/session'
import { parseSessionTileIdentity, sessionTileDelegate, sessionTileIdentity } from '@/store/session-states'
import { isAuxiliaryWindow } from '@/store/windows'

interface QuickEntryBridgeParams {
  startFreshSessionDraft: () => void
  submitText: (text: string) => Promise<unknown> | unknown
}

// The picker is a capture aid, not a session browser — a handful of recent
// rows is the whole point.
const QUICK_ENTRY_SESSION_OPTIONS = 5
let publishedSessionOptions: QuickEntrySessionOption[] = []

export function resolveQuickEntrySubmissionTarget(
  target: string,
  options: readonly QuickEntrySessionOption[] = publishedSessionOptions
): null | { owner: { connectionId: string; profile: string }; storedSessionId: string } {
  const encoded = target.startsWith('session:') ? parseSessionTileIdentity(target.slice('session:'.length)) : null

  if (encoded) {
    return { owner: encoded.owner, storedSessionId: encoded.storedSessionId }
  }

  // Legacy Quick Entry windows sent a bare stored id. Keep that shape only
  // while the current published list identifies one exact source; never infer
  // an owner from the renderer's now-active connection after a source switch.
  const matches = options.filter(option => quickEntrySessionTarget(option) === target || option.id === target)
  const option = matches.length === 1 ? matches[0] : null

  return option?.connectionId
    ? {
        owner: { connectionId: option.connectionId, profile: option.profile || 'default' },
        storedSessionId: option.id
      }
    : null
}

function sessionOptions(): QuickEntrySessionOption[] {
  const owner = activeBackendOwner()

  return $sessions
    .get()
    .filter(session => !session.archived)
    .slice(0, QUICK_ENTRY_SESSION_OPTIONS)
    .map(session => {
      const profile = owner?.profile ?? session.profile ?? 'default'

      return {
        connectionId: owner?.connectionId,
        id: session.id,
        profile,
        target: owner ? `session:${sessionTileIdentity(owner, session.id)}` : session.id,
        title: session.title?.trim() || session.preview?.trim() || session.id
      }
    })
}

/**
 * Wires the global-hotkey Quick Entry window back into the app, both ways:
 *
 * - **Inbound:** text captured there is routed by target and submitted through
 *   THIS window's normal prompt machinery — current chat rides `submitText`, a
 *   picked stored session rides the session-tile delegate (resume + submit,
 *   background, without touching the primary view — the same path tiled
 *   sessions use), and "new session" is a fresh draft + submit, exactly what
 *   clicking New Chat and typing does. One submit pipeline, no bespoke RPC.
 * - **Outbound:** gateway connection state + the recent-session list are pushed
 *   to the quick window (via main, which caches the latest push), so its input
 *   disables with a reconnect hint whenever the backend is unreachable.
 *
 * Handlers register ONCE through refs tracking the latest callbacks —
 * re-registering on identity churn leaves a nulled-handler window that can drop
 * a submit (the same bug shape use-pet-bridge guards). Primary window only: a
 * secondary session window must not also claim the global capture channel, or
 * one keystroke would send N prompts.
 */
export function useQuickEntryBridge({ startFreshSessionDraft, submitText }: QuickEntryBridgeParams): void {
  const submitTextRef = useRef(submitText)
  submitTextRef.current = submitText
  const startFreshRef = useRef(startFreshSessionDraft)
  startFreshRef.current = startFreshSessionDraft

  useEffect(() => {
    if (isAuxiliaryWindow()) {
      return
    }

    setQuickEntrySubmitHandler(({ target, text }) => {
      if (target === QUICK_TARGET_NEW) {
        // Same as the user clicking New Chat and typing: fresh draft, then the
        // normal submit creates the backend session.
        startFreshRef.current()
        void submitTextRef.current(text)

        return
      }

      if (target !== QUICK_TARGET_CURRENT) {
        // A picked stored session: resume + submit in the background through
        // the session-tile delegate so the primary view stays where it is.
        const delegate = sessionTileDelegate()
        const resolved = resolveQuickEntrySubmissionTarget(target)

        if (delegate && resolved) {
          const { owner, storedSessionId } = resolved

          void delegate
            .resumeTile(storedSessionId, owner)
            .then(runtimeId => delegate.submitToSession(runtimeId, text, owner))
            // A dead/undeliverable target must not swallow the prompt.
            .catch(() => void submitTextRef.current(text))

          return
        }
      }

      void submitTextRef.current(text)
    })

    const dispose = initQuickEntryBridge()

    return () => {
      setQuickEntrySubmitHandler(null)
      dispose()
    }
  }, [])

  // Push gateway truth into the quick window whenever it changes: connection
  // state gates its input; the recent-session list feeds its target picker.
  useEffect(() => {
    if (isAuxiliaryWindow()) {
      return
    }

    const api = window.hermesDesktop?.quickEntry

    if (!api?.pushState) {
      return
    }

    const push = () => {
      publishedSessionOptions = sessionOptions()
      api.pushState({ connected: $gatewayState.get() === 'open', sessions: publishedSessionOptions })
    }

    push()

    const offGateway = $gatewayState.listen(push)
    const offSessions = $sessions.listen(push)

    return () => {
      offGateway()
      offSessions()
    }
  }, [])
}
