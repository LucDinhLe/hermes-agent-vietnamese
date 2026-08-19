import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { getAuxiliaryModels, type HermesGateway } from '@/hermes'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import { setCurrentAdvisorEnabled } from '@/store/session'
import { sessionTileDelegate } from '@/store/session-states'
import type { AuxiliaryModelsResponse } from '@/types/hermes'

interface SessionAdvisorBarProps {
  enabled: boolean
  gateway: HermesGateway | null
  gatewayOpen: boolean
  sessionId: string | null
}

function advisorModelLabel(data: AuxiliaryModelsResponse | undefined): string {
  if (!data) {
    return ''
  }

  const assignment = data.tasks.find(task => task.task === 'advisor')

  if (!assignment || assignment.provider === 'auto') {
    return data.main.model
  }

  return assignment.model || data.main.model
}

/**
 * Session-local Advisor control. It is deliberately mounted inside ChatView,
 * making the chat pane its layout and clipping boundary. Container queries
 * progressively hide copy as the user narrows a split instead of borrowing
 * space from the outer-right rail.
 */
export function SessionAdvisorBar({ enabled, gateway, gatewayOpen, sessionId }: SessionAdvisorBarProps) {
  const { t } = useI18n()
  const profile = useStore($activeGatewayProfile)
  const [pending, setPending] = useState(false)

  const auxiliary = useQuery({
    enabled: gatewayOpen,
    queryFn: () => getAuxiliaryModels(profile),
    queryKey: ['advisor-model', profile],
    staleTime: 60_000
  })

  const model = advisorModelLabel(auxiliary.data)

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

  return (
    <div
      className="@container relative z-20 min-w-0 shrink-0 overflow-hidden border-b border-(--ui-stroke-secondary) bg-(--ui-chat-surface-background)/92 px-2 py-1"
      data-session-advisor-bar=""
    >
      <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5">
        <Codicon
          className={cn('size-3.5 shrink-0', enabled ? 'text-primary' : 'text-(--ui-text-quaternary)')}
          name="shield"
        />
        <span className="hidden shrink-0 text-[0.6875rem] font-medium text-(--ui-text-secondary) @sm:inline">
          {t.settings.model.advisorTitle}
        </span>
        {model && (
          <Tip label={`${t.settings.model.advisorModel}: ${model}`}>
            <span className="hidden min-w-0 max-w-48 truncate rounded-md border border-(--ui-stroke-secondary) bg-(--ui-control-background) px-1.5 py-0.5 font-mono text-[0.625rem] text-(--ui-text-tertiary) @lg:inline">
              {model}
            </span>
          </Tip>
        )}
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
