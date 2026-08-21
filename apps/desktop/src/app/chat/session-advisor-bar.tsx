import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ModelCatalogMenu, ModelMenuCloseContext, type ModelMenuController } from '@/app/shell/model-catalog-menu'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { getAuxiliaryModels, type HermesGateway, setModelAssignment } from '@/hermes'
import { useI18n } from '@/i18n'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { setCurrentAdvisorEnabled } from '@/store/session'
import { sessionTileDelegate } from '@/store/session-states'
import type { AuxiliaryModelsResponse, UsageStats } from '@/types/hermes'

import { SessionAgentsSlot } from './session-agents-contrib'
import { SessionContextMeter } from './session-context-meter'

interface SessionAdvisorBarProps {
  busy: boolean
  enabled: boolean
  gateway: HermesGateway | null
  gatewayOpen: boolean
  model: string
  provider: string
  leadConnectionId?: string | null
  leadProfile?: string
  projectKey?: string
  projectResolutionKnown?: boolean
  sessionId: string | null
  storedSessionId?: string | null
  usage?: UsageStats | null
}

const advisorModelQueryKey = (connectionId: null | string, profile: string) =>
  ['advisor-model', connectionId || 'primary', profile] as const

interface AdvisorModelSelection {
  model: string
  provider: string
}

function advisorModelSelection(data: AuxiliaryModelsResponse | undefined): AdvisorModelSelection {
  if (!data) {
    return { model: '', provider: '' }
  }

  const assignment = data.tasks.find(task => task.task === 'advisor')

  if (!assignment || assignment.provider === 'auto') {
    return data.main
  }

  return {
    model: assignment.model || data.main.model,
    provider: assignment.provider || data.main.provider
  }
}

function withAdvisorAssignment(
  data: AuxiliaryModelsResponse | undefined,
  selection: AdvisorModelSelection
): AuxiliaryModelsResponse | undefined {
  if (!data) {
    return data
  }

  const next = {
    base_url: '',
    model: selection.model,
    provider: selection.provider,
    task: 'advisor'
  }

  const index = data.tasks.findIndex(task => task.task === 'advisor')

  return {
    ...data,
    tasks: index < 0 ? [...data.tasks, next] : data.tasks.map((task, taskIndex) => (taskIndex === index ? next : task))
  }
}

/**
 * Session-local Advisor control. It is deliberately mounted inside ChatView,
 * making the chat pane its layout and clipping boundary. Container queries
 * progressively hide copy as the user narrows a split instead of borrowing
 * space from the outer-right rail.
 */
