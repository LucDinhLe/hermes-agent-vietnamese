import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGlobalModelOptions } from '@/hermes'
import { rendererRuntimeKey } from '@/lib/session-runtime-key'

import { manualPickRemoved, modelOptionsQueryKey, requestModelOptions } from './model-options'

const globalOptions = { model: 'hermes-4', provider: 'nous', providers: [] }
const runtimeRequest = vi.hoisted(() => vi.fn())

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: vi.fn(() => Promise.resolve(globalOptions))
}))
vi.mock('@/store/session-request-router', () => ({ requestForRendererRuntime: runtimeRequest }))

describe('requestModelOptions', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the connected gateway even before a session exists', async () => {
    const gatewayPayload = {
      model: 'BeastMode',
      provider: 'moa',
      providers: [{ models: ['BeastMode'], name: 'Mixture of Agents', slug: 'moa' }]
    }

    const gateway = {
      request: vi.fn(() => Promise.resolve(gatewayPayload))
    }
    await expect(requestModelOptions({ gateway: gateway as never, sessionId: null })).resolves.toBe(gatewayPayload)

    expect(gateway.request).toHaveBeenCalledWith('model.options', { explicit_only: true })
    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('keeps an empty session catalog authoritative without falling through to ambient REST', async () => {
    const gatewayPayload = { model: 'hermes-local', provider: 'hermes-local' }

    const gateway = {
      request: vi.fn(() => Promise.resolve(gatewayPayload))
    }
    runtimeRequest.mockResolvedValueOnce(gatewayPayload)

    await expect(requestModelOptions({ gateway: gateway as never, sessionId: 'session-1' })).resolves.toEqual(
      gatewayPayload
    )

    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('fails closed when the exact session catalog request fails', async () => {
    const gateway = {
      request: vi.fn(() => Promise.reject(new Error('gateway request unavailable')))
    }
    runtimeRequest.mockRejectedValueOnce(new Error('gateway request unavailable'))

    await expect(requestModelOptions({ gateway: gateway as never, sessionId: 'session-1' })).rejects.toThrow(
      'gateway request unavailable'
    )
    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('routes a qualified session without an ambient gateway and never calls global REST', async () => {
    const runtimeKey = rendererRuntimeKey(
      { connectionId: 'agent-a', gatewayEpoch: 7, profile: 'default' },
      'same-runtime'
    )

    runtimeRequest.mockResolvedValueOnce(globalOptions)

    await expect(requestModelOptions({ gateway: undefined, sessionId: runtimeKey })).resolves.toBe(globalOptions)
    expect(runtimeRequest).toHaveBeenCalledWith(runtimeKey, 'model.options', {
      explicit_only: true,
      session_id: runtimeKey
    })
    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('preserves the gateway error when its REST recovery path also fails', async () => {
    const gatewayError = new Error('gateway request unavailable')

    const gateway = {
      request: vi.fn(() => Promise.reject(gatewayError))
    }

    vi.mocked(getGlobalModelOptions).mockRejectedValueOnce(new Error('REST request unavailable'))

    await expect(requestModelOptions({ gateway: gateway as never })).rejects.toBe(gatewayError)
  })

  it('keeps the gateway result when both catalog paths have no selectable models', async () => {
    const gatewayPayload = { model: 'hermes-local', provider: 'hermes-local', providers: [] }

    const gateway = {
      request: vi.fn(() => Promise.resolve(gatewayPayload))
    }

    await expect(requestModelOptions({ gateway: gateway as never })).resolves.toBe(gatewayPayload)
  })

  it('passes the active session id and refresh flag through the gateway', async () => {
    const gateway = {
      request: vi.fn(() => Promise.resolve(globalOptions))
    }
    runtimeRequest.mockResolvedValueOnce(globalOptions)

    await requestModelOptions({ gateway: gateway as never, refresh: true, sessionId: 'session-1' })

    expect(runtimeRequest).toHaveBeenCalledWith('session-1', 'model.options', {
      explicit_only: true,
      refresh: true,
      session_id: 'session-1'
    })
    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('falls back to REST when no gateway is connected', async () => {
    await requestModelOptions({ refresh: true })

    expect(getGlobalModelOptions).toHaveBeenCalledWith({ explicitOnly: true, refresh: true })
  })
})

describe('modelOptionsQueryKey', () => {
  it('isolates new-chat catalogs by active gateway profile', () => {
    expect(modelOptionsQueryKey('default')).toEqual(['model-options', 'default', 'global'])
    expect(modelOptionsQueryKey('compass')).toEqual(['model-options', 'compass', 'global'])
    expect(modelOptionsQueryKey('default')).not.toEqual(modelOptionsQueryKey('compass'))
  })

  it('keeps session catalogs inside the owning profile namespace', () => {
    expect(modelOptionsQueryKey(' compass ', 'session-1')).toEqual(['model-options', 'compass', 'session-1'])
  })
})

describe('manualPickRemoved', () => {
  const providers = [
    { name: 'OpenRouter', slug: 'openrouter', models: ['owl-alpha', 'gpt-5.5'] },
    { name: 'Nous', slug: 'nous', models: [] } // present but unconfigured / re-auth
  ]

  it('flags a pick whose model was dropped from a populated provider', () => {
    expect(manualPickRemoved(providers, 'openrouter', 'nemotron-removed')).toBe(true)
  })

  it('keeps a pick that is still in the catalog', () => {
    expect(manualPickRemoved(providers, 'openrouter', 'gpt-5.5')).toBe(false)
  })

  it('matches the provider by name as well as slug', () => {
    expect(manualPickRemoved(providers, 'OpenRouter', 'gpt-5.5')).toBe(false)
    expect(manualPickRemoved(providers, 'OpenRouter', 'gone')).toBe(true)
  })

  it('never clobbers when the provider is absent (ambiguous / deauth)', () => {
    expect(manualPickRemoved(providers, 'anthropic', 'claude-sonnet-4.6')).toBe(false)
  })

  it('never clobbers when the provider has an empty model list (re-auth)', () => {
    expect(manualPickRemoved(providers, 'nous', 'hermes-4')).toBe(false)
  })

  it('never clobbers on a not-yet-loaded or empty catalog', () => {
    expect(manualPickRemoved(undefined, 'openrouter', 'gpt-5.5')).toBe(false)
    expect(manualPickRemoved([], 'openrouter', 'gpt-5.5')).toBe(false)
  })

  it('never clobbers when there is no pick', () => {
    expect(manualPickRemoved(providers, '', '')).toBe(false)
  })
})
