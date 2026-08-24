import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('routine list, legacy pause, and row mutation keep profile and source scope', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'routine-scope-a', profile: 'ops' }
  const calls = []
  const runtime = {
    state: {
      connectionId: { get: () => owner.connectionId },
      profile: { get: () => owner.profile }
    },
    requestProfile: async (route, method, params) => {
      calls.push({ route, method, params })
      if (params.action === 'list') {
        return {
          jobs: [{
            job_id: 'legacy',
            name: '[bot:ops] Audit',
            prompt_preview: 'You are running the scheduled routine "Audit" for agent',
            enabled: true
          }]
        }
      }
      return { success: true }
    }
  }

  const result = await api.loadRoutines(owner.profile, owner, runtime)
  await api.runRoutineAction(result.jobs[0], 'remove', owner.profile, owner, runtime)

  assert.deepEqual(calls.map(call => [call.params.action, call.params.profile]), [
    ['list', owner.profile],
    ['pause', owner.profile],
    ['remove', owner.profile]
  ])
  assert.equal(calls.every(call => call.route.connectionId === owner.connectionId), true)
})

test('routine query identity separates same-named profiles on different sources', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const a = api.routineQueryKey({ connectionId: 'routine-a', profile: 'ops' }, 'ops')
  const b = api.routineQueryKey({ connectionId: 'routine-b', profile: 'ops' }, 'ops')
  const otherProfile = api.routineQueryKey({ connectionId: 'routine-a', profile: 'lead' }, 'lead')

  assert.notDeepEqual(a, b)
  assert.notDeepEqual(a, otherProfile)
  assert.deepEqual(a.slice(-2), ['routine-a', 'ops'])
})
