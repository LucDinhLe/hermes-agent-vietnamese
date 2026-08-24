import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DECISIONS_KEY = 'hermes.desktop.pluginDecisions.v2'

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('required bundled plugins', () => {
  it('activates a required feature even when an older install persisted false', async () => {
    window.localStorage.setItem(DECISIONS_KEY, JSON.stringify({ 'hermes-bots': false, 'optional-example': false }))

    const { pluginShouldActivate } = await import('./plugins-store')

    expect(pluginShouldActivate('hermes-bots', true, true)).toBe(true)
    expect(pluginShouldActivate('optional-example', true, false)).toBe(false)
  })

  it('refuses a live disable request without mutating the saved decision or unloading the feature', async () => {
    const { $pluginRecords, publishPlugin, setPluginEnabled } = await import('./plugins-store')
    const activate = vi.fn()
    const deactivate = vi.fn()

    publishPlugin(
      {
        id: 'required-feature',
        kind: 'bundled',
        name: 'Required feature',
        required: true,
        status: 'loaded'
      },
      { activate, deactivate }
    )

    await setPluginEnabled('required-feature', false)

    expect(deactivate).not.toHaveBeenCalled()
    expect(activate).not.toHaveBeenCalled()
    expect($pluginRecords.get()['required-feature']?.status).toBe('loaded')
    expect(window.localStorage.getItem(DECISIONS_KEY)).toBeNull()
  })
})
