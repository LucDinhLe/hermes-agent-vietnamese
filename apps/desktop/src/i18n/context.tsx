import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useBackendOwnerGuard } from '@/app/hooks/use-backend-owner-guard'
import { getHermesConfigRecord, type HermesConfigRecord, saveHermesConfig } from '@/hermes'
import type { BackendOwner } from '@/store/backend-owner'

import { TRANSLATIONS } from './catalog'
import { DEFAULT_LOCALE, localeConfigValue, normalizeLocale } from './languages'
import { setRuntimeI18nLocale } from './runtime'
import type { Locale, Translations } from './types'

export { LOCALE_META } from './languages'

export interface I18nConfigClient {
  getConfig: (owner?: BackendOwner) => Promise<HermesConfigRecord>
  saveConfig: (config: HermesConfigRecord, owner?: BackendOwner) => Promise<{ ok: boolean }>
}

const defaultConfigClient: I18nConfigClient = {
  getConfig: owner => {
    if (typeof window === 'undefined' || !window.hermesDesktop?.api) {
      return Promise.resolve({})
    }

    return getHermesConfigRecord(owner?.profile, owner?.connectionId)
  },
  saveConfig: (config, owner) => {
    if (typeof window === 'undefined' || !window.hermesDesktop?.api) {
      return Promise.resolve({ ok: true })
    }

    return saveHermesConfig(config, owner?.profile, owner?.connectionId)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getConfigDisplayLanguage(config: HermesConfigRecord): unknown {
  return isRecord(config.display) ? config.display.language : undefined
}

export function withConfigDisplayLanguage(config: HermesConfigRecord, locale: Locale): HermesConfigRecord {
  const display = isRecord(config.display) ? config.display : {}

  return {
    ...config,
    display: {
      ...display,
      language: localeConfigValue(locale)
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

const RTL_LOCALES = new Set<Locale>(['ar'])
const FIRST_RUN_LOCALE: Locale = 'vi'
export const FIRST_RUN_LOCALE_KEY = 'hermes-first-run-locale-v1'

function readFirstRunLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(FIRST_RUN_LOCALE_KEY)

    return value ? normalizeLocale(value) : null
  } catch {
    return null
  }
}

function writeFirstRunLocale(locale: Locale | null) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (locale) {
      window.localStorage.setItem(FIRST_RUN_LOCALE_KEY, locale)
    } else {
      window.localStorage.removeItem(FIRST_RUN_LOCALE_KEY)
    }
  } catch {
    // The language still changes for this window when storage is unavailable.
  }
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = locale
  document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
}

export interface I18nContextValue {
  configLoadError: Error | null
  isLoadingConfig: boolean
  isSavingLocale: boolean
  locale: Locale
  saveError: Error | null
  previewLocale: (next: Locale) => void
  setLocale: (next: Locale) => Promise<void>
  t: Translations
}

const I18nContext = createContext<I18nContextValue>({
  configLoadError: null,
  isLoadingConfig: false,
  isSavingLocale: false,
  locale: DEFAULT_LOCALE,
  saveError: null,
  previewLocale: () => {},
  setLocale: async () => {},
  t: TRANSLATIONS[DEFAULT_LOCALE]
})

export interface I18nProviderProps {
  backendOwner?: BackendOwner | null
  children: ReactNode
  configClient?: I18nConfigClient | null
  initialLocale?: unknown
}

export function I18nProvider({
  backendOwner = null,
  children,
  configClient = defaultConfigClient,
  initialLocale
}: I18nProviderProps) {
  const isCurrentOwner = useBackendOwnerGuard(backendOwner)

  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = normalizeLocale(initialLocale ?? readFirstRunLocale() ?? FIRST_RUN_LOCALE)

    // Module-level translators (plugin manifest/palette callbacks and
    // imperative notifications) run while descendants render. Publish the
    // initial locale before that first child render instead of waiting for a
    // passive effect, which would leave them one locale behind.
    setRuntimeI18nLocale(initial)

    return initial
  })

  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [isSavingLocale, setIsSavingLocale] = useState(false)
  const [configLoadError, setConfigLoadError] = useState<Error | null>(null)
  const [saveError, setSaveError] = useState<Error | null>(null)
  const localeRef = useRef(locale)
  const saveGenerationRef = useRef(0)

  const publishLocale = useCallback((next: Locale) => {
    // Keep render-time callbacks synchronous with the context update. A
    // passive effect changes the plain runtime variable only after children
    // have already rendered, and that mutation does not schedule a repaint.
    localeRef.current = next
    setRuntimeI18nLocale(next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  // eslint-disable-next-line no-restricted-syntax -- generation prevents a stale save from rolling back a newer owner's locale
  useEffect(() => {
    saveGenerationRef.current += 1
    setIsSavingLocale(false)
    setSaveError(null)
  }, [backendOwner?.connectionId, backendOwner?.profile])

  useEffect(() => {
    if (!configClient) {
      return
    }

    let cancelled = false

    setIsLoadingConfig(true)
    setConfigLoadError(null)

    const load = backendOwner ? configClient.getConfig(backendOwner) : configClient.getConfig()

    load
      .then(config => {
        if (!cancelled && isCurrentOwner()) {
          const configuredLanguage = getConfigDisplayLanguage(config)

          // The community build opens in Vietnamese on a fresh profile while
          // preserving English as the technical fallback for missing strings,
          // plugins, unsupported values, and config-load failures.
          publishLocale(
            configuredLanguage == null
              ? (readFirstRunLocale() ?? FIRST_RUN_LOCALE)
              : normalizeLocale(configuredLanguage)
          )
        }
      })
      .catch(error => {
        if (!cancelled && isCurrentOwner()) {
          setConfigLoadError(toError(error))
          // The backend is intentionally unavailable during first install and
          // managed release refreshes. Keep the cached choice (Vietnamese on a
          // fresh community profile) so the setup/progress UI does not flash
          // back to English while Hermes is being prepared.
          publishLocale(readFirstRunLocale() ?? FIRST_RUN_LOCALE)
        }
      })
      .finally(() => {
        if (!cancelled && isCurrentOwner()) {
          setIsLoadingConfig(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [backendOwner, configClient, initialLocale, isCurrentOwner, publishLocale])

  const previewLocale = useCallback(
    (next: Locale) => {
      setSaveError(null)
      publishLocale(next)
      writeFirstRunLocale(next)
    },
    [publishLocale]
  )

  const setLocale = useCallback(
    async (next: Locale) => {
      const previousLocale = localeRef.current
      const generation = saveGenerationRef.current + 1
      saveGenerationRef.current = generation
      const owner = backendOwner

      setSaveError(null)
      publishLocale(next)

      if (!configClient) {
        return
      }

      setIsSavingLocale(true)

      try {
        const latestConfig = owner ? await configClient.getConfig(owner) : await configClient.getConfig()

        if (!isCurrentOwner() || saveGenerationRef.current !== generation) {
          return
        }

        const nextConfig = withConfigDisplayLanguage(latestConfig, next)

        const result = owner
          ? await configClient.saveConfig(nextConfig, owner)
          : await configClient.saveConfig(nextConfig)

        if (!isCurrentOwner() || saveGenerationRef.current !== generation) {
          return
        }

        if (!result.ok) {
          throw new Error('Failed to save language')
        }

        // Keep a local cache as an early-boot hint. Backend config remains
        // authoritative once it is reachable, while install/update screens can
        // render in the user's chosen language before that request succeeds.
        writeFirstRunLocale(next)
      } catch (error) {
        const nextError = toError(error)

        if (!isCurrentOwner() || saveGenerationRef.current !== generation) {
          return
        }

        publishLocale(previousLocale)
        setSaveError(nextError)

        throw nextError
      } finally {
        if (isCurrentOwner() && saveGenerationRef.current === generation) {
          setIsSavingLocale(false)
        }
      }
    },
    [backendOwner, configClient, isCurrentOwner, publishLocale]
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      configLoadError,
      isLoadingConfig,
      isSavingLocale,
      locale,
      previewLocale,
      saveError,
      setLocale,
      t: TRANSLATIONS[locale]
    }),
    [configLoadError, isLoadingConfig, isSavingLocale, locale, previewLocale, saveError, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
