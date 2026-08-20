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
    const { container } = renderBar({
      busy: false,
      enabled: false,
      gateway: null,
      gatewayOpen: true,
      model: 'working-model',
      provider: 'openai',
      sessionId: null
    })

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

    const { container } = renderBar({
      busy: false,
      enabled: true,
      gateway,
      gatewayOpen: true,
      model: 'gpt-5.6-sol',
      provider: 'openai-codex',
      sessionId: 'runtime-42'
    })

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
    renderBar({
      busy: false,
      enabled: false,
      gateway: null,
      gatewayOpen: true,
      model: 'working-model',
      provider: 'openai',
      sessionId: null
    })

    fireEvent.click(screen.getByRole('switch'))

    expect($currentAdvisorEnabled.get()).toBe(true)
  })

  it('sends a live toggle only to the targeted session', async () => {
    const request = vi.fn().mockResolvedValue({})
    const gateway = { request } as unknown as HermesGateway
    renderBar({
      busy: false,
      enabled: false,
      gateway,
      gatewayOpen: true,
      model: 'working-model',
      provider: 'openai',
      sessionId: 'runtime-42'
    })

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('config.set', {
        key: 'advisor',
        session_id: 'runtime-42',
        value: 'on'
      })
    )
  })

  it('shows the working model published window for the exact chat session', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'session.context_breakdown') {
        return {
          categories: [],
          compact_recommended: false,
          compact_threshold_percent: 50,
          compact_threshold_tokens: 450_000,
          context_max: 900_000,
          context_measurement: 'measured',
          context_percent: 18,
          context_used: 161_800,
          estimated_total: 161_800,
          model: 'gpt-5.6-sol',
          published_context_max: 1_050_000,
          published_context_percent: 15,
          published_context_reference: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
          published_context_source: 'openai',
          remaining_tokens: 888_200,
          tokens_until_compact: 288_200
        }
      }

      return {}
    })

    const gateway = { request } as unknown as HermesGateway

    const { container } = renderBar({
      busy: false,
      enabled: true,
      gateway,
      gatewayOpen: true,
      model: 'gpt-5.6-sol',
      provider: 'openai-codex',
      sessionId: 'runtime-42'
    })

    expect(await screen.findByText('161.8k/1.05M (15%)')).toBeTruthy()
    expect(request).toHaveBeenCalledWith('session.context_breakdown', { session_id: 'runtime-42' })

    const meter = container.querySelector('[data-session-context-meter]')
    const shield = container.querySelector('.codicon-shield')
    expect(meter).toBeTruthy()
    expect(shield).toBeTruthy()
    expect(meter!.compareDocumentPosition(shield!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.pointerDown(meter as Element, { button: 0, ctrlKey: false })
    const publisherLink = await screen.findByRole('link', { name: /Published capacity: 1\.05M · OpenAI/ })

    expect(publisherLink.getAttribute('href')).toBe('https://developers.openai.com/api/docs/models/gpt-5.6-sol')
    expect(screen.getByText('Current route limit: 900k')).toBeTruthy()
    expect(screen.getByText('288.2k until Hermes compacts')).toBeTruthy()
  })

  it('keeps context readings independent across two chat panels', async () => {
    const request = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method !== 'session.context_breakdown') {
        return {}
      }

      const first = params?.session_id === 'runtime-a'
      const contextUsed = first ? 100_000 : 200_000

      return {
        categories: [],
        context_max: 1_050_000,
        context_measurement: 'measured',
        context_percent: first ? 10 : 19,
        context_used: contextUsed,
        estimated_total: contextUsed,
        model: 'gpt-5.5',
        published_context_max: 1_050_000,
        published_context_source: 'openai'
      }
    })

    const gateway = { request } as unknown as HermesGateway
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <SessionAdvisorBar
          busy={false}
          enabled={false}
          gateway={gateway}
          gatewayOpen
          model="gpt-5.5"
          provider="openai"
          sessionId="runtime-a"
        />
        <SessionAdvisorBar
          busy={false}
          enabled={false}
          gateway={gateway}
          gatewayOpen
          model="gpt-5.5"
          provider="openai"
          sessionId="runtime-b"
        />
      </QueryClientProvider>
    )

    expect(await screen.findByText('100k/1.05M (10%)')).toBeTruthy()
    expect(await screen.findByText('200k/1.05M (19%)')).toBeTruthy()
    expect(request).toHaveBeenCalledWith('session.context_breakdown', { session_id: 'runtime-a' })
    expect(request).toHaveBeenCalledWith('session.context_breakdown', { session_id: 'runtime-b' })
  })
})
