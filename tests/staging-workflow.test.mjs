import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(import.meta.dirname, '..')
const workflow = readFileSync(path.join(ROOT, '.github', 'workflows', 'stage-windows-x64.yml'), 'utf8')
const lifecycle = readFileSync(path.join(ROOT, 'scripts', 'windows-staging-lifecycle.ps1'), 'utf8')
const edition = JSON.parse(readFileSync(path.join(ROOT, 'edition.json'), 'utf8'))
const shellPackage = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const metadata = JSON.parse(
  readFileSync(
    path.join(
      ROOT,
      'edition',
      'vietnamese',
      'overlay',
      'apps',
      'desktop',
      'src',
      'plugins',
      'hermes-vietnamese',
      'product-metadata.json'
    ),
    'utf8'
  )
)

test('V33 dev.6 version is one immutable edition fact', () => {
  assert.equal(shellPackage.version, '0.33.0-dev.6')
  assert.equal(edition.technicalVersion, shellPackage.version)
  assert.equal(metadata.technicalVersion, shellPackage.version)
})

test('Windows staging is branch-scoped, pinned, unsigned, and never publishes', () => {
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/)
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- v33\/composite-shell/)
  assert.doesNotMatch(workflow, /\n\s*(?:pull_request|schedule):/)
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/)

  const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s+(.+))?$/gm)]
  assert.ok(actionUses.length > 0)
  for (const [, action, commit, versionComment] of actionUses) {
    assert.match(action, /^[\w.-]+\/[\w.-]+$/)
    assert.match(commit, /^[a-f0-9]{40}$/)
    assert.match(versionComment ?? '', /^v\d/)
  }

  assert.equal(workflow.match(/persist-credentials:\s*false/g)?.length, 2)
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY:\s*'false'/)
  assert.match(workflow, /STAGING-ONLY\.txt/)
  assert.match(workflow, /unsigned=true/)
  assert.match(workflow, /public_release=false/)
  assert.doesNotMatch(workflow, /gh release create|gh release upload|git tag|--publish\s+(?!never)/i)
})

test('Windows staging builds once and tests exact transition bytes', () => {
  assert.equal(workflow.match(/npm run build --workspace apps\/desktop/g)?.length, 1)
  assert.equal(workflow.match(/npm run builder --workspace apps\/desktop/g)?.length, 1)
  assert.match(workflow, /--win nsis --x64 --publish never/)
  assert.match(workflow, /--release/)
  assert.match(workflow, /--require-release/)
  assert.match(workflow, /Hermes-0\.33\.0-dev\.6-win-x64\.exe/)
  assert.match(workflow, /stage-resident-runtime\.mjs/)
  assert.match(workflow, /verify-resident-payload\.mjs/)
  assert.match(workflow, /vi-v0\.32\.1-18/)
  assert.match(workflow, /565e1313162505999238b9c3b4f1422ec37256a1da153bae5149b5795c83c5ac/)
  assert.match(workflow, /windows-staging-lifecycle\.ps1/)
  assert.match(workflow, /-CandidateVersion '0\.33\.0-dev\.6'/)
  assert.doesNotMatch(lifecycle, /0\.33\.0-dev\.\d+/)
  assert.match(lifecycle, /fresh-first-launch/)
  assert.match(lifecycle, /v321ToV33Update/)
  assert.match(lifecycle, /rollbackV32118/)
  assert.doesNotMatch(lifecycle, /\$home\b/i)
  assert.match(workflow, /realGatewayBootstrap,realChatSession,safeToolCall/)
})
