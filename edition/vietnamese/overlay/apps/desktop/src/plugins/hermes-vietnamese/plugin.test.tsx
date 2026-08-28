import type { PluginContext } from '@hermes/plugin-sdk'
import { PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { describe, expect, it, vi } from 'vitest'

import plugin from './plugin'

describe('Hermes Vietnamese bundled plugin', () => {
  it('registers only edition-owned route, navigation, and palette surfaces', () => {
    const contributions: Parameters<PluginContext['registerMany']>[0] = []

    const context = {
      i18n: {
        register: vi.fn(),
        t: (key: string) => key
      },
      registerMany: vi.fn(items => {
        contributions.push(...items)

        return () => undefined
      }),
      os: {
        notify: vi.fn(),
        openExternal: vi.fn(async () => true),
        revealPath: vi.fn(async () => true),
        writeClipboard: vi.fn(async () => true)
      }
    } as unknown as PluginContext

    plugin.register(context)

    expect(plugin.id).toBe('hermes-vietnamese')
    expect(plugin.defaultEnabled).toBe(true)
    expect(context.i18n.register).toHaveBeenCalledOnce()
    expect(contributions.map(item => item.area)).toEqual([ROUTES_AREA, SIDEBAR_NAV_AREA, PALETTE_AREA])
    expect(contributions.every(item => item.id.startsWith('about-'))).toBe(true)
  })
})
