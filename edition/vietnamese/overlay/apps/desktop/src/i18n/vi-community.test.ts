import { describe, expect, it } from 'vitest'

import { TRANSLATIONS } from './catalog'
import { isLocale, isSupportedLocaleValue, localeConfigValue, normalizeLocale } from './languages'

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

  it('falls back to English for new upstream keys that are not translated yet', () => {
    expect(TRANSLATIONS.vi.boot.steps.retryingRemoteBackend).toBe(TRANSLATIONS.en.boot.steps.retryingRemoteBackend)
  })
})
