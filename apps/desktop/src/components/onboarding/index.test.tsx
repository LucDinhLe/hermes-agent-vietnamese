import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $desktopOnboarding, type DesktopOnboardingState, type OnboardingContext } from '@/store/onboarding'
import type { OAuthProvider } from '@/types/hermes'

import { buildApiKeyCatalog, Picker } from '.'

function provider(id: string, name = id): OAuthProvider {
  return {
    cli_command: `hermes login ${id}`,
    docs_url: `https://example.com/${id}`,
    flow: 'pkce',
    id,
    name,
    status: { logged_in: false }
  }
}

function setProviders(providers: OAuthProvider[]) {
  $desktopOnboarding.set({
    configured: false,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false
  } satisfies DesktopOnboardingState)
}

const ctx: OnboardingContext = { requestGateway: async () => undefined as never }

afterEach(() => {
  cleanup()

  try {
    window.localStorage.clear()
  } catch {
    // jsdom localStorage should always be present; ignore if not.
  }

  $desktopOnboarding.set({
    configured: null,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers: null,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false
  })
})

describe('onboarding Picker', () => {
  it('shows existing-account connectors before optional provider services', () => {
    setProviders([
      provider('anthropic', 'Anthropic Claude'),
      provider('nous', 'Nous Portal'),
      provider('claude-code', 'Claude Code'),
      provider('openai-codex', 'OpenAI Codex / ChatGPT')
    ])
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('OpenAI OAuth (ChatGPT)')).toBeTruthy()
    expect(screen.getByText('Claude Pro / Max (qua Claude Code)')).toBeTruthy()
    expect(screen.getByText('Google Gemini (API key)')).toBeTruthy()
    expect(screen.getByText('Nous Portal')).toBeTruthy()
    expect(screen.getByText('Fireworks AI')).toBeTruthy()
    expect(screen.getByText('OpenRouter')).toBeTruthy()
    expect(screen.getByText('OpenAI')).toBeTruthy()
    expect(screen.getByText('xAI Grok')).toBeTruthy()
    expect(screen.getByText('Local / custom endpoint')).toBeTruthy()
    expect(screen.getByText('Anthropic API Key')).toBeTruthy()
    expect(screen.queryByText('Recommended')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Other providers' })).toBeNull()
  })

  it('adds every pasteable API provider from the backend catalog', () => {
    const options = buildApiKeyCatalog([
      { auth_type: 'api_key', key_env: 'DEEPSEEK_API_KEY', models: [], name: 'DeepSeek', slug: 'deepseek' },
      { auth_type: 'oauth_external', models: [], name: 'Account OAuth', slug: 'account-oauth' },
      { auth_type: 'api_key', models: [], name: 'Missing key metadata', slug: 'missing-key' }
    ])

    expect(options.some(option => option.id === 'deepseek')).toBe(true)
    expect(options.some(option => option.id === 'account-oauth')).toBe(false)
    expect(options.some(option => option.id === 'missing-key')).toBe(false)
  })

  it('keeps ChatGPT, Claude Pro, and Gemini ahead of Nous regardless of backend order', () => {
    setProviders([
      provider('minimax-oauth', 'MiniMax'),
      provider('nous', 'Nous Portal'),
      provider('claude-code', 'Claude Code'),
      provider('openai-codex', 'OpenAI Codex / ChatGPT')
    ])
    render(<Picker ctx={ctx} />)

    const labels = screen
      .getAllByRole('button')
      .map(el => el.textContent ?? '')
      .filter(text => /OpenAI OAuth|Claude Pro|Google Gemini|Nous Portal|MiniMax/.test(text))

    const indexOf = (needle: string) => labels.findIndex(text => text.includes(needle))
    expect(indexOf('OpenAI OAuth')).toBeGreaterThanOrEqual(0)
    expect(indexOf('Claude Pro')).toBeGreaterThan(indexOf('OpenAI OAuth'))
    expect(indexOf('Google Gemini')).toBeGreaterThan(indexOf('Claude Pro'))
    expect(indexOf('Nous Portal')).toBeGreaterThan(indexOf('Google Gemini'))
    expect(indexOf('MiniMax')).toBeGreaterThan(indexOf('Nous Portal'))
  })

  it('opens the API form with Google Gemini preselected', () => {
    setProviders([provider('nous', 'Nous Portal'), provider('openai-codex', 'OpenAI Codex / ChatGPT')])
    render(<Picker ctx={ctx} />)

    fireEvent.click(screen.getByRole('button', { name: /Google Gemini/ }))

    expect($desktopOnboarding.get().mode).toBe('apikey')
    expect(screen.getByRole('button', { name: /Google Gemini/ }).className).toContain('border-primary')
    expect(screen.getByText('Use an API key from Google AI Studio to access Gemini models.')).toBeTruthy()
  })

  it('shows every provider directly when Nous Portal is absent', () => {
    setProviders([provider('anthropic', 'Anthropic Claude'), provider('openai-codex', 'OpenAI Codex / ChatGPT')])
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('Fireworks AI')).toBeTruthy()
    expect(screen.getByText('Anthropic API Key')).toBeTruthy()
    expect(screen.getByText('OpenAI OAuth (ChatGPT)')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Other providers' })).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('offers "choose later" on first run and persists the skip', () => {
    setProviders([provider('nous', 'Nous Portal')])
    render(<Picker ctx={ctx} />)

    const skip = screen.getByRole('button', { name: "I'll choose a provider later" })

    fireEvent.click(skip)

    expect($desktopOnboarding.get().firstRunSkipped).toBe(true)
    expect(window.localStorage.getItem('hermes-onboarding-skipped-v1')).toBe('1')
  })

  it('hides "choose later" in manual (add-provider) mode', () => {
    setProviders([provider('nous', 'Nous Portal')])
    $desktopOnboarding.set({ ...$desktopOnboarding.get(), manual: true })
    render(<Picker ctx={ctx} />)

    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })
})
