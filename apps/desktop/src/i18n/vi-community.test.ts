import { describe, expect, it } from 'vitest'

import { TRANSLATIONS } from './catalog'
import { DEFAULT_LOCALE, isLocale, isSupportedLocaleValue, localeConfigValue, normalizeLocale } from './languages'

describe('Vietnamese edition locale contract', () => {
  it.each(['vi', 'vi-VN', 'vi_VN', 'Vietnamese', 'Tiếng Việt', 'tieng viet'])('normalizes %s to vi', value => {
    expect(normalizeLocale(value)).toBe('vi')
    expect(isSupportedLocaleValue(value)).toBe(true)
  })

  it('registers Vietnamese in the typed catalog and config value', () => {
    expect(isLocale('vi')).toBe(true)
    expect(localeConfigValue('vi')).toBe('vi')
    expect(TRANSLATIONS.vi.settings.about.heading).toBe('Hermes Vietnamese')
  })

  it('preserves upstream English fallback semantics independently of the shell first-run policy', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(normalizeLocale(undefined)).toBe('en')
    expect(normalizeLocale('unknown-locale')).toBe('en')
    expect(normalizeLocale('en')).toBe('en')
  })

  it('names the discoverable usage destination accurately', () => {
    expect(TRANSLATIONS.vi.commandCenter.sections.usage).toBe('Thống kê sử dụng')
    expect(TRANSLATIONS.vi.profiles.connectGateway).toBe('Quản lý Gateway…')
  })

  it('falls back to English for new upstream keys that are not translated yet', () => {
    expect(TRANSLATIONS.vi.boot.steps.retryingRemoteBackend).toBe(TRANSLATIONS.en.boot.steps.retryingRemoteBackend)
  })
})
