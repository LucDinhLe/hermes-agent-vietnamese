import { titlebarButtonClass } from '@/app/shell/titlebar'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { LOCALE_META, useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { notifyError } from '@/store/notifications'

/** One-click Vietnamese/English switch for the always-visible title bar.
 *
 * The full language picker remains in Appearance for every supported locale.
 * This compact control covers the community build's common VI ↔ EN workflow.
 * Its glyph names the destination language, so clicking "EN" always means
 * "switch to English" rather than exposing an ambiguous current-state badge.
 */
export function BilingualQuickToggle() {
  const { isSavingLocale, locale, setLocale, t } = useI18n()
  const target = locale === 'vi' ? 'en' : 'vi'
  const targetName = LOCALE_META[target].name
  const label = `${t.language.switchTo}: ${targetName}`

  const switchLanguage = async () => {
    if (isSavingLocale) {
      return
    }

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
        className={`${titlebarButtonClass} bg-transparent px-1 font-mono text-[0.58rem] font-semibold tracking-tight select-none`}
        disabled={isSavingLocale}
        onClick={() => void switchLanguage()}
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
