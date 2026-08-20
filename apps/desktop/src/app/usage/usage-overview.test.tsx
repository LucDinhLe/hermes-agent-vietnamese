import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnalyticsResponse } from '@/hermes'

import { UsageOverview } from './usage-overview'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      commandCenter: {
        actions: (count: string) => `${count} actions`,
        dailyTokens: 'Daily tokens',
        input: 'input',
        loadingUsage: 'Loading usage',
        noDailyActivity: 'No daily activity',
        noModelUsage: 'No model usage',
        noSkillActivity: 'No skill activity',
        noUsage: (period: number) => `No usage in ${period} days`,
        output: 'output',
        retry: 'Retry',
        statApiCalls: 'API calls',
        statSessions: 'Sessions',
        statTokens: 'Tokens in/out',
        topModels: 'Top models',
        topSkills: 'Top skills'
      }
    }
  })
}))

afterEach(cleanup)

const usage: AnalyticsResponse = {
  by_model: [
    {
      api_calls: 4,
      estimated_cost: 0,
      input_tokens: 10_000,
      model: 'gpt-5.6-sol',
      output_tokens: 5_000,
      sessions: 2
    }
  ],
  daily: [
    {
      actual_cost: 0,
      api_calls: 4,
      cache_read_tokens: 0,
      day: '2026-08-19',
      estimated_cost: 0,
      input_tokens: 10_000,
      output_tokens: 5_000,
      reasoning_tokens: 0,
      sessions: 2
    }
  ],
  period_days: 30,
  skills: {
    summary: { distinct_skills_used: 0, total_skill_actions: 0, total_skill_edits: 0, total_skill_loads: 0 },
    top_skills: []
  },
  totals: {
    total_actual_cost: 0,
    total_api_calls: 4,
    total_cache_read: 0,
    total_estimated_cost: 0,
    total_input: 10_000,
    total_output: 5_000,
    total_reasoning: 0,
    total_sessions: 2
  }
}

describe('UsageOverview', () => {
  it('shows token totals and the models that consumed them', () => {
    render(<UsageOverview error="" loading={false} onRefresh={vi.fn()} period={30} usage={usage} />)

    expect(screen.getByText('gpt-5.6-sol')).toBeTruthy()
    expect(screen.getByText('15k')).toBeTruthy()
    expect(screen.getByText('10k / 5k')).toBeTruthy()
  })
})
