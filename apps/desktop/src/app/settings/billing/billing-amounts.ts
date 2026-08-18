import type { Locale } from '@/i18n'

import type { BillingStateResponse } from './types'
import { EMPTY_BILLING_VALUE } from './use-billing-state'

export function clampAmount(raw: string, billing: Pick<BillingStateResponse, 'max_usd' | 'min_usd'>): string {
  const amount = parseAmount(raw)

  if (amount == null) {
    return ''
  }

  const min = parseAmount(billing.min_usd)
  const max = parseAmount(billing.max_usd)
  const clampedMin = min == null ? amount : Math.max(min, amount)
  const clamped = max == null ? clampedMin : Math.min(max, clampedMin)

  return formatAmountForRequest(clamped)
}

export function parseAmount(value?: null | number | string): null | number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value.replace(/[$,\s]/g, ''))

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatAmountForRequest(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function initialAutoReloadAmount(...candidates: Array<null | string | undefined>): string {
  for (const candidate of candidates) {
    const amount = parseAmount(candidate)

    if (amount != null) {
      return formatAmountForRequest(amount)
    }
  }

  return ''
}

export function validateAutoReloadInputs(
  thresholdRaw: string,
  reloadToRaw: string,
  bounds: Pick<BillingStateResponse, 'max_usd' | 'min_usd'>,
  locale: Locale = 'en'
): { error?: string; values?: { reloadTo: string; threshold: string } } {
  const isVi = locale === 'vi'
  const threshold = validateBillingAmount(isVi ? 'Ngưỡng' : 'Threshold', thresholdRaw, bounds, locale)

  if (threshold.error || threshold.amount == null) {
    return { error: threshold.error }
  }

  const reloadTo = validateBillingAmount(isVi ? 'Mức nạp' : 'Reload-to', reloadToRaw, bounds, locale)

  if (reloadTo.error || reloadTo.amount == null) {
    return { error: reloadTo.error }
  }

  if (reloadTo.amount <= threshold.amount) {
    return { error: isVi ? 'Mức nạp phải lớn hơn ngưỡng.' : 'Reload-to amount must be greater than the threshold.' }
  }

  return {
    values: {
      reloadTo: formatAmountForRequest(reloadTo.amount),
      threshold: formatAmountForRequest(threshold.amount)
    }
  }
}

export function validateBillingAmount(
  label: string,
  raw: string,
  bounds: Pick<BillingStateResponse, 'max_usd' | 'min_usd'>,
  locale: Locale = 'en'
): { amount?: number; error?: string } {
  const isVi = locale === 'vi'
  const cleaned = raw.trim().replace(/^\$/, '').trim()

  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return {
      error: isVi
        ? `${label}: nhập số tiền USD với tối đa 2 chữ số thập phân.`
        : `${label}: enter a dollar amount with at most 2 decimal places.`
    }
  }

  const amount = Number(cleaned)

  if (!(amount > 0)) {
    return { error: isVi ? `${label}: số tiền phải lớn hơn $0.` : `${label}: amount must be greater than $0.` }
  }

  const min = parseAmount(bounds.min_usd)

  if (min != null && amount < min) {
    return {
      error: isVi ? `${label}: tối thiểu ${formatMoney(min)}.` : `${label}: minimum is ${formatMoney(min)}.`
    }
  }

  const max = parseAmount(bounds.max_usd)

  if (max != null && amount > max) {
    return {
      error: isVi ? `${label}: tối đa ${formatMoney(max)}.` : `${label}: maximum is ${formatMoney(max)}.`
    }
  }

  return { amount }
}

export function formatMoney(value?: null | number | string): string {
  const amount = parseAmount(value)

  if (amount == null) {
    return EMPTY_BILLING_VALUE
  }

  return new Intl.NumberFormat(undefined, {
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    style: 'currency'
  }).format(amount)
}
