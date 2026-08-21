import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('legacy SDK without optional exports imports the single-file plugin', async () => {
  const loaded = await loadHermesBotsPlugin()

  assert.equal(loaded.default.id, 'hermes-bots')
  assert.equal(loaded.default.name, 'Agents')
  assert.equal(loaded.default.description(), 'Create and manage Agent profiles, capabilities, groups, and routines.')
  assert.equal(typeof loaded.default.register, 'function')
})

test('optional Agent surfaces register only when their SDK areas exist', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const registered = []
  const ctx = { register: contribution => registered.push(contribution) }

  assert.deepEqual(api.registerAgentSurfaces(ctx, {}), [])
  assert.deepEqual(registered, [])

  assert.deepEqual(
    api.registerAgentSurfaces(ctx, {
      ROUTES_AREA: 'routes',
      SESSION_AGENTS_AREA: 'chat.session-agents'
    }),
    ['session-control', 'management-page']
  )
  assert.deepEqual(
    registered.map(({ area, id }) => [area, id]),
    [
      ['chat.session-agents', 'session-control'],
      ['routes', 'management-page']
    ]
  )
})
