import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const owner = { connectionId: 'routine-prompt-source', profile: 'research' }

function runtimeFor(requestProfile) {
  return {
    state: {
      connectionId: { get: () => owner.connectionId },
      profile: { get: () => owner.profile }
    },
    requestProfile
  }
}

test('unit: direct execution is selected for the active bot profile', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  assert.equal(api.routinePrompt('default', 'Health', 'Collect status', ' DEFAULT '), 'Collect status')
})

test('integration: a different active profile retains the delegated routine wrapper', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const prompt = api.routinePrompt('research', 'Digest', 'Summarize findings', 'default')
  assert.match(prompt, /hermes -p 'research' chat/)
  assert.match(prompt, /\[Scheduled routine\] Summarize findings/)
})

test('security: delegated routine arguments remain literal shell values', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const title = 'Audit $(printf TITLE_EXPANDED) `printf TITLE_TICK` \'quoted\''
  const instruction = 'Line one $(printf TASK_EXPANDED) `printf TASK_TICK`\nLine two \'quoted\''
  const prompt = api.routinePrompt('research', title, instruction, 'default')
  const command = prompt.slice(prompt.indexOf('hermes '), prompt.lastIndexOf('\n\nIf the command'))
  const script = `hermes() { printf '%s\\037' "$@"; }\n${command}`
  const result = spawnSync('sh', ['-c', script], { encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.split('\x1f').slice(0, -1), [
    '-p',
    'research',
    'chat',
    '-c',
    `Routine: ${title}`,
    '-q',
    `[Scheduled routine] ${instruction}`
  ])
})

test('security: upgrade pauses persisted delegated routines before they can execute', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const oldPrompt = 'You are running the scheduled routine "Audit" for agent \'research\'. Execute it.'
  const persisted = {
    job_id: 'legacy-job',
    name: '[bot:research] Audit',
    prompt: oldPrompt,
    prompt_preview: oldPrompt,
    schedule: 'every 2h',
    enabled: true,
    state: 'scheduled',
    repeat: { times: 3, completed: 1 }
  }
  const requests = []
  const runtime = runtimeFor(async (route, method, params) => {
    requests.push({ route, method, params })
    if (params.action === 'list') return { jobs: [persisted] }
    if (params.action === 'pause') return { success: true }
    throw new Error('unexpected action')
  })

  const result = await api.loadRoutines(owner.profile, owner, runtime)
  assert.deepEqual(requests.map(call => [call.params.action, call.params.name]), [
    ['list', undefined],
    ['pause', 'legacy-job']
  ])
  assert.equal(result.jobs[0].enabled, false)
  assert.equal(result.jobs[0].state, 'paused')
  assert.deepEqual(result.jobs[0].repeat, persisted.repeat)
  assert.equal(requests.every(call => call.route.connectionId === owner.connectionId), true)

  const recreated = api.routinePrompt('research', 'Audit', 'Inspect', 'default')
  assert.equal(api.isLegacyDelegatedRoutine({ ...persisted, prompt_preview: recreated.slice(0, 100) }), false)
})

test('robustness: routine input rejects NUL before cron creation', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  assert.equal(api.routineInputError('Normal title', 'Normal instruction'), null)
  assert.match(api.routineInputError('Bad\0title', 'Normal instruction'), /NUL.*U\+0000/)
  assert.match(api.routineInputError('Normal title', 'Bad\0instruction'), /NUL.*U\+0000/)
})

test('regression: the captured active profile selects direct routine execution', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const instruction = 'Keep "quoted" output intact'
  assert.equal(api.routinePrompt('ops', 'Check', instruction, 'ops'), instruction)
  assert.doesNotMatch(api.routinePrompt('ops', 'Check', instruction, 'ops'), /hermes -p/)
})

test('system: Agent palette entries exist only when the management route exists', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const navigated = []
  let queued = 0
  const entries = api.createAgentPaletteContributions({
    routeAvailable: true,
    navigate: path => navigated.push(path),
    queueNew: () => { queued += 1 },
    text: key => key
  })

  assert.deepEqual(entries.map(entry => entry.id), ['manage-agents', 'new-agent'])
  entries[0].data.run()
  entries[1].data.run()
  assert.deepEqual(navigated, ['/agent-profiles', '/agent-profiles'])
  assert.equal(queued, 1)
  assert.deepEqual(api.createAgentPaletteContributions({ routeAvailable: false }), [])
})

test('performance: direct prompt selection remains bounded', async t => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const start = Date.now()
  for (let index = 0; index < 10000; index += 1) api.routinePrompt('ops', 'Check', 'Inspect', 'ops')
  const elapsed = Date.now() - start
  t.diagnostic(`10,000 direct prompt selections: ${elapsed} ms`)
  assert.ok(elapsed < 1000)
})
