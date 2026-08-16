import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { $visibleModels } from '@/store/model-visibility'
import { $collapsedProviders } from '@/store/provider-collapse'

import { ModelVisibilityDialog } from './model-visibility-dialog'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

const getGlobalModelOptions = vi.fn()

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptions(...args),
  setApiRequestProfile: vi.fn()
}))

beforeEach(() => {
  $visibleModels.set(null)
  $collapsedProviders.set(['claude-code'])
  getGlobalModelOptions.mockResolvedValue({
    providers: [{ models: ['sonnet', 'opus', 'haiku'], name: 'Claude Pro / Max (Claude Code)', slug: 'claude-code' }]
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('model visibility provider disclosure', () => {
  it('exposes the collapsed state and expands the provider models', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <ModelVisibilityDialog onOpenChange={vi.fn()} onOpenProviders={vi.fn()} open />
      </QueryClientProvider>
    )

    const label = await screen.findByText('Claude Pro / Max (Claude Code)')
    const header = label.closest('button')

    expect(header?.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/^Sonnet/i)).toBeNull()

    fireEvent.click(header!)

    await screen.findByText(/^Sonnet/i)
    expect(header?.getAttribute('aria-expanded')).toBe('true')
  })
})
