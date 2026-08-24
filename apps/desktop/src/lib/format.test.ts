import { describe, expect, it } from 'vitest'

import { compactNumber, formatPercentOf, formatUsdCost } from './format'

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

describe('formatPercentOf', () => {
  it('formats occupancy from the raw numerator and denominator to one decimal', () => {
    expect(formatPercentOf(17_300, 1_050_000, 'en')).toBe('1.6')
    expect(formatPercentOf(17_300, 272_000, 'en')).toBe('6.4')
  })

  it('clamps invalid and over-capacity values', () => {
    expect(formatPercentOf(1, 0, 'en')).toBe('0.0')
    expect(formatPercentOf(2, 1, 'en')).toBe('100.0')
  })
})
