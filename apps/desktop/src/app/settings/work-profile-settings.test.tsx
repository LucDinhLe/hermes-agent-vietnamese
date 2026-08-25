import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { applyWorkProfile, getSkills, getWorkProfile, recommendWorkProfile } = vi.hoisted(() => ({
  applyWorkProfile: vi.fn(),
  getSkills: vi.fn(),
  getWorkProfile: vi.fn(),
  recommendWorkProfile: vi.fn()
}))

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  applyWorkProfile,
  getSkills,
  getWorkProfile,
  recommendWorkProfile
}))

import { WorkProfileSettings } from './work-profile-settings'

const owner = { connectionId: 'remote-a', profile: 'writer' }

beforeEach(() => {
  getWorkProfile.mockResolvedValue({
    allowed: ['deep-research'],
    common_tasks: ['Write cited briefs'],
    completed: true,
    installed_count: 2,
    legacy: false,
    skipped: false,
    work_areas: ['research_learning']
  })
  getSkills.mockResolvedValue([
    { category: 'research', description: 'Research deeply', enabled: true, name: 'deep-research' },
    { category: 'documents', description: 'Create Word files', enabled: false, name: 'docx' }
  ])
  recommendWorkProfile.mockResolvedValue({
    reasons: { 'deep-research': 'research_learning', docx: 'Write cited briefs' },
    skills: ['deep-research', 'docx'],
    used_provider: false
  })
  applyWorkProfile.mockResolvedValue({
    allowed: ['deep-research', 'docx'],
    completed: true,
    ok: true,
    skipped: false
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WorkProfileSettings', () => {
  it('previews local recommendations without mutating, then saves only after confirmation', async () => {
    render(<WorkProfileSettings backendOwner={owner} />)

    await screen.findByText('deep-research')
    expect(getWorkProfile).toHaveBeenCalledWith('writer', 'remote-a')
    expect(getSkills).toHaveBeenCalledWith('writer', 'remote-a')

    fireEvent.click(screen.getByRole('button', { name: 'Preview recommendations' }))

    await screen.findByText('docx')
    expect(recommendWorkProfile).toHaveBeenCalledWith(
      { common_tasks: ['Write cited briefs'], work_areas: ['research_learning'] },
      'writer',
      'remote-a'
    )
    expect(applyWorkProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save work profile' }))

    await waitFor(() =>
      expect(applyWorkProfile).toHaveBeenCalledWith(
        {
          allowed_skills: ['deep-research', 'docx'],
          common_tasks: ['Write cited briefs'],
          skipped: false,
          work_areas: ['research_learning']
        },
        'writer',
        'remote-a'
      )
    )
  })

  it('does not migrate a legacy profile merely by opening Settings', async () => {
    getWorkProfile.mockResolvedValueOnce({
      allowed: null,
      common_tasks: [],
      completed: false,
      installed_count: 2,
      legacy: true,
      skipped: false,
      work_areas: []
    })

    render(<WorkProfileSettings backendOwner={owner} />)

    await screen.findByText('deep-research')
    expect(applyWorkProfile).not.toHaveBeenCalled()
  })
})
