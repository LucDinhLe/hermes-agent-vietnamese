import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

function atom(value) {
  return { get: () => value, set: next => { value = next } }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('a delayed local avatar render cannot upload to the newly active source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const connectionId = atom('local')
  const profile = atom('lead')
  const calls = []
  const runtime = {
    state: { connectionId, profile },
    request: async (method, params) => { calls.push({ method, params, source: connectionId.get() }) }
  }
  const rendered = deferred()
  const pending = rendered.promise.then(data =>
    api.persistAvatarForOwner('same-name', data, { connectionId: 'local', profile: 'lead' }, runtime)
  )

  connectionId.set('remote-b')
  rendered.resolve('data:image/png;base64,avatar-a')
  assert.equal(await pending, false)
  assert.deepEqual(calls, [])

  connectionId.set('local')
  assert.equal(
    await api.persistAvatarForOwner(
      'same-name',
      'data:image/png;base64,avatar-a',
      { connectionId: 'local', profile: 'lead' },
      runtime
    ),
    true
  )
  assert.equal(calls[0].source, 'local')
})

test('MCP requester keeps one exact route and legacy fallback aborts after A to B switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = { connectionId: 'mcp-a', profile: 'lead' }
  const connectionId = atom(ownerA.connectionId)
  const profile = atom(ownerA.profile)
  const routed = []
  const modern = {
    state: { connectionId, profile },
    request: async () => { throw new Error('ambient request must not run') },
    requestProfile: async (route, method, params) => {
      routed.push({ route, method, params })
      return { ok: true }
    }
  }
  const exact = api.createMcpRequester(modern, ownerA)
  connectionId.set('mcp-b')
  assert.equal((await exact('mcp.servers.set_api_key', { profile: 'same-name' })).ok, true)
  assert.equal(routed[0].route.connectionId, ownerA.connectionId)

  connectionId.set(ownerA.connectionId)
  const gate = deferred()
  const ambient = []
  const legacy = {
    state: { connectionId, profile },
    request: async (method, params) => {
      ambient.push({ source: connectionId.get(), method, params })
      if (method === 'mcp.servers.add') return gate.promise
      return { ok: true }
    }
  }
  const guarded = api.createMcpRequester(legacy, ownerA)
  const first = guarded('mcp.servers.add', { profile: 'same-name' })
  connectionId.set('mcp-b')
  gate.resolve({ ok: true })
  assert.equal((await first).ok, true)
  const second = await guarded('mcp.servers.set_api_key', { profile: 'same-name' })
  assert.equal(second.ok, false)
  assert.equal(second.sourceChanged, true)
  assert.deepEqual(ambient.map(call => call.source), [ownerA.connectionId])
})

test('MCP support probe cache is source-qualified', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const ownerA = { connectionId: 'mcp-support-a', profile: 'lead' }
  const ownerB = { connectionId: 'mcp-support-b', profile: 'lead' }
  const requestA = async () => (calls.push('a'), { ok: false, unsupported: true })
  const requestB = async () => (calls.push('b'), { ok: true, result: {} })

  assert.equal(await api.mcpSetupSupported(requestA, ownerA), false)
  assert.equal(await api.mcpSetupSupported(requestB, ownerB), true)
  assert.deepEqual(calls, ['a', 'b'])
})

test('routine load, pause, and actions are isolated by captured source and profile', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = { connectionId: 'routine-a', profile: 'same-name' }
  const connectionId = atom(ownerA.connectionId)
  const profile = atom(ownerA.profile)
  const listed = deferred()
  const calls = []
  const runtime = {
    state: { connectionId, profile },
    request: async () => { throw new Error('ambient request must not run') },
    requestProfile: async (route, method, params) => {
      calls.push({ route, method, params })
      if (params.action === 'list') return listed.promise
      return { ok: true }
    }
  }
  const pending = api.loadRoutines(ownerA.profile, ownerA, runtime)
  connectionId.set('routine-b')
  listed.resolve({
    jobs: [{
      job_id: 'job-a',
      name: '[bot:same-name] old delegated',
      enabled: true,
      prompt_preview: 'You are running the scheduled routine "old delegated" for agent'
    }]
  })
  const result = await pending

  assert.equal(result.jobs[0].state, 'paused')
  assert.deepEqual(calls.map(call => call.route.connectionId), [ownerA.connectionId, ownerA.connectionId])
  assert.notDeepEqual(
    api.routineQueryKey(ownerA, ownerA.profile),
    api.routineQueryKey({ connectionId: 'routine-b', profile: ownerA.profile }, ownerA.profile)
  )

  await api.runRoutineAction(result.jobs[0], 'remove', ownerA.profile, ownerA, runtime)
  assert.equal(calls.at(-1).route.connectionId, ownerA.connectionId)
})

