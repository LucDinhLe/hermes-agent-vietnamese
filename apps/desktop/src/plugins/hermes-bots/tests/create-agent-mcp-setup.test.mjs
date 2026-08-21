import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('Create Agent shares one lazy materialization and exposes its slug to local MCP setup', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const draft = api.createAgentDraftProvenance({
    slug: 'researcher',
    activeConnectionId: 'local',
    activeProfile: 'default',
    targetMode: 'local'
  })
  let creates = 0
  let finish
  const lifecycle = api.createAgentDraftLifecycle()
  const create = () => {
    creates += 1
    return new Promise(resolve => {
      finish = resolve
    })
  }
  const first = lifecycle.ensure(draft, create)
  const second = lifecycle.ensure(draft, create)

  assert.strictEqual(second, first)
  assert.equal(api.agentMcpSetupAvailable(false), true)
  await Promise.resolve()
  finish({})
  assert.equal(await first, 'researcher')
  assert.equal(creates, 1)
})

test('remote-target MCP setup stays disabled because its legacy RPC door is active-source scoped', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing

  assert.equal(api.agentMcpSetupAvailable(true), false)
})
