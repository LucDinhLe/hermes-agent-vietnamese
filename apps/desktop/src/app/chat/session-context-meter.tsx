import { useCallback, useMemo } from 'react'

import { ContextUsagePanel } from '@/app/shell/context-usage-panel'
import { useContextBreakdown } from '@/app/shell/hooks/use-context-breakdown'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import type { HermesGateway } from '@/hermes'
import { useI18n } from '@/i18n'
import { compactNumber, formatPercentOf, formatUsdCost, percentOf } from '@/lib/format'
import type { UsageStats } from '@/types/hermes'

interface SessionContextMeterProps {
  busy: boolean
  gateway: HermesGateway | null
  gatewayOpen: boolean
  model: string
  provider: string
  sessionId: string | null
  sessionUsage?: UsageStats | null
}

/** Context occupancy for exactly one chat tile.
 *
 * The published model window is the headline denominator. The details keep
 * the current route limit and Hermes' real compact threshold separate, so a
 * provider promise is never mistaken for the route's usable capacity.
 */
export function SessionContextMeter({
  busy,
  gateway,
  gatewayOpen,
  model,
  provider,
  sessionId,
  sessionUsage
}: SessionContextMeterProps) {
  const { locale, t } = useI18n()
  const copy = t.shell.statusbar

  const requestGateway = useCallback(
    <T = unknown,>(method: string, params?: Record<string, unknown>) => {
      if (!gateway) {
        return Promise.reject(new Error('Hermes gateway is unavailable'))
      }

      return gateway.request<T>(method, params)
    },
    [gateway]
  )

  const { breakdown, loading } = useContextBreakdown({
    busy,
    enabled: gatewayOpen && Boolean(gateway),
    refreshKey: `${provider}:${model}`,
    requestGateway,
    sessionId
  })

  const contextMax = breakdown?.published_context_max ?? breakdown?.context_max ?? 0
  const contextUsed = breakdown?.context_used ?? 0
  const contextPercentValue = percentOf(contextUsed, contextMax)
  const contextPercent = formatPercentOf(contextUsed, contextMax, locale)
  const estimated = breakdown?.context_measurement === 'estimated'

  const fraction =
    contextMax > 0 ? `${estimated ? '~' : ''}${compactNumber(contextUsed)}/${compactNumber(contextMax, 2)}` : '…'

  const included = sessionUsage?.cost_status === 'included'
  const referenceKnown = sessionUsage?.reference_cost_status === 'estimated'
  const billedKnown = sessionUsage?.cost_status === 'actual' || sessionUsage?.cost_status === 'estimated'
  const displayedCost = included && referenceKnown ? sessionUsage?.reference_cost_usd : sessionUsage?.cost_usd
  const costKnown = (included && referenceKnown) || billedKnown

  const formattedCost = costKnown
    ? formatUsdCost(displayedCost, included || sessionUsage?.cost_status === 'estimated')
    : ''

  const costLabel =
    formattedCost && included && referenceKnown
      ? copy.contextUsagePanel.costReferenceCompact(formattedCost)
      : formattedCost

  const titleParts = [contextMax > 0 ? `${copy.contextUsage}: ${fraction} (${contextPercent}%)` : copy.contextUsage]

  if (costLabel) {
    titleParts.push(costLabel)
  }

  const title = titleParts.join(' · ')

  const usage = useMemo<UsageStats>(
    () => ({
      calls: sessionUsage?.calls ?? 0,
      ...sessionUsage,
      context_max: contextMax,
      context_percent: contextPercentValue,
      context_used: contextUsed,
      input: sessionUsage?.input ?? 0,
      output: sessionUsage?.output ?? 0,
      total: sessionUsage?.total ?? 0
    }),
    [contextMax, contextPercentValue, contextUsed, sessionUsage]
  )

  return (
    <DropdownMenu>
      <Tip label={title}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={title}
            className="min-w-0 gap-1 px-1.5 font-mono text-[0.625rem] text-(--ui-text-tertiary)"
            data-session-context-meter=""
            disabled={!gatewayOpen || !gateway || !sessionId}
            size="xs"
            type="button"
            variant="ghost"
          >
            <Codicon className="size-3.5 shrink-0" name="pulse" />
            <span className="hidden tabular-nums @sm:inline @md:hidden">{contextPercent}%</span>
            <span className="hidden whitespace-nowrap tabular-nums @md:inline">
              {fraction} ({contextPercent}%)
            </span>
            {costLabel && <span className="hidden whitespace-nowrap tabular-nums @xl:inline">· {costLabel}</span>}
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-auto border-(--ui-stroke-secondary) p-0" sideOffset={6}>
        <ContextUsagePanel breakdown={breakdown} loading={loading} usage={usage} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
