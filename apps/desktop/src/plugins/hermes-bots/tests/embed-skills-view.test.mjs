import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

function atom(value) {
  return { get: () => value, set: next => { value = next } }
}

test('embedded capabilities are available only on an exact single-source owner', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'local', profile: 'researcher' }
  const connectionId = atom(owner.connectionId)
  const profile = atom(owner.profile)
  const SkillsView = () => null
  const legacy = { state: { connectionId, profile } }

  assert.equal(api.agentEmbeddedCapabilitiesAvailable(SkillsView, owner, legacy), true)
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(undefined, owner, legacy), false)
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(SkillsView, owner, legacy, true), false)

  connectionId.set('remote-b')
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(SkillsView, owner, legacy), false)
})

test('multi-source SDK enables embedded widgets only when immutable capability scoping is advertised', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'remote-a', profile: 'default' }
  const runtime = {
    connections: async () => ({ connections: [{ id: 'remote-a' }, { id: 'remote-b' }] }),
    state: {
      connectionId: { get: () => owner.connectionId },
      profile: { get: () => owner.profile }
    }
  }

  assert.equal(api.agentEmbeddedCapabilitiesAvailable(() => null, owner, runtime), false)
  runtime.capabilityConnectionScoped = true
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(() => null, owner, runtime), true)
  assert.equal(api.agentMcpSetupAvailable(false), true, 'the routed legacy capability setup remains available')
})
