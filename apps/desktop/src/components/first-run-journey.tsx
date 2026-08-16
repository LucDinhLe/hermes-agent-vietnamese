import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import type { Locale } from '@/i18n'
import { Check } from '@/lib/icons'
import { cn } from '@/lib/utils'

type JourneyStep = 1 | 2 | 3
type SetupLocale = Extract<Locale, 'en' | 'vi'>

interface FirstRunJourneyProps {
  activeStep: JourneyStep
  className?: string
  showLanguage?: boolean
}

const LANGUAGE_OPTIONS = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' }
] as const

/** Shared progress for the community build's three-step first-run experience.
 *
 * Install and onboarding remain separate recovery states. This component only
 * gives them one visible journey and an early language choice; it does not
 * merge their state machines or change the main Hermes workspace.
 */
export function FirstRunJourney({ activeStep, className, showLanguage = false }: FirstRunJourneyProps) {
  const { locale, previewLocale, t } = useI18n()
  const selectedLocale: SetupLocale = locale === 'vi' ? 'vi' : 'en'

  return (
    <div className={cn('grid gap-3', className)}>
      <ol aria-label={t.install.setupChoiceTitle} className="grid grid-cols-3 gap-2">
        {t.install.journeySteps.map((label, index) => {
          const step = (index + 1) as JourneyStep
          const completed = step < activeStep
          const active = step === activeStep

          return (
            <li
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-2 border-t-2 pt-2 text-xs',
                active
                  ? 'border-(--theme-primary) font-semibold text-foreground'
                  : completed
                    ? 'border-(--ui-stroke-primary) text-(--ui-text-secondary)'
                    : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary)'
              )}
              key={label}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] tabular-nums',
                  active ? 'bg-(--theme-primary) text-primary-foreground' : 'bg-(--ui-bg-tertiary)'
                )}
              >
                {completed ? <Check className="size-3" /> : step}
              </span>
              <span className="truncate">{label}</span>
            </li>
          )
        })}
      </ol>

      {showLanguage ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-(--ui-text-secondary)">{t.install.chooseLanguage}</p>
            <p className="mt-0.5 text-xs text-(--ui-text-tertiary)">{t.install.noTerminalRequired}</p>
          </div>
          <SegmentedControl onChange={next => previewLocale(next)} options={LANGUAGE_OPTIONS} value={selectedLocale} />
        </div>
      ) : null}
    </div>
  )
}
