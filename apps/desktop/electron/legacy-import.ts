// legacy-import.ts — nhập dữ liệu từ bản Hermes Vietnamese cũ (trước 2026.9.3, thư mục
// %LOCALAPPDATA%\hermes hoặc ~/.hermes) sang thư mục dữ liệu mới của bản composite.
//
// Nguyên tắc (kế hoạch composite, bước 7): CHỈ SAO CHÉP, không di chuyển, không xoá.
// Bản cũ và dữ liệu của nó giữ nguyên để người dùng quay lui bằng cách mở lại icon cũ.
// Chỉ đề nghị khi thư mục mới còn trống (chưa có state.db lẫn config.yaml).
//
// Những gì mang sang: cấu hình, khoá API (.env), lịch sử phiên (state.db + WAL), sessions/,
// memories/, skills/, cron/, hooks/, SOUL.md, pairing/, projects/.
// Những gì bỏ lại: checkout hermes-agent và venv của bản cũ (lõi khác), bootstrap-cache,
// logs, mọi cache, tệp khoá/dấu cài đặt. Lõi mới tự dựng lại phần đó.

import fs from 'node:fs'
import path from 'node:path'

export const LEGACY_IMPORT_MARKER = 'legacy-import.json'

const COPY_ENTRIES = [
  'config.yaml',
  '.env',
  'state.db',
  'state.db-wal',
  'state.db-shm',
  'SOUL.md',
  'install_id',
  'sessions',
  'memories',
  'skills',
  'cron',
  'hooks',
  'pairing',
  'projects'
] as const

const SKIP_ENTRIES = new Set([
  'hermes-agent',
  'venv',
  '.venv',
  'bootstrap-cache',
  'logs',
  'cache',
  'image_cache',
  'audio_cache',
  'node',
  'python',
  'uv'
])

export interface LegacyImportDeps {
  exists: (p: string) => boolean
  isDirectory: (p: string) => boolean
}

const realDeps: LegacyImportDeps = {
  exists: p => {
    try {
      fs.accessSync(p)

      return true
    } catch {
      return false
    }
  },
  isDirectory: p => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  }
}

/** Thư mục dữ liệu của bản cũ theo nền tảng, cùng quy ước với bản 9.2. */
export function legacyHermesHomeCandidates(platform: string, env: NodeJS.ProcessEnv, home: string): string[] {
  const out: string[] = []

  if (platform === 'win32' && env.LOCALAPPDATA) {
    out.push(path.join(env.LOCALAPPDATA, 'hermes'))
  }

  out.push(path.join(home, '.hermes'))

  return out
}

function hasUserData(dir: string, deps: LegacyImportDeps): boolean {
  return ['state.db', 'config.yaml', '.env'].some(f => deps.exists(path.join(dir, f)))
}

/**
 * Quyết định có đề nghị nhập không. Trả về thư mục cũ nếu: thư mục mới chưa có dữ liệu
 * người dùng, chưa từng hỏi (không có marker), và có một thư mục cũ mang dữ liệu thật.
 * Thư mục cũ trùng với thư mục mới (người dùng tự trỏ HERMES_VI_HOME vào đó) bị bỏ qua.
 */
export function findLegacyImportSource(
  newHome: string,
  candidates: string[],
  deps: LegacyImportDeps = realDeps
): string | null {
  if (deps.exists(path.join(newHome, LEGACY_IMPORT_MARKER)) || hasUserData(newHome, deps)) {
    return null
  }

  const resolvedNew = path.resolve(newHome)

  for (const candidate of candidates) {
    if (path.resolve(candidate) === resolvedNew) {
      continue
    }

    if (deps.isDirectory(candidate) && hasUserData(candidate, deps)) {
      return candidate
    }
  }

  return null
}

export function planLegacyImport(source: string, deps: LegacyImportDeps = realDeps): string[] {
  return COPY_ENTRIES.filter(name => !SKIP_ENTRIES.has(name) && deps.exists(path.join(source, name)))
}

export interface LegacyImportResult {
  copied: string[]
  failed: { name: string; error: string }[]
}

/** Sao chép các mục đã lên kế hoạch; lỗi từng mục không chặn mục khác. */
export function runLegacyImport(source: string, newHome: string, entries: string[]): LegacyImportResult {
  fs.mkdirSync(newHome, { recursive: true })
  const result: LegacyImportResult = { copied: [], failed: [] }

  for (const name of entries) {
    const from = path.join(source, name)
    const to = path.join(newHome, name)

    try {
      fs.cpSync(from, to, { recursive: true, errorOnExist: false, force: false, dereference: false })
      result.copied.push(name)
    } catch (error) {
      result.failed.push({ name, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return result
}

export function writeLegacyImportMarker(
  newHome: string,
  record: { source: string; decision: 'imported' | 'skipped'; copied?: string[]; failed?: LegacyImportResult['failed'] }
): void {
  try {
    fs.mkdirSync(newHome, { recursive: true })
    fs.writeFileSync(
      path.join(newHome, LEGACY_IMPORT_MARKER),
      JSON.stringify({ ...record, at: new Date().toISOString() }, null, 2)
    )
  } catch {
    // marker là tiện ích; thiếu marker chỉ khiến lần sau hỏi lại
  }
}
