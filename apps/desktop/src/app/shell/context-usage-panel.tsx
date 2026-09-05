import { useMemo } from 'react'

import { useI18n } from '@/i18n'
import { ExternalLink } from '@/lib/external-link'
import { compactNumber, formatPercentOf, formatUsdCost } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ContextBreakdown, ContextUsageCategory, UsageStats } from '@/types/hermes'

interface ContextUsagePanelProps {
  breakdown: ContextBreakdown | null
  loading: boolean
  usage: UsageStats
}

/** Presentational: the breakdown is fetched by the statusbar (see
 *  `useContextBreakdown`) because the gauge's own label needs it, so the
 *  popover opens with its numbers already in hand. `usage` is the gauge's
 *  merged figure — measured occupancy when the backend has it, the estimate
 *  otherwise — so the header and the bar can never disagree. */
export function ContextUsagePanel({ breakdown, loading, usage }: ContextUsagePanelProps) {
  const { locale, t } = useI18n()
  const copy = t.shell.statusbar.contextUsagePanel
  const publishedMax = breakdown?.published_context_max ?? breakdown?.context_max ?? usage.context_max ?? 0
  const effectiveMax = breakdown?.context_max ?? usage.context_max ?? 0
  const contextUsed = breakdown?.context_used ?? usage.context_used ?? 0
  const activePercent = formatPercentOf(contextUsed, publishedMax, locale)
  const effectivePercent = formatPercentOf(contextUsed, effectiveMax, locale)
  const measurement = breakdown?.context_measurement === 'measured' ? copy.measured : copy.estimated

  const source =
    breakdown?.published_context_source === 'openai'
      ? copy.sourceOpenAI
      : breakdown?.published_context_source === 'anthropic'
        ? copy.sourceAnthropic
        : copy.sourceRuntime

  const remaining = breakdown?.remaining_tokens ?? Math.max(0, publishedMax - contextUsed)
  const summaryUsed = `${breakdown?.context_measurement === 'estimated' ? '~' : ''}${compactNumber(contextUsed)}`
  const included = usage.cost_status === 'included'
  const referenceKnown = usage.reference_cost_status === 'estimated'
  const billedKnown = usage.cost_status === 'actual' || usage.cost_status === 'estimated'
  const displayedCost = included && referenceKnown ? usage.reference_cost_usd : usage.cost_usd
  const approximate = included || usage.cost_status === 'estimated'
  const costAmount = formatUsdCost(displayedCost, approximate)

  const costSummary =
    included && referenceKnown
      ? copy.costReference(costAmount)
      : usage.cost_status === 'actual'
        ? copy.costActual(costAmount)
        : billedKnown
          ? copy.costEstimated(costAmount)
          : copy.costUnknown

  const cacheTokens = (usage.cache_read ?? 0) + (usage.cache_write ?? 0)
  const turnBudget = usage.turn_budget
  const turnBudgetState = turnBudget?.paused ? 'paused' : turnBudget?.near_limit ? 'near-limit' : 'normal'

  const turnBudgetStateLabel = turnBudget?.paused
    ? copy.turnBudgetPaused
    : turnBudget?.near_limit
      ? copy.turnBudgetNearLimit
      : copy.turnBudgetNormal

  const categories = useMemo(
    () =>
      (breakdown?.categories ?? []).map(category => ({
        ...category,
        label: copy.categories[category.id as keyof typeof copy.categories] ?? category.label
      })),
    [breakdown?.categories, copy]
  )

  const segmentTotal = categories.reduce((sum, category) => sum + category.tokens, 0) || contextUsed || 1
  const hasCategoryBreakdown = categories.length > 0

  const conversationTokens =
    breakdown?.conversation_tokens ??
    (hasCategoryBreakdown ? (categories.find(category => category.id === 'conversation')?.tokens ?? 0) : null)

  const systemBackgroundTokens =
    breakdown?.system_background_tokens ??
    (hasCategoryBreakdown
      ? categories.reduce((sum, category) => sum + (category.id === 'conversation' ? 0 : category.tokens), 0)
      : null)

  const quota = breakdown?.quota

  const quotaKnown =
    quota?.available === true && Number.isFinite(quota.remaining_percent) && quota.remaining_percent !== undefined

  return (
    <div className="flex w-72 flex-col gap-3 p-3 text-[0.75rem]" data-slot="context-usage-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{copy.title}</p>

        <span className="text-[0.6875rem] text-muted-foreground">
          {copy.tokenSummary(summaryUsed, compactNumber(publishedMax, 2))}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
        <p className="text-foreground">{copy.percentFull(activePercent)}</p>
        <span className="rounded-full bg-(--ui-bg-elevated) px-1.5 py-0.5 text-muted-foreground">{measurement}</span>
      </div>

      <ContextUsageBar categories={categories} segmentTotal={segmentTotal} />

      {breakdown && (
        <div className="flex flex-col gap-1 border-b border-(--ui-stroke-tertiary) pb-2 text-[0.6875rem] text-muted-foreground">
          {breakdown.model && <div>{copy.modelLabel(breakdown.model)}</div>}
          {publishedMax > 0 && (
            <div>
              {breakdown.published_context_reference ? (
                <ExternalLink href={breakdown.published_context_reference} showExternalIcon>
                  {copy.publishedCapacity(compactNumber(publishedMax, 2), source)}
                </ExternalLink>
              ) : (
                copy.publishedCapacity(compactNumber(publishedMax, 2), source)
              )}
            </div>
          )}
          {effectiveMax > 0 && <div>{copy.effectiveCapacity(compactNumber(effectiveMax, 2), effectivePercent)}</div>}
          {publishedMax > 0 && <div>{copy.remaining(compactNumber(remaining, 2))}</div>}
          <div>
            {copy.systemBackground(
              systemBackgroundTokens === null ? copy.unavailable : compactNumber(systemBackgroundTokens, 2)
            )}
          </div>
          <div>
            {copy.conversationContext(
              conversationTokens === null ? copy.unavailable : compactNumber(conversationTokens, 2)
            )}
          </div>
          <div>
            {copy.logicalHistory(
              breakdown.logical_history_tokens === undefined
                ? copy.unavailable
                : compactNumber(breakdown.logical_history_tokens, 2)
            )}
          </div>
          <div>
            {copy.compactionCount(
              breakdown.compaction_count === undefined ? copy.unavailable : String(breakdown.compaction_count)
            )}
          </div>
          <div>
            {quotaKnown
              ? copy.quotaRemaining(
                  quota?.provider?.trim() || copy.sourceRuntime,
                  formatPercentOf(quota?.remaining_percent, 100, locale)
                )
              : copy.quotaUnavailable}
          </div>
          {quotaKnown && quota?.reset_at && <div>{copy.quotaReset(quota.reset_at)}</div>}
          {(breakdown.compact_threshold_tokens ?? 0) > 0 && (
            <div className={cn(breakdown.compact_recommended && 'font-medium text-amber-600 dark:text-amber-400')}>
              {breakdown.compact_recommended
                ? copy.compactNow
                : copy.tokensUntilCompact(compactNumber(breakdown.tokens_until_compact, 2))}
            </div>
          )}
          {(breakdown.compact_threshold_tokens ?? 0) > 0 && (
            <div>
              {copy.compactAt(
                compactNumber(breakdown.compact_threshold_tokens, 2),
                breakdown.compact_threshold_percent ?? 0
              )}
            </div>
          )}
        </div>
      )}

      {turnBudget && (
        <div
          className={cn(
            'flex flex-col gap-1 rounded-md border p-2 text-[0.6875rem]',
            turnBudget.paused
              ? 'border-red-500/35 bg-red-500/8'
              : turnBudget.near_limit
                ? 'border-amber-500/35 bg-amber-500/8'
                : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)'
          )}
          data-slot="turn-budget-meter"
          data-state={turnBudgetState}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">{copy.turnBudgetTitle}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5',
                turnBudget.paused
                  ? 'bg-red-500/12 text-red-700 dark:text-red-300'
                  : turnBudget.near_limit
                    ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                    : 'bg-(--ui-bg-overlay) text-muted-foreground'
              )}
            >
              {turnBudgetStateLabel}
            </span>
          </div>
          <span className="tabular-nums text-foreground">
            {copy.turnBudgetCalls(
              turnBudget.model_calls,
              turnBudget.model_hard_limit,
              turnBudget.tool_calls,
              turnBudget.tool_hard_limit
            )}
          </span>
          <span className="text-muted-foreground">
            {copy.turnBudgetTokens(
              compactNumber(turnBudget.input_tokens),
              compactNumber(turnBudget.cache_read_tokens),
              compactNumber(turnBudget.output_tokens)
            )}
          </span>
          <span className="text-muted-foreground">
            {copy.turnBudgetApiEquivalent(formatUsdCost(turnBudget.estimated_cost_usd, true))}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-md bg-(--ui-bg-elevated) p-2 text-[0.6875rem]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{copy.costTitle}</span>
          {included && <span className="text-muted-foreground">{copy.costIncluded}</span>}
        </div>
        <span className="tabular-nums text-foreground">{costSummary}</span>
        <span className="text-muted-foreground">
          {copy.costTokens(compactNumber(usage.input), compactNumber(usage.output), compactNumber(cacheTokens))}
        </span>
        {(billedKnown || referenceKnown) && <span className="text-muted-foreground">{copy.costDisclaimer}</span>}
      </div>

      <ul className="flex flex-col gap-1.5">
        {categories.map(category => (
          <li className="flex items-center justify-between gap-2" key={category.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: category.color }} />

              <span className="truncate text-muted-foreground">{category.label}</span>
            </span>

            <span className="shrink-0 tabular-nums text-foreground">{compactNumber(category.tokens)}</span>
          </li>
        ))}
      </ul>

      {loading && !categories.length && <p className="text-[0.6875rem] text-muted-foreground">{copy.loading}</p>}

      {!loading && !categories.length && <p className="text-[0.6875rem] text-muted-foreground">{copy.empty}</p>}
    </div>
  )
}

function ContextUsageBar({
  categories,
  segmentTotal
}: {
  categories: readonly ContextUsageCategory[]
  segmentTotal: number
}) {
  return (
    <div
      className={cn(
        'flex h-1.5 overflow-hidden rounded-full',
        categories.length ? 'bg-(--ui-stroke-tertiary)' : 'dither bg-(--ui-bg-elevated)'
      )}
      data-slot="context-usage-bar"
    >
      {categories.map(category => (
        <span
          className="h-full min-w-px"
          key={category.id}
          style={{
            background: category.color,
            width: `${(category.tokens / segmentTotal) * 100}%`
          }}
        />
      ))}
    </div>
  )
}
