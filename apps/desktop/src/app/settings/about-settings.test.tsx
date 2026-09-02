import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DesktopVersionInfo } from '@/global'
import productMetadata from '@/plugins/hermes-vietnamese/product-metadata.json'
import { $desktopVersion } from '@/store/updates'

import { AboutSettings } from './about-settings'

vi.mock('@/store/updates', async () => {
  const { atom } = await import('nanostores')

  return { $desktopVersion: atom(null), refreshDesktopVersion: vi.fn() }
})
vi.mock('./uninstall-section', () => ({ UninstallSection: () => null }))

afterEach(() => {
  cleanup()
  $desktopVersion.set(null)
})

describe('About runtime provenance', () => {
  it('does not show a mismatch while version information is loading', () => {
    render(<AboutSettings />)
    expect(screen.getByText('Đang kiểm tra bộ chạy…')).toBeTruthy()
    expect(screen.queryByText(/Runtime Advisor chưa được xác minh/)).toBeNull()
  })

  it('describes the installed local Stable identity without Experimental recovery or uninstall advice', () => {
    $desktopVersion.set({
      appVersion: productMetadata.technicalVersion,
      engineVersion: productMetadata.upstream.version,
      runtimeProductVersion: productMetadata.technicalVersion,
      runtimeCandidateId: 'verified-candidate',
      runtimeSourceCommit: '1234567890123456',
      hermesRoot: 'candidate-root',
      electronVersion: '',
      nodeVersion: '',
      platform: 'win32'
    } as DesktopVersionInfo)
    render(<AboutSettings />)
    expect(screen.getByText('verified-candidate')).toBeTruthy()
    expect(screen.getByText('Kênh Local Stable · cập nhật bằng bộ cài đã kiểm thử')).toBeTruthy()
    expect(screen.queryByText(/chưa khớp|chưa được xác minh|lối tắt Experimental|Gỡ GUI/)).toBeNull()
  })
})
