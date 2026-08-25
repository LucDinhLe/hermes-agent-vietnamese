import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyWorkProfile,
  getWorkProfile,
  recommendWorkProfile,
  setApiRequestConnection,
  setApiRequestProfile
} from './hermes'

describe('work-profile helpers are backend/profile scoped', () => {
  const api = vi.fn(async (_request: unknown) => ({}) as never)

  beforeEach(() => {
    ;(window as { hermesDesktop?: unknown }).hermesDesktop = { api }
    api.mockClear()
  })

  afterEach(() => {
    setApiRequestProfile(null)
    setApiRequestConnection(null)
    delete (window as { hermesDesktop?: unknown }).hermesDesktop
  })

  it('routes read, recommendation, and apply through the owning backend profile', () => {
    setApiRequestProfile('writer')
    setApiRequestConnection('studio-gateway')

    void getWorkProfile()
    void recommendWorkProfile({ work_areas: ['writing_content'], common_tasks: ['Draft a newsletter'] })
    void applyWorkProfile({
      allowed_skills: ['docx', 'grounded-citations'],
      work_areas: ['writing_content'],
      common_tasks: ['Draft a newsletter'],
      skipped: false
    })

    expect(api.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({
        path: '/api/skills/work-profile',
        profile: 'writer',
        connectionId: 'studio-gateway'
      }),
      expect.objectContaining({
        path: '/api/skills/work-profile/recommend',
        method: 'POST',
        profile: 'writer',
        connectionId: 'studio-gateway'
      }),
      expect.objectContaining({
        path: '/api/skills/work-profile',
        method: 'PUT',
        profile: 'writer',
        connectionId: 'studio-gateway'
      })
    ])
  })

  it('honors an explicit owner instead of ambient state', () => {
    setApiRequestProfile('ambient')
    setApiRequestConnection('ambient-gateway')

    void getWorkProfile('research', 'remote-b')

    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ profile: 'research', connectionId: 'remote-b' }))
  })
})
