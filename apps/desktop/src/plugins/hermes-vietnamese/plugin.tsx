import type {
  HermesPlugin,
  PaletteContribution,
  PluginOs,
  RouteContribution,
  SidebarNavContribution
} from '@hermes/plugin-sdk'
import { Button, host, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA, usePluginI18n } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { EDITION_INFO } from './edition-info'
import { VIETNAMESE_EDITION_LOCALES, VIETNAMESE_STATIC_LABELS } from './i18n'
import { SESSION_CONTROLS_AREA, SessionControlBar } from './session-control-bar'
import { buildSupportReport } from './support-report'

const ROUTE = '/hermes-vietnamese'

function runtimePlatform(): { architecture: string; platform: string } {
  const platform = typeof navigator === 'undefined' ? 'unknown' : navigator.platform || 'unknown'
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent

  const architecture = /arm64|aarch64/i.test(userAgent)
    ? 'arm64'
    : /x86_64|x64|win64|amd64/i.test(userAgent)
      ? 'x64'
      : 'unknown'

  return { architecture, platform }
}

function EditionPage({ os }: { os: PluginOs }) {
  const t = usePluginI18n('hermes-vietnamese')
  const [notice, setNotice] = useState<string | null>(null)

  const copySupport = async () => {
    const runtime = runtimePlatform()

    const copied = await os.writeClipboard(
      buildSupportReport({
        ...runtime,
        displayName: EDITION_INFO.displayName,
        engineCommit: EDITION_INFO.engineCommit,
        engineVersion: EDITION_INFO.engineVersion,
        locale: document.documentElement.lang || 'unknown',
        productVersion: EDITION_INFO.productVersion,
        technicalVersion: EDITION_INFO.technicalVersion
      })
    )

    const message = t(copied ? 'copiedSupport' : 'copyFailed')

    setNotice(message)
    host.notify({ kind: copied ? 'success' : 'error', message })
  }

  const open = async (url: string) => {
    const opened = await os.openExternal(url)

    if (!opened) {
      const message = t('openFailed')

      setNotice(message)
      host.notify({ kind: 'error', message })
    }
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col gap-8 overflow-y-auto px-6 py-10 text-(--ui-text-primary)">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-(--ui-text-tertiary)">
          {EDITION_INFO.productVersion}
        </p>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="max-w-2xl text-sm leading-6 text-(--ui-text-secondary)">{t('subtitle')}</p>
      </header>

      <dl className="grid gap-5 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-(--ui-text-tertiary)">{t('engine')}</dt>
        <dd>
          {EDITION_INFO.engineName} {EDITION_INFO.engineVersion} · {EDITION_INFO.engineTag} ·{' '}
          <code>{EDITION_INFO.engineCommit.slice(0, 12)}</code>
        </dd>
        <dt className="text-(--ui-text-tertiary)">{t('maintainer')}</dt>
        <dd>{EDITION_INFO.maintainer}</dd>
        <dt className="text-(--ui-text-tertiary)">{t('boundary')}</dt>
        <dd className="leading-6">{t('boundaryValue')}</dd>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void copySupport()} variant="secondary">
          {t('copySupport')}
        </Button>
        <Button onClick={() => void open(EDITION_INFO.issuesUrl)} variant="outline">
          {t('openIssues')}
        </Button>
        <Button onClick={() => void open(EDITION_INFO.releasesUrl)} variant="outline">
          {t('openReleases')}
        </Button>
      </div>

      {notice ? (
        <p aria-live="polite" className="text-xs text-(--ui-text-tertiary)">
          {notice}
        </p>
      ) : null}
    </main>
  )
}

const plugin: HermesPlugin = {
  id: 'hermes-vietnamese',
  name: 'Hermes Vietnamese',
  description: 'Vietnamese product, support, and community surfaces maintained independently from the upstream engine.',
  defaultEnabled: true,
  register(ctx) {
    ctx.i18n.register(VIETNAMESE_EDITION_LOCALES)
    ctx.registerMany([
      {
        id: 'about-route',
        area: ROUTES_AREA,
        title: 'Hermes Vietnamese',
        data: { path: ROUTE } satisfies RouteContribution,
        render: () => <EditionPage os={ctx.os} />
      },
      {
        id: 'v32-session-controls',
        area: SESSION_CONTROLS_AREA,
        order: 10,
        render: () => <SessionControlBar />
      },
      {
        id: 'usage-nav',
        area: SIDEBAR_NAV_AREA,
        order: 30,
        data: {
          path: '/command-center?section=usage',
          label: VIETNAMESE_STATIC_LABELS.navUsage,
          codicon: 'graph'
        } satisfies SidebarNavContribution
      },
      {
        id: 'about-command',
        area: PALETTE_AREA,
        data: {
          id: 'hermes-vietnamese.open',
          label: VIETNAMESE_STATIC_LABELS.paletteOpen,
          keywords: ['vietnamese', 'viet nam', 'support', 'about'],
          run: () => host.navigate(ROUTE)
        } satisfies PaletteContribution
      }
    ])
  }
}

export default plugin
