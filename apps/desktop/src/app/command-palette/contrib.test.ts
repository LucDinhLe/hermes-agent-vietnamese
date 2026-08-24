import { describe, expect, it } from 'vitest'

import { resolvePaletteContributionLabel } from './contrib'

describe('palette contribution localized labels', () => {
  it('keeps static labels backward compatible', () => {
    expect(resolvePaletteContributionLabel('Open dashboard')).toBe('Open dashboard')
  })

  it('resolves a registered getter again after its locale source changes', () => {
    let locale: 'en' | 'vi' = 'en'
    const label = () => (locale === 'vi' ? 'Agents: Quản lý' : 'Agents: Manage')

    expect(resolvePaletteContributionLabel(label)).toBe('Agents: Manage')

    locale = 'vi'

    expect(resolvePaletteContributionLabel(label)).toBe('Agents: Quản lý')
  })
})
