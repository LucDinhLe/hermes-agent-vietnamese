import {
  Button,
  Codicon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  host,
  StatusDot,
  Tip,
  usePluginI18n,
  useValue
} from '@hermes/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'

const PLUGIN_ID = 'hermes-vietnamese'

export const SESSION_CONTROLS_AREA = 'chat.sessionControls'

type SessionControlState = Pick<
  typeof host.state,
  'busy' | 'focusedSessionId' | 'focusedSessionProfile' | 'focusedUsage' | 'gateway' | 'model' | 'profile'
>

type GatewayRequest = (method: string, params?: Record<string, unknown>) => Promise<unknown>

interface AdvisorStatus {
  distinct_from_main: boolean
  enabled: boolean
  model: string
  provider: string
  value: 'off' | 'on'
}

interface ProfileSummary {
  display_name?: string
  last_session?: ProfileSessionSummary
  name?: string
  preferred_session?: ProfileSessionSummary
  title?: string
  ui_meta?: Record<string, { chat?: string; hidden?: boolean; title?: string } | undefined>
}

interface ProfileSessionSummary {
  id?: string
  resolved_id?: string
}

export interface SessionControlBarProps {
  navigate?: typeof host.navigate
  newChat?: typeof host.newChat
  openSession?: typeof host.openSession
  request?: GatewayRequest
  state?: SessionControlState
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function contextPercentOf(usage: ReturnType<(typeof host.state.focusedUsage)['get']>): number {
  const direct = finiteNumber(usage?.context_percent)

  if (direct !== null) {
    return Math.max(0, Math.min(100, Math.round(direct)))
  }

  const used = finiteNumber(usage?.context_used)
  const max = finiteNumber(usage?.context_max)

  if (used === null || max === null || max <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((used / max) * 100)))
}

function compactTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}m`
  }

  if (value >= 1_000) {
    return `${Number((value / 1_000).toFixed(1))}k`
  }

  return String(Math.round(value))
}

export function contextTokenSummary(usage: ReturnType<(typeof host.state.focusedUsage)['get']>): {
  exact: string | null
  short: string
} {
  const percent = contextPercentOf(usage)
  const used = finiteNumber(usage?.context_used)
  const max = finiteNumber(usage?.context_max)

  if (used === null || max === null || max <= 0) {
    return { exact: null, short: `${percent}%` }
  }

  const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

  return {
    exact: `${formatter.format(used)} / ${formatter.format(max)} token`,
    short: `${compactTokenCount(used)}/${compactTokenCount(max)} · ${percent}%`
  }
}

function friendlyProfileName(profile: ProfileSummary | undefined, fallback: string): string {
  const explicit =
    profile?.ui_meta?.['hermes-bots']?.title?.trim() || profile?.display_name?.trim() || profile?.title?.trim()

  if (explicit) {
    return explicit
  }

  const name = profile?.name?.trim()

  return name === 'default' ? 'Hermes' : name || fallback
}

export function SessionControlBar({
  navigate = host.navigate,
  newChat = host.newChat,
  openSession = host.openSession,
  request = host.request,
  state = host.state
}: SessionControlBarProps) {
  const t = usePluginI18n(PLUGIN_ID)
  const gateway = useValue(state.gateway)
  const busy = useValue(state.busy)
  const focusedSessionId = useValue(state.focusedSessionId)
  const focusedSessionProfile = useValue(state.focusedSessionProfile)
  const usage = useValue(state.focusedUsage)
  const model = useValue(state.model)
  const profile = useValue(state.profile)
  const [advisor, setAdvisor] = useState<AdvisorStatus | null>(null)
  const [advisorSaving, setAdvisorSaving] = useState(false)
  const [agentProfiles, setAgentProfiles] = useState<ProfileSummary[]>([{ name: 'default' }])
  const [agentOpening, setAgentOpening] = useState<string | null>(null)
  const context = contextTokenSummary(usage)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    if (gateway !== 'open') {
      setAdvisor(null)

      return () => {
        cancelled = true
      }
    }

    const loadAdvisor = async (attempt = 0) => {
      try {
        const result = await request('config.get', {
          key: 'advisor',
          ...(focusedSessionId ? { session_id: focusedSessionId } : {})
        })

        if (!cancelled) {
          setAdvisor(result as AdvisorStatus)
        }
      } catch {
        // The connection-state atom can reach "open" one paint before the
        // live gateway instance is published. Retry that bounded startup race
        // so a persisted Advisor setting is not painted as falsely disabled.
        if (!cancelled && attempt < 2) {
          retryTimer = setTimeout(() => void loadAdvisor(attempt + 1), 250 * (attempt + 1))
        } else if (!cancelled) {
          setAdvisor(null)
        }
      }
    }

    setAdvisor(null)
    void loadAdvisor()

    return () => {
      cancelled = true

      if (retryTimer !== null) {
        clearTimeout(retryTimer)
      }
    }
  }, [focusedSessionId, gateway, request])

  const loadAgentProfiles = useCallback(async () => {
    if (gateway !== 'open') {
      return
    }

    const result = await request('profiles.list', { include_sessions: true })

    let profiles = Array.isArray((result as { profiles?: unknown[] } | null)?.profiles)
      ? ((result as { profiles: ProfileSummary[] }).profiles ?? [])
      : []

    const preferredSessionIds = Object.fromEntries(
      profiles
        .map(item => [item.name?.trim(), item.ui_meta?.['hermes-bots']?.chat?.trim()] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]))
    )

    if (Object.keys(preferredSessionIds).length > 0) {
      try {
        const resolved = await request('profiles.list', {
          include_sessions: true,
          preferred_session_ids: preferredSessionIds
        })

        const resolvedProfiles = Array.isArray((resolved as { profiles?: unknown[] } | null)?.profiles)
          ? ((resolved as { profiles: ProfileSummary[] }).profiles ?? [])
          : []

        if (resolvedProfiles.length > 0) {
          profiles = resolvedProfiles
        }
      } catch {
        // Older gateways ignore preferred-session resolution. The ordinary
        // last-session row and the stored Bot Chat pointer remain usable.
      }
    }

    const visible = profiles.filter(item => item?.name?.trim() && item.ui_meta?.['hermes-bots']?.hidden !== true)
    visible.sort((left, right) => {
      if (left.name === 'default') {
        return -1
      }

      if (right.name === 'default') {
        return 1
      }

      return friendlyProfileName(left, left.name || '').localeCompare(
        friendlyProfileName(right, right.name || ''),
        'vi'
      )
    })
    setAgentProfiles(visible.length > 0 ? visible : [{ name: 'default' }])
  }, [gateway, request])

  useEffect(() => {
    void loadAgentProfiles().catch(() => undefined)
  }, [focusedSessionProfile, loadAgentProfiles])

  const gatewayStatus =
    gateway === 'open'
      ? t('sessionControls.connected')
      : gateway === 'connecting' || gateway === 'reconnecting'
        ? t('sessionControls.connecting')
        : t('sessionControls.disconnected')

  const gatewayTone =
    gateway === 'open' ? 'good' : gateway === 'connecting' || gateway === 'reconnecting' ? 'warn' : 'bad'

  const gatewayLabel = `${t('sessionControls.gateway')}: ${gatewayStatus}`
  const modelName = model.trim() || t('sessionControls.modelUnavailable')

  const contextLabel = `${t('sessionControls.context')} ${modelName}: ${context.exact ?? context.short}${
    context.exact ? ` (${contextPercentOf(usage)}%)` : ''
  }`

  const focusedProfileName = focusedSessionProfile.trim() || 'default'
  const focusedProfile = agentProfiles.find(item => item.name === focusedProfileName)

  const focusedAgentName = friendlyProfileName(
    focusedProfile,
    focusedProfileName === 'default' ? 'Hermes' : focusedProfileName
  )

  const agentsLabel = `${t('sessionControls.agents')} · ${t('sessionControls.activeAgent')}: ${focusedAgentName}`
  const advisorEnabled = advisor?.enabled === true
  const advisorModel = advisor?.model || 'gpt-5.6-sol'

  const advisorLabel = `${t('sessionControls.advisor')}: ${t(
    advisorEnabled ? 'sessionControls.advisorOn' : 'sessionControls.advisorOff'
  )} · ${t('sessionControls.advisorModel')}: ${advisorModel}`

  const toggleAdvisor = async () => {
    if (gateway !== 'open' || advisorSaving || busy) {
      return
    }

    setAdvisorSaving(true)

    try {
      const status = (await request('config.set', {
        key: 'advisor',
        value: advisorEnabled ? 'off' : 'on',
        ...(focusedSessionId ? { session_id: focusedSessionId } : {})
      })) as AdvisorStatus

      setAdvisor(status)
      host.notify({
        kind: 'success',
        message: t(status.enabled ? 'sessionControls.advisorEnabledNotice' : 'sessionControls.advisorDisabledNotice')
      })
    } catch (error) {
      host.notify({
        kind: 'error',
        message: error instanceof Error ? error.message : t('sessionControls.advisorToggleFailed')
      })
    } finally {
      setAdvisorSaving(false)
    }
  }

  const selectAgent = async (selected: ProfileSummary) => {
    const profileName = selected.name?.trim()

    if (!profileName || agentOpening) {
      return
    }

    setAgentOpening(profileName)

    try {
      const botChat = selected.ui_meta?.['hermes-bots']?.chat?.trim()
      const session = selected.preferred_session ?? selected.last_session
      const storedSessionId = session?.resolved_id?.trim() || session?.id?.trim() || botChat

      if (storedSessionId) {
        await openSession(storedSessionId, {
          awaitHydration: true,
          expectHistory: true,
          intent: 'main',
          keepAllProfilesScope: true,
          profile: profileName,
          retryHydrationTimeoutOnce: true
        })
      } else {
        newChat(profileName)
      }
    } catch (error) {
      host.notify({
        kind: 'error',
        message: error instanceof Error ? error.message : t('sessionControls.agentOpenFailed')
      })
    } finally {
      setAgentOpening(null)
    }
  }

  return (
    <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5" data-v32-session-controls="">
      <Tip label={`${gatewayLabel} · ${profile}`}>
        <Button
          aria-label={gatewayLabel}
          className="gap-1 text-[0.6875rem] text-(--ui-text-secondary)"
          data-session-gateway-control=""
          data-v32-control="gateway"
          onClick={() => navigate('/command-center?section=system')}
          size="xs"
          type="button"
          variant="ghost"
        >
          <Codicon className="size-3.5 shrink-0" name="globe" />
          <StatusDot className="shrink-0" tone={gatewayTone} />
          <span className="hidden shrink-0 font-medium @sm:inline">{t('sessionControls.gateway')}</span>
          <Codicon className="size-2.5 shrink-0 opacity-60" name="chevron-down" />
        </Button>
      </Tip>

      <DropdownMenu onOpenChange={open => open && void loadAgentProfiles().catch(() => undefined)}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={agentsLabel}
            className="gap-1 text-[0.6875rem] text-(--ui-text-secondary)"
            data-session-agents-control=""
            data-v32-control="agents"
            disabled={gateway !== 'open' || Boolean(agentOpening)}
            size="xs"
            type="button"
            variant="ghost"
          >
            <Codicon className="size-3.5 shrink-0" name="organization" />
            <span className="hidden shrink-0 font-medium @sm:inline">{t('sessionControls.agents')}</span>
            <Codicon className="size-2.5 shrink-0 opacity-60" name="chevron-down" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-52">
          {agentProfiles.map(agent => {
            const name = agent.name?.trim() || 'default'
            const display = friendlyProfileName(agent, name === 'default' ? 'Hermes' : name)
            const active = name === focusedProfileName

            return (
              <DropdownMenuItem
                aria-label={active ? `${display} · đang dùng` : display}
                key={name}
                onSelect={() => void selectAgent(agent)}
              >
                <Codicon aria-hidden="true" className="size-3.5" name={active ? 'check' : 'hubot'} />
                <span>{display}</span>
                {active ? <span className="text-(--ui-text-tertiary)">· đang dùng</span> : null}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/agents/manage')}>
            <Codicon aria-hidden="true" className="size-3.5" name="settings-gear" />
            <span>{t('sessionControls.agentManager')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tip label={contextLabel}>
        <Button
          aria-label={contextLabel}
          className="gap-1 px-1.5 font-mono text-[0.625rem] text-(--ui-text-tertiary)"
          data-session-context-control=""
          data-v32-control="context"
          onClick={() => navigate('/command-center?section=usage')}
          size="xs"
          type="button"
          variant="ghost"
        >
          <Codicon className="size-3.5 shrink-0" name="pulse" />
          <span className="tabular-nums">{context.short}</span>
        </Button>
      </Tip>

      <Tip label={advisorLabel}>
        <Button
          aria-label={advisorLabel}
          aria-pressed={advisorEnabled}
          className="gap-1.5 text-[0.6875rem] text-(--ui-text-secondary)"
          data-session-advisor-control=""
          data-v32-control="advisor"
          disabled={gateway !== 'open' || advisorSaving || busy}
          onClick={() => void toggleAdvisor()}
          size="xs"
          type="button"
          variant="ghost"
        >
          <Codicon className="size-3.5 shrink-0" name="shield" />
          <span className="hidden shrink-0 font-medium @md:inline">{t('sessionControls.advisor')}</span>
          <span className="hidden max-w-28 truncate font-mono text-[0.625rem] text-(--ui-text-tertiary) @lg:inline">
            {advisorModel}
          </span>
          <span
            aria-hidden="true"
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              advisorEnabled ? 'bg-(--ui-accent)' : 'bg-(--ui-border-strong)'
            }`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform ${
                advisorEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </Button>
      </Tip>
    </div>
  )
}
