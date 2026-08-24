import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { stageTrackedSnapshot } from './tracked-snapshot.mjs'

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test('mapped source snapshot contains tracked HEAD only, never ignored credential files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-tracked-snapshot-test-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  const repo = path.join(root, 'repo')
  const snapshot = path.join(root, 'snapshot')
  fs.mkdirSync(repo)
  git(repo, ['init', '--quiet'])
  fs.writeFileSync(path.join(repo, '.gitattributes'), '*.txt text eol=lf\n')
  fs.writeFileSync(path.join(repo, '.gitignore'), '*.pem\n.op.env\n.mcp.json\n')
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'committed acceptance source\n')
  fs.writeFileSync(path.join(repo, '.op.env'), 'REAL_SECRET_MUST_NOT_MAP\n')
  fs.writeFileSync(path.join(repo, '.mcp.json'), '{"token":"REAL_SECRET_MUST_NOT_MAP"}\n')
  fs.writeFileSync(path.join(repo, 'private.pem'), 'REAL_SECRET_MUST_NOT_MAP\n')
  git(repo, ['add', '.gitattributes', '.gitignore', 'tracked.txt'])
  git(repo, [
    '-c',
    'user.name=Harness Test',
    '-c',
    'user.email=harness@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture'
  ])
  const commit = git(repo, ['rev-parse', 'HEAD'])

  stageTrackedSnapshot({ destination: snapshot, expectedCommit: commit, repoRoot: repo })
  assert.equal(fs.readFileSync(path.join(snapshot, 'tracked.txt'), 'utf8'), 'committed acceptance source\n')
  assert.equal(fs.existsSync(path.join(snapshot, '.op.env')), false)
  assert.equal(fs.existsSync(path.join(snapshot, '.mcp.json')), false)
  assert.equal(fs.existsSync(path.join(snapshot, 'private.pem')), false)
  assert.equal(
    fs.readdirSync(snapshot, { recursive: true }).some(name => String(name).includes('REAL_SECRET_MUST_NOT_MAP')),
    false
  )
})
