import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { type AnalyticsResponse, getUsageAnalytics } from '@/hermes'
import { useI18n } from '@/i18n'
import { $activeGatewayProfile } from '@/store/profile'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'

import { USAGE_PERIODS, UsageOverview, type UsagePeriod } from './usage-overview'

export function UsageView() {
  const { t } = useI18n()
  const cc = t.commandCenter
  const profile = useStore($activeGatewayProfile)
  const [period, setPeriod] = useState<UsagePeriod>(30)
  const [usage, setUsage] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError('')

    try {
      const response = await getUsageAnalytics(period, profile)

      if (requestRef.current === requestId) {
        setUsage(response)
      }
    } catch (nextError) {
      if (requestRef.current === requestId) {
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [period, profile])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRefreshHotkey(refresh)

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)">
      <header className="flex shrink-0 items-end justify-between gap-4 px-5 pb-4 pt-[calc(var(--titlebar-height)+1rem)]">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{cc.sections.usage}</h1>
          <p className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
            {cc.sectionDescriptions.usage}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedControl
            onChange={id => setPeriod(Number(id) as UsagePeriod)}
            options={USAGE_PERIODS.map(value => ({ id: String(value), label: cc.days(value) }))}
            value={String(period)}
          />
          <Button
            aria-label={cc.refresh}
            disabled={loading}
            onClick={() => void refresh()}
            size="icon-sm"
            variant="ghost"
          >
            <Codicon name="refresh" size="0.8125rem" spinning={loading} />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 px-5 pb-4">
        <UsageOverview error={error} loading={loading} onRefresh={() => void refresh()} period={period} usage={usage} />
      </div>
    </section>
  )
}
