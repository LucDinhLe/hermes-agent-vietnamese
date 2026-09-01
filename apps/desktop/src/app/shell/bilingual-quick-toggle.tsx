import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { LOCALE_META, useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'

import { titlebarButtonClass } from './titlebar'

/** V32's one-click Vietnamese/English switch. Other locales remain available
 *  in Appearance settings; this compact control only restores the daily-use
 *  VI ↔ EN path shown in the accepted V32 shell. */
export function BilingualQuickToggle() {
  const { isSavingLocale, locale, setLocale, t } = useI18n()
  const target = locale === 'vi' ? 'en' : 'vi'
  const targetLabel = LOCALE_META[target].name
  const label = `${t.language.switchTo}: ${targetLabel}`

  const switchLocale = async () => {
    triggerHaptic('selection')

    try {
      await setLocale(target)
      triggerHaptic('success')
    } catch (error) {
      notifyError(error, t.language.saveError)
    }
  }

  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        className={cn(
          titlebarButtonClass,
          'bg-transparent font-mono text-[0.6875rem] font-semibold tracking-wide text-(--ui-text-secondary) select-none'
        )}
        data-bilingual-quick-toggle=""
        disabled={isSavingLocale}
        onClick={() => void switchLocale()}
        onPointerDown={event => event.stopPropagation()}
        size="icon-titlebar"
        type="button"
        variant="ghost"
      >
        {target.toUpperCase()}
      </Button>
    </Tip>
  )
}
