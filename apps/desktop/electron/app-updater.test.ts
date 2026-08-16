import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  beginAppUpdateInstall,
  configureAutoUpdater,
  describeFeedCheck,
  releaseTagForAppVersion,
  shouldUseAppUpdater
} from './app-updater'

test('packaged updates download the complete promoted artifact', () => {
  const updater = {
    allowPrerelease: false,
    autoDownload: true,
    autoInstallOnAppQuit: false,
    disableDifferentialDownload: false
  }

  configureAutoUpdater(updater as any)

  assert.deepEqual(updater, {
    allowPrerelease: true,
    autoDownload: false,
    autoInstallOnAppQuit: true,
    disableDifferentialDownload: true
  })
})

test('install handoff disarms the quit guard and forces a relaunch', () => {
  const calls: string[] = []

  const updater = {
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean) {
      calls.push(`quitAndInstall:${isSilent}:${isForceRunAfter}`)
    }
  }

  beginAppUpdateInstall(updater as any, () => calls.push('beforeInstall'))

  assert.deepEqual(calls, ['beforeInstall', 'quitAndInstall:false:true'])
})

// ── shouldUseAppUpdater ─────────────────────────────────────────────

test('app updater runs only for packaged bundled installs with payloads', () => {
  assert.equal(shouldUseAppUpdater({ stampHasPayload: true, installMode: 'bundled', isPackaged: true }), true)
})

test('a thin build never uses the app updater', () => {
  assert.equal(shouldUseAppUpdater({ stampHasPayload: false, installMode: 'bundled', isPackaged: true }), false)
})

test('a source or ejected checkout keeps the git update path', () => {
  // Eject writes installMode: source. The gate must fall through to git.
  assert.equal(shouldUseAppUpdater({ stampHasPayload: true, installMode: 'source', isPackaged: true }), false)
  // No manifest at all: a legacy checkout. Adoption may run later, but the
  // updater gate stays closed until the manifest says bundled.
  assert.equal(shouldUseAppUpdater({ stampHasPayload: true, installMode: null, isPackaged: true }), false)
})

test('dev runs never use the app updater', () => {
  assert.equal(shouldUseAppUpdater({ stampHasPayload: true, installMode: 'bundled', isPackaged: false }), false)
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

test('community app versions map back to public vi release tags', () => {
  assert.equal(releaseTagForAppVersion('0.20.0-vi.15'), 'vi-v0.20.0-15')
  assert.equal(releaseTagForAppVersion('0.20.0'), 'v0.20.0')

  const out = describeFeedCheck('0.20.0-vi.14', { version: '0.20.0-vi.15' }, true)
  assert.equal(out.latestTag, 'vi-v0.20.0-15')
  assert.equal(out.updateAvailable, true)
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
