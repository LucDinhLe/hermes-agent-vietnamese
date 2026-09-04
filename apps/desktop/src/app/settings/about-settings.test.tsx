// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { vi as viTranslations } from '@/i18n/vi'
import { $desktopVersion, $updateChecking, $updateStatus, resetUpdateApplyState } from '@/store/updates'

import { AboutSettings } from './about-settings'

const mocks = vi.hoisted(() => ({ openExternal: vi.fn() }))

vi.mock('@/i18n', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    useI18n: () => ({ locale: 'vi', t: viTranslations })
  }
})

vi.mock('./uninstall-section', () => ({ UninstallSection: () => null }))

describe('AboutSettings community identity and updater source', () => {
  beforeEach(() => {
    resetUpdateApplyState()
    $updateChecking.set(false)
    $desktopVersion.set({
      appVersion: '0.20.4-vi.35',
      electronVersion: '42.8.0',
      hermesRoot: 'C:/Hermes',
      nodeVersion: '26.5.1',
      platform: 'win32'
    })
    $updateStatus.set({
      channel: 'stable',
      error: 'fetch-failed',
      mechanism: 'app-updater',
      supported: true
    })
    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        getVersion: vi.fn(async () => $desktopVersion.get()),
        openExternal: (...args: unknown[]) => mocks.openExternal(...args)
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    $updateStatus.set(null)
  })

  it('shows factual attribution, MIT license, and the community update channel without unknown git data', () => {
    render(<AboutSettings />)

    expect(screen.getByText('Phiên bản v32.1')).toBeTruthy()
    expect(screen.getByText('Phiên bản kỹ thuật')).toBeTruthy()
    expect(screen.getByText('0.20.4-vi.35')).toBeTruthy()
    expect(screen.getByText('Phiên bản Hermes Agent gốc')).toBeTruthy()
    expect(screen.getByText('0.21.0')).toBeTruthy() // upstream ghim trong engine.lock (v2026.8.31)
    expect(screen.getByText('Hermes Agent · Nous Research')).toBeTruthy()
    expect(screen.getByText('Lê Đình Lực (LucDinhLe)')).toBeTruthy()
    expect(screen.getByText('Giấy phép MIT')).toBeTruthy()
    expect(screen.getByText('Kênh Hermes Vietnamese · GitHub Releases')).toBeTruthy()
    expect(screen.queryByText(/unknown/i)).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: /Giấy phép MIT/ }))
    expect(mocks.openExternal).toHaveBeenCalledWith(
      'https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/LICENSE'
    )
  })
})
