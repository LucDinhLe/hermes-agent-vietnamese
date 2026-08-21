import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getMemoryProviderOAuthStatus, startMemoryProviderOAuth } from '@/hermes'
import { Check, ExternalLink, Loader2 } from '@/lib/icons'
import type { BackendOwner } from '@/store/backend-owner'
import { notifyError } from '@/store/notifications'
import type { MemoryProviderOAuthStatus } from '@/types/hermes'

import { useBackendOwnerGuard } from '../../hooks/use-backend-owner-guard'

const POLL_MS = 1500
const POLL_TIMEOUT_MS = 120_000

// Small connect affordance rendered under the provider dropdown. Capability is
// backend-driven: the status route 404s for providers without an oauth_flow
// module, so non-OAuth providers render nothing.
export function MemoryConnect({
  backendOwner = null,
  profile = null,
  provider
}: {
  backendOwner?: BackendOwner | null
  profile?: null | string
  provider: string
}) {
  const [capable, setCapable] = useState<'no' | 'unknown' | 'yes'>('unknown')
  const [connected, setConnected] = useState(false)
  const [auth, setAuth] = useState<MemoryProviderOAuthStatus['auth']>(null)
  const [phase, setPhase] = useState<'error' | 'idle' | 'pending'>('idle')
  const [detail, setDetail] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadline = useRef(0)
  const flowGeneration = useRef(0)
  const isCurrentOwner = useBackendOwnerGuard(backendOwner)
  const apiProfile = backendOwner?.profile ?? profile ?? undefined
  const connectionId = backendOwner?.connectionId

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  // eslint-disable-next-line no-restricted-syntax -- generation invalidates async OAuth work; it does not mirror UI/store state
  useEffect(() => {
    let active = true
    flowGeneration.current += 1
    setCapable('unknown')
    getMemoryProviderOAuthStatus(provider, apiProfile, connectionId)
      .then(s => {
        if (!active || !isCurrentOwner()) {
          return
        }

        setCapable('yes')
        setConnected(s.connected)
        setAuth(s.auth)
      })
      .catch(() => {
        if (active && isCurrentOwner()) {
          setCapable('no')
        }
      })

    return () => {
      active = false
      flowGeneration.current += 1
      stop()
    }
  }, [apiProfile, connectionId, isCurrentOwner, provider, stop])

  // An error message isn't sticky — it clears back to the steady state
  // (Connect link, plus the connected badge if a credential is stored).
  useEffect(() => {
    if (phase !== 'error') {
      return
    }

    const t = setTimeout(() => {
      setPhase('idle')
      setDetail('')
    }, 6000)

    return () => clearTimeout(t)
  }, [phase])

  const connect = useCallback(async () => {
    const generation = flowGeneration.current + 1
    flowGeneration.current = generation
    setPhase('pending')

    try {
      await startMemoryProviderOAuth(provider, apiProfile, connectionId)
    } catch (err) {
      if (!isCurrentOwner() || flowGeneration.current !== generation) {
        return
      }

      setPhase('error')
      setDetail('Could not start the connection.')
      notifyError(err, 'Failed to start connection')

      return
    }

    if (!isCurrentOwner() || flowGeneration.current !== generation) {
      return
    }

    deadline.current = Date.now() + POLL_TIMEOUT_MS
    stop()
    timer.current = setInterval(() => {
      void (async () => {
        try {
          const next = await getMemoryProviderOAuthStatus(provider, apiProfile, connectionId)

          if (!isCurrentOwner() || flowGeneration.current !== generation) {
            return
          }

          if (next.state === 'pending') {
            if (Date.now() > deadline.current) {
              stop()
              setPhase('error')
              setDetail('Timed out — try again.')
            }

            return
          }

          stop()
          setConnected(next.connected)
          setAuth(next.auth)

          if (next.state === 'error') {
            setPhase('error')
            setDetail(next.detail || 'Connection failed.')
          } else {
            setPhase('idle')
          }
        } catch {
          // Transient poll failure — keep trying until the deadline.
        }
      })()
    }, POLL_MS)
  }, [apiProfile, connectionId, isCurrentOwner, provider, stop])

  const cancel = useCallback(() => {
    flowGeneration.current += 1
    stop()
    setPhase('idle')
  }, [stop])

  if (capable !== 'yes') {
    return null
  }

  const connectLabel = connected ? (auth === 'apikey' ? 'Connect via OAuth' : 'Reconnect') : 'Connect'

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {phase === 'idle' && connected && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Check className="size-3" />
          {auth === 'apikey' ? 'api key set' : 'oauth set'}
        </span>
      )}
      {phase === 'pending' ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Waiting for browser consent…
          </span>
          <Button className="h-auto p-0 text-xs" onClick={cancel} size="sm" type="button" variant="link">
            Cancel
          </Button>
        </>
      ) : (
        <Button
          className="h-auto gap-1 p-0 text-xs"
          onClick={() => void connect()}
          size="sm"
          type="button"
          variant="link"
        >
          <ExternalLink className="size-3" />
          {connectLabel}
        </Button>
      )}
      {phase === 'error' && detail && <span className="text-destructive">{detail}</span>}
    </span>
  )
}
