import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const EXISTING_SOUL = `# Main agent

I am the default profile on this machine.

## Notes
- Execute directly.
`

const owner = { connectionId: 'protocol-source-a', profile: 'lead' }

function atom(value) {
  return { get: () => value, set: next => { value = next } }
}

test('protocol helpers append once and generated instructions use the live profile command', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const roster = [
    { name: 'default', description: 'main agent' },
    { name: 'researcher', description: 'research specialist' }
  ]
  const once = api.ensureMessagingProtocol(EXISTING_SOUL, 'default', roster)

  assert.equal(api.hasMessagingProtocol(EXISTING_SOUL), false)
  assert.equal(api.hasMessagingProtocol(once), true)
  assert.match(once, /I am the default profile on this machine/)
  assert.match(once, /`researcher` — research specialist/)
  assert.match(once, /hermes profile list/)
  assert.doesNotMatch(once, /hermes profiles list/)
  assert.match(once, /@hermes/)
  assert.doesNotMatch(once, /@default/)
  assert.equal(api.ensureMessagingProtocol(once, 'default', roster), once.trim())

  const generated = api.composeSoul({
    name: 'researcher',
    title: 'Researcher',
    description: 'literature review',
    roster,
    customSoul: ''
  })
  const cloned = api.composeSoul({ name: 'researcher', roster, customSoul: generated })
  assert.equal(cloned.split('## Messaging other agents').length, 2)
})

test('backfill routes describe and configure through exact source descriptors', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const routes = [
    { connectionId: owner.connectionId, profile: 'protocol-missing', targetProfile: 'protocol-missing' },
    { connectionId: owner.connectionId, profile: 'protocol-present', targetProfile: 'protocol-present' }
  ]
  const runtime = {
    profileRoutes: async () => routes,
    request: async () => { throw new Error('ambient request must not be used') },
    requestProfile: async (route, method, payload) => {
      calls.push({ route, method, payload })
      if (method === 'profiles.describe') {
        return payload.name === 'protocol-present'
          ? { soul: '# Existing\n\n## Messaging other agents\n' }
          : { soul: EXISTING_SOUL }
      }
      return { ok: true }
    }
  }

  await api.backfillMessagingProtocol(
    routes.map(route => ({ name: route.targetProfile, connectionId: owner.connectionId })),
    owner,
    { runtime }
  )

  assert.deepEqual(
    calls.filter(call => call.method === 'profiles.describe').map(call => call.payload.name).sort(),
    ['protocol-missing', 'protocol-present']
  )
  const configured = calls.filter(call => call.method === 'profiles.configure')
  assert.equal(configured.length, 1)
  assert.equal(configured[0].payload.name, 'protocol-missing')
  assert.match(configured[0].payload.soul, /## Messaging other agents/)
  assert.equal(configured[0].route.connectionId, owner.connectionId)
})

test('owner-qualified protocol capability suppresses both backfill and create-time append', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  await api.backfillMessagingProtocol(
    [{ name: 'protocol-injected', connectionId: owner.connectionId }],
    owner,
    { protocolInjected: true, runtime: { request: async (...args) => calls.push(args) } }
  )
  assert.equal(calls.length, 0)
  assert.equal(api.ensureMessagingProtocol(EXISTING_SOUL, 'default', [], true), EXISTING_SOUL.trim())

  const draft = {
    slug: 'modern-agent',
    connectionId: owner.connectionId,
    remoteTarget: true,
    route: { connectionId: owner.connectionId, profile: 'lead', targetProfile: 'lead' }
  }
  const injected = await api.agentDraftProtocolInjected(
    { requestProfile: async () => ({ bot_mode_protocol: true }) },
    draft
  )
  const soul = api.composeSoul({ name: draft.slug, title: 'Modern', roster: [], protocolInjected: injected })
  assert.doesNotMatch(soul, /## Messaging other agents/)
})

test('legacy owner-switch abort stays retryable and never configures the new source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const connectionId = atom(owner.connectionId)
  const profile = atom(owner.profile)
  let resolveDescribe
  let first = true
  const calls = []
  const runtime = {
    state: { connectionId, profile },
    request: async (method, payload) => {
      calls.push({ source: connectionId.get(), method, payload })
      if (method === 'profiles.describe' && first) {
        first = false
        return new Promise(resolve => { resolveDescribe = resolve })
      }
      if (method === 'profiles.describe') return { soul: EXISTING_SOUL }
      return { ok: true }
    }
  }
  const roster = [{ name: 'protocol-retry-after-switch', connectionId: owner.connectionId }]
  const pending = api.backfillMessagingProtocol(roster, owner, { runtime })

  await Promise.resolve()
  connectionId.set('protocol-source-b')
  resolveDescribe({ soul: EXISTING_SOUL })
  await pending
  assert.equal(calls.filter(call => call.method === 'profiles.configure').length, 0)

  connectionId.set(owner.connectionId)
  await api.backfillMessagingProtocol(roster, owner, { runtime })
  assert.equal(calls.filter(call => call.method === 'profiles.describe').length, 2)
  assert.equal(calls.filter(call => call.method === 'profiles.configure').length, 1)
  assert.ok(calls.every(call => call.source === owner.connectionId))
})