test('legacy routine action fails closed after source switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = { connectionId: 'routine-legacy-a', profile: 'same-name' }
  const connectionId = atom('routine-legacy-b')
  const profile = atom(ownerA.profile)
  const calls = []
  const runtime = {
    state: { connectionId, profile },
    request: async (...args) => calls.push(args)
  }

  await assert.rejects(
    api.runRoutineAction({ job_id: 'stale-a' }, 'remove', ownerA.profile, ownerA, runtime),
    /routine-legacy-a/
  )
  assert.deepEqual(calls, [])
})

test('embedded core capability widgets require source-scoped SDK support and the exact active owner', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'capability-a', profile: 'default' }
  const connectionId = atom(owner.connectionId)
  const profile = atom(owner.profile)
  const component = () => null
  const legacyRuntime = { state: { connectionId, profile } }
  const multiSourceRuntime = { ...legacyRuntime, connections: async () => ({ connections: [] }) }

  assert.equal(api.agentEmbeddedCapabilitiesAvailable(component, owner, legacyRuntime), true)
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(component, owner, multiSourceRuntime), false)
  multiSourceRuntime.capabilityConnectionScoped = true
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(component, owner, multiSourceRuntime), true)
  connectionId.set('capability-b')
  assert.equal(api.agentEmbeddedCapabilitiesAvailable(component, owner, legacyRuntime), false)
})

test('advanced capability reads use the captured owner route after a same-profile source switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = { connectionId: 'capability-route-a', profile: 'default' }
  const connectionId = atom(owner.connectionId)
  const profile = atom(owner.profile)
  const describe = deferred()
  const calls = []
  const runtime = {
    state: { connectionId, profile },
    request: async () => { throw new Error('ambient request must not run') },
    requestProfile: async (route, method, params) => {
      calls.push({ route, method, params })
      if (method === 'profiles.describe') return describe.promise
      if (method === 'profiles.list') return { bot_mode_protocol: true }
      return { servers: [] }
    }
  }
  const pending = api.loadAdvancedProfileConfig('default', owner, runtime)
  connectionId.set('capability-route-b')
  describe.resolve({ skills: [{ name: 'a-only', enabled: true }] })
  const result = await pending

  assert.equal(result.profile.skills[0].name, 'a-only')
  assert.equal(result.protocolInjected, true)
  assert.deepEqual(calls.map(call => call.route.connectionId), [
    owner.connectionId,
    owner.connectionId,
    owner.connectionId
  ])
})

test('a delayed Create Agent capability catalog cannot paint or apply after its target changes', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = { connectionId: 'catalog-a', profile: 'default' }
  const ownerB = { connectionId: 'catalog-b', profile: 'default' }
  const scopeA = api.agentCapabilityCatalogScopeKey(ownerA, 'default')
  const scopeB = api.agentCapabilityCatalogScopeKey(ownerB, 'default')
  const profileA = deferred()
  let current = { scopeKey: scopeA, generation: 1 }
  const requestA = async method => {
    if (method === 'profiles.describe') return profileA.promise
    return { servers: [{ name: 'a-only-mcp' }] }
  }

  const pendingA = api.loadAgentCapabilityCatalog(
    requestA,
    current,
    'default',
    'default',
    token => api.agentCapabilityCatalogRequestCurrent(token, current)
  )

  current = { scopeKey: scopeB, generation: 2 }
  profileA.resolve({ skills: [{ name: 'a-only-skill', enabled: true }] })
  assert.equal(await pendingA, null)

  const resultB = await api.loadAgentCapabilityCatalog(
    async method =>
      method === 'profiles.describe'
        ? { skills: [{ name: 'b-only-skill', enabled: true }] }
        : { servers: [] },
    current,
    'default',
    'default',
    token => api.agentCapabilityCatalogRequestCurrent(token, current)
  )

  assert.equal(resultB.scopeKey, scopeB)
  assert.deepEqual(resultB.skills.map(skill => skill.name), ['b-only-skill'])
  assert.notEqual(scopeA, scopeB)
})
