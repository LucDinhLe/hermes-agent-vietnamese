import { atom, computed } from 'nanostores'

export type AdvisorCheckpoint = 'final' | 'plan' | 'recovery'
export type AdvisorProgressState =
  'failed' | 'passed' | 'reviewing' | 'revision_requested' | 'unavailable' | 'unresolved'

export type WorkProgress =
  | { kind: 'analyzing' }
  | { kind: 'compacting' }
  | { kind: 'reasoning' }
  | { kind: 'responding' }
  | { kind: 'tool-checking'; toolName: string }
  | { kind: 'tool-preparing'; toolName: string }
  | { kind: 'tool-running'; toolName: string }
  | {
      checkpoint: AdvisorCheckpoint
      kind: 'advisor'
      state: AdvisorProgressState
      summary?: string
    }

const keyFor = (sessionId: string | null | undefined): string => sessionId ?? ''

export const $workProgressSessions = atom<Record<string, WorkProgress>>({})

export function sessionWorkProgress(sessionId: null | string) {
  return computed($workProgressSessions, sessions => sessions[keyFor(sessionId)] ?? null)
}

function sameProgress(left: WorkProgress | undefined, right: WorkProgress): boolean {
  if (!left || left.kind !== right.kind) {
    return false
  }

  if ('toolName' in left || 'toolName' in right) {
    return 'toolName' in left && 'toolName' in right && left.toolName === right.toolName
  }

  if (left.kind === 'advisor' && right.kind === 'advisor') {
    return left.checkpoint === right.checkpoint && left.state === right.state && left.summary === right.summary
  }

  return true
}

export function setSessionWorkProgress(sessionId: string | null | undefined, progress: null | WorkProgress): void {
  const key = keyFor(sessionId)
  const sessions = $workProgressSessions.get()

  if (!progress) {
    if (!(key in sessions)) {
      return
    }

    const next = { ...sessions }
    delete next[key]
    $workProgressSessions.set(next)

    return
  }

  if (sameProgress(sessions[key], progress)) {
    return
  }

  $workProgressSessions.set({ ...sessions, [key]: progress })
}

export function clearSessionWorkProgress(sessionId: string | null | undefined): void {
  setSessionWorkProgress(sessionId, null)
}

export function clearAllWorkProgress(): void {
  $workProgressSessions.set({})
}

export function advisorWorkProgress(payload: unknown): WorkProgress | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const value = payload as Record<string, unknown>
  const checkpoint = value.checkpoint
  const state = value.state

  if (checkpoint !== 'plan' && checkpoint !== 'recovery' && checkpoint !== 'final') {
    return null
  }

  if (
    state !== 'reviewing' &&
    state !== 'passed' &&
    state !== 'revision_requested' &&
    state !== 'unavailable' &&
    state !== 'failed' &&
    state !== 'unresolved'
  ) {
    return null
  }

  const summary = typeof value.summary === 'string' ? value.summary.trim().slice(0, 600) : ''

  return {
    checkpoint,
    kind: 'advisor',
    state,
    ...(summary ? { summary } : {})
  }
}
