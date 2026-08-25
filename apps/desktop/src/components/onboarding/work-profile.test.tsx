import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyWorkProfile, getSkills, getWorkProfile, recommendWorkProfile } from '@/hermes'
import type * as HermesModule from '@/hermes'

import { WorkProfileSetup } from './work-profile'

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<typeof HermesModule>()),
  applyWorkProfile: vi.fn(),
  getSkills: vi.fn(),
  getWorkProfile: vi.fn(),
  recommendWorkProfile: vi.fn()
}))

const mockedGetWorkProfile = vi.mocked(getWorkProfile)
const mockedGetSkills = vi.mocked(getSkills)
const mockedRecommend = vi.mocked(recommendWorkProfile)
const mockedApply = vi.mocked(applyWorkProfile)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function arrange() {
  mockedGetWorkProfile.mockResolvedValue({
    allowed: null,
    common_tasks: [],
    completed: false,
    installed_count: 3,
    legacy: true,
    skipped: false,
    work_areas: []
  })
  mockedGetSkills.mockResolvedValue([
    { name: 'docx', description: 'Word documents', enabled: true },
    { name: 'pdf', description: 'PDF documents', enabled: true },
    { name: 'grounded-citations', description: 'Cited research', enabled: true }
  ] as never)
  mockedRecommend.mockResolvedValue({
    reasons: { docx: 'Useful for writing.', pdf: 'Useful for writing.' },
    skills: ['docx', 'pdf'],
    used_provider: false
  })
  mockedApply.mockResolvedValue({ allowed: ['docx'], completed: true, ok: true, skipped: false })
}

describe('WorkProfileSetup', () => {
  it('previews a local recommendation and lets the user edit it before applying', async () => {
    arrange()
    const onDone = vi.fn()
    render(<WorkProfileSetup connectionId="source-a" onDone={onDone} profile="writer" />)

    await screen.findByRole('button', { name: 'Writing and content' })
    fireEvent.click(screen.getByRole('button', { name: 'Writing and content' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Common tasks' }), {
      target: { value: 'Draft a weekly newsletter' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview recommendations' }))

    await screen.findByText('docx')
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pdf' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save work setup' }))

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith(
        {
          allowed_skills: ['docx'],
          common_tasks: ['Draft a weekly newsletter'],
          skipped: false,
          work_areas: ['writing_content']
        },
        'writer',
        'source-a'
      )
    )
    expect(onDone).toHaveBeenCalledWith(false)
  })

  it('persists skip instead of silently dismissing first-run setup', async () => {
    arrange()
    mockedApply.mockResolvedValue({ allowed: [], completed: true, ok: true, skipped: true })
    const onDone = vi.fn()
    render(<WorkProfileSetup firstRun onDone={onDone} profile="default" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith(
        { allowed_skills: [], common_tasks: [], skipped: true, work_areas: [] },
        'default',
        undefined
      )
    )
    expect(onDone).toHaveBeenCalledWith(true)
  })
})
