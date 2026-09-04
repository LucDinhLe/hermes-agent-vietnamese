import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  buildReleaseNotice,
  checkReleaseNotice,
  compareCalver,
  parseCalverVersion,
  parseReleaseFeed,
  RELEASE_FEED_URLS,
  releaseChannelForVersion
} from './release-notice'

const feed = {
  tag: 'v2026.9.3',
  version: '2026.9.3',
  updateFeedEnabled: true,
  releaseClass: 'community-pilot',
  windowsX64: { filename: 'Hermes-2026.9.3-win-x64.exe', size: 252000000, sha256: 'A'.repeat(64) }
}

test('parseCalverVersion: bản thường xếp trên bản thử nghiệm cùng số', () => {
  assert.deepEqual(parseCalverVersion('2026.9.3-thunghiem.2'), [2026, 9, 3, 2])
  assert.equal(parseCalverVersion('2026.9.3')?.[3], Number.MAX_SAFE_INTEGER)
  assert.equal(parseCalverVersion('0.32.1-vi.18'), null)
  assert.equal(compareCalver('2026.9.3', '2026.9.3-thunghiem.9'), 1)
  assert.equal(compareCalver('2026.9.3-thunghiem.2', '2026.9.3-thunghiem.1'), 1)
  assert.equal(compareCalver('2026.9.2', '2026.9.3-thunghiem.1'), -1)
  assert.equal(compareCalver('2026.10.1', '2026.9.30'), 1)
  assert.equal(compareCalver('x', '2026.9.3'), null)
})

test('releaseChannelForVersion: hậu tố thunghiem chọn kênh thử nghiệm', () => {
  assert.equal(releaseChannelForVersion('2026.9.3-thunghiem.1'), 'thunghiem')
  assert.equal(releaseChannelForVersion('2026.9.3'), 'latest')
  assert.match(RELEASE_FEED_URLS.latest, /\/main\/\.github\/public-release\.json$/)
  assert.match(RELEASE_FEED_URLS.thunghiem, /feed\/thunghiem\//)
})

test('parseReleaseFeed: chỉ nhận sha256 hợp lệ, bỏ trường lạ', () => {
  const parsed = parseReleaseFeed({ ...feed, extra: 1 })
  assert.equal(parsed?.windowsX64?.sha256, 'a'.repeat(64))
  assert.equal(parseReleaseFeed({ ...feed, windowsX64: { ...feed.windowsX64, sha256: 'xyz' } })?.windowsX64, undefined)
  assert.equal(parseReleaseFeed({ ...feed, version: 'vi-v0.32.1-18' }), null)
  assert.equal(parseReleaseFeed(null), null)
})

test('buildReleaseNotice: có bản mới → đủ tên tệp, kích thước, SHA-256, liên kết; không tự tải', () => {
  const n = buildReleaseNotice('2026.9.2', parseReleaseFeed(feed), { channel: 'latest', fromCache: false, fetchedAt: 1 })
  assert.equal(n.notifyOnly, true)
  assert.equal(n.updateAvailable, true)
  assert.equal(n.sha256, 'a'.repeat(64))
  assert.equal(n.size, 252000000)
  assert.equal(n.downloadUrl, 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.3/Hermes-2026.9.3-win-x64.exe')
  assert.equal(n.releaseUrl, 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.3')
  assert.equal(n.targetSha, 'v2026.9.3')
})

test('buildReleaseNotice: feed tắt → im lặng dù có bản mới; bản đang chạy mới hơn → im lặng', () => {
  const off = buildReleaseNotice('2026.9.2', parseReleaseFeed({ ...feed, updateFeedEnabled: false }), {
    channel: 'latest', fromCache: false, fetchedAt: 1
  })

  assert.equal(off.updateAvailable, false)
  assert.equal(off.feedEnabled, false)
  assert.equal(off.downloadUrl, null)
  assert.equal(off.latestVersion, '2026.9.3')

  const newer = buildReleaseNotice('2026.9.4', parseReleaseFeed(feed), { channel: 'latest', fromCache: false, fetchedAt: 1 })
  assert.equal(newer.updateAvailable, false)
})

test('buildReleaseNotice: lỗi mạng và feed hỏng trả về lỗi có cấu trúc', () => {
  const err = buildReleaseNotice('2026.9.2', null, { channel: 'latest', fromCache: false, fetchedAt: 1, error: 'HTTP 503' })
  assert.equal(err.error, 'fetch-failed')
  assert.equal(err.updateAvailable, false)
  const bad = buildReleaseNotice('2026.9.2', null, { channel: 'latest', fromCache: false, fetchedAt: 1 })
  assert.equal(bad.error, 'invalid-feed')
})

test('checkReleaseNotice: cache 24 giờ bền qua khởi động lại, force bỏ qua cache, đổi kênh không dùng chung cache', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notice-'))
  let calls = 0

  const fetchJson = async () => {
    calls += 1

    return feed
  }

  let clock = 1_000_000

  const first = await checkReleaseNotice({ currentVersion: '2026.9.2', userDataDir: dir, force: false, fetchJson, now: () => clock })
  assert.equal(first.fromCache, false)
  assert.equal(calls, 1)

  clock += 60 * 60 * 1000 // 1 giờ sau, "khởi động lại": gọi mới vẫn đọc cache trên đĩa
  const second = await checkReleaseNotice({ currentVersion: '2026.9.2', userDataDir: dir, force: false, fetchJson, now: () => clock })
  assert.equal(second.fromCache, true)
  assert.equal(second.updateAvailable, true)
  assert.equal(calls, 1)

  const forced = await checkReleaseNotice({ currentVersion: '2026.9.2', userDataDir: dir, force: true, fetchJson, now: () => clock })
  assert.equal(forced.fromCache, false)
  assert.equal(calls, 2)

  clock += 25 * 60 * 60 * 1000 // quá 24 giờ
  await checkReleaseNotice({ currentVersion: '2026.9.2', userDataDir: dir, force: false, fetchJson, now: () => clock })
  assert.equal(calls, 3)

  // kênh thử nghiệm không đọc cache của kênh chính
  await checkReleaseNotice({ currentVersion: '2026.9.2-thunghiem.1', userDataDir: dir, force: false, fetchJson, now: () => clock })
  assert.equal(calls, 4)

  const failing = await checkReleaseNotice({
    currentVersion: '2026.9.2', userDataDir: dir, force: true,
    fetchJson: async () => { throw new Error('offline') }, now: () => clock
  })

  assert.equal(failing.error, 'fetch-failed')
  assert.equal(failing.message, 'offline')
})
