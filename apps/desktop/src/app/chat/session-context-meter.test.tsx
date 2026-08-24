// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setRuntimeI18nLocale } from '@/i18n'
import type { ContextBreakdown, UsageStats } from '@/types/hermes'

import { SessionContextMeter } from './session-context-meter'

const mockBreakdown = vi.hoisted<ContextBreakdown>(() => ({
  categories: [],
  compact_recommended: false,
  context_max: 272_000,
  context_measurement: 'measured',
  context_percent: 6,
  context_used: 17_300,
  estimated_total: 17_300,
  published_context_max: 1_050_000,
  published_context_source: 'openai'
}))

vi.mock('@/app/shell/hooks/use-context-breakdown', () => ({
  useContextBreakdown: () => ({ breakdown: mockBreakdown, loading: false })
}))

afterEach(() => {
  cleanup()
  setRuntimeI18nLocale('en')
})

describe('SessionContextMeter headline', () => {
  it('uses one-decimal published occupancy and identifies API-equivalent value as not billed', () => {
    const usage: UsageStats = {
      calls: 1,
      cost_status: 'included',
      cost_usd: 0,
      input: 100,
      output: 20,
      reference_cost_status: 'estimated',
      reference_cost_usd: 1.23,
      total: 120
    }

    const { container } = render(
      <SessionContextMeter
        busy={false}
        gateway={{ request: vi.fn() } as never}
        gatewayOpen
        model="test-model"
        provider="mock"
        sessionId="runtime-1"
        sessionUsage={usage}
      />
    )

    const meter = container.querySelector<HTMLButtonElement>('[data-session-context-meter]')
    expect(meter?.getAttribute('aria-label')).toContain('17.3k/1.05M (1.6%)')
    expect(meter?.getAttribute('aria-label')).toContain('API-equivalent: ~$1.23 USD · not billed')
    expect(meter?.textContent).toContain('(1.6%)')
  })
})
