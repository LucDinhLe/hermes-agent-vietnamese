import { usePluginI18n } from '@hermes/plugin-sdk'
import type { CSSProperties } from 'react'

const PLUGIN_ID = 'hermes-vietnamese'

export function HomeIntro() {
  const t = usePluginI18n(PLUGIN_ID)
  const wordmark = t('home.wordmark')

  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-center text-muted-foreground sm:px-6 lg:px-8"
      data-slot="aui_intro"
    >
      <div className="w-full min-w-0">
        <p
          aria-label={wordmark}
          className="fit-text mx-auto mb-1 w-[calc(100%-1rem)] font-['Collapse'] font-bold uppercase leading-[0.9] tracking-[0.08em] text-midground mix-blend-plus-lighter dark:text-foreground/90"
          style={{ '--fit-min': '2rem' } as CSSProperties}
        >
          <span>
            <span>{wordmark}</span>
          </span>
          <span aria-hidden="true">{wordmark}</span>
        </p>

        <p className="m-0 text-center tracking-tight" data-slot="aui_intro-tagline">
          {t('home.tagline')}
        </p>
        <p className="m-0 text-center" data-slot="aui_intro-attribution">
          {t('home.attribution')}
        </p>
      </div>
    </div>
  )
}
