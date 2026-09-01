/**
 * REST TAIL-HYDRATION BOOKKEEPING — keyed by STORED session id.
 *
 * `getLatestSessionMessages` loads a small newest-first page instead of a
 * fixed 500-row transcript. When that page comes back full (returned ===
 * limit), older rows likely exist on the backend; this store records that
 * fact plus the offset the next older page starts at, so the transcript
 * window's "Show earlier" action knows to backfill over REST once the
 * in-memory store is fully materialized (see app/chat/transcript-backfill).
 *
 * Offsets use the backend's `order: 'latest'` semantics: measured back from
 * the NEWEST row, with each page returned in chronological order — so the
 * page immediately older than N already-loaded tail rows starts at offset N.
 */

import { atom } from 'nanostores'

import type { SessionMessagesResponse } from '@/types/hermes'

export interface TranscriptTailState {
  /** Exact registry owner captured at hydration. `null` is explicitly local;
   *  `undefined` means a legacy profile-only hydration. */
  connectionId?: null | string
  /** Offset (back from the newest row) where the next older page starts. */
  nextOffset: number
  /** The last hydration page was exactly the page limit, so older rows
   *  likely exist beyond what the in-memory store holds. */
  possiblyTruncated: boolean
  /** Owning profile captured at hydration time, so a later backfill routes
   *  its REST read to the same backend that served the tail. */
  profile?: null | string
}

export const $transcriptTailBySessionId = atom<Record<string, TranscriptTailState>>({})

type TailPage = Pick<SessionMessagesResponse, 'messages' | 'pagination'>
type TailScope = null | string | { connectionId: null | string; profile: string }

function tailStateFromPage(page: TailPage, scope?: TailScope): TranscriptTailState {
  const pagination = page.pagination
  const exactOwner = scope !== null && typeof scope === 'object' ? scope : null
  const profile: null | string | undefined = exactOwner
    ? exactOwner.profile.trim() || 'default'
    : typeof scope === 'string' || scope === null
      ? scope
      : undefined
  const connectionId = exactOwner ? exactOwner.connectionId?.trim() || null : undefined
  const owner = connectionId === undefined ? {} : { connectionId }

  // No pagination metadata is a legacy backend that ignored the paging query
  // and returned the full transcript: nothing is truncated.
  if (!pagination || pagination.limit <= 0) {
    return { ...owner, nextOffset: page.messages.length, possiblyTruncated: false, profile }
  }

  return {
    ...owner,
    nextOffset: pagination.offset + page.messages.length,
    possiblyTruncated: page.messages.length >= pagination.limit,
    profile
  }
}

/** Record the outcome of a tail hydration (`getLatestSessionMessages`). */
export function recordTranscriptTail(storedSessionId: string, page: TailPage, scope?: TailScope): void {
  if (!storedSessionId) {
    return
  }

  const current = $transcriptTailBySessionId.get()
  $transcriptTailBySessionId.set({ ...current, [storedSessionId]: tailStateFromPage(page, scope) })
}

/** Advance the bookkeeping after one older backfill page landed. */
export function recordTranscriptBackfillPage(storedSessionId: string, page: TailPage): void {
  const current = $transcriptTailBySessionId.get()
  const previous = current[storedSessionId]
  const scope =
    previous?.connectionId !== undefined
      ? { connectionId: previous.connectionId, profile: previous.profile ?? 'default' }
      : previous?.profile

  $transcriptTailBySessionId.set({
    ...current,
    [storedSessionId]: tailStateFromPage(page, scope)
  })
}

export function transcriptTailState(storedSessionId: null | string | undefined): TranscriptTailState | undefined {
  return storedSessionId ? $transcriptTailBySessionId.get()[storedSessionId] : undefined
}

export function clearTranscriptTail(storedSessionId: string): void {
  const current = $transcriptTailBySessionId.get()

  if (!(storedSessionId in current)) {
    return
  }

  const { [storedSessionId]: _dropped, ...rest } = current
  $transcriptTailBySessionId.set(rest)
}
