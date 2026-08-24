import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const LEGACY_PREFIX = 'You are running the scheduled routine "'
const owner = { connectionId: 'routine-pause-source', profile: 'research' }

function runtimeFor(handler) {
  return {
    state: {
      connectionId: { get: () => owner.connectionId },
      profile: { get: () => owner.profile }
    },
    requestProfile: (route, method, params) => handler(route, method, params)
  }
}

test('a failed legacy-routine pause does not fail the routines list', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const jobs = [
    { job_id: 'legacy-fails', name: '[bot:research] Audit', prompt_preview: `${LEGACY_PREFIX}Audit" for agent 'research'`, enabled: true, state: 'scheduled' },
    { job_id: 'legacy-pauses', name: '[bot:research] Build', prompt_preview: `${LEGACY_PREFIX}Build" for agent 'research'`, enabled: true, state: 'scheduled' },
    { job_id: 'normal', name: '[bot:research] Report', prompt: 'Summarize the day', enabled: true, state: 'scheduled' }
  ]
  const requests = []
  const runtime = runtimeFor(async (route, method, params) => {
    requests.push({ route, method, params })
    if (params.action === 'list') return { jobs }
    if (params.name === 'legacy-fails') throw new Error('gateway rejected the pause')
    return { success: true }
  })

  const result = await api.loadRoutines(owner.profile, owner, runtime)
  const byId = Object.fromEntries(result.jobs.map(job => [job.job_id, job]))
  assert.equal(byId['legacy-fails'].enabled, true)
  assert.equal(byId['legacy-fails'].state, 'scheduled')
  assert.equal(byId['legacy-pauses'].enabled, false)
  assert.equal(byId['legacy-pauses'].state, 'paused')
  assert.equal(byId.normal.enabled, true)
  assert.deepEqual(requests.map(call => [call.params.action, call.params.name]), [
    ['list', undefined],
    ['pause', 'legacy-fails'],
    ['pause', 'legacy-pauses']
  ])
  assert.equal(requests.every(call => call.route.connectionId === owner.connectionId), true)
})

test('all pauses failing still resolves with the list', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const runtime = runtimeFor(async (route, method, params) => {
    if (params.action === 'list') {
      return {
        jobs: [{
          job_id: 'only',
          name: '[bot:research] Watch',
          prompt_preview: `${LEGACY_PREFIX}Watch" for agent 'research'`,
          enabled: true,
          state: 'scheduled'
        }]
      }
    }
    throw new Error('gateway down')
  })

  const result = await api.loadRoutines(owner.profile, owner, runtime)
  assert.equal(result.jobs[0].job_id, 'only')
  assert.equal(result.jobs[0].enabled, true)
})
