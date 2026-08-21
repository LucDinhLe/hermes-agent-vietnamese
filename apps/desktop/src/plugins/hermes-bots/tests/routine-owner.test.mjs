import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('routine creation keeps its captured owner while another bot becomes active', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const captured = { bot: 'ops', rosterOwner: { connectionId: 'source-a', profile: 'ops' } }

  assert.equal(api.routineCreateTarget(captured, 'default'), 'ops')
  assert.equal(api.routineCreateTarget('ops', 'default'), 'ops')
  assert.equal(api.routineCreateTarget(null, 'default'), 'default')
  assert.equal(api.routineOwnerKey(captured.rosterOwner, captured.bot), 'source-a::ops')
})

test('captured routine action routes to its immutable owner after the UI switches', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'source-a', profile: 'ops' }
  const active = { connectionId: 'source-b', profile: 'ops' }
  const calls = []
  const runtime = {
    state: {
      connectionId: { get: () => active.connectionId },
      profile: { get: () => active.profile }
    },
    requestProfile: async (route, method, params) => {
      calls.push({ route, method, params })
      return { success: true }
    },
    request: async () => { throw new Error('ambient source must not be used') }
  }

  await api.runRoutineAction({ job_id: 'job-a' }, 'pause', owner.profile, owner, runtime)
  assert.deepEqual(calls.map(call => ({ source: call.route.connectionId, action: call.params.action })), [
    { source: owner.connectionId, action: 'pause' }
  ])
})

test('legacy routine action refuses a stale owner instead of mutating the active source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const runtime = {
    state: {
      connectionId: { get: () => 'source-b' },
      profile: { get: () => 'ops' }
    },
    request: async (...args) => calls.push(args)
  }

  await assert.rejects(
    api.runRoutineAction(
      { job_id: 'job-a' },
      'remove',
      'ops',
      { connectionId: 'source-a', profile: 'ops' },
      runtime
    ),
    /source-a/
  )
  assert.deepEqual(calls, [])
})
