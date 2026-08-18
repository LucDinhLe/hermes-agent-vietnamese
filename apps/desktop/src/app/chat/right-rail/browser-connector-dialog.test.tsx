import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BrowserConnectorDialog } from './browser-connector-dialog'

const trust = {
  extensionId: 'jabfgpkkfcoiiegikmdccooedjoooflm',
  version: '0.20.0.26',
  manifestVersion: 3,
  permissions: ['activeTab'],
  optionalPermissions: ['cookies'],
  optionalHostPermissions: ['http://*/*', 'https://*/*', 'http://127.0.0.1/*'],
  sha256: 'a'.repeat(64),
  extensionPath: 'C:/isolated/hermes-connector',
  verified: true
}

function installApi(api: Record<string, unknown>) {
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      browserConnector: api,
      writeClipboard: vi.fn(async () => true)
    }
  })
}

describe('BrowserConnectorDialog', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('is disabled by default and requires explicit enablement', async () => {
    let enabled = false
    const status = vi.fn(async () => ({ ok: true, value: { enabled, imports: [], trust } }))

    const setEnabled = vi.fn(async (next: boolean) => {
      enabled = next

      return { ok: true, value: { enabled } }
    })

    installApi({
      status,
      setEnabled,
      cancel: vi.fn(),
      openExtensionFolder: vi.fn(),
      start: vi.fn(),
      pairingStatus: vi.fn(),
      approve: vi.fn(),
      revoke: vi.fn()
    })

    render(<BrowserConnectorDialog onOpenChange={vi.fn()} open url="https://app.example.com/" />)
    expect(await screen.findByText('Connector disabled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create one-time code' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true))
    expect(await screen.findByText('Connector enabled')).toBeTruthy()
  })

  it('shows metadata-only preview before approval and reports import result', async () => {
    const pairing = {
      attemptId: 'attempt-1',
      hostname: 'app.example.com',
      expiresAt: Date.now() + 120_000,
      state: 'pairing',
      pairingCode: '43123.fixturePairingSecret12345678901'
    }

    const preview = {
      ...pairing,
      pairingCode: undefined,
      state: 'preview',
      preview: {
        browser: 'chrome',
        hostname: 'app.example.com',
        cookieCount: 2,
        unsupportedCount: 1,
        expiredCount: 0,
        sessionCount: 1,
        latestExpiry: 1_900_000_000
      }
    }

    const approve = vi.fn(async () => ({
      ok: true,
      value: {
        id: 'import-1',
        hostname: 'app.example.com',
        cookieCount: 2,
        importedAt: Date.now(),
        skippedExpired: 0,
        skippedUnsupported: 1,
        sessionCount: 1
      }
    }))

    installApi({
      status: vi.fn(async () => ({ ok: true, value: { enabled: true, imports: [], trust } })),
      setEnabled: vi.fn(),
      cancel: vi.fn(),
      openExtensionFolder: vi.fn(),
      start: vi.fn(async () => ({ ok: true, value: pairing })),
      pairingStatus: vi.fn(async () => ({ ok: true, value: preview })),
      approve,
      revoke: vi.fn()
    })

    render(<BrowserConnectorDialog onOpenChange={vi.fn()} open url="https://app.example.com/account" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Create one-time code' }))
    expect(await screen.findByText(pairing.pairingCode)).toBeTruthy()
    expect(await screen.findByText('Review before importing')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByText('fixture-cookie-value')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 cookies for app.example.com' }))
    await waitFor(() => expect(approve).toHaveBeenCalledWith('attempt-1'))
    expect(await screen.findByText('Imported 2 cookies for app.example.com.')).toBeTruthy()
    expect(screen.getByText('Skipped 1 unsupported partitioned cookies.')).toBeTruthy()
  })
})
