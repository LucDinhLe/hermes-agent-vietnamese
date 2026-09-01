/**
 * Resolves `@session:<profile>/<id>` reference values to the session's title.
 *
 * Same shape as the external-link title resolver (`external-link.tsx`): a
 * process-lifetime cache and subscribers so every chip for the same session
 * repaints off one lookup. Raw references carry no registry connection, so an
 * unknown or ambiguous id deliberately performs no network request.
 */
import { useEffect, useMemo, useState } from 'react'

import type { SessionApiOwner } from '@/hermes'
import { parseSessionRefValue, sessionRefCacheKey, sessionRefFallbackLabel } from '@/lib/session-refs'
import { $sessions, sessionMatchesStoredId } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

const titleCache = new Map<string, string>()
const titleInflight = new Map<string, Promise<string>>()
const titleSubs = new Map<string, Set<(value: string) => void>>()

/** Deliberately not `sessionTitle()` from chat-runtime: its "Untitled session"
 *  fallback is a worse chip label than the short id, so an untitled row
 *  resolves to empty and the caller's fallback wins. */
function sessionRowTitle(row: SessionInfo): string {
  return row.title?.trim() || row.preview?.trim() || ''
}

function profileMatches(sessionProfile: null | string | undefined, target?: string): boolean {
  if (!target) {
    return true
  }

  return ((sessionProfile ?? '').trim() || 'default') === (target.trim() || 'default')
}

function localSessionMatch(value: string): null | { owner: SessionApiOwner; row: SessionInfo } {
  const { profile, sessionId } = parseSessionRefValue(value)

  if (!sessionId) {
    return null
  }

  const matches = $sessions
    .get()
    .filter(session => sessionMatchesStoredId(session, sessionId) && profileMatches(session.profile, profile))

  const byOwner = new Map<string, { owner: SessionApiOwner; row: SessionInfo }>()

  for (const row of matches) {
    const ownerProfile = row.profile?.trim()

    if (!ownerProfile) {
      continue
    }

    const owner = { connectionId: row.connection_id?.trim() || null, profile: ownerProfile }

    byOwner.set(JSON.stringify([owner.connectionId, owner.profile]), { owner, row })
  }

  return byOwner.size === 1 ? (byOwner.values().next().value ?? null) : null
}

export function lookupLocalSessionOwner(value: string): SessionApiOwner | undefined {
  return localSessionMatch(value)?.owner
}

export function lookupLocalSessionTitle(value: string): string {
  const match = localSessionMatch(value)

  return match ? sessionRowTitle(match.row) : ''
}

export function fetchSessionLinkTitle(value: string): Promise<string> {
  const key = sessionRefCacheKey(value)

  if (!key) {
    return Promise.resolve('')
  }

  const cached = titleCache.get(key)

  if (cached !== undefined) {
    return Promise.resolve(cached)
  }

  const inflight = titleInflight.get(key)

  if (inflight) {
    return inflight
  }

  const local = lookupLocalSessionTitle(value)

  if (local) {
    titleCache.set(key, local)

    return Promise.resolve(local)
  }

  const promise = Promise.resolve(local)
    .then(title => {
      titleCache.set(key, title)
      titleInflight.delete(key)
      titleSubs.get(key)?.forEach(notify => notify(title))

      return title
    })

  titleInflight.set(key, promise)

  return promise
}

export function useSessionLinkTitle(value: string, fallbackLabel?: string): string {
  const key = useMemo(() => sessionRefCacheKey(value), [value])
  const fallback = fallbackLabel?.trim() || sessionRefFallbackLabel(value)
  const [title, setTitle] = useState(() => (key ? titleCache.get(key) || lookupLocalSessionTitle(value) : ''))

  useEffect(() => {
    if (!key) {
      return
    }

    const known = titleCache.get(key) || lookupLocalSessionTitle(value)

    setTitle(known)

    if (known) {
      return
    }

    const subs = titleSubs.get(key) ?? new Set<(resolved: string) => void>()

    subs.add(setTitle)
    titleSubs.set(key, subs)
    void fetchSessionLinkTitle(value)

    return () => {
      subs.delete(setTitle)

      if (!subs.size) {
        titleSubs.delete(key)
      }
    }
  }, [key, value])

  return title || fallback
}

export function __resetSessionLinkTitleCache(): void {
  titleCache.clear()
  titleInflight.clear()
  titleSubs.clear()
}
