import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const workflow = readFileSync(path.join(ROOT, '.github', 'workflows', 'validate-windows.yml'), 'utf8')
const shellPackage = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const shellLock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'))

test('Windows validation pins every action to an immutable commit', () => {
  const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s+(.+))?$/gm)]
  assert.ok(actionUses.length > 0)

  for (const [, action, commit, versionComment] of actionUses) {
    assert.match(action, /^[\w.-]+\/[\w.-]+$/)
    assert.match(commit, /^[a-f0-9]{40}$/)
    assert.match(versionComment ?? '', /^v\d/)
  }

  assert.equal(workflow.match(/persist-credentials:\s*false/g)?.length, 2)
})

test('Windows validation derives the engine ref from engine.lock', () => {
  assert.match(workflow, /\$lock\.source\.tag/)
  assert.match(workflow, /\$lock\.source\.commit/)
  assert.match(workflow, /ref: \$\{\{ steps\.engine\.outputs\.tag \}\}/)
  assert.doesNotMatch(workflow, /v2026\.8\.27/)
})

test('Windows validation uses the Node major locked by upstream', () => {
  assert.match(workflow, /node-version:\s*26/)
  assert.doesNotMatch(workflow, /node-version:\s*(?:2[0-5]|1\d)(?:\D|$)/)
  assert.equal(shellPackage.engines.node, '>=26.0.0')
  assert.equal(shellLock.packages[''].engines.node, shellPackage.engines.node)
})

test('Windows validation runs the source and build gates without publishing', () => {
  for (const command of [
    'npm run typecheck --workspace apps/desktop',
    'npm run lint --workspace apps/desktop',
    'npm run check:test:plugins --workspace apps/desktop',
    'npm run test:ui --workspace apps/desktop',
    'npm run test:desktop:platforms --workspace apps/desktop',
    'npm run build --workspace apps/desktop'
  ]) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.doesNotMatch(workflow, /--release/)
  assert.match(workflow, /steps\.materialize\.outcome == 'success'/)
  assert.match(workflow, /steps\.install\.outcome == 'success'/)
  assert.match(workflow, /steps\.verify_materialized\.outcome == 'success'/)
  for (const focusedPath of [
    'src/i18n/vi-community.test.ts',
    'src/plugins/hermes-vietnamese/plugin.test.tsx',
    'src/plugins/hermes-vietnamese/support-report.test.ts',
    'electron/vietnamese-identity-migration.test.ts'
  ]) {
    assert.match(workflow, new RegExp(focusedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(workflow, /support-report\.test\.ts\s+--maxWorkers=1/)
  assert.match(workflow, /electron\/vietnamese-identity-migration\.test\.ts\s+--maxWorkers=1/)
  assert.match(workflow, /Remove-Item Env:GITHUB_SHA/)
  assert.match(workflow, /npm run verify:materialized/)
  assert.match(workflow, /--tree "\.work\/materialized"/)
  assert.match(workflow, /npm run verify:provenance/)
  assert.match(workflow, /--resources \"\.work\/materialized\/apps\/desktop\/build\"/)
  assert.match(workflow, /--require-clean-shell/)
  assert.doesNotMatch(workflow, /--require-release/)
  assert.doesNotMatch(workflow, /gh release|electron-builder.*--publish|npm publish|actions\/create-release/i)
})
