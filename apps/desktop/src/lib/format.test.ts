import { describe, expect, it } from 'vitest'

import { compactNumber } from './format'

describe('compactNumber', () => {
  it('keeps the shared one-decimal default', () => {
    expect(compactNumber(1_050_000)).toBe('1.1M')
  })

  it('can preserve an official two-decimal model capacity', () => {
    expect(compactNumber(1_050_000, 2)).toBe('1.05M')
    expect(compactNumber(1_000_000, 2)).toBe('1M')
  })
})
