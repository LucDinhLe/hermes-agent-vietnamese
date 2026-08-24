import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ connectionId: 'source-a', profile: 'default' }))
const notify = vi.hoisted(() => vi.fn())

vi.mock('@/i18n', () => ({ translateNow: (key: string) => key }))
vi.mock('./backend-owner', () => ({
  activeBackendOwner: () => ({ ...state })
}))
vi.mock('./notifications', () => ({ notify }))

import { $mcpInstallRequest, requestMcpInstallFromDeepLink } from './mcp-deeplink-install'

const config = btoa(JSON.stringify({ url: 'https://example.com/mcp' }))

describe('MCP deep-link source capture', () => {
  beforeEach(() => {
    state.connectionId = 'source-a'
    state.profile = 'default'
    notify.mockReset()
    $mcpInstallRequest.set(null)
  })

  it('keeps the immutable source selected when the link entered the app', () => {
    requestMcpInstallFromDeepLink({ config, name: 'example' })
    state.connectionId = 'source-b'

    expect($mcpInstallRequest.get()?.owner).toEqual({ connectionId: 'source-a', profile: 'default' })
  })
})
