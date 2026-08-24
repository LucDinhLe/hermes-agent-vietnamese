import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContextBreakdown, UsageStats } from '@/types/hermes'

import { ContextUsagePanel } from './context-usage-panel'
import { useContextBreakdown } from './hooks/use-context-breakdown'

const usage: UsageStats = {
  calls: 1,
  context_max: 1_050_000,
  context_percent: 23,
  context_used: 241_400,
  cost_status: 'included',
  cost_usd: 0,
  cache_read: 80_000,
  input: 0,
  output: 0,
  reference_cost_status: 'estimated',
  reference_cost_usd: 1.234,
  total: 0
}

const breakdown: ContextBreakdown = {
  categories: [{ color: 'teal', id: 'conversation', label: 'Conversation', tokens: 241_400 }],
  compact_recommended: false,
  compact_threshold_percent: 50,
  compact_threshold_tokens: 136_000,
  context_max: 272_000,
  context_measurement: 'measured',
  context_percent: 89,
  context_used: 241_400,
  estimated_total: 286_600,
  model: 'test-model',
  published_context_max: 1_050_000,
  published_context_source: 'openai',
  remaining_tokens: 808_600,
  tokens_until_compact: 0
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useContextBreakdown', () => {
  it('fetches for a session that has not run a turn yet', async () => {
    const requestGateway = vi.fn().mockResolvedValue(breakdown)

    const { result } = renderHook(() =>
      useContextBreakdown({ busy: false, enabled: true, requestGateway, sessionId: 'runtime-1' })
    )

    await waitFor(() => expect(result.current.breakdown).toEqual(breakdown))
    expect(requestGateway).toHaveBeenCalledWith('session.context_breakdown', { session_id: 'runtime-1' })
  })

  it('does not fetch while the gauge is hidden, and fetches once it is shown', async () => {
    const requestGateway = vi.fn().mockResolvedValue(breakdown)

    const { rerender } = renderHook(
      ({ enabled }) => useContextBreakdown({ busy: false, enabled, requestGateway, sessionId: 'runtime-1' }),
      { initialProps: { enabled: false } }
    )

    expect(requestGateway).not.toHaveBeenCalled()

    rerender({ enabled: true })

    await waitFor(() => expect(requestGateway).toHaveBeenCalledTimes(1))
  })

  it('skips the estimate mid-turn — the gateway streams measured usage then', () => {
    const requestGateway = vi.fn().mockResolvedValue(breakdown)

    renderHook(() => useContextBreakdown({ busy: true, enabled: true, requestGateway, sessionId: 'runtime-1' }))

    expect(requestGateway).not.toHaveBeenCalled()
  })

  it('refetches on a session switch and never reports the previous session numbers', async () => {
    const requestGateway = vi.fn().mockResolvedValue(breakdown)

    const { rerender, result } = renderHook(
      ({ sessionId }) => useContextBreakdown({ busy: false, enabled: true, requestGateway, sessionId }),
      { initialProps: { sessionId: 'runtime-1' } }
    )

    await waitFor(() => expect(result.current.breakdown).toEqual(breakdown))

    // Switching sessions must drop the numbers immediately — painting them
    // under the new session's name would be a lie until its own fetch lands.
    requestGateway.mockImplementation(() => new Promise(() => undefined))
    rerender({ sessionId: 'runtime-2' })

    expect(result.current.breakdown).toBeNull()
    expect(requestGateway).toHaveBeenLastCalledWith('session.context_breakdown', { session_id: 'runtime-2' })
  })

  it('reports the measured occupancy the backend sends, not just the estimate', async () => {
    // `context_used` on the payload is already the measured figure once a turn
    // has run — the estimate is the backend's own fallback, not a second value
    // the client has to choose between.
    const measured: ContextBreakdown = { ...breakdown, context_used: 12_000 }
    const requestGateway = vi.fn().mockResolvedValue(measured)

    const { result } = renderHook(() =>
      useContextBreakdown({ busy: false, enabled: true, requestGateway, sessionId: 'runtime-1' })
    )

    await waitFor(() => expect(result.current.breakdown?.context_used).toBe(12_000))
  })

  it('refetches when the working model changes inside the same session', async () => {
    const requestGateway = vi.fn().mockResolvedValue(breakdown)

    const { rerender } = renderHook(
      ({ refreshKey }) =>
        useContextBreakdown({
          busy: false,
          enabled: true,
          refreshKey,
          requestGateway,
          sessionId: 'runtime-1'
        }),
      { initialProps: { refreshKey: 'openai:gpt-5.5' } }
    )

    await waitFor(() => expect(requestGateway).toHaveBeenCalledTimes(1))
    rerender({ refreshKey: 'anthropic:claude-sonnet-5' })
    await waitFor(() => expect(requestGateway).toHaveBeenCalledTimes(2))
  })
})

