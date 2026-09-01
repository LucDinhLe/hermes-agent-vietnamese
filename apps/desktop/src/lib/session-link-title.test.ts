import { afterEach, describe, expect, it } from 'vitest'

import { $sessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import {
  __resetSessionLinkTitleCache,
  fetchSessionLinkTitle,
  lookupLocalSessionOwner,
  lookupLocalSessionTitle
} from './session-link-title'

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    ended_at: null,
    id: '20260101_abc123',
    input_tokens: 0,
    is_active: false,
    last_active: 1_000,
    message_count: 1,
    model: null,
    output_tokens: 0,
    preview: null,
    profile: 'default',
    source: 'cli',
    started_at: 1_000,
    title: 'Research notes',
    tool_call_count: 0,
    ...overrides
  }
}

afterEach(() => {
  __resetSessionLinkTitleCache()
  $sessions.set([])
})

describe('lookupLocalSessionTitle', () => {
  it('reads a uniquely owned row from the in-memory session list', () => {
    $sessions.set([makeSession({ connection_id: 'source-a', profile: 'work', title: 'Branch plan' })])

    expect(lookupLocalSessionTitle('work/20260101_abc123')).toBe('Branch plan')
    expect(lookupLocalSessionOwner('work/20260101_abc123')).toEqual({
      connectionId: 'source-a',
      profile: 'work'
    })
  })

  it('matches the lineage root so a compressed chat still resolves', () => {
    $sessions.set([makeSession({ _lineage_root_id: '20260101_abc123', id: '20260102_tip', title: 'Compressed chat' })])

    expect(lookupLocalSessionTitle('20260101_abc123')).toBe('Compressed chat')
  })

  it('ignores a same-id row owned by another profile', () => {
    $sessions.set([makeSession({ profile: 'work', title: 'Work chat' })])

    expect(lookupLocalSessionTitle('personal/20260101_abc123')).toBe('')
  })

  it('fails closed when A and B share the profile and raw session id', () => {
    $sessions.set([
      makeSession({ connection_id: 'source-a', profile: 'mbc', title: 'A title' }),
      makeSession({ connection_id: 'source-b', profile: 'mbc', title: 'B title' })
    ])

    expect(lookupLocalSessionTitle('mbc/20260101_abc123')).toBe('')
    expect(lookupLocalSessionOwner('mbc/20260101_abc123')).toBeUndefined()
  })

  it('returns empty for an untitled row so the caller can fall back to the id', () => {
    $sessions.set([makeSession({ preview: null, title: null })])

    expect(lookupLocalSessionTitle('default/20260101_abc123')).toBe('')
  })
})

describe('fetchSessionLinkTitle', () => {
  it('uses a uniquely owned local row', async () => {
    $sessions.set([makeSession({ title: 'Cached title' })])

    await expect(fetchSessionLinkTitle('default/20260101_abc123')).resolves.toBe('Cached title')
  })

  it('returns empty for an uncached raw reference without attempting owner discovery', async () => {
    await expect(fetchSessionLinkTitle('default/missing')).resolves.toBe('')
  })

  it('returns empty for an ambiguous A/B reference', async () => {
    $sessions.set([
      makeSession({ connection_id: 'source-a', profile: 'mbc', title: 'A title' }),
      makeSession({ connection_id: 'source-b', profile: 'mbc', title: 'B title' })
    ])

    await expect(fetchSessionLinkTitle('mbc/20260101_abc123')).resolves.toBe('')
  })

  it('falls back to the preview when the unique row has no title', async () => {
    $sessions.set([makeSession({ preview: 'Summarize this repo', title: null })])

    await expect(fetchSessionLinkTitle('20260101_abc123')).resolves.toBe('Summarize this repo')
  })
})
