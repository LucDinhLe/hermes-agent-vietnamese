import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'

import { normalizeBundleSymlinks } from './mac-bundle-symlinks.mjs'

test('symlink tuyệt đối trong bundle → tương đối; ngoài bundle hoặc đứt → xoá; tương đối hợp lệ giữ nguyên', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'macsym-'))
  const app = path.join(tmp, 'X.app')
  fs.mkdirSync(path.join(app, 'Contents', 'Resources', 'python', 'bin'), { recursive: true })
  const real = path.join(app, 'Contents', 'Resources', 'python', 'bin', 'python3.11')
  fs.writeFileSync(real, '')
  fs.writeFileSync(path.join(tmp, 'outside.txt'), '')

  const absIn = path.join(app, 'Contents', 'Resources', 'python', 'bin', 'python3')
  fs.symlinkSync(real, absIn)
  const relOk = path.join(app, 'Contents', 'Resources', 'python', 'bin', 'python')
  fs.symlinkSync('python3.11', relOk)
  const outside = path.join(app, 'Contents', 'Resources', 'leak')
  fs.symlinkSync(path.join(tmp, 'outside.txt'), outside)
  const dangling = path.join(app, 'Contents', 'Resources', 'gone')
  fs.symlinkSync('nope', dangling)

  const logs = []
  const result = normalizeBundleSymlinks(app, m => logs.push(m))

  assert.equal(result.fixed.length, 1)
  assert.equal(fs.readlinkSync(absIn), 'python3.11')
  assert.equal(fs.readlinkSync(relOk), 'python3.11')
  assert.deepEqual(result.removed.map(r => r.reason).sort(), ['ngoài bundle', 'đích không tồn tại'])
  assert.ok(!fs.existsSync(outside) && !fs.lstatSync(outside, { throwIfNoEntry: false }))
  assert.ok(!fs.lstatSync(dangling, { throwIfNoEntry: false }))
  assert.equal(logs.length, 3)
})
