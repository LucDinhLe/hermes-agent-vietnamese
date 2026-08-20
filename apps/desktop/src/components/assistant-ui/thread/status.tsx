import { useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { toolPresentVerb } from '@/components/assistant-ui/tool/run-summary'
import { useElapsedSeconds } from '@/components/chat/activity-timer'
import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { SCAFFOLD_LABEL_CLASS } from '@/components/chat/scaffold-row'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { StatusPulse } from '@/components/ui/status-pulse'
import { type Translations, useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $backgroundResume } from '@/store/background-delegation'
import { sessionCompacting } from '@/store/compaction'
import { sessionAwaitingInput } from '@/store/prompts'
import { sessionProviderWait } from '@/store/provider-wait'
import { $turnStartedAt } from '@/store/session'
import { type DraftingTool, sessionDraftingTool } from '@/store/tool-drafting'
import { sessionWorkProgress, type WorkProgress } from '@/store/work-progress'

// A status line is scaffolding like any other — "Editing" while the model
// drafts a call is the same kind of line as "Explored 3 files" once it has run,
// and reads as one continuous column only if it shares their type and colour.
const StatusRow: FC<{ children: ReactNode; label: string } & React.ComponentPropsWithoutRef<'div'>> = ({
  children,
  label,
  className,
  ...rest
}) => (
  <div
    aria-label={label}
    aria-live="polite"
    className={cn(
      'flex min-w-0 max-w-full items-center gap-1.5 self-start leading-(--conversation-line-height)',
      'text-(--conversation-scaffold-text)',
      className
    )}
    data-conversation-scaffold=""
    role="status"
    {...rest}
  >
    {children}
  </div>
)

// Fixed label while auto-compaction runs — decoupled from backend status text.
const COMPACTION_LABEL = 'Summarizing thread'

const HintText: FC<{ children: ReactNode }> = ({ children }) => (
  <span className={cn(SCAFFOLD_LABEL_CLASS, 'shimmer min-w-0 flex-1 truncate')}>{children}</span>
)

const ProgressText: FC<{ action: string; reason: string }> = ({ action, reason }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <span className={cn(SCAFFOLD_LABEL_CLASS, 'shimmer min-w-0 truncate')}>{action}</span>
    <span className="max-w-[42rem] text-[0.6875rem] leading-4 text-muted-foreground/65">{reason}</span>
  </span>
)

type WorkProgressCopy = Translations['assistant']['thread']['workProgress']

function progressText(progress: WorkProgress, copy: WorkProgressCopy): { action: string; reason: string } {
  switch (progress.kind) {
    case 'analyzing':
      return { action: copy.analyzingAction, reason: copy.analyzingReason }

    case 'reasoning':
      return { action: copy.reasoningAction, reason: copy.reasoningReason }

    case 'responding':
      return { action: copy.respondingAction, reason: copy.respondingReason }

    case 'compacting':
      return { action: copy.compactingAction, reason: copy.compactingReason }

    case 'tool-preparing':
      return { action: copy.toolPreparingAction(progress.toolName), reason: copy.toolPreparingReason }

    case 'tool-running':
      return { action: copy.toolRunningAction(progress.toolName), reason: copy.toolRunningReason }

    case 'tool-checking':
      return { action: copy.toolCheckingAction(progress.toolName), reason: copy.toolCheckingReason }
    case 'advisor': {
      const checkpoint =
        progress.checkpoint === 'final'
          ? copy.checkpointFinal
          : progress.checkpoint === 'recovery'
            ? copy.checkpointRecovery
            : copy.checkpointPlan

      if (progress.state === 'reviewing') {
        if (progress.checkpoint === 'final') {
          return { action: copy.advisorFinalAction, reason: copy.advisorFinalReason }
        }

        if (progress.checkpoint === 'recovery') {
          return { action: copy.advisorRecoveryAction, reason: copy.advisorRecoveryReason }
        }

        return { action: copy.advisorPlanAction, reason: copy.advisorPlanReason }
      }

      if (progress.state === 'passed') {
        return {
          action: copy.advisorPassedAction(checkpoint),
          reason: progress.summary || copy.advisorPassedReason
        }
      }

      if (progress.state === 'revision_requested') {
        return {
          action: copy.advisorRevisionAction(checkpoint),
          reason: progress.summary || copy.advisorRevisionReason
        }
      }

      if (progress.state === 'unavailable') {
        return { action: copy.advisorUnavailableAction, reason: copy.advisorUnavailableReason }
      }

      if (progress.state === 'failed') {
        return { action: copy.advisorFailedAction, reason: copy.advisorFailedReason }
      }

      return {
        action: copy.advisorUnresolvedAction,
        reason: progress.summary || copy.advisorUnresolvedReason
      }
    }
  }
}

/** These indicators render inside whichever transcript mounted them, so every
 *  session-scoped signal comes from that surface's view — a tile must never
 *  show the primary chat's compaction, prompt-wait, or turn timer. */
function useThreadSessionStatus() {
  const sessionId = useStore(useSessionView().$runtimeId)
  const turnStartedAt = useStore($turnStartedAt)
  const compacting = useStore(useMemo(() => sessionCompacting(sessionId), [sessionId]))
  const drafting = useStore(useMemo(() => sessionDraftingTool(sessionId), [sessionId]))
  const providerWait = useStore(useMemo(() => sessionProviderWait(sessionId), [sessionId]))
  const workProgress = useStore(useMemo(() => sessionWorkProgress(sessionId), [sessionId]))
  // A pending clarify / approval / sudo / secret means the turn is paused on the
  // user, not working — so don't resurrect the "thinking" timer while they
  // decide (matches the pet's awaitingInput pose taking priority over busy).
  const awaitingInput = useStore(useMemo(() => sessionAwaitingInput(sessionId), [sessionId]))

  return {
    awaitingInput,
    compacting,
    drafting,
    providerWait,
    workProgress,
    turnTimerKey: sessionId && turnStartedAt ? `turn:${sessionId}:${turnStartedAt}` : undefined
  }
}

// Long enough that a tool whose arguments arrive in a few frames never gets to
// strobe a label, short enough that a real wait is named almost immediately.
const DRAFTING_REVEAL_MS = 200

/**
 * What to call the wait, if it deserves a name. Compaction outranks a draft —
 * it's rarer, slower, and explains a transcript that looks like it reset.
 */
function useStatusHint(compacting: boolean, drafting: DraftingTool | null, providerWait: string): string {
  const [revealed, setRevealed] = useState(false)
  const name = drafting?.name ?? ''

  useEffect(() => {
    setRevealed(false)

    if (!name) {
      return
    }

    const id = window.setTimeout(() => setRevealed(true), DRAFTING_REVEAL_MS)

    return () => window.clearTimeout(id)
  }, [name])

  if (compacting) {
    return COMPACTION_LABEL
  }

  if (providerWait) {
    return providerWait
  }

  return revealed && name ? toolPresentVerb(name) : ''
}

export const CenteredThreadSpinner: FC = () => {
  const { t } = useI18n()

  return (
    <div
      aria-label={t.assistant.thread.loadingSession}
      className="pointer-events-none absolute inset-0 z-1 grid place-items-center"
      role="status"
    >
      <Loader
        aria-hidden="true"
        className="size-12 text-midground/70"
        pathSteps={220}
        role="presentation"
        strokeScale={0.72}
        type="rose-curve"
      />
    </div>
  )
}

export const ResponseLoadingIndicator: FC = () => {
  const { t } = useI18n()
  const { compacting, drafting, providerWait, turnTimerKey, workProgress } = useThreadSessionStatus()
  const elapsed = useElapsedSeconds(true, turnTimerKey)
  const hint = useStatusHint(compacting, drafting, providerWait)
  const progress = workProgress ? progressText(workProgress, t.assistant.thread.workProgress) : null

  return (
    <StatusRow
      className={progress ? 'items-start' : undefined}
      data-slot="aui_response-loading"
      label={progress?.action || hint || t.assistant.thread.loadingResponse}
    >
      <StatusPulse
        aria-hidden="true"
        className={cn('dither inline-block size-3 rounded-[2px] text-midground/80', progress && 'mt-1')}
        kind="opacity"
      />
      {progress ? <ProgressText {...progress} /> : hint && <HintText>{hint}</HintText>}
      <ActivityTimerText seconds={elapsed} />
    </StatusRow>
  )
}

// Parked-background affordance: a top-level delegate_task runs in the
// background, so the parent turn ends and the app goes idle while the subagent
// keeps working and its result re-enters as a fresh turn later. Instead of a
// spinner (reads as "stuck"), reuse the same compact, centered system-note
// chrome as the steer / slash-status lines (SystemMessage above) so it sits in
// the thread like every other meta line. Idle-only (gated upstream). Null when
// nothing is parked.
export const BackgroundResumeNotice: FC = () => {
  const { t } = useI18n()
  const resume = useStore($backgroundResume)

  if (!resume) {
    return null
  }

  const label = resume.activity ?? t.assistant.thread.resumeWhenBackgroundDone(resume.count)

  return (
    <div
      aria-live="polite"
      className="flex max-w-[min(86%,44rem)] items-center gap-1.5 self-center px-2 py-0.5 text-[0.6875rem] leading-5 text-muted-foreground/55"
      data-slot="aui_background-resume"
      role="status"
    >
      <Codicon className="text-muted-foreground/55" name="sync" size="0.75rem" />
      <span className="shimmer min-w-0 truncate">{label}</span>
    </div>
  )
}

// Seconds of no visible output (text or part count) before a still-running turn
// is treated as stalled and the thinking indicator returns at the tail.
const STREAM_STALL_S = 2

// Tail "still thinking" indicator: the pre-first-token spinner goes away once
// text flows, but if the stream then goes quiet mid-turn (tool think-time,
// provider stall) nothing signals that work continues. Watch a per-flush
// activity signal; when it hasn't changed for STREAM_STALL_S, re-show the
// dither + a timer counting from the last activity.
//
// Subscribes to the activity signal ITSELF (rather than taking it as a prop)
// so that per-token updates re-render only this leaf, not the whole
// AssistantMessage subtree.
export const StreamStallIndicator: FC = () => {
  const activity = useAuiState(s => {
    let textLength = 0

    for (const part of s.message.content) {
      const text = (part as { text?: unknown }).text

      if (typeof text === 'string') {
        textLength += text.length
      }
    }

    return `${s.message.content.length}:${textLength}`
  })

  // Timestamp of the activity that preceded the current quiet spell, set once
  // the spell qualifies as a stall. Holding the timestamp (not a boolean) is
  // what lets the timer read "quiet for 12s" rather than the age of this
  // component, which is the whole turn so far.
  const [quietSince, setQuietSince] = useState<number | undefined>(undefined)
  const { awaitingInput, compacting, drafting, providerWait, turnTimerKey, workProgress } = useThreadSessionStatus()
  const hint = useStatusHint(compacting, drafting, providerWait)
  const { t } = useI18n()
  const progress = workProgress ? progressText(workProgress, t.assistant.thread.workProgress) : null

  // A tool run at the tail already narrates the wait — its summary counts the
  // calls, its ticker names the current one, and it carries its own timer. A
  // second spinner under that adds a line and says nothing new.
  const toolNarrating = useAuiState(s => s.message.content.at(-1)?.type === 'tool-call')

  useEffect(() => {
    setQuietSince(undefined)
    const seenAt = Date.now()
    const id = window.setTimeout(() => setQuietSince(seenAt), STREAM_STALL_S * 1000)

    return () => window.clearTimeout(id)
  }, [activity])

  // A named wait doesn't have to earn the stall threshold first — we already
  // know what the turn is doing, so say it as soon as the label is ready rather
  // than leaving the transcript silent for STREAM_STALL_S.
  const active =
    (Boolean(progress) || quietSince !== undefined || Boolean(hint)) &&
    !awaitingInput &&
    (!toolNarrating || Boolean(progress))

  // Compaction owns the whole turn, so it keeps counting from the turn's start;
  // anything else counts from the moment the stream went quiet — the stall's own
  // mark, or the draft's, whichever named the wait first.
  const elapsed = useElapsedSeconds(
    active,
    compacting || progress ? turnTimerKey : undefined,
    compacting || progress ? undefined : (quietSince ?? drafting?.since)
  )

  if (!active) {
    return null
  }

  return (
    <StatusRow
      className={progress ? 'items-start' : undefined}
      data-slot="aui_stream-stall"
      label={progress?.action || hint || t.assistant.thread.thinking}
    >
      <StatusPulse
        aria-hidden="true"
        className={cn('dither inline-block size-3 rounded-[2px] text-midground/80', progress && 'mt-1')}
        kind="opacity"
      />
      {progress ? <ProgressText {...progress} /> : hint && <HintText>{hint}</HintText>}
      <ActivityTimerText seconds={elapsed} />
    </StatusRow>
  )
}
