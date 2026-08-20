import { useMemo } from 'react'

import { useI18n } from '@/i18n'
import { ExternalLink } from '@/lib/external-link'
import { compactNumber } from '@/lib/format'
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
  const { t } = useI18n()
  const copy = t.shell.statusbar.contextUsagePanel
  const contextMax = usage.context_max ?? 0
  const contextUsed = usage.context_used ?? 0
  const contextPercent = Math.max(0, Math.min(100, Math.round(usage.context_percent ?? 0)))
  const measurement = breakdown?.context_measurement === 'measured' ? copy.measured : copy.estimated

  const source =
    breakdown?.published_context_source === 'openai'
      ? copy.sourceOpenAI
      : breakdown?.published_context_source === 'anthropic'
        ? copy.sourceAnthropic
        : copy.sourceRuntime

  const publishedMax = breakdown?.published_context_max ?? breakdown?.context_max ?? 0
  const effectiveMax = breakdown?.context_max ?? 0
  const remaining = breakdown?.remaining_tokens ?? Math.max(0, publishedMax - contextUsed)
  const summaryUsed = `${breakdown?.context_measurement === 'estimated' ? '~' : ''}${compactNumber(contextUsed)}`

  const categories = useMemo(
    () =>
      (breakdown?.categories ?? []).map(category => ({
        ...category,
        label: copy.categories[category.id as keyof typeof copy.categories] ?? category.label
      })),
    [breakdown?.categories, copy]
  )

  const segmentTotal = categories.reduce((sum, category) => sum + category.tokens, 0) || contextUsed || 1

  return (
    <div className="flex w-72 flex-col gap-3 p-3 text-[0.75rem]" data-slot="context-usage-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{copy.title}</p>

        <span className="text-[0.6875rem] text-muted-foreground">
          {copy.tokenSummary(summaryUsed, compactNumber(contextMax, 2))}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
        <p className="text-foreground">{copy.percentFull(contextPercent)}</p>
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
          {effectiveMax > 0 && effectiveMax !== publishedMax && (
            <div>{copy.effectiveCapacity(compactNumber(effectiveMax, 2))}</div>
          )}
          {publishedMax > 0 && <div>{copy.remaining(compactNumber(remaining, 2))}</div>}
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