describe('ContextUsagePanel', () => {
  it('renders one-decimal active/effective occupancy and an explicit API-equivalent disclaimer', () => {
    render(<ContextUsagePanel breakdown={breakdown} loading={false} usage={usage} />)

    expect(screen.getByText('23.0% of published context')).toBeTruthy()
    expect(screen.getByText('Published capacity: 1.05M · OpenAI')).toBeTruthy()
    expect(screen.getByText('Current route limit: 272k · 88.8% used')).toBeTruthy()
    expect(screen.getByText('API-equivalent value: ~$1.23 USD — reference only, not billed')).toBeTruthy()
    expect(screen.getByText('Included in the current subscription')).toBeTruthy()
    expect(screen.getByText('Conversation')).toBeTruthy()
  })

  it('keeps active and effective percentages distinct and marks absent contract fields unavailable', () => {
    const lowUsage = { ...usage, context_percent: 2, context_used: 17_300 }

    const lowBreakdown = {
      ...breakdown,
      categories: [
        { color: 'gray', id: 'system_prompt', label: 'System prompt', tokens: 16_800 },
        { color: 'teal', id: 'conversation', label: 'Conversation', tokens: 500 }
      ],
      context_used: 17_300,
      remaining_tokens: 1_032_700
    }

    render(<ContextUsagePanel breakdown={lowBreakdown} loading={false} usage={lowUsage} />)

    expect(screen.getByText('1.6% of published context')).toBeTruthy()
    expect(screen.getByText('Current route limit: 272k · 6.4% used')).toBeTruthy()
    expect(screen.getByText('System + background: 16.8k')).toBeTruthy()
    expect(screen.getByText('Conversation context: 500')).toBeTruthy()
    expect(screen.getByText('Logical history: Unavailable')).toBeTruthy()
    expect(screen.getByText('Compactions: Unavailable')).toBeTruthy()
    expect(screen.getByText('Provider quota: unavailable')).toBeTruthy()
  })

  it('renders future optional logical, compaction, and provider quota fields when present', () => {
    render(
      <ContextUsagePanel
        breakdown={{
          ...breakdown,
          compaction_count: 2,
          conversation_tokens: 10_000,
          logical_history_tokens: 480_000,
          quota: { available: true, provider: 'OpenAI', remaining_percent: 98, reset_at: '2026-08-25' },
          system_background_tokens: 231_400
        }}
        loading={false}
        usage={usage}
      />
    )

    expect(screen.getByText('Logical history: 480k')).toBeTruthy()
    expect(screen.getByText('Compactions: 2')).toBeTruthy()
    expect(screen.getByText('Provider quota (OpenAI): 98.0% remaining')).toBeTruthy()
    expect(screen.getByText('Quota resets: 2026-08-25')).toBeTruthy()
  })

  it('says so when there is no breakdown rather than painting an empty bar', () => {
    render(<ContextUsagePanel breakdown={null} loading={false} usage={usage} />)

    expect(screen.getByText('No context data yet')).toBeTruthy()
  })
})
