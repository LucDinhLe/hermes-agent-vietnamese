import { atom } from 'nanostores'

import type { HermesGateway } from '@/hermes'
import type { ChatMessage } from '@/lib/chat-messages'
import { normalizeProfileKey } from '@/store/profile'

const ENABLED_KEY = 'hermes.desktop.reasoningSummary.enabled.v1'
const CACHE_KEY = 'hermes.desktop.reasoningSummary.cache.v1'
const MAX_CACHE_RECORDS = 120
const MAX_CACHE_BYTES = 1024 * 1024

export interface ReasoningSummaryUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface ReasoningSummaryRecord {
  key: string
  profile: string
  sessionLineage: string
  messageId: string
  sourceDigest: string
  summary: string
  provider: string
  model: string
  latencyMs: number
  usage: ReasoningSummaryUsage | null
  createdAt: number
}

interface SummaryResponse {
  summary?: string
  source_digest?: string
  provider?: string
  model?: string
  latency_ms?: number
  usage?: ReasoningSummaryUsage | null
}

export interface SummarizeReasoningOptions {
  gateway: HermesGateway | null
  message: ChatMessage
  profile: string
  runtimeSessionId?: string
  sessionLineage: string
}

function loadEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(ENABLED_KEY) === 'on'
  } catch {
    return false
  }
}

function isSummaryRecord(value: unknown): value is ReasoningSummaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Partial<ReasoningSummaryRecord>

  return (
    typeof record.key === 'string' &&
    typeof record.profile === 'string' &&
    typeof record.sessionLineage === 'string' &&
    typeof record.messageId === 'string' &&
    /^[0-9a-f]{64}$/.test(record.sourceDigest ?? '') &&
    typeof record.summary === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.latencyMs === 'number'
  )
}

function loadCache(): Record<string, ReasoningSummaryRecord> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}') as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, ReasoningSummaryRecord] => isSummaryRecord(entry[1]))
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .slice(-MAX_CACHE_RECORDS)
    )
  } catch {
    return {}
  }
}

export const $reasoningSummaryEnabled = atom(loadEnabled())
export const $reasoningSummaries = atom<Record<string, ReasoningSummaryRecord>>(loadCache())
export const $reasoningSummaryErrors = atom<Record<string, string>>({})

const inFlight = new Map<string, Promise<ReasoningSummaryRecord | null>>()

export function setReasoningSummaryEnabled(enabled: boolean): void {
  $reasoningSummaryEnabled.set(enabled)

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off')
  } catch {
    // A failed preference write must not turn the feature on implicitly.
  }
}

export function clearReasoningSummaryCache(): void {
  $reasoningSummaries.set({})
  $reasoningSummaryErrors.set({})

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(CACHE_KEY)
  } catch {
    // Local derivative cache only; storage failure is non-fatal.
  }
}

export function publicReasoningText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: 'reasoning' }> => part.type === 'reasoning')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export async function reasoningSourceDigest(reasoning: string): Promise<string> {
  const bytes = new TextEncoder().encode(reasoning)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)

  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function cacheKey(profile: string, sessionLineage: string, messageId: string, sourceDigest: string): string {
  return [normalizeProfileKey(profile), sessionLineage, messageId, sourceDigest].map(encodeURIComponent).join('|')
}

export function findReasoningSummary(
  records: Record<string, ReasoningSummaryRecord>,
  profile: string,
  sessionLineage: string,
  messageId: string,
  sourceDigest: string
): ReasoningSummaryRecord | undefined {
  const exact = records[cacheKey(profile, sessionLineage, messageId, sourceDigest)]

  if (exact) {
    return exact
  }

  // Live streaming ids are ephemeral. On restart, the transcript rebuilds a
  // stable id from its timestamp/index, so recover by the remaining isolation
  // tuple. The digest still binds the summary to the exact public source.
  const profileKey = normalizeProfileKey(profile)

  return Object.values(records).find(
    record =>
      record.profile === profileKey && record.sessionLineage === sessionLineage && record.sourceDigest === sourceDigest
  )
}

