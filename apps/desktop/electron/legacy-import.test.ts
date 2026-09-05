import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  findLegacyImportSource,
  LEGACY_IMPORT_MARKER,
  legacyHermesHomeCandidates,
  planLegacyImport,
  runLegacyImport,
  writeLegacyImportMarker
} from './legacy-import'

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-import-'))
}

test('candidates: Windows ưu tiên %LOCALAPPDATA%\\hermes rồi ~/.hermes; POSIX chỉ ~/.hermes', () => {
  assert.deepEqual(legacyHermesHomeCandidates('win32', { LOCALAPPDATA: 'C:\\LA' }, 'C:\\U'), [
    path.join('C:\\LA', 'hermes'),
    path.join('C:\\U', '.hermes')
  ])
  assert.deepEqual(legacyHermesHomeCandidates('linux', {}, '/home/u'), ['/home/u/.hermes'])
})

test('findLegacyImportSource: chỉ đề nghị khi thư mục mới trống, có bản cũ thật, chưa hỏi', () => {
  const root = tmp()
  const newHome = path.join(root, 'hermes-vietnamese')
  const old = path.join(root, 'hermes')
  fs.mkdirSync(old, { recursive: true })

  assert.equal(findLegacyImportSource(newHome, [old]), null, 'bản cũ rỗng → không hỏi')

  fs.writeFileSync(path.join(old, 'config.yaml'), 'display:\n  language: vi\n')
  assert.equal(findLegacyImportSource(newHome, [old]), old)

  assert.equal(findLegacyImportSource(newHome, [newHome, old]), old, 'bỏ qua ứng viên trùng thư mục mới')

  fs.mkdirSync(newHome, { recursive: true })
  fs.writeFileSync(path.join(newHome, 'state.db'), '')
  assert.equal(findLegacyImportSource(newHome, [old]), null, 'thư mục mới đã có dữ liệu → không hỏi')

  const fresh = path.join(root, 'fresh')
  writeLegacyImportMarker(fresh, { source: old, decision: 'skipped' })
  assert.equal(findLegacyImportSource(fresh, [old]), null, 'đã hỏi rồi → không hỏi lại')
  assert.ok(fs.existsSync(path.join(fresh, LEGACY_IMPORT_MARKER)))
})

test('planLegacyImport + runLegacyImport: sao chép đúng mục, bỏ checkout/venv/cache, bản cũ nguyên vẹn', () => {
  const root = tmp()
  const old = path.join(root, 'hermes')
  const newHome = path.join(root, 'hermes-vietnamese')

  for (const d of [
    'sessions/s1',
    'memories',
    'skills/x',
    'hermes-agent/agent',
    'venv/bin',
    'logs',
    'cache',
    'bootstrap-cache'
  ]) {
    fs.mkdirSync(path.join(old, d), { recursive: true })
  }

  fs.writeFileSync(path.join(old, 'config.yaml'), 'a: 1\n')
  fs.writeFileSync(path.join(old, '.env'), 'GEMINI_API_KEY=x\n')
  fs.writeFileSync(path.join(old, 'state.db'), 'db')
  fs.writeFileSync(path.join(old, 'sessions', 's1', 'm.json'), '{}')
  fs.writeFileSync(path.join(old, 'hermes-agent', 'agent', 'x.py'), '')
  fs.writeFileSync(path.join(old, 'logs', 'a.log'), 'log')

  const plan = planLegacyImport(old)
  assert.deepEqual(plan, ['config.yaml', '.env', 'state.db', 'sessions', 'memories', 'skills'])

  const result = runLegacyImport(old, newHome, plan)
  assert.deepEqual(result.failed, [])
  assert.deepEqual(result.copied, plan)
  assert.equal(fs.readFileSync(path.join(newHome, '.env'), 'utf8'), 'GEMINI_API_KEY=x\n')
  assert.equal(fs.readFileSync(path.join(newHome, 'sessions', 's1', 'm.json'), 'utf8'), '{}')
  assert.ok(!fs.existsSync(path.join(newHome, 'hermes-agent')), 'không mang checkout lõi cũ')
  assert.ok(!fs.existsSync(path.join(newHome, 'logs')))
  assert.ok(!fs.existsSync(path.join(newHome, 'venv')))
  // bản cũ còn nguyên
  assert.equal(fs.readFileSync(path.join(old, 'state.db'), 'utf8'), 'db')
  assert.ok(fs.existsSync(path.join(old, 'sessions', 's1', 'm.json')))

  // chạy lại không ghi đè tệp đã có ở thư mục mới
  fs.writeFileSync(path.join(newHome, 'config.yaml'), 'a: 2\n')
  runLegacyImport(old, newHome, ['config.yaml'])
  assert.equal(fs.readFileSync(path.join(newHome, 'config.yaml'), 'utf8'), 'a: 2\n')
})
