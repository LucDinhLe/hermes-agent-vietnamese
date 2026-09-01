import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  APPEARANCE_STORAGE_KEYS,
  migrateV32AppearanceLightDefault,
  V32_APPEARANCE_LIGHT_DEFAULT_MIGRATION_KEY
} from './vietnamese-v32-appearance-migration'

describe('V32 appearance light-default migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('style')
    delete document.documentElement.dataset.hermesMode
    delete document.documentElement.dataset.hermesTheme
  })

  it.each([
    {
      label: 'the default profile skin',
      seed: () => window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.skin, 'ember')
    },
    {
      label: 'a named profile skin',
      seed: () =>
        window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.profileSkins, JSON.stringify({ work: 'ember' }))
    }
  ])('preserves V32 light mode for $label when mode was implicit', ({ seed }) => {
    seed()

    expect(migrateV32AppearanceLightDefault()).toBe('legacy-light-preserved')
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEYS.mode)).toBe('light')
    expect(window.localStorage.getItem(V32_APPEARANCE_LIGHT_DEFAULT_MIGRATION_KEY)).toBe('1')
  })

  it('marks a fresh V33 profile without changing its mode now or after a later skin choice', () => {
    expect(migrateV32AppearanceLightDefault()).toBe('fresh-profile-marked')
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEYS.mode)).toBeNull()

    window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.skin, 'ember')

    expect(migrateV32AppearanceLightDefault()).toBe('already-complete')
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEYS.mode)).toBeNull()
  })

  it.each(['light', 'dark', 'system'])('never replaces an explicit %s mode', mode => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.skin, 'ember')
    window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.mode, mode)

    expect(migrateV32AppearanceLightDefault()).toBe('explicit-mode-preserved')
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEYS.mode)).toBe(mode)
  })

  it('runs before boot paint and restores the V32 Ember light palette', async () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEYS.skin, 'ember')
    vi.resetModules()

    const { getBaseColors, modePref, skinPref } = await import('./context')

    expect(skinPref.resolve('default')).toBe('ember')
    expect(modePref.resolve('default')).toBe('light')
    expect(document.documentElement.dataset.hermesTheme).toBe('ember')
    expect(document.documentElement.dataset.hermesMode).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--theme-midground')).toBe('#d97316')

    const colors = getBaseColors('ember', 'light')
    expect(colors.background).toBe('#ffffff')
    expect(colors.primary).toBe('#d97316')
    expect(colors.ring).toBe('#d97316')
    expect(colors.midground).toBe('#d97316')
  })
})
