import { useStore } from '@nanostores/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { $gateway } from '@/store/gateway'

import { useBillingApi } from './api'
import { resolveRefusal } from './errors'

export type StepUpPhase = 'idle' | 'verifying' | 'waiting'

export interface StepUpVerification {
  code: string | null
  url: string
}

export interface StepUpMessage {
  kind: 'error' | 'success'
  text: string
  title: string
}

interface StepUpVerificationPayload {
  user_code?: unknown
  verification_url?: unknown
}

export function useStepUpFlow() {
  const { locale } = useI18n()
  const isVi = locale === 'vi'
  const api = useBillingApi()
  const gateway = useStore($gateway)
  const queryClient = useQueryClient()
  const offRef = useRef<(() => void) | null>(null)
  const runningRef = useRef(false)
  const runIdRef = useRef(0)
  const [message, setMessage] = useState<StepUpMessage | null>(null)
  const [phase, setPhase] = useState<StepUpPhase>('idle')
  const [verification, setVerification] = useState<StepUpVerification | null>(null)

  const unsubscribe = useCallback(() => {
    offRef.current?.()
    offRef.current = null
  }, [])

  const dismiss = useCallback(() => {
    runIdRef.current += 1
    runningRef.current = false
    unsubscribe()
    setMessage(null)
    setPhase('idle')
    setVerification(null)
  }, [unsubscribe])

  useEffect(
    () => () => {
      runIdRef.current += 1
      runningRef.current = false
      unsubscribe()
    },
    [unsubscribe]
  )

  const openVerification = useCallback(() => {
    if (!verification?.url) {
      return
    }

    void window.hermesDesktop?.openExternal?.(verification.url)
  }, [verification?.url])

  const start = useCallback(async () => {
    if (runningRef.current) {
      return
    }

    runningRef.current = true
    const runId = runIdRef.current + 1

    runIdRef.current = runId
    unsubscribe()
    setMessage(null)
    setVerification(null)
    setPhase('waiting')

    offRef.current =
      gateway?.on<StepUpVerificationPayload>('billing.step_up.verification', event => {
        const payload = event.payload
        const url = typeof payload?.verification_url === 'string' ? payload.verification_url : null

        if (!url) {
          return
        }

        setVerification({
          code: typeof payload?.user_code === 'string' ? payload.user_code : null,
          url
        })
        setPhase('verifying')
      }) ?? null

    const result = await api.stepUp()

    if (runIdRef.current !== runId) {
      return
    }

    runningRef.current = false
    unsubscribe()

    if (!result.ok) {
      const resolved = resolveRefusal(result.refusal, locale)

      setMessage({
        kind: 'error',
        text: resolved.message,
        title: resolved.title
      })

      return
    }

    if (!result.data.granted) {
      setMessage({
        kind: 'error',
        text: isVi
          ? 'Đã xác minh xong nhưng Remote Spending vẫn chưa được cấp cho máy này.'
          : 'Verification finished without allowing Remote Spending for this terminal.',
        title: isVi ? 'Chưa phê duyệt xác minh' : 'Verification was not approved'
      })

      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['billing', 'state'] }),
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] })
    ])
    setMessage({
      kind: 'success',
      text: isVi ? 'Remote Spending đã được cấp cho máy này.' : 'Remote Spending is allowed for this terminal.',
      title: isVi ? 'Xác minh hoàn tất' : 'Verification complete'
    })
  }, [api, gateway, isVi, locale, queryClient, unsubscribe])

  return { dismiss, message, openVerification, phase, start, verification }
}
