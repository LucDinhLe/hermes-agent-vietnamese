import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '..', '..', '..')
const communityRepo = 'LucDinhLe/hermes-agent-vietnamese'
const upstreamRepo = 'NousResearch/hermes-agent'

const distributionFiles = [
  'apps/desktop/electron/bootstrap-runner.ts',
  'scripts/install.ps1',
  'scripts/install.sh',
  'hermes_cli/update_cmd.py',
  'hermes_cli/banner.py'
]

test('community installers and update paths use the Vietnamese repository', () => {
  for (const relativePath of distributionFiles) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    assert.match(source, new RegExp(communityRepo.replace('/', '\\/')))
  }
})

test('fresh-install entry points do not download source from upstream', () => {
  const entryPoints = [
    'apps/desktop/electron/bootstrap-runner.ts',
    'scripts/install.ps1',
    'scripts/install.sh'
  ]

  for (const relativePath of entryPoints) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, new RegExp(upstreamRepo.replace('/', '\\/')))
  }
})

test('upstream contributor bookkeeping stays disabled in community forks', () => {
  const workflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /github\.repository == 'NousResearch\/hermes-agent'/)
})
