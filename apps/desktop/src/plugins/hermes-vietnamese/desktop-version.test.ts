import { describe, expect, it } from 'vitest'

import { adaptVietnameseDesktopVersion } from './desktop-version'

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
      appVersion: '0.33.0-dev.11-advisor-exp.9',
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
})
