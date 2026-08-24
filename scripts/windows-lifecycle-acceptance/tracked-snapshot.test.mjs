import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { fingerprintSnapshot, stagePlaywrightDependencies, stageTrackedSnapshot } from './tracked-snapshot.mjs'

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

function writePlaywrightFixture(root, { integrity = 'sha512-fixture', payload = 'trusted payload\n' } = {}) {
  const packageName = 'playwright-fixture'
  const version = '1.2.3'
  const packageRoot = path.join(root, 'node_modules', packageName)
  fs.mkdirSync(packageRoot, { recursive: true })
  fs.writeFileSync(path.join(packageRoot, 'package.json'), `${JSON.stringify({ name: packageName, version })}\n`)
  fs.writeFileSync(path.join(packageRoot, 'index.js'), payload)
  const fingerprint = fingerprintSnapshot(packageRoot)
  const destinationRepo = path.join(root, 'repo-snapshot')
  fs.mkdirSync(destinationRepo, { recursive: true })
  fs.writeFileSync(
    path.join(destinationRepo, 'package-lock.json'),
    `${JSON.stringify({ packages: { [`node_modules/${packageName}`]: { integrity, version } } })}\n`
  )
  return {
    destinationRepo,
    nodeModulesRoot: path.join(root, 'node_modules'),
    packageRoot,
    spec: { ...fingerprint, integrity, packageName, version }
  }
}

test('offline Playwright staging binds lock integrity, version and exact installed tree', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-playwright-snapshot-test-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  const fixture = writePlaywrightFixture(root)

  const staged = stagePlaywrightDependencies({
    destinationRepo: fixture.destinationRepo,
    nodeModulesRoot: fixture.nodeModulesRoot,
    specs: [fixture.spec]
  })

  assert.deepEqual(staged, [fixture.spec])
  assert.deepEqual(
    fingerprintSnapshot(path.join(fixture.destinationRepo, 'node_modules', fixture.spec.packageName)),
    fingerprintSnapshot(fixture.packageRoot)
  )
})

test('offline Playwright staging rejects a tampered installed tree or lock entry', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-playwright-tamper-test-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  const treeFixture = writePlaywrightFixture(path.join(root, 'tree'))
  fs.writeFileSync(path.join(treeFixture.packageRoot, 'index.js'), 'tampered payload\n')
  assert.throws(
    () =>
      stagePlaywrightDependencies({
        destinationRepo: treeFixture.destinationRepo,
        nodeModulesRoot: treeFixture.nodeModulesRoot,
        specs: [treeFixture.spec]
      }),
    /fingerprint mismatch/
  )

  const lockFixture = writePlaywrightFixture(path.join(root, 'lock'), { integrity: 'sha512-wrong' })
  assert.throws(
    () =>
      stagePlaywrightDependencies({
        destinationRepo: lockFixture.destinationRepo,
        nodeModulesRoot: lockFixture.nodeModulesRoot,
        specs: [{ ...lockFixture.spec, integrity: 'sha512-expected' }]
      }),
    /package-lock provenance mismatch/
  )
})