export function SessionAdvisorBar({
  busy,
  enabled,
  gateway,
  gatewayOpen,
  leadConnectionId = null,
  leadProfile = 'default',
  model,
  projectKey = '',
  projectResolutionKnown = false,
  provider,
  sessionId,
  storedSessionId = null,
  usage
}: SessionAdvisorBarProps) {
  const { t } = useI18n()
  const profile = leadProfile.trim() || 'default'
  const [pending, setPending] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const queryClient = useQueryClient()

  const auxiliary = useQuery({
    enabled: gatewayOpen,
    queryFn: () => getAuxiliaryModels(profile, leadConnectionId),
    queryKey: advisorModelQueryKey(leadConnectionId, profile),
    staleTime: 60_000
  })

  const selection = advisorModelSelection(auxiliary.data)

  const paint = (next: boolean) => {
    if (sessionId) {
      sessionTileDelegate()?.updateSession(sessionId, state => ({ ...state, advisorEnabled: next }))
    } else {
      setCurrentAdvisorEnabled(next)
    }
  }

  const toggle = async (next: boolean) => {
    if (pending || !gatewayOpen) {
      return
    }

    const previous = enabled
    paint(next)

    if (!sessionId) {
      return
    }

    if (!gateway) {
      paint(previous)

      return
    }

    setPending(true)

    try {
      await gateway.request('config.set', {
        key: 'advisor',
        session_id: sessionId,
        value: next ? 'on' : 'off'
      })
    } catch (error) {
      paint(previous)
      notifyError(error, t.settings.model.defaultsFailed)
    } finally {
      setPending(false)
    }
  }

  const selectAdvisorModel = async (model: string, provider: string): Promise<boolean> => {
    if (pending || !gatewayOpen) {
      return false
    }

    const queryKey = advisorModelQueryKey(leadConnectionId, profile)
    const previous = queryClient.getQueryData<AuxiliaryModelsResponse>(queryKey)
    const next = { model, provider }

    queryClient.setQueryData<AuxiliaryModelsResponse | undefined>(queryKey, current =>
      withAdvisorAssignment(current, next)
    )
    setPending(true)

    try {
      const result = await setModelAssignment(
        {
          model,
          provider,
          scope: 'auxiliary',
          task: 'advisor'
        },
        profile,
        leadConnectionId
      )

      if (result.ok !== true) {
        throw new Error(result.confirm_message?.trim() || t.shell.modelOptions.updateFailed)
      }

      void queryClient.invalidateQueries({ queryKey })

      return true
    } catch (error) {
      queryClient.setQueryData(queryKey, previous)
      notifyError(error, t.shell.modelOptions.updateFailed)

      return false
    } finally {
      setPending(false)
    }
  }

  const modelController: ModelMenuController = {
    applyPreset: () => undefined,
    current: {
      effort: '',
      fast: false,
      model: selection.model,
      provider: selection.provider
    },
    presetFor: () => ({}),
    select: selectAdvisorModel,
    setOptions: () => undefined
  }

  const modelTitle = selection.model
    ? `${t.settings.model.advisorModel}: ${selection.model}`
    : t.settings.model.advisorModel

  return (
    <div
      className="@container relative z-20 min-w-0 shrink-0 overflow-hidden border-b border-(--ui-stroke-secondary) bg-(--ui-chat-surface-background)/92 px-2 py-1"
      data-session-advisor-bar=""
    >
      <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5">
        <SessionContextMeter
          busy={busy}
          gateway={gateway}
          gatewayOpen={gatewayOpen}
          model={model}
          provider={provider}
          sessionId={sessionId}
          sessionUsage={usage}
        />
        <SessionAgentsSlot
          busy={busy}
          leadConnectionId={leadConnectionId}
          leadProfile={leadProfile}
          projectKey={projectKey}
          projectResolutionKnown={projectResolutionKnown}
          runtimeSessionId={sessionId}
          storedSessionId={storedSessionId}
        />
        <Codicon
          className={cn('size-3.5 shrink-0', enabled ? 'text-primary' : 'text-(--ui-text-quaternary)')}
          name="shield"
        />
        <span className="hidden shrink-0 text-[0.6875rem] font-medium text-(--ui-text-secondary) @sm:inline">
          {t.settings.model.advisorTitle}
        </span>
        <DropdownMenu onOpenChange={setModelMenuOpen} open={modelMenuOpen}>
          <Tip label={modelTitle}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={modelTitle}
                className="min-w-0 max-w-48 gap-1 font-mono text-[0.625rem] text-(--ui-text-tertiary)"
                data-session-advisor-model-trigger=""
                disabled={!gatewayOpen || pending}
                size="xs"
                type="button"
                variant="ghost"
              >
                {selection.model && <span className="hidden min-w-0 truncate @lg:inline">{selection.model}</span>}
                <ChevronDown className="size-2.5 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-72 p-0" side="bottom" sideOffset={6}>
            <ModelMenuCloseContext.Provider value={() => setModelMenuOpen(false)}>
              <ModelCatalogMenu
                allModels
                controller={modelController}
                gateway={gateway ?? undefined}
                profile={profile}
                selectionOnly
                showManageModels={false}
              />
            </ModelMenuCloseContext.Provider>
          </DropdownMenuContent>
        </DropdownMenu>
        <Switch
          aria-label={t.settings.model.advisorEnabled}
          checked={enabled}
          disabled={!gatewayOpen || pending}
          onCheckedChange={checked => void toggle(checked)}
          size="xs"
        />
      </div>
    </div>
  )
}
