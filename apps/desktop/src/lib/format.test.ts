import { describe, expect, it } from 'vitest'

import { compactNumber, formatUsdCost } from './format'

describe('compactNumber', () => {
  it('keeps the shared one-decimal default', () => {
    expect(compactNumber(1_050_000)).toBe('1.1M')
  })

  it('can preserve an official two-decimal model capacity', () => {
    expect(compactNumber(1_050_000, 2)).toBe('1.05M')
    expect(compactNumber(1_000_000, 2)).toBe('1M')
  })
})

describe('formatUsdCost', () => {
  it('keeps sub-cent estimates visible', () => {
    expect(formatUsdCost(0.0046, true)).toBe('~$0.0046')
    expect(formatUsdCost(0.00001, true)).toBe('~$<0.0001')
  })

  it('formats normal USD totals and zero honestly', () => {
    expect(formatUsdCost(1.236, true)).toBe('~$1.24')
    expect(formatUsdCost(1.236, false)).toBe('$1.24')
    expect(formatUsdCost(0, true)).toBe('$0.00')
  })
})
