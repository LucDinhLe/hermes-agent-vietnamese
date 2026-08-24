import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('description normalization indexes only enabled capability names and nested model data', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const normalized = api.normalizeAgentDescription(
    { name: 'researcher', description: 'Fallback summary' },
    {
      role: 'Research lead',
      description: 'Finds and verifies primary sources',
      model: { default: 'claude-sonnet-4', provider: 'anthropic' },
      skills: [
        { name: 'web-search', enabled: true },
        { name: 'ambiguous-search' },
        { name: 'legacy-search', enabled: false }
      ],
      toolsets: [
        { name: 'browser_tools', label: 'Browser Tools', enabled: true },
        { name: 'unsafe_tools', label: 'Unsafe Tools', enabled: false }
      ],
      mcp_servers: [
        { name: 'calendar', enabled: true },
        { name: 'old-calendar', enabled: false }
      ],
      capabilities: [{ name: 'invented-generic', enabled: true }]
    }
  )

  assert.equal(normalized.role, 'Research lead')
  assert.equal(normalized.description, 'Finds and verifies primary sources')
  assert.equal(normalized.model, 'claude-sonnet-4')
  assert.equal(normalized.provider, 'anthropic')
  assert.deepEqual(normalized.capabilities, ['web-search', 'Browser Tools', 'calendar'])
  assert.ok(normalized.capabilitySearch.includes('browser_tools'))
  assert.ok(!normalized.capabilitySearch.includes('legacy-search'))
  assert.ok(!normalized.capabilitySearch.includes('unsafe_tools'))
  assert.ok(!normalized.capabilitySearch.includes('old-calendar'))
  assert.ok(!normalized.capabilitySearch.includes('ambiguous-search'))
  assert.ok(!normalized.capabilitySearch.includes('invented-generic'))

  const row = { name: 'researcher', ...normalized }
  assert.equal(api.filterAgentCandidates([row], {}, 'browser_tools').length, 1)
  assert.equal(api.filterAgentCandidates([row], {}, 'unsafe_tools').length, 0)
  assert.equal(api.filterAgentCandidates([row], {}, 'claude-sonnet-4').length, 1)
})

test('lazy hydration uses exact source routes, bounds concurrency, caches successes, and tolerates failures', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const roster = [
    { connectionId: 'gateway-a', name: 'lead', remoteSource: false },
    { connectionId: 'local-secondary', connectionKind: 'local', name: 'researcher', remoteSource: true },
    { connectionId: 'gateway-b', connectionKind: 'ssh', name: 'researcher', remoteSource: true },
    { connectionId: 'gateway-b', connectionKind: 'ssh', name: 'writer', remoteSource: true },
    { connectionId: 'offline', connectionKind: 'remote', name: 'critic', remoteSource: true }
  ]
  const routes = roster.slice(1).map(bot => ({
    connectionId: bot.connectionId,
    mode: bot.connectionKind === 'local' ? 'local' : 'remote',
    profile: bot.name,
    targetProfile: bot.connectionId === 'gateway-b' ? `target-${bot.name}` : bot.name
  }))
  const calls = []
  let active = 0
  let maxActive = 0
  const describe = async (source, name) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setImmediate(resolve))
    active -= 1

    if (source === 'offline') {
      throw new Error('offline')
    }

    return {
      description: `${source} ${name}`,
      model: { default: `${source}-model`, provider: 'test-provider' },
      skills: [{ name: `${source}-skill`, enabled: true }],
      toolsets: [],
      mcp_servers: []
    }
  }
  const runtime = {
    profileRoutes: async () => {
      calls.push(['routes'])
      return routes
    },
    request: async (method, params) => {
      calls.push(['active', method, params.name])
      return describe('gateway-a', params.name)
    },
    requestProfile: async (route, method, params) => {
      calls.push(['profile', route, method, params.name])
      return describe(route.connectionId, params.name)
    }
  }
  const cache = new Map()
  const first = await api.hydrateAgentDescriptions(roster, 'gateway-a', runtime, {
    cache,
    concurrency: 2,
    now: () => 1000,
    pending: new Map(),
    ttl: 5000
  })

  assert.equal(maxActive, 2)
  assert.equal(first.outcomes.filter(result => result.status === 'fulfilled').length, 4)
  assert.equal(first.outcomes.filter(result => result.status === 'rejected').length, 1)
  assert.deepEqual(calls[0], ['routes'])
  assert.deepEqual(calls.find(call => call[0] === 'active'), ['active', 'profiles.describe', 'lead'])

  const localCall = calls.find(call => call[0] === 'profile' && call[1].connectionId === 'local-secondary')
  assert.strictEqual(localCall[1], routes[0], 'secondary local source must use the exact SDK route object')
  assert.equal(localCall[2], 'profiles.describe')

  const remoteCall = calls.find(
    call => call[0] === 'profile' && call[1].connectionId === 'gateway-b' && call[3] === 'target-researcher'
  )
  assert.strictEqual(remoteCall[1], routes[1], 'target profile requests must retain the exact SDK route descriptor')
  assert.equal(remoteCall[2], 'profiles.describe')

  const merged = api.mergeAgentDescriptions(roster, cache, 1000)
  const localResearcher = merged.find(bot => bot.connectionId === 'local-secondary')
  const remoteResearcher = merged.find(bot => bot.connectionId === 'gateway-b' && bot.name === 'researcher')
  const offline = merged.find(bot => bot.connectionId === 'offline')

  assert.deepEqual(localResearcher.capabilities, ['local-secondary-skill'])
  assert.deepEqual(remoteResearcher.capabilities, ['gateway-b-skill'])
  assert.equal(offline.capabilities, undefined, 'failed detail reads preserve the thin roster fallback')

  const callCount = calls.length
  await api.hydrateAgentDescriptions(roster.slice(0, 4), 'gateway-a', runtime, {
    cache,
    concurrency: 2,
    now: () => 1001,
    pending: new Map(),
    ttl: 5000
  })
  assert.equal(calls.length, callCount, 'fresh source-qualified cache entries must avoid refetch')
})

