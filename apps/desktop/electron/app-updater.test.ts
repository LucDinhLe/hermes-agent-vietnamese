import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  beginAppUpdateInstall,
  classifyBundledUpdateStamp,
  communityReleaseFeedUrl,
  configureAutoUpdater,
  configureCommunityReleaseFeed,
  decideDesktopUpdateRoute,
  describeFeedCheck,
  dispatchDesktopUpdateRoute,
  releaseTagForAppVersion,
  selectCommunityUpdateRelease,
  selectInstallStampCandidates
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
    feedUrl: 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-36',
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

  assert.equal(selectCommunityUpdateRelease(releases, '0.20.4-vi.34', 'win32', 'x64')?.version, '0.21.0-vi.1')
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
    },
    {
      tag_name: 'vi-v0.31.0-6',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    },
    {
      tag_name: 'vi-v0.31.0-7',
      draft: false,
      prerelease: true,
      assets: [{ name: 'latest.yml' }]
    }
  ]

  assert.deepEqual(selectCommunityUpdateRelease(releases, '0.20.4-vi.39', 'win32', 'x64'), {
    feedUrl: 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7',
    tag: 'vi-v0.31.0-7',
    version: '0.31.0-vi.7'
  })
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.1', 'win32', 'x64')?.version, '0.31.0-vi.7')
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.2', 'win32', 'x64')?.version, '0.31.0-vi.7')
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.3', 'win32', 'x64')?.version, '0.31.0-vi.7')
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.4', 'win32', 'x64')?.version, '0.31.0-vi.7')
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.5', 'win32', 'x64')?.version, '0.31.0-vi.7')
  assert.equal(selectCommunityUpdateRelease(releases, '0.31.0-vi.6', 'win32', 'x64')?.version, '0.31.0-vi.7')
})

test('community update feeds are pinned to an immutable GitHub release', () => {
  assert.equal(
    communityReleaseFeedUrl('vi-v0.20.4-35'),
    'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35'
  )

  const calls: unknown[] = []
  configureCommunityReleaseFeed({ setFeedURL: value => calls.push(value) } as any, {
    feedUrl: communityReleaseFeedUrl('vi-v0.20.4-35')
  })
  assert.deepEqual(calls, [
    {
      channel: 'latest',
      provider: 'generic',
      url: 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35'
    }
  ])
})

// ── bundled updater policy ──────────────────────────────────────────

const stableStamp = {
  schemaVersion: 2,
  commit: 'a'.repeat(40),
  payload: true,
  tag: 'vi-v0.32.0-1',
  releaseClass: 'stable',
  updateChannel: 'stable',
  updateFeedEnabled: true
}

const communityStamp = {
  ...stableStamp,
  releaseClass: 'community-prerelease',
  updateChannel: 'community-prerelease',
  updateFeedEnabled: false
}

const thinStamp = {
  schemaVersion: 2,
  commit: 'b'.repeat(40),
  payload: false,
  tag: null,
  releaseClass: null,
  updateChannel: null,
  updateFeedEnabled: false
}

test('packaged apps never fall back from their resident stamp to a development stamp', () => {
  assert.deepEqual(selectInstallStampCandidates('resources/install-stamp.json', 'build/install-stamp.json', true), [
    'resources/install-stamp.json'
  ])
  assert.deepEqual(selectInstallStampCandidates(null, 'build/install-stamp.json', true), [])
  assert.deepEqual(selectInstallStampCandidates('resources/install-stamp.json', 'build/install-stamp.json', false), [
    'resources/install-stamp.json',
    'build/install-stamp.json'
  ])
})

test('only the two exact release-policy tuples are accepted', () => {
  assert.deepEqual(classifyBundledUpdateStamp(stableStamp), {
    kind: 'stable-enabled',
    releaseClass: 'stable'
  })
  assert.deepEqual(classifyBundledUpdateStamp(communityStamp), {
    kind: 'community-disabled',
    releaseClass: 'community-prerelease'
  })

  for (const installStamp of [
    { ...stableStamp, releaseClass: 'community-prerelease' },
    { ...stableStamp, updateChannel: 'community-prerelease' },
    { ...stableStamp, updateFeedEnabled: false },
    { ...communityStamp, updateChannel: 'stable' },
    { ...communityStamp, updateFeedEnabled: true },
    { ...communityStamp, updateFeedEnabled: 'false' },
    { ...stableStamp, commit: 'A'.repeat(40) },
    { payload: false },
    { schemaVersion: 2, commit: 'b'.repeat(40), payload: false, updateFeedEnabled: false },
    { ...thinStamp, schemaVersion: 1 },
    { payload: true },
    null
  ]) {
    assert.equal(classifyBundledUpdateStamp(installStamp).kind, 'invalid')
  }
})

