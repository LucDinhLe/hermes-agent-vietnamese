import { describe, expect, it } from 'vitest'

import { adaptVietnameseDesktopVersion } from './desktop-version'
import productMetadata from './product-metadata.json'

interface DesktopVersionFixture {
  appVersion: string
  electronVersion: string
  engineVersion?: string
  hermesRoot: string
  nodeVersion: string
  platform: string
}

const rawVersion = (overrides: Partial<DesktopVersionFixture> = {}): DesktopVersionFixture => ({
  appVersion: '0.20.5',
  electronVersion: '40.0.0',
  hermesRoot: 'C:/isolated/hermes',
  nodeVersion: '24.0.0',
  platform: 'win32',
  ...overrides
})

describe('adaptVietnameseDesktopVersion', () => {
  it('shows the edition version while preserving the exact engine version', () => {
    expect(adaptVietnameseDesktopVersion(rawVersion())).toEqual({
      appVersion: productMetadata.technicalVersion,
      electronVersion: '40.0.0',
      engineVersion: '0.20.5',
      hermesRoot: 'C:/isolated/hermes',
      nodeVersion: '24.0.0',
      platform: 'win32'
    })
  })

  it('does not overwrite an explicitly separated engine version', () => {
    const adapted = adaptVietnameseDesktopVersion(rawVersion({ appVersion: '0.32.1-vi.18', engineVersion: '0.20.5' }))

    expect(adapted.appVersion).toBe('0.32.1-vi.18')
    expect(adapted.engineVersion).toBe('0.20.5')
  })

  it('keeps the actual application version when the modern bridge reports an unknown engine', () => {
    const adapted = adaptVietnameseDesktopVersion(rawVersion({ appVersion: 'installed-version', engineVersion: '' }))
    expect(adapted.appVersion).toBe('installed-version')
    expect(adapted.engineVersion).toBe('')
  })
})
