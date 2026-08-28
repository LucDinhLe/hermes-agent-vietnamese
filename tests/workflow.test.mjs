import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const workflow = readFileSync(path.join(ROOT, '.github', 'workflows', 'validate-windows.yml'), 'utf8')

test('Windows validation pins every action to an immutable commit', () => {
  const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s+(.+))?$/gm)]
  assert.ok(actionUses.length > 0)

  for (const [, action, commit, versionComment] of actionUses) {
    assert.match(action, /^[\w.-]+\/[\w.-]+$/)
    assert.match(commit, /^[a-f0-9]{40}$/)
    assert.match(versionComment ?? '', /^v\d/)
  }
})

test('Windows validation derives the engine ref from engine.lock', () => {
  assert.match(workflow, /\$lock\.source\.tag/)
  assert.match(workflow, /\$lock\.source\.commit/)
  assert.match(workflow, /ref: \$\{\{ steps\.engine\.outputs\.tag \}\}/)
  assert.doesNotMatch(workflow, /v2026\.8\.27/)
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
