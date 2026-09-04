#!/usr/bin/env node
// engine-sync: giữ lõi Hermes Agent ở gốc kho bằng đúng cây upstream ghim trong engine.lock.
//
//   node scripts/engine-sync.mjs check   → thoát 1 nếu bất kỳ tệp lõi nào lệch upstream (dùng làm gate CI)
//   node scripts/engine-sync.mjs apply   → kéo lại lõi từ upstream, khôi phục overlay của vỏ từ HEAD
//
// Không phụ thuộc gì ngoài git. Không đụng shellPaths.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine.lock'), 'utf8'))
const mode = process.argv[2] ?? 'check'

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const overlay = Object.entries(lock.shellOverlay)
  .filter(([k]) => k !== '_comment')
  .flatMap(([, v]) => v)
const isOverlay = (file) =>
  overlay.some((o) => (o.endsWith('/') ? file.startsWith(o) : file === o))

// GitHub chặn tốc độ (HTTP 429) với lượt tải ẩn danh từ máy chạy CI, nên ưu tiên URL có token
// của workflow rồi mới tới URL trần, và thử lại vài lượt có giãn cách.
function engineFetchUrls() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
  const urls = []

  if (token && lock.engine.repository.startsWith('https://github.com/')) {
    urls.push(lock.engine.repository.replace('https://', `https://x-access-token:${token}@`))
  }

  urls.push(lock.engine.repository)

  return urls
}

function fetchEngineTag() {
  const urls = engineFetchUrls()
  const refspec = `refs/tags/${lock.engine.tag}:refs/tags/${lock.engine.tag}`
  let last

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    for (const url of urls) {
      try {
        git('fetch', '--depth', '1', url, refspec)

        return
      } catch (error) {
        last = error
        const detail = String(error?.stderr || error?.message || '')
        console.warn(`[engine-sync] lượt ${attempt} tải lõi thất bại: ${detail.split('\n')[0]}`)
      }
    }

    execFileSync(process.execPath, ['-e', `setTimeout(()=>{}, ${attempt * 15000})`], { stdio: 'ignore' })
  }

  throw last
}

function ensureEngineCommit() {
  try {
    git('cat-file', '-e', `${lock.engine.commit}^{commit}`)
  } catch {
    console.log(`[engine-sync] tải ${lock.engine.tag} từ ${lock.engine.repository}`)
    fetchEngineTag()
  }
  const resolved = git('rev-parse', `${lock.engine.tag}^{commit}`)
  if (resolved !== lock.engine.commit) {
    throw new Error(`tag ${lock.engine.tag} trỏ ${resolved}, engine.lock ghi ${lock.engine.commit}`)
  }
}

function drift() {
  const out = git('diff', '--name-status', lock.engine.commit, 'HEAD', '--', ...lock.corePaths)
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t')
      return { status: status[0], file: rest[rest.length - 1] }
    })
    .filter(({ status, file }) => !(status === 'A' && isOverlay(file)))
}

ensureEngineCommit()

if (mode === 'check') {
  const d = drift()
  if (d.length === 0) {
    console.log(`[engine-sync] OK: lõi khớp ${lock.engine.tag} (${lock.engine.commit.slice(0, 12)}), overlay ${overlay.length} mục`)
    process.exit(0)
  }
  console.error(`[engine-sync] LỆCH LÕI: ${d.length} tệp khác upstream ${lock.engine.tag}`)
  for (const { status, file } of d.slice(0, 50)) console.error(`  ${status}  ${file}`)
  if (d.length > 50) console.error(`  … và ${d.length - 50} tệp nữa`)
  console.error('Sửa: node scripts/engine-sync.mjs apply, hoặc ghi mục RED vào docs/patch-ledger.md và cập nhật shellOverlay.')
  process.exit(1)
}

if (mode === 'apply') {
  const existing = lock.corePaths.filter((p) => {
    try { git('cat-file', '-e', `HEAD:${p}`); return true } catch { return false }
  })
  if (existing.length) git('rm', '-r', '-q', '--cached', '--', ...existing)
  for (const p of existing) fs.rmSync(path.join(ROOT, p), { recursive: true, force: true })
  git('checkout', '-q', lock.engine.commit, '--', ...lock.corePaths)
  for (const o of overlay) {
    const p = o.replace(/\/$/, '')
    try { git('cat-file', '-e', `HEAD:${p}`); git('checkout', '-q', 'HEAD', '--', o) } catch { /* overlay chưa có ở HEAD */ }
  }
  const d = drift()
  console.log(d.length === 0
    ? `[engine-sync] đã áp ${lock.engine.tag}; lõi khớp, overlay ${overlay.length} mục`
    : `[engine-sync] đã áp nhưng còn ${d.length} tệp lệch, xem check`)
  process.exit(d.length === 0 ? 0 : 1)
}

console.error('dùng: engine-sync.mjs check | apply')
process.exit(2)
