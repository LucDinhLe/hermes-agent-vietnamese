/**
 * Preserve V32's implicit light-mode appearance exactly once.
 *
 * V32 treated an absent mode preference as `light`; upstream V33 treats it as
 * `system`. A profile that explicitly chose a V32 skin (for example Ember) but
 * never touched the mode control therefore needs one compatibility write. A
 * genuinely fresh V33 profile is marked without a mode write so it continues
 * to follow the operating system, including after it chooses a skin later.
 */

import { readKey, storedStringRecord, writeKey } from '@/lib/storage'

export const APPEARANCE_STORAGE_KEYS = {
  lastProfile: 'hermes-desktop-active-profile-v1',
  mode: 'hermes-desktop-mode-v1',
  profileModes: 'hermes-desktop-profile-modes-v1',
  profileSkins: 'hermes-desktop-profile-themes-v1',
  skin: 'hermes-desktop-theme-v2'
} as const

export const V32_APPEARANCE_LIGHT_DEFAULT_MIGRATION_KEY =
  'hermes.vietnamese.migrations.v32AppearanceLightDefault.dev11'

export type V32AppearanceMigrationResult =
  | 'already-complete'
  | 'explicit-mode-preserved'
  | 'fresh-profile-marked'
  | 'legacy-light-preserved'

const hasNonEmptyValue = (value: null | string): boolean => Boolean(value?.trim())

/**
 * Run before the theme module's boot-time paint. The marker is written last so
 * a successful legacy mode write always precedes completion. Multiple desktop
 * windows may race this at launch; every write is deterministic and idempotent.
 */
export function migrateV32AppearanceLightDefault(): V32AppearanceMigrationResult {
  if (typeof window === 'undefined') {
    return 'already-complete'
  }

  if (readKey(V32_APPEARANCE_LIGHT_DEFAULT_MIGRATION_KEY) !== null) {
    return 'already-complete'
  }

  const globalSkin = readKey(APPEARANCE_STORAGE_KEYS.skin)
  const profileSkins = storedStringRecord(APPEARANCE_STORAGE_KEYS.profileSkins)

  const hasV32ThemeData =
    hasNonEmptyValue(globalSkin) || Object.values(profileSkins).some(theme => hasNonEmptyValue(theme))

  const modeIsAbsent = readKey(APPEARANCE_STORAGE_KEYS.mode) === null

  if (hasV32ThemeData && modeIsAbsent) {
    // Re-read immediately before writing so a concurrent window/user choice is
    // never replaced after the initial absence check.
    if (readKey(APPEARANCE_STORAGE_KEYS.mode) === null) {
      writeKey(APPEARANCE_STORAGE_KEYS.mode, 'light')
    }
  }

  writeKey(V32_APPEARANCE_LIGHT_DEFAULT_MIGRATION_KEY, '1')

  if (hasV32ThemeData) {
    return modeIsAbsent ? 'legacy-light-preserved' : 'explicit-mode-preserved'
  }

  return 'fresh-profile-marked'
}
