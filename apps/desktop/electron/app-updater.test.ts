import assert from 'node:assert/strict'

import { test } from 'vitest'

import { describeFeedCheck, shouldUseAppUpdater } from './app-updater'

// ── shouldUseAppUpdater ─────────────────────────────────────────────

test('app updater runs only for packaged bundled installs with payloads', () => {
  assert.equal(
    shouldUseAppUpdater({ stampHasPayload: true, installMode: 'bundled', isPackaged: true }),
    true
  )
})

test('a thin build never uses the app updater', () => {
  assert.equal(
    shouldUseAppUpdater({ stampHasPayload: false, installMode: 'bundled', isPackaged: true }),
    false
  )
})

test('a source or ejected checkout keeps the git update path', () => {
  // Eject writes installMode: source. The gate must fall through to git.
  assert.equal(
    shouldUseAppUpdater({ stampHasPayload: true, installMode: 'source', isPackaged: true }),
    false
  )
  // No manifest at all: a legacy checkout. Adoption may run later, but the
  // updater gate stays closed until the manifest says bundled.
  assert.equal(
    shouldUseAppUpdater({ stampHasPayload: true, installMode: null, isPackaged: true }),
    false
  )
})

test('dev runs never use the app updater', () => {
  assert.equal(
    shouldUseAppUpdater({ stampHasPayload: true, installMode: 'bundled', isPackaged: false }),
    false
  )
})

// ── describeFeedCheck ───────────────────────────────────────────────

test('feed check reports an available update when versions differ', () => {
  const out = describeFeedCheck('0.17.0', { version: '0.18.0' })

  assert.equal(out.supported, true)
  assert.equal(out.mechanism, 'app-updater')
  assert.equal(out.channel, 'stable')
  assert.equal(out.currentVersion, '0.17.0')
  assert.equal(out.latestVersion, '0.18.0')
  assert.equal(out.latestTag, 'v0.18.0')
  assert.equal(out.updateAvailable, true)
  assert.ok(out.fetchedAt > 0)
})

test('feed check reports up to date when versions match', () => {
  const out = describeFeedCheck('0.17.0', { version: '0.17.0' })

  assert.equal(out.updateAvailable, false)
  assert.equal(out.latestVersion, '0.17.0')
})

test('feed check tolerates a missing update info payload', () => {
  const out = describeFeedCheck('0.17.0', null)

  assert.equal(out.updateAvailable, false)
  assert.equal(out.latestVersion, null)
})
