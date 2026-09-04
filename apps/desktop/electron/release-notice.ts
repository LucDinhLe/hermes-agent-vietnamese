// release-notice.ts — cập nhật kiểu "chỉ báo" (notify-only) cho bản đóng gói
// Hermes Vietnamese. Quyết định 27/08/2026, áp ở bước 4 kế hoạch composite.
//
// App KHÔNG tự tải, KHÔNG tự cài. Nó đọc một tệp feed JSON trên kho GitHub,
// so phiên bản, rồi báo cho người dùng: phiên bản mới, kích thước, SHA-256
// thật và nút mở trang tải. Bật hay tắt feed là một commit vào tệp feed
// (`updateFeedEnabled`), không cần build lại app.
//
// Kênh suy từ phiên bản đang chạy: có hậu tố `-thunghiem.N` → kênh thử nghiệm
// (feed riêng trên nhánh feed/thunghiem), ngược lại → kênh chính (feed
// .github/public-release.json trên main). Bản chính không bao giờ thấy tag
// thử nghiệm và ngược lại.
//
// Cache 24 giờ bền qua khởi động lại (tệp JSON trong userData); "Kiểm tra
// ngay" bỏ qua cache.

import fs from 'node:fs'
import path from 'node:path'

export type ReleaseChannel = 'latest' | 'thunghiem'

export const RELEASE_REPO = 'LucDinhLe/hermes-agent-vietnamese'
export const RELEASE_FEED_URLS: Record<ReleaseChannel, string> = {
  latest: `https://raw.githubusercontent.com/${RELEASE_REPO}/main/.github/public-release.json`,
  thunghiem: `https://raw.githubusercontent.com/${RELEASE_REPO}/feed/thunghiem/public-release-thunghiem.json`
}
export const RELEASE_NOTICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Phần của public-release.json mà notice cần. Trường lạ được bỏ qua. */
export interface ReleaseFeed {
  tag: string
  version: string
  updateFeedEnabled: boolean
  releaseClass?: string
  windowsX64?: { filename: string; size: number; sha256: string }
}

export interface ReleaseNotice {
  supported: true
  mechanism: 'app-updater'
  channel: 'stable'
  notifyOnly: true
  releaseChannel: ReleaseChannel
  currentVersion: string
  latestVersion: string | null
  latestTag: string | null
  targetSha: string | null
  updateAvailable: boolean
  feedEnabled: boolean
  downloadUrl: string | null
  releaseUrl: string | null
  filename: string | null
  size: number | null
  sha256: string | null
  message?: string
  error?: string
  fromCache: boolean
  fetchedAt: number
}

// ── phiên bản ───────────────────────────────────────────────────────────────

/** `2026.9.3` hoặc `2026.9.3-thunghiem.2` → khoá so sánh. Bản thường > bản thử nghiệm cùng số. */
export function parseCalverVersion(version: string): number[] | null {
  const m = /^v?(\d{4})\.(\d{1,2})\.(\d{1,3})(?:-thunghiem\.(\d{1,4}))?$/.exec(version.trim())

  if (!m) {
    return null
  }

  const [, y, mo, n, pre] = m

  return [Number(y), Number(mo), Number(n), pre === undefined ? Number.MAX_SAFE_INTEGER : Number(pre)]
}

export function compareCalver(a: string, b: string): number | null {
  const ka = parseCalverVersion(a)
  const kb = parseCalverVersion(b)

  if (!ka || !kb) {
    return null
  }

  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] !== kb[i]) {
      return ka[i] < kb[i] ? -1 : 1
    }
  }

  return 0
}

export function releaseChannelForVersion(version: string): ReleaseChannel {
  return /-thunghiem\.\d+$/.test(version.trim()) ? 'thunghiem' : 'latest'
}

// ── feed ────────────────────────────────────────────────────────────────────

export function parseReleaseFeed(raw: unknown): ReleaseFeed | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const r = raw as Record<string, unknown>

  if (typeof r.tag !== 'string' || typeof r.version !== 'string' || !parseCalverVersion(r.version)) {
    return null
  }

  const w = r.windowsX64 as Record<string, unknown> | undefined

  const windowsX64 =
    w &&
    typeof w.filename === 'string' &&
    typeof w.size === 'number' &&
    typeof w.sha256 === 'string' &&
    /^[0-9a-f]{64}$/i.test(w.sha256)
      ? { filename: w.filename, size: w.size, sha256: w.sha256.toLowerCase() }
      : undefined

  return {
    tag: r.tag,
    version: r.version,
    updateFeedEnabled: r.updateFeedEnabled === true,
    releaseClass: typeof r.releaseClass === 'string' ? r.releaseClass : undefined,
    windowsX64
  }
}

