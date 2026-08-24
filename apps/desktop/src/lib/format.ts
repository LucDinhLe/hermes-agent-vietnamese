// THE compact-number formatter — every user-facing count/token figure goes
// through here. 999 → "999", 1000 → "1k", 1230 → "1.2k", 10000 → "10k",
// 1_500_000 → "1.5M". Do not hand-roll `/ 1000` display math elsewhere.
export function compactNumber(value: null | number | undefined, maximumFractionDigits = 1): string {
  const num = Number(value ?? 0)

  if (!Number.isFinite(num) || num <= 0) {
    return '0'
  }

  const digits = Math.max(0, Math.min(3, Math.floor(maximumFractionDigits)))
  const scaled = (v: number, suffix: string) => `${v.toFixed(digits).replace(/\.?0+$/, '')}${suffix}`

  // Thresholds sit just under the unit boundary so rounding can't produce
  // "1000k" or "1000" — those promote to the next unit instead.
  if (num >= 999_950) {
    return scaled(num / 1_000_000, 'M')
  }

  if (num >= 999.5) {
    return scaled(num / 1_000, 'k')
  }

  return `${Math.round(num)}`
}

/** Raw occupancy percentage, clamped to a progress-meter range. */
export function percentOf(value: null | number | undefined, maximum: null | number | undefined): number {
  const numerator = Number(value ?? 0)
  const denominator = Number(maximum ?? 0)

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (numerator / denominator) * 100))
}

/** Locale-aware one-decimal percentage without the percent sign. */
export function formatPercentOf(
  value: null | number | undefined,
  maximum: null | number | undefined,
  locale = 'en'
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(percentOf(value, maximum))
}

/** Honest USD formatter for model-usage estimates.
 *
 * Keeps sub-cent values visible instead of rounding them to a fake $0.00.
 * `approximate` is reserved for published-list-price estimates; provider-
 * reported actual charges should render without the tilde.
 */
export function formatUsdCost(value: null | number | undefined, approximate = false): string {
  const amount = Number(value ?? 0)

  if (!Number.isFinite(amount) || amount <= 0) {
    return '$0.00'
  }

  const prefix = approximate ? '~' : ''

  if (amount < 0.00005) {
    return `${prefix}$<0.0001`
  }

  if (amount < 0.01) {
    return `${prefix}$${amount.toFixed(4)}`
  }

  return `${prefix}$${amount.toFixed(2)}`
}
