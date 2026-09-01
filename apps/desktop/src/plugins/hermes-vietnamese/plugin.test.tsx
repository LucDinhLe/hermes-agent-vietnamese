import type { PluginContext } from '@hermes/plugin-sdk'
import { PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { describe, expect, it, vi } from 'vitest'

import plugin from './plugin'
import { SESSION_CONTROLS_AREA } from './session-control-bar'

describe('Hermes Vietnamese bundled plugin', () => {
  it('restores V32 usage navigation and session controls without shadowing built-in routes', () => {
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

    const routes = contributions.filter(item => item.area === ROUTES_AREA)
    const navigation = contributions.filter(item => item.area === SIDEBAR_NAV_AREA)
    const commands = contributions.filter(item => item.area === PALETTE_AREA)
    const sessionControls = contributions.filter(item => item.area === SESSION_CONTROLS_AREA)

    expect(routes.map(item => ({ id: item.id, path: (item.data as { path?: string } | undefined)?.path }))).toEqual([
      { id: 'about-route', path: '/hermes-vietnamese' }
    ])
    expect(
      navigation.map(item => ({
        id: item.id,
        label: (item.data as { label?: string } | undefined)?.label,
        path: (item.data as { path?: string } | undefined)?.path
      }))
    ).toEqual([{ id: 'usage-nav', label: 'Thống kê sử dụng', path: '/command-center?section=usage' }])
    expect(sessionControls.map(item => item.id)).toEqual(['v32-session-controls'])
    expect(
      commands.map(item => ({ id: item.id, label: (item.data as { label?: string } | undefined)?.label }))
    ).toEqual([{ id: 'about-command', label: 'Bản tiếng Việt: Mở thông tin sản phẩm' }])
  })
})
