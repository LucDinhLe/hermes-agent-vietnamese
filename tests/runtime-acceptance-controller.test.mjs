import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const contract = JSON.parse(fs.readFileSync(path.join(root, 'acceptance', 'v33-dev8.json'), 'utf8'))
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'accept-v33-runtime.yml'), 'utf8')
const orchestrator = fs.readFileSync(
  path.join(root, 'acceptance', 'run-windows-upstream-runtime-acceptance.ps1'),
  'utf8'
)
const acceptance = fs.readFileSync(
  path.join(root, 'acceptance', 'v33-upstream-runtime-acceptance.spec.ts'),
  'utf8'
)

test('runtime controller locks the exact immutable dev.8 candidate', () => {
  assert.equal(contract.candidate.version, '0.33.0-dev.8')
  assert.equal(contract.candidate.commit, '4900ba42fc017fd83f4a3d661609197bbe085d7e')
  assert.equal(contract.candidate.runId, 33246486251)
  assert.equal(contract.candidate.artifactId, 9713159738)
  assert.equal(contract.candidate.installerSize, 118674409)
  assert.equal(
    contract.candidate.installerSha256,
    'eef693acd664b08f581a107e38cbe30dd141319971053760636da5218e7afffc'
  )
  assert.equal(contract.engine.tag, 'v2026.8.27')
  assert.equal(contract.engine.commit, '5fc308a70719a83cccdbba4c0e39c23f5a8239d5')
})

test('workflow downloads the candidate and never builds or publishes product bytes', () => {
  assert.match(workflow, /gh run download/)
  assert.match(workflow, /candidate SHA-256 mismatch/)
  assert.match(workflow, /runs-on: windows-2025/)
  assert.match(workflow, /permissions:\s*\n\s*actions: read\s*\n\s*contents: read/)
  assert.doesNotMatch(workflow, /npm run (?:build|builder|dist|pack)/)
  assert.doesNotMatch(workflow, /gh release|git tag|npm publish/)
  assert.doesNotMatch(workflow, /write-all|contents: write|packages: write/)
})

test('controller permits network bootstrap but does not patch or replace upstream runtime', () => {
  assert.match(orchestrator, /raw\.githubusercontent\.com\/NousResearch\/hermes-agent\/\$EngineCommit\/scripts\/install\.ps1/)
  assert.match(orchestrator, /RUNNER_ENVIRONMENT -eq 'github-hosted'/)
  assert.match(orchestrator, /HERMES_ACCEPTANCE_NETWORK_ALLOWED = '1'/)
  assert.doesNotMatch(orchestrator, /New-NetFirewallRule|Set-NetFirewallProfile|Disable-NetAdapter/)

  assert.match(acceptance, /completeInstalledStartup\(active, 1_500_000/)
  assert.match(acceptance, /HERMES_TUI_TOOLSETS: 'todo'/)
  assert.match(acceptance, /upstreamRuntimeProvenance/)
  assert.match(acceptance, /provider: 'loopback-mock'/)
  assert.doesNotMatch(acceptance, /agent-payload|HOTFIX_RUNTIME_PATHS|HERMES_DESKTOP_BUNDLED/)
})

test('acceptance proves chat, safe tool execution, and persisted relaunch without call-count policy', () => {
  assert.match(acceptance, /SIMPLE_PROMPT = 'Chào em'/)
  assert.match(acceptance, /TOOL_TRIGGER = 'Thực hiện kiểm thử nhiều bước E2E_INTERIM_TRIGGER/)
  assert.match(acceptance, /INTERIM_TEXTS\.finalText/)
  assert.match(acceptance, /safeToolCall/)
  assert.match(acceptance, /persistedRelaunch/)
  assert.match(acceptance, /simpleModelCalls >= 1/)
  assert.doesNotMatch(acceptance, /simpleModelCalls === 1/)
})
