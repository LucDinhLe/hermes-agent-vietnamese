import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuxiliaryModels, type HermesGateway, setModelAssignment } from '@/hermes'
import { $currentAdvisorEnabled, setCurrentAdvisorEnabled } from '@/store/session'

import { SessionAdvisorBar } from './session-advisor-bar'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAuxiliaryModels: vi.fn(),
  setModelAssignment: vi.fn()
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
  vi.mocked(setModelAssignment).mockResolvedValue({ ok: true })
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

  it('shows every model from every connected provider and assigns the Advisor model', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'model.options') {
        return {
          providers: [
            {
              authenticated: true,
              models: ['gpt-5.6-sol', 'gpt-5.5'],
              name: 'Connected OpenAI',
              slug: 'openai-codex'
            },
            {
              authenticated: true,
              models: ['advisor-model', 'review-model'],
              name: 'Connected provider',
              slug: 'anthropic'
            }
          ]
        }
      }

      return {}
    })

    const gateway = { request } as unknown as HermesGateway
    const { container } = renderBar({ enabled: true, gateway, gatewayOpen: true, sessionId: 'runtime-42' })

    const trigger = await screen.findByRole('button', { name: 'Advisor model: advisor-model' })
    expect(container.querySelector('[data-session-advisor-model-trigger] svg')).toBeTruthy()

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })

    expect(await screen.findByText('Connected OpenAI')).toBeTruthy()
    expect(await screen.findByText(/GPT-5\.6-sol/i)).toBeTruthy()
    expect(await screen.findByText('Review Model')).toBeTruthy()
    expect(request).toHaveBeenCalledWith('model.options', { explicit_only: true })

    fireEvent.click(screen.getByText('Review Model'))

    await waitFor(() =>
      expect(setModelAssignment).toHaveBeenCalledWith(
        {
          model: 'review-model',
          provider: 'anthropic',
          scope: 'auxiliary',
          task: 'advisor'
        },
        'default'
      )
    )
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
