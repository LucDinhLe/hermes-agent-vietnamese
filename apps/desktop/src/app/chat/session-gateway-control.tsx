import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useBackendOwnerGuard } from '@/app/hooks/use-backend-owner-guard'
import { StatusDot } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  dropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { LogView } from '@/components/ui/log-view'
import { getLogs, getStatus, restartGateway, runDoctor, startGateway, stopGateway } from '@/hermes'
import { useI18n } from '@/i18n'
import {
  Activity,
  ChevronDown,
  FileText,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Square,
  StopFilled,
  Wrench
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { BackendOwner } from '@/store/backend-owner'
import { notifyError } from '@/store/notifications'
import { awaitHermesAction, HermesActionTimeoutError } from '@/store/system-actions'
import type { ActionResponse, ActionStatusResponse, StatusResponse } from '@/types/hermes'

interface SessionGatewayControlProps {
  backendReady: boolean
  connectionId: null | string
  profile: string
}

type PendingAction = 'doctor' | 'restart' | 'start' | 'stop' | null

const LOG_TAIL = 160

const ownerKeyFor = (owner: BackendOwner) => `${owner.connectionId}::${owner.profile}`

function gatewayHealthy(status: StatusResponse): boolean {
  return status.gateway_running && ['draining', 'running'].includes(status.gateway_state || 'running')
}

/**
 * Exact-owner gateway lifecycle menu for a chat surface. Every request keeps
 * the immutable connection/profile pair captured by the surface; a late
 * completion after an owner switch is ignored instead of repainting the next
 * tile or following the ambient gateway.
 */
export function SessionGatewayControl({ backendReady, connectionId, profile }: SessionGatewayControlProps) {
  const { t } = useI18n()
  const copy = t.shell.gatewayMenu
  const normalizedConnectionId = connectionId?.trim() || ''
  const normalizedProfile = profile.trim() || 'default'

  const owner = useMemo<BackendOwner | null>(
    () => (normalizedConnectionId ? { connectionId: normalizedConnectionId, profile: normalizedProfile } : null),
    [normalizedConnectionId, normalizedProfile]
  )

  const ownerKey = owner ? ownerKeyFor(owner) : '__unresolved__'
  const isCurrentOwner = useBackendOwnerGuard(owner)
  const ownerGenerationRef = useRef(0)
  const statusRequestIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [logsVisible, setLogsVisible] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [logsError, setLogsError] = useState('')
  const [doctorLines, setDoctorLines] = useState<string[]>([])
  const [healthMessage, setHealthMessage] = useState('')
  const [stopTarget, setStopTarget] = useState<BackendOwner | null>(null)

  useLayoutEffect(() => {
    ownerGenerationRef.current += 1
  }, [ownerKey])

  const isCurrentRequest = useCallback(
    (target: BackendOwner, generation: number) =>
      ownerGenerationRef.current === generation && ownerKeyFor(target) === ownerKey && isCurrentOwner(),
    [isCurrentOwner, ownerKey]
  )

  const loadStatus = useCallback(
    async (target: BackendOwner, generation = ownerGenerationRef.current): Promise<StatusResponse | null> => {
      const requestId = ++statusRequestIdRef.current
      setStatusLoading(true)
      setStatusError('')

      try {
        const next = await getStatus(target.profile, target.connectionId)

        if (requestId === statusRequestIdRef.current && isCurrentRequest(target, generation)) {
          setStatus(next)

          return next
        }

        return null
      } catch (error) {
        if (requestId === statusRequestIdRef.current && isCurrentRequest(target, generation)) {
          setStatusError(copy.statusLoadFailed)
        }

        return null
      } finally {
        if (requestId === statusRequestIdRef.current && isCurrentRequest(target, generation)) {
          setStatusLoading(false)
        }
      }
    },
    [copy.statusLoadFailed, isCurrentRequest]
  )

  useEffect(() => {
    setOpen(false)
    setStatus(null)
    setStatusLoading(false)
    setStatusError('')
    setPendingAction(null)
    setLogsVisible(false)
    setLogsLoading(false)
    setLogs([])
    setLogsError('')
    setDoctorLines([])
    setHealthMessage('')
    setStopTarget(null)
  }, [ownerKey])

  useEffect(() => {
    if (!open || !backendReady || !owner) {
      return
    }

    void loadStatus(owner)
  }, [backendReady, loadStatus, open, owner])

  async function performAction(
    action: Exclude<PendingAction, null>,
    label: string,
    target: BackendOwner,
    start: (profile: string, connectionId: string) => Promise<ActionResponse>,
    generation = ownerGenerationRef.current
  ): Promise<ActionStatusResponse | null> {
    setPendingAction(action)

    try {
      const result = await awaitHermesAction(await start(target.profile, target.connectionId), target)

      if (isCurrentRequest(target, generation)) {
        await loadStatus(target, generation)
      }

      return result
    } catch (error) {
      if (error instanceof HermesActionTimeoutError) {
        throw error
      }

      throw new Error(copy.actionFailed(label), { cause: error })
    } finally {
      if (isCurrentRequest(target, generation)) {
        setPendingAction(null)
      }
    }
  }

  function runMenuAction(
    action: Exclude<PendingAction, null>,
    label: string,
    start: (profile: string, connectionId: string) => Promise<ActionResponse>
  ) {
    if (!owner || pendingAction || !lifecycleTargetable) {
      return
    }

    const target = owner
    const generation = ownerGenerationRef.current
    void performAction(action, label, target, start, generation).catch(error => {
      if (isCurrentRequest(target, generation)) {
        notifyError(error, copy.actionFailed(label))
      }
    })
  }

  async function loadLogs(target: BackendOwner) {
    const generation = ownerGenerationRef.current
    setLogsVisible(true)
    setLogsLoading(true)
    setLogsError('')

    try {
      const result = await getLogs({ file: 'gateway', lines: LOG_TAIL }, target.profile, target.connectionId)

      if (isCurrentRequest(target, generation)) {
        setLogs(result.lines)
      }
    } catch {
      if (isCurrentRequest(target, generation)) {
        setLogsError(copy.logsLoadFailed)
      }
    } finally {
      if (isCurrentRequest(target, generation)) {
        setLogsLoading(false)
      }
    }
  }

  const running = status?.gateway_running === true
  const explicitlyStopped = status?.gateway_running === false
  const lifecycleOwner = status?.gateway_lifecycle_owner_profile
  const lifecycleOwnerKnown = lifecycleOwner !== undefined

  const lifecycleTargetable = status
    ? lifecycleOwnerKnown
      ? lifecycleOwner === normalizedProfile
      : normalizedProfile === 'default'
    : false

  const lifecycleShared = status?.gateway_lifecycle_shared === true

  const lifecycleExplanation = lifecycleOwner ? copy.lifecycleManagedBy(lifecycleOwner) : copy.lifecycleOwnerUnknown

  const triggerTone = !backendReady ? 'bad' : running ? 'good' : status ? 'bad' : 'muted'

  const statusLabel =
    statusLoading && !status
      ? copy.statusUnknown
      : running
        ? copy.statusRunning
        : explicitlyStopped
          ? copy.statusStopped
          : copy.statusUnknown

  return (
    <div className="shrink-0" data-session-gateway-control="">
      <DropdownMenu
        onOpenChange={next => {
          setOpen(next)

          if (!next) {
            setHealthMessage('')
          }
        }}
        open={open}
      >
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={copy.gateway}
            className="gap-1 text-[0.6875rem] text-(--ui-text-secondary)"
            data-session-gateway-trigger=""
            disabled={!backendReady || !owner}
            size="xs"
            type="button"
            variant="ghost"
          >
            <Network className="size-3.5 shrink-0" />
            <StatusDot className="shrink-0" tone={triggerTone} />
            <span className="hidden shrink-0 font-medium @sm:inline">{copy.gateway}</span>
            <ChevronDown className="size-2.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72 p-0" side="bottom" sideOffset={6}>
          <div className="px-3 py-2" data-session-gateway-status="">
            <div className="flex items-center gap-2 text-sm font-medium">
              {statusLoading && !status ? (
                <Loader2 className="size-3.5 animate-spin text-(--ui-text-tertiary)" />
              ) : (
                <StatusDot tone={running ? 'good' : status ? 'bad' : 'muted'} />
              )}
              <span>{statusLabel}</span>
              {status?.gateway_pid != null ? (
                <span className="font-normal text-(--ui-text-tertiary)">· {copy.pidLabel(status.gateway_pid)}</span>
              ) : null}
            </div>
            <div className="mt-1 truncate text-[0.6875rem] text-(--ui-text-tertiary)">
              {owner ? `${owner.connectionId} · ${owner.profile}` : copy.statusUnknown}
            </div>
            {statusError ? <div className="mt-1 text-xs text-destructive">{statusError}</div> : null}
            {healthMessage ? <div className="mt-1 text-xs text-(--ui-text-secondary)">{healthMessage}</div> : null}
            {status && lifecycleShared && lifecycleTargetable ? (
              <div className="mt-1 text-xs text-(--ui-text-secondary)" data-session-gateway-shared-warning="">
                {copy.sharedLifecycleWarning}
              </div>
            ) : null}
          </div>

          <DropdownMenuSeparator className="mx-0 my-0" />

          {status && !lifecycleTargetable ? (
            <div
              className="px-3 py-2 text-xs leading-relaxed text-(--ui-text-secondary)"
              data-session-gateway-lifecycle-unavailable=""
              role="note"
            >
              {lifecycleExplanation}
            </div>
          ) : (
            <>
              {explicitlyStopped ? (
                <DropdownMenuItem
                  className={dropdownMenuRow}
                  disabled={Boolean(pendingAction)}
                  onSelect={event => {
                    event.preventDefault()
                    runMenuAction('start', copy.startGateway, startGateway)
                  }}
                >
                  {pendingAction === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
                  {copy.startGateway}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={dropdownMenuRow}
                  disabled={!running || Boolean(pendingAction)}
                  onSelect={event => {
                    event.preventDefault()
                    runMenuAction('restart', copy.restartGateway, restartGateway)
                  }}
                >
                  {pendingAction === 'restart' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {copy.restartGateway}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className={dropdownMenuRow}
                disabled={!running || Boolean(pendingAction)}
                onSelect={() => {
                  if (owner) {
                    setOpen(false)
                    setStopTarget(owner)
                  }
                }}
              >
                <Square />
                {copy.stopGateway}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem
            className={cn(dropdownMenuRow, 'text-destructive')}
            disabled
            title={copy.forceStopUnavailable}
            variant="destructive"
          >
            <StopFilled />
            <span className="flex min-w-0 flex-col">
              <span>{copy.forceStopGateway}</span>
              <span className="text-[0.625rem] leading-tight font-normal whitespace-normal opacity-80">
                {copy.forceStopUnavailable}
              </span>
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-0 my-0" />

          <DropdownMenuItem
            className={dropdownMenuRow}
            disabled={!owner || logsLoading}
            onSelect={event => {
              event.preventDefault()

              if (owner) {
                if (logsVisible) {
                  setLogsVisible(false)
                } else {
                  void loadLogs(owner)
                }
              }
            }}
          >
            {logsLoading ? <Loader2 className="animate-spin" /> : <FileText />}
            {copy.viewLogs}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={dropdownMenuRow}
            disabled={!owner || Boolean(pendingAction)}
            onSelect={event => {
              event.preventDefault()

              if (!owner) {
                return
              }

              const target = owner
              const generation = ownerGenerationRef.current
              void performAction('doctor', copy.runDoctor, target, runDoctor, generation)
                .then(result => {
                  if (isCurrentRequest(target, generation)) {
                    const lines = result?.lines ?? []
                    setDoctorLines(lines)

                    if (!lines.length) {
                      setHealthMessage(copy.doctorStarted)
                    }
                  }
                })
                .catch(error => {
                  if (isCurrentRequest(target, generation)) {
                    notifyError(error, copy.actionFailed(copy.runDoctor))
                  }
                })
            }}
          >
            {pendingAction === 'doctor' ? <Loader2 className="animate-spin" /> : <Wrench />}
            {copy.runDoctor}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={dropdownMenuRow}
            disabled={!owner || statusLoading}
            onSelect={event => {
              event.preventDefault()

              if (!owner) {
                return
              }

              const target = owner
              const generation = ownerGenerationRef.current
              void loadStatus(target, generation).then(next => {
                if (next && isCurrentRequest(target, generation)) {
                  setHealthMessage(gatewayHealthy(next) ? copy.healthHealthy : copy.healthUnhealthy)
                }
              })
            }}
          >
            {statusLoading ? <Loader2 className="animate-spin" /> : <Activity />}
            {copy.checkHealth}
          </DropdownMenuItem>

          {logsVisible ? (
            <div className="border-t border-(--ui-stroke-tertiary) px-2.5 py-2">
              {logsError ? <div className="text-xs text-destructive">{logsError}</div> : null}
              {!logsLoading && !logsError ? (
                <LogView className="max-h-44 border-0 px-0">{logs.length ? logs.join('\n') : copy.logsEmpty}</LogView>
              ) : null}
            </div>
          ) : null}

          {doctorLines.length ? (
            <div className="border-t border-(--ui-stroke-tertiary) px-2.5 py-2">
              <LogView className="max-h-44 border-0 px-0">{doctorLines.join('\n')}</LogView>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        confirmLabel={copy.stopGateway}
        description={
          lifecycleShared ? copy.stopSharedConfirmBody : copy.stopConfirmBody(stopTarget?.profile ?? normalizedProfile)
        }
        destructive
        onClose={() => setStopTarget(null)}
        onConfirm={async () => {
          if (!stopTarget || !owner || !lifecycleTargetable || ownerKeyFor(stopTarget) !== ownerKeyFor(owner)) {
            throw new Error(copy.actionFailed(copy.stopGateway))
          }

          await performAction('stop', copy.stopGateway, stopTarget, stopGateway, ownerGenerationRef.current)
        }}
        open={Boolean(stopTarget)}
        title={copy.stopConfirmTitle}
      />
    </div>
  )
}