test('stable packaged bundles are the only route to electron-updater', () => {
  assert.deepEqual(
    decideDesktopUpdateRoute({
      installStamp: stableStamp,
      bundledPayloadComplete: true,
      installMode: 'bundled',
      isPackaged: true
    }),
    { mechanism: 'app-updater', reason: 'stable-feed-enabled', releaseClass: 'stable' }
  )
})

test('community, missing, old, and contradictory bundled stamps fail closed', () => {
  const stamps = [
    communityStamp,
    null,
    { ...stableStamp, schemaVersion: 1 },
    { ...stableStamp, commit: 'a'.repeat(7) },
    { ...stableStamp, tag: 'v0.32.0' },
    { ...stableStamp, updateChannel: 'community-prerelease' },
    { ...communityStamp, updateFeedEnabled: true }
  ]

  for (const installStamp of stamps) {
    for (const installMode of ['bundled', null]) {
      assert.equal(
        decideDesktopUpdateRoute({
          installStamp,
          bundledPayloadComplete: true,
          installMode,
          isPackaged: true
        }).mechanism,
        'blocked'
      )
    }
  }
})

test('a stamp claiming a missing payload fails closed instead of reaching git', () => {
  assert.deepEqual(
    decideDesktopUpdateRoute({
      installStamp: stableStamp,
      bundledPayloadComplete: false,
      installMode: 'bundled',
      isPackaged: true
    }),
    { mechanism: 'blocked', reason: 'missing-bundled-payload', releaseClass: 'stable' }
  )
})

test('explicit ejected and source installs keep the git route regardless of the bundle stamp', () => {
  for (const installStamp of [stableStamp, communityStamp, { payload: true }, null]) {
    assert.equal(
      decideDesktopUpdateRoute({
        installStamp,
        bundledPayloadComplete: true,
        installMode: 'source',
        isPackaged: true
      }).mechanism,
      'git'
    )
  }
})

test('thin builds, dev runs, and coherent legacy source checkouts keep the git route', () => {
  assert.equal(
    decideDesktopUpdateRoute({
      installStamp: thinStamp,
      bundledPayloadComplete: false,
      installMode: null,
      isPackaged: true
    }).mechanism,
    'git'
  )
  assert.equal(
    decideDesktopUpdateRoute({
      installStamp: communityStamp,
      bundledPayloadComplete: true,
      installMode: 'bundled',
      isPackaged: false
    }).mechanism,
    'git'
  )
  assert.deepEqual(
    decideDesktopUpdateRoute({
      installStamp: stableStamp,
      bundledPayloadComplete: true,
      installMode: null,
      isPackaged: true
    }),
    { mechanism: 'git', reason: 'legacy-source-checkout', releaseClass: 'stable' }
  )
})

test('blocked bundle dispatch cannot call either network updater or git handler', async () => {
  const calls: string[] = []

  for (const installStamp of [communityStamp, null, { ...stableStamp, updateChannel: 'community-prerelease' }]) {
    const route = decideDesktopUpdateRoute({
      installStamp,
      bundledPayloadComplete: true,
      installMode: null,
      isPackaged: true
    })

    const result = await dispatchDesktopUpdateRoute(route, {
      appUpdater: async () => {
        calls.push('electron-updater')

        return 'network'
      },
      blocked: async () => {
        calls.push('blocked')

        return 'stopped'
      },
      git: async () => {
        calls.push('git')

        return 'network'
      }
    })

    assert.equal(result, 'stopped')
  }

  assert.deepEqual(calls, ['blocked', 'blocked', 'blocked'])
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
  assert.equal(releaseTagForAppVersion('0.31.0-vi.6'), 'vi-v0.31.0-6')
  assert.equal(releaseTagForAppVersion('0.31.0-vi.7'), 'vi-v0.31.0-7')
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