test('autocomplete and middleware both prefer the current connection-scoped roster cache', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const scoped = {
    rosterOwner: { connectionId: 'gateway-a', profile: 'default' },
    profiles: [
      { connectionId: 'gateway-a', name: 'default', remoteSource: false },
      {
        connectionId: 'gateway-b',
        connectionLabel: 'Lab',
        handle: 'researcher-lab',
        name: 'researcher',
        remoteSource: true
      }
    ]
  }
  const legacy = { profiles: [{ connectionId: 'legacy', name: 'wrong', remoteSource: false }] }
  const values = new Map([
    [JSON.stringify(['hermes-bots', 'roster', 'gateway-a', 'default']), scoped],
    [JSON.stringify(['hermes-bots', 'roster']), legacy]
  ])
  const client = { getQueryData: key => values.get(JSON.stringify(key)) }
  const live = { connectionId: 'gateway-a', name: 'default' }

  assert.strictEqual(api.cachedRosterSnapshot(client, 'gateway-a'), scoped)
  assert.deepEqual(api.rosterMentionCompletionsFromCache('research', client, 'gateway-a', live, {}), [
    {
      display: '@researcher-lab',
      insert: '@researcher-lab',
      meta: 'Agent · Researcher · Lab'
    }
  ])
  assert.deepEqual(
    api.rosterMentionsFromCache('Please ask @researcher-lab', live, client, 'gateway-a').map(bot => bot.connectionId),
    ['gateway-b']
  )
  assert.strictEqual(api.cachedRosterSnapshot(client, 'missing', ''), legacy)
  assert.equal(api.cachedRosterSnapshot(client, 'missing', 'default'), null)
})

test('same-connection profile switches never reuse a differently owned roster snapshot', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const profileA = {
    profiles: [{ connectionId: 'gateway-a', name: 'only-a' }],
    rosterOwner: { connectionId: 'gateway-a', profile: 'profile-a' }
  }
  const profileB = {
    profiles: [{ connectionId: 'gateway-a', name: 'only-b' }],
    rosterOwner: { connectionId: 'gateway-a', profile: 'profile-b' }
  }
  const values = new Map([
    [JSON.stringify(['hermes-bots', 'roster', 'gateway-a', 'profile-a']), profileA],
    [JSON.stringify(['hermes-bots', 'roster', 'gateway-a', 'profile-b']), profileB],
    [JSON.stringify(['hermes-bots', 'roster', 'gateway-a']), profileA]
  ])
  const client = { getQueryData: key => values.get(JSON.stringify(key)) }

  assert.strictEqual(api.cachedRosterSnapshot(client, 'gateway-a', 'profile-a'), profileA)
  assert.strictEqual(api.cachedRosterSnapshot(client, 'gateway-a', 'profile-b'), profileB)
  assert.equal(api.cachedRosterSnapshot(client, 'gateway-a', 'profile-c'), null)
})
