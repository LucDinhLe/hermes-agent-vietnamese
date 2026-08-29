import { describe, expect, it } from 'vitest'

import { buildSupportReport } from './support-report'

const BASE = {
  architecture: 'x64',
  displayName: 'Hermes Vietnamese',
  engineCommit: '5fc308a70719a83cccdbba4c0e39c23f5a8239d5',
  engineVersion: '0.20.6',
  locale: 'vi',
  platform: 'win32',
  productVersion: 'V33',
  technicalVersion: '0.33.0-dev.3'
}

describe('Vietnamese edition support report', () => {
  it('contains only coarse product and runtime facts', () => {
    const report = buildSupportReport(BASE, new Date('2026-08-28T00:00:00.000Z'))

    expect(report).toContain('Hermes Vietnamese V33')
    expect(report).toContain('Hermes Agent 0.20.6 (5fc308a70719)')
    expect(report).toContain('OS: Windows · Architecture: x64')
    expect(report).toContain('UI language: vi')
  })

  it('redacts path-like and identity-like coarse values', () => {
    const report = buildSupportReport(
      {
        ...BASE,
        architecture: 'C:\\Users\\private',
        locale: 'person@example.com',
        platform: '/home/person'
      },
      new Date('2026-08-28T00:00:00.000Z')
    )

    expect(report).not.toContain('private')
    expect(report).not.toContain('person')
    expect(report).toContain('OS: unknown · Architecture: unknown')
    expect(report).toContain('UI language: unknown')
  })
})