export function buildReleaseNotice(
  currentVersion: string,
  feed: ReleaseFeed | null,
  opts: { channel: ReleaseChannel; fromCache: boolean; fetchedAt: number; error?: string }
): ReleaseNotice {
  const base: ReleaseNotice = {
    supported: true,
    mechanism: 'app-updater',
    channel: 'stable',
    notifyOnly: true,
    releaseChannel: opts.channel,
    currentVersion,
    latestVersion: null,
    latestTag: null,
    targetSha: null,
    updateAvailable: false,
    feedEnabled: false,
    downloadUrl: null,
    releaseUrl: null,
    filename: null,
    size: null,
    sha256: null,
    fromCache: opts.fromCache,
    fetchedAt: opts.fetchedAt
  }

  if (opts.error) {
    return { ...base, error: 'fetch-failed', message: opts.error }
  }

  if (!feed) {
    return { ...base, error: 'invalid-feed', message: 'Tệp feed phát hành không hợp lệ.' }
  }

  const cmp = compareCalver(feed.version, currentVersion)
  const newer = cmp !== null && cmp > 0
  const available = feed.updateFeedEnabled && newer
  const releaseUrl = `https://github.com/${RELEASE_REPO}/releases/tag/${encodeURIComponent(feed.tag)}`
  const asset = feed.windowsX64 ?? null

  return {
    ...base,
    latestVersion: feed.version,
    latestTag: feed.tag,
    targetSha: available ? feed.tag : null,
    updateAvailable: available,
    feedEnabled: feed.updateFeedEnabled,
    downloadUrl:
      available && asset
        ? `https://github.com/${RELEASE_REPO}/releases/download/${encodeURIComponent(feed.tag)}/${encodeURIComponent(asset.filename)}`
        : null,
    releaseUrl: available ? releaseUrl : null,
    filename: available && asset ? asset.filename : null,
    size: available && asset ? asset.size : null,
    sha256: available && asset ? asset.sha256 : null
  }
}

// ── cache ───────────────────────────────────────────────────────────────────

interface CacheRecord {
  channel: ReleaseChannel
  fetchedAt: number
  feed: ReleaseFeed | null
}

export function cachePathFor(userDataDir: string): string {
  return path.join(userDataDir, 'release-notice-cache.json')
}

export function readFreshCache(
  file: string,
  channel: ReleaseChannel,
  now: number,
  ttlMs = RELEASE_NOTICE_CACHE_TTL_MS
): CacheRecord | null {
  try {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheRecord

    if (rec.channel !== channel || typeof rec.fetchedAt !== 'number' || now - rec.fetchedAt >= ttlMs || now < rec.fetchedAt) {
      return null
    }

    return { channel, fetchedAt: rec.fetchedAt, feed: parseReleaseFeed(rec.feed) }
  } catch {
    return null
  }
}

export function writeCache(file: string, rec: CacheRecord): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(rec))
  } catch {
    // cache là tiện ích, không phải điều kiện
  }
}

// ── kiểm tra (impure, mọi I/O tiêm vào để test) ─────────────────────────────

export async function checkReleaseNotice(input: {
  currentVersion: string
  userDataDir: string
  force: boolean
  fetchJson: (url: string) => Promise<unknown>
  now?: () => number
}): Promise<ReleaseNotice> {
  const now = input.now ?? Date.now
  const channel = releaseChannelForVersion(input.currentVersion)
  const file = cachePathFor(input.userDataDir)

  if (!input.force) {
    const cached = readFreshCache(file, channel, now())

    if (cached) {
      return buildReleaseNotice(input.currentVersion, cached.feed, { channel, fromCache: true, fetchedAt: cached.fetchedAt })
    }
  }

  try {
    const raw = await input.fetchJson(RELEASE_FEED_URLS[channel])
    const feed = parseReleaseFeed(raw)
    const fetchedAt = now()

    writeCache(file, { channel, fetchedAt, feed })

    return buildReleaseNotice(input.currentVersion, feed, { channel, fromCache: false, fetchedAt })
  } catch (error) {
    return buildReleaseNotice(input.currentVersion, null, {
      channel,
      fromCache: false,
      fetchedAt: now(),
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
