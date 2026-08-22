import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  beginAppUpdateInstall,
  communityReleaseFeedUrl,
  configureAutoUpdater,
  configureCommunityReleaseFeed,
  describeFeedCheck,
  releaseTagForAppVersion,
  selectCommunityUpdateRelease,
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

test('install handoff disarms the quit guard, installs silently, and forces a relaunch', () => {
  const calls: string[] = []

  const updater = {
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean) {
      calls.push(`quitAndInstall:${isSilent}:${isForceRunAfter}`)
    }
  }

  beginAppUpdateInstall(updater as any, () => calls.push('beforeInstall'))

  assert.deepEqual(calls, ['beforeInstall', 'quitAndInstall:true:true'])
})

test('community release resolver selects the newest published release with this platform feed', () => {
  const releases = [
    {
      tag_name: 'vi-v0.20.4-37',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest-mac.yml' }]
    },
    {
      tag_name: 'vi-v0.20.4-36',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.20.4-35',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.20.4-99',
      draft: true,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    }
  ]

  assert.deepEqual(selectCommunityUpdateRelease(releases, '0.20.4-vi.34', 'win32', 'x64'), {
    feedUrl:
      'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-36',
    tag: 'vi-v0.20.4-36',
    version: '0.20.4-vi.36'
  })
})

test('community release resolver rejects downgrades, malformed tags, and missing architecture feeds', () => {
  const releases = [
    { tag_name: 'not-semver', draft: false, assets: [{ name: 'latest-linux-arm64.yml' }] },
    { tag_name: 'vi-v0.20.4-34', draft: false, assets: [{ name: 'latest-linux-arm64.yml' }] },
    { tag_name: 'vi-v0.20.4-35', draft: false, assets: [{ name: 'latest-linux.yml' }] }
  ]

  assert.equal(selectCommunityUpdateRelease(releases, '0.20.4-vi.34', 'linux', 'arm64'), null)
  assert.equal(selectCommunityUpdateRelease(releases, '0.20.4-vi.35', 'linux', 'x64'), null)
  assert.equal(selectCommunityUpdateRelease({}, '0.20.4-vi.34', 'win32', 'x64'), null)
})

test('community release resolver orders base versions before community iterations', () => {
  const releases = [
    { tag_name: 'vi-v0.20.9-99', draft: false, assets: [{ name: 'latest.yml' }] },
    { tag_name: 'vi-v0.21.0-1', draft: false, assets: [{ name: 'latest.yml' }] }
  ]

  assert.equal(
    selectCommunityUpdateRelease(releases, '0.20.4-vi.34', 'win32', 'x64')?.version,
    '0.21.0-vi.1'
  )
})

test('vi39 and all superseded v31 candidates upgrade to the newest v31 successor', () => {
  const releases = [
    {
      tag_name: 'vi-v0.31.0-1',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.20.4-39',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.31.0-2',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.31.0-3',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.31.0-4',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.31.0-5',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    }
  ]

  assert.deepEqual(selectCommunityUpdateRelease(releases, '0.20.4-vi.39', 'win32', 'x64'), {
    feedUrl:
      'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-5',
    tag: 'vi-v0.31.0-5',
    version: '0.31.0-vi.5'
  })
  assert.equal(
    selectCommunityUpdateRelease(releases, '0.31.0-vi.1', 'win32', 'x64')?.version,
    '0.31.0-vi.5'
  )
  assert.equal(
    selectCommunityUpdateRelease(releases, '0.31.0-vi.2', 'win32', 'x64')?.version,
    '0.31.0-vi.5'
  )
  assert.equal(
    selectCommunityUpdateRelease(releases, '0.31.0-vi.3', 'win32', 'x64')?.version,
    '0.31.0-vi.5'
  )
  assert.equal(
    selectCommunityUpdateRelease(releases, '0.31.0-vi.4', 'win32', 'x64')?.version,
    '0.31.0-vi.5'
  )
})

test('community update feeds are pinned to an immutable GitHub release', () => {
  assert.equal(
    communityReleaseFeedUrl('vi-v0.20.4-35'),
    'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35'
  )

  const calls: unknown[] = []
  configureCommunityReleaseFeed(
    { setFeedURL: value => calls.push(value) } as any,
    { feedUrl: communityReleaseFeedUrl('vi-v0.20.4-35') }
  )
  assert.deepEqual(calls, [
    {
      channel: 'latest',
      provider: 'generic',
      url: 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35'
    }
  ])
})

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
  assert.equal(out.targetSha, 'v0.18.0')
  assert.equal(out.updateAvailable, true)
  assert.ok(out.fetchedAt > 0)
})

test('community app versions map back to public vi release tags', () => {
  assert.equal(releaseTagForAppVersion('0.20.0-vi.15'), 'vi-v0.20.0-15')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.1'), 'vi-v0.31.0-1')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.2'), 'vi-v0.31.0-2')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.3'), 'vi-v0.31.0-3')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.4'), 'vi-v0.31.0-4')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.5'), 'vi-v0.31.0-5')
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