export function reasoningSummaryContextKey(
  profile: string,
  sessionLineage: string,
  messageId: string,
  sourceDigest: string
): string {
  return cacheKey(profile, sessionLineage, messageId, sourceDigest)
}

function persistCache(records: Record<string, ReasoningSummaryRecord>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const newest = Object.values(records).sort((a, b) => b.createdAt - a.createdAt)
    const kept: ReasoningSummaryRecord[] = []

    for (const record of newest.slice(0, MAX_CACHE_RECORDS)) {
      const candidate = Object.fromEntries([...kept, record].map(item => [item.key, item]))

      if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_CACHE_BYTES) {
        break
      }

      kept.push(record)
    }

    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept.map(item => [item.key, item]))))
  } catch {
    // Summary remains available in memory for this run.
  }
}

function setSummaryError(key: string, message?: string): void {
  const current = $reasoningSummaryErrors.get()

  if (message) {
    $reasoningSummaryErrors.set({ ...current, [key]: message })
  } else if (current[key]) {
    const next = { ...current }
    delete next[key]
    $reasoningSummaryErrors.set(next)
  }
}

/**
 * Generate at most one summary for an exact public-reasoning digest.
 * The enabled check is deliberately first: disabled means zero hashing work
 * and, more importantly, zero gateway/model calls.
 */
export async function summarizeReasoningMessage({
  gateway,
  message,
  profile,
  runtimeSessionId,
  sessionLineage
}: SummarizeReasoningOptions): Promise<ReasoningSummaryRecord | null> {
  if (!$reasoningSummaryEnabled.get()) {
    return null
  }

  const reasoning = publicReasoningText(message)

  if (!reasoning) {
    return null
  }

  const sourceDigest = await reasoningSourceDigest(reasoning)
  const profileKey = normalizeProfileKey(profile)
  const key = cacheKey(profileKey, sessionLineage, message.id, sourceDigest)

  const cached = findReasoningSummary($reasoningSummaries.get(), profileKey, sessionLineage, message.id, sourceDigest)

  if (cached) {
    return cached
  }

  const existing = inFlight.get(key)

  if (existing) {
    return existing
  }

  const request = (async () => {
    if (!gateway) {
      setSummaryError(key, 'Gateway not connected')

      return null
    }

    const started = performance.now()

    try {
      const response = await gateway.request<SummaryResponse>('reasoning.summarize', {
        message_id: message.id,
        reasoning,
        session_id: runtimeSessionId || sessionLineage,
        source_digest: sourceDigest
      })

      const summary = (response?.summary ?? '').trim()

      if (!summary || response?.source_digest !== sourceDigest) {
        throw new Error('Summary response did not match its public reasoning source')
      }

      const record: ReasoningSummaryRecord = {
        key,
        profile: profileKey,
        sessionLineage,
        messageId: message.id,
        sourceDigest,
        summary,
        provider: (response.provider ?? 'auxiliary').trim() || 'auxiliary',
        model: (response.model ?? '').trim(),
        latencyMs: Math.max(0, Math.round(performance.now() - started)),
        usage: response.usage ?? null,
        createdAt: Date.now()
      }

      const next = Object.fromEntries(
        Object.entries({ ...$reasoningSummaries.get(), [key]: record })
          .sort((a, b) => a[1].createdAt - b[1].createdAt)
          .slice(-MAX_CACHE_RECORDS)
      )

      $reasoningSummaries.set(next)
      persistCache(next)
      setSummaryError(key)

      return record
    } catch (error) {
      setSummaryError(key, error instanceof Error ? error.message : 'Reasoning summary failed')

      return null
    }
  })()

  inFlight.set(key, request)

  try {
    return await request
  } finally {
    inFlight.delete(key)
  }
}
