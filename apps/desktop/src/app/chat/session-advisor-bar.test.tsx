import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuxiliaryModels, type HermesGateway } from '@/hermes'
import { $currentAdvisorEnabled, setCurrentAdvisorEnabled } from '@/store/session'

import { SessionAdvisorBar } from './session-advisor-bar'

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAuxiliaryModels: vi.fn()
}))

function renderBar(props: React.ComponentProps<typeof SessionAdvisorBar>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <SessionAdvisorBar {...props} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  setCurrentAdvisorEnabled(false)
  vi.mocked(getAuxiliaryModels).mockResolvedValue({
    main: { model: 'working-model', provider: 'openai' },
    tasks: [{ base_url: 'https://advisor.test/v1', model: 'advisor-model', provider: 'anthropic', task: 'advisor' }]
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SessionAdvisorBar', () => {
  it('stays clipped to its chat-pane container and shows the configured model', async () => {
    const { container } = renderBar({ enabled: false, gateway: null, gatewayOpen: true, sessionId: null })
    const bar = container.querySelector('[data-session-advisor-bar]')

    expect(bar?.className).toContain('@container')
    expect(bar?.className).toContain('overflow-hidden')
    expect(await screen.findByText('advisor-model')).toBeTruthy()
  })

  it('stores a draft toggle locally so session.create can inherit it', () => {
    renderBar({ enabled: false, gateway: null, gatewayOpen: true, sessionId: null })

    fireEvent.click(screen.getByRole('switch'))

    expect($currentAdvisorEnabled.get()).toBe(true)
  })

  it('sends a live toggle only to the targeted session', async () => {
    const request = vi.fn().mockResolvedValue({})
    const gateway = { request } as unknown as HermesGateway
    renderBar({ enabled: false, gateway, gatewayOpen: true, sessionId: 'runtime-42' })

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('config.set', {
        key: 'advisor',
        session_id: 'runtime-42',
        value: 'on'
      })
    )
  })
})
