import { refusalPolicy } from '@hermes/shared/billing-policy'
import {
  driveChargeSettlement,
  SETTLEMENT_POLL_CAP_MS,
  SETTLEMENT_POLL_INTERVAL_MS
} from '@hermes/shared/charge-settlement'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { type Locale, useI18n } from '@/i18n'

import type { BillingApi, BillingRefusal } from './api'
import { useBillingApi } from './api'
import { resolveRefusal } from './errors'
import type { BillingChargeStatusResponse } from './types'

export const CHARGE_POLL_INTERVAL_MS = SETTLEMENT_POLL_INTERVAL_MS
export const CHARGE_POLL_CAP_MS = SETTLEMENT_POLL_CAP_MS

export type ChargeFlowPhase = 'charging' | 'done' | 'idle' | 'polling'

export type ChargeFlowOutcome =
  | {
      amountUsd?: string | null
      kind: 'success'
      message: string
    }
  | {
      action?: { type: 'portal'; url?: string } | { type: 'retry' } | { type: 'step_up' }
      kind: 'failure'
      message: string
      retryFreshKey: boolean
      title: string
    }
  | {
      kind: 'ambiguous'
      message: string
      portalUrl?: string
      title: string
    }

export interface ChargePollClock {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface ChargePollOptions extends ChargePollClock {
  locale?: Locale
  portalUrl?: null | string
}

interface PendingChargeIntent {
  amountUsd: string
  idempotencyKey: string
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const retryableSendKinds = new Set([
  'endpoint_unavailable',
  'rate_limited',
  'temporarily_unavailable',
  'timeout',
  'transport'
])

export async function pollChargeSettlement(
  api: Pick<BillingApi, 'chargeStatus'>,
  chargeId: string,
  opts: ChargePollOptions = {}
): Promise<ChargeFlowOutcome> {
  const sleep = opts.sleep ?? defaultSleep
  const now = opts.now ?? Date.now
  const isVi = opts.locale === 'vi'
  const observed: { refusal?: BillingRefusal; status?: BillingChargeStatusResponse } = {}

  const settlement = await driveChargeSettlement({
    fetchStatus: async () => {
      const result = await api.chargeStatus(chargeId)

      if (result.ok) {
        observed.refusal = undefined
        observed.status = result.data

        return result.data
      }

      observed.refusal = result.refusal
      observed.status = statusFromRefusal(result.refusal)

      return observed.status
    },
    isCancelled: () => false,
    now,
    sleep
  })

  switch (settlement.kind) {
    case 'settled':
      return {
        amountUsd: settlement.status.amount_usd,
        kind: 'success',
        message: settlement.status.amount_usd
          ? isVi
            ? `Đã nạp $${settlement.status.amount_usd}.`
            : `$${settlement.status.amount_usd} added.`
          : isVi
            ? 'Đã nạp tín dụng.'
            : 'Credits added.'
      }

    case 'failed':
      return {
        action: { type: 'retry' },
        kind: 'failure',
        message: renderChargeFailed(settlement.status.reason, isVi),
        retryFreshKey: true,
        title: isVi ? 'Giao dịch thất bại' : 'Charge failed'
      }
    case 'ambiguous': {
      if (settlement.status && refusalPolicy(settlement.error).ambiguousMidPoll) {
        const refusal = observed.refusal ?? refusalFromStatus(settlement.error, settlement.status)
        const resolved = resolveRefusal(refusal, opts.locale)
        const portalUrl = resolved.action.type === 'portal' ? resolved.action.url : refusal.portalUrl

        return {
          kind: 'ambiguous',
          message: `${resolved.message} ${isVi ? 'Chưa xác nhận được kết quả giao dịch gần nhất — hãy kiểm tra số dư/lịch sử trước khi thử lại.' : "Your last charge's outcome is unconfirmed - check your balance/history before retrying."}`,
          portalUrl: portalUrl ?? opts.portalUrl ?? undefined,
          title: isVi ? 'Chưa xác nhận được kết quả giao dịch' : 'Charge outcome unconfirmed'
        }
      }

      return {
        kind: 'failure',
        message: observed.refusal?.message || (isVi ? 'Không thể kiểm tra giao dịch.' : 'Could not check the charge.'),
        retryFreshKey: true,
        title: isVi ? 'Không thể kiểm tra giao dịch' : 'Could not check charge'
      }
    }

    case 'refused':
      return {
        kind: 'failure',
        message:
          observed.refusal?.message ||
          settlement.status.message ||
          (isVi ? 'Không thể kiểm tra giao dịch.' : 'Could not check the charge.'),
        retryFreshKey: true,
        title: isVi ? 'Không thể kiểm tra giao dịch' : 'Could not check charge'
      }

    case 'cancelled':

    case 'timed_out':
      return timeoutOutcome(observed.status?.ok ? (observed.status.portal_url ?? opts.portalUrl) : opts.portalUrl, isVi)
  }
}

function statusFromRefusal(refusal: BillingRefusal): BillingChargeStatusResponse {
  const raw = isRecord(refusal.raw) ? refusal.raw : {}

  return {
    ...raw,
    error: refusal.kind,
    message: refusal.message,
    ok: false,
    ...(refusal.payload !== undefined ? { payload: refusal.payload } : {}),
    ...(refusal.portalUrl !== undefined ? { portal_url: refusal.portalUrl } : {}),
    ...(refusal.retryAfter !== undefined ? { retry_after: refusal.retryAfter } : {})
  } as BillingChargeStatusResponse
}

function refusalFromStatus(error: string, status: BillingChargeStatusResponse): BillingRefusal {
  return {
    kind: error,
    message: status.message || error,
    payload: status.payload,
    portalUrl: status.portal_url ?? undefined,
    retryAfter: status.retry_after ?? undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function useChargeFlow() {
  const { locale } = useI18n()
  const isVi = locale === 'vi'
  const api = useBillingApi()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<ChargeFlowPhase>('idle')
  const [outcome, setOutcome] = useState<ChargeFlowOutcome | null>(null)
  const phaseRef = useRef<ChargeFlowPhase>('idle')
  const retryIntentRef = useRef<PendingChargeIntent | null>(null)

  const setPhaseState = useCallback((next: ChargeFlowPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const reset = useCallback(() => {
    retryIntentRef.current = null
    setOutcome(null)
    setPhaseState('idle')
  }, [setPhaseState])

  const start = useCallback(
    async (amountUsd: string) => {
      if (phaseRef.current === 'charging' || phaseRef.current === 'polling') {
        return
      }

      const retryIntent = retryIntentRef.current
      const idempotencyKey = retryIntent?.amountUsd === amountUsd ? retryIntent.idempotencyKey : undefined

      setOutcome(null)
      setPhaseState('charging')

      const chargeResult = await api.charge(amountUsd, idempotencyKey)

      if (!chargeResult.ok) {
        const resolved = resolveRefusal(chargeResult.refusal, locale)

        const action =
          resolved.action.type === 'portal'
            ? ({ type: 'portal', url: resolved.action.url } as const)
            : resolved.action.type === 'retry'
              ? ({ type: 'retry' } as const)
              : resolved.action.type === 'step_up'
                ? ({ type: 'step_up' } as const)
                : undefined

        retryIntentRef.current = shouldReuseIdempotencyKey(chargeResult.refusal)
          ? { amountUsd, idempotencyKey: chargeResult.idempotencyKey }
          : null
        setOutcome({
          action,
          kind: 'failure',
          message: resolved.message,
          retryFreshKey: false,
          title: resolved.title
        })
        setPhaseState('done')

        return
      }

      retryIntentRef.current = null

      const chargeId = chargeResult.data.charge_id

      if (!chargeId) {
        setOutcome({
          kind: 'failure',
          message: isVi
            ? 'Dịch vụ thanh toán đã nhận yêu cầu nhưng không trả về mã giao dịch.'
            : 'The billing service accepted the request but did not return a charge id.',
          retryFreshKey: true,
          title: isVi ? 'Không thể theo dõi giao dịch' : 'Charge could not be tracked'
        })
        setPhaseState('done')

        return
      }

      setPhaseState('polling')

      const pollOutcome = await pollChargeSettlement(api, chargeId, {
        locale,
        portalUrl: chargeResult.data.portal_url
      })

      setOutcome(pollOutcome)
      setPhaseState('done')

      if (pollOutcome.kind === 'success') {
        void queryClient.invalidateQueries({ queryKey: ['billing', 'state'] })
      }
    },
    [api, isVi, locale, queryClient, setPhaseState]
  )

  return { outcome, phase, reset, start }
}

function shouldReuseIdempotencyKey(refusal: BillingRefusal): boolean {
  return retryableSendKinds.has(refusal.kind)
}

function timeoutOutcome(portalUrl: null | string | undefined, isVi: boolean): ChargeFlowOutcome {
  return {
    kind: 'ambiguous',
    message: isVi
      ? 'Giao dịch có thể vẫn đang xử lý. Hãy kiểm tra Nous Portal trước khi thử lại.'
      : 'Charge may still settle. Check the portal before retrying.',
    portalUrl: portalUrl ?? undefined,
    title: isVi ? 'Vẫn đang xử lý sau 5 phút' : 'Still processing after 5 minutes'
  }
}

function renderChargeFailed(reason: null | string | undefined, isVi: boolean): string {
  switch ((reason || '').trim()) {
    case 'authentication_required':
      return isVi
        ? 'Ngân hàng yêu cầu xác minh (3DS). Hãy hoàn tất trong Nous Portal để kết thúc giao dịch.'
        : 'Your bank requires verification (3DS). Complete it on the portal to finish this purchase.'

    case 'payment_method_expired':
      return isVi
        ? 'Thẻ đã hết hạn. Hãy cập nhật trong Nous Portal.'
        : 'Your card has expired. Update it on the portal.'

    case 'card_declined':
      return isVi
        ? 'Thẻ bị từ chối. Hãy thử thẻ khác trong Nous Portal.'
        : 'Your card was declined. Try another card on the portal.'

    default:
      return isVi
        ? `Giao dịch không thành công (${reason || 'processing_error'}).`
        : `The charge didn't go through (${reason || 'processing_error'}).`
  }
}
