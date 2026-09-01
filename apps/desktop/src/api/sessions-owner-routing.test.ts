import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $transcriptTailBySessionId, transcriptTailState } from '@/store/transcript-tail'

import { setApiRequestConnection, setApiRequestProfile } from './client'
import {
  deleteSessionForOwner,
  getAllSessionMessagesForOwner,
  getLatestSessionMessagesForOwner,
  getOlderSessionMessagesForOwner,
  getSessionForOwner,
  renameSessionForOwner,
  setSessionArchivedForOwner,
  setSessionPinnedRemoteForOwner,
  setSessionUnreadRemoteForOwner
} from './sessions'

describe('owner-qualified session REST', () => {
  interface TestApiRequest {
    body?: unknown
    connectionId?: string
    method?: string
    path: string
    profile?: string
  }

  const api = vi.fn(async (request: TestApiRequest) =>
    request.path.includes('/messages')
      ? {
          messages: [],
          pagination: { limit: 120, offset: 0, order: 'latest', returned: 0 },
          session_id: 'runtime-shared'
        }
      : { ok: true, title: 'renamed' }
  )

  beforeEach(() => {
    api.mockClear()
    $transcriptTailBySessionId.set({})
    setApiRequestConnection('source-b')
    setApiRequestProfile('mbc')
    ;(window as { hermesDesktop?: unknown }).hermesDesktop = { api }
  })

  afterEach(() => {
    setApiRequestConnection(null)
    setApiRequestProfile(null)
    delete (window as { hermesDesktop?: unknown }).hermesDesktop
  })

  it('routes same-profile same-id reads and mutations only to owner A while ambient is B', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'mbc' }
    const id = 'runtime-shared'

    await Promise.all([
      getSessionForOwner(id, ownerA),
      getLatestSessionMessagesForOwner(id, ownerA),
      getOlderSessionMessagesForOwner(id, ownerA, 120),
      getAllSessionMessagesForOwner(id, ownerA),
      deleteSessionForOwner(id, ownerA),
      setSessionArchivedForOwner(id, true, ownerA),
      setSessionPinnedRemoteForOwner(id, true, ownerA),
      setSessionUnreadRemoteForOwner(id, true, ownerA),
      renameSessionForOwner(id, 'renamed', ownerA)
    ])

    expect(api).toHaveBeenCalledTimes(9)

    for (const [request] of api.mock.calls) {
      expect(request.connectionId).toBe('source-a')
      expect(request.connectionId).not.toBe('source-b')
      expect(request.profile).toBe('mbc')
      expect(request.path).toContain('/api/sessions/runtime-shared')
      expect(request.path).toContain('profile=mbc')
    }

    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { archived: true },
        connectionId: 'source-a',
        method: 'PATCH'
      })
    )
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { title: 'renamed' },
        connectionId: 'source-a',
        method: 'PATCH'
      })
    )
    expect(transcriptTailState(id)).toMatchObject({ connectionId: 'source-a', profile: 'mbc' })
  })

  it.each([null, 'local'] as const)('forces owner %s local instead of inheriting ambient B', async connectionId => {
    await deleteSessionForOwner('runtime-shared', { connectionId, profile: 'mbc' })

    expect(api).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/api/sessions/runtime-shared?profile=mbc',
      profile: 'mbc'
    })
  })
})
