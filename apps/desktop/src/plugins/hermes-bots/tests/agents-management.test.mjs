import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'
import { host as sdkHost } from './sdk-behavior-stub.mjs'

function requestAtom(initial = 0) {
  let value = initial

  return {
    get: () => value,
    set: next => {
      value = next
    }
  }
}

test('a New Agent command edge is consumed once and does not replay after route remount', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const request = requestAtom()

  assert.equal(api.queueNewAgentRequest(request), 1)
  assert.equal(api.consumeNewAgentRequest(request), true)
  assert.equal(request.get(), 0)
  assert.equal(api.consumeNewAgentRequest(request), false, 'a remount cannot replay the consumed request')

  assert.equal(api.queueNewAgentRequest(request), 1)
  assert.equal(api.consumeNewAgentRequest(request), true, 'a new command still creates a fresh edge')
})

test('Create-on accepts the real SDK registry object and the legacy array shape', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const connections = [
    { id: 'local', kind: 'local', label: 'This device' },
    { id: 'gateway-b', kind: 'ssh', label: 'Gateway B' }
  ]

  assert.strictEqual(api.normalizeAgentConnections(connections), connections)
  assert.strictEqual(api.normalizeAgentConnections({ connections }), connections)
  assert.deepEqual(api.normalizeAgentConnections({ connections: null }), [])
})

test('profile deletion is source-qualified and older SDKs fail closed for remote Agents', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing

  assert.deepEqual(
    api.agentProfileDeleteRoute(
      { connectionId: 'gateway-b', profile: 'lead-b' },
      { deleteProfileConnectionScoped: true }
    ),
    { connectionId: 'gateway-b', profile: 'lead-b' }
  )
  assert.equal(
    api.agentProfileDeleteRoute({ connectionId: 'gateway-b', profile: 'lead-b' }, { deleteProfile: async () => {} }),
    null
  )
  assert.deepEqual(api.agentProfileDeleteRoute({ connectionId: 'local', profile: 'default' }, {}), {
    connectionId: undefined,
    profile: 'default'
  })
  assert.equal(
    api.agentDeleteClearsLegacyMeta(
      { connectionId: 'gateway-b', profile: 'default' },
      { connectionId: 'local', profile: 'default' }
    ),
    false,
    'deleting remote B must preserve same-named local legacy metadata'
  )
  assert.equal(
    api.agentDeleteClearsLegacyMeta(
      { connectionId: 'local', profile: 'default' },
      { connectionId: 'local', profile: 'default' }
    ),
    true
  )
})

test('an explicit local Agent activation fails closed if an older host stays on a remote source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const originalEnsure = sdkHost.ensureAgent
  const originalActiveConnectionId = sdkHost.activeConnectionId
  const calls = []

  try {
    sdkHost.ensureAgent = async (connectionId, profile) => calls.push([connectionId, profile])
    sdkHost.activeConnectionId = () => 'gateway-b'

    await assert.rejects(
      api.prepareBotSource(
        {
          connectionId: 'local',
          connectionLabel: 'This device',
          name: 'researcher',
          remoteSource: false,
          sourceScoped: true
        },
        'local-pin'
      ),
      /Still on gateway-b, not This device/
    )
    assert.deepEqual(calls, [['local', 'researcher']])

    sdkHost.activeConnectionId = () => 'local'
    assert.equal(
      await api.prepareBotSource(
        { connectionId: 'local', name: 'researcher', remoteSource: false, sourceScoped: true },
        'local-pin'
      ),
      'local-pin'
    )

    sdkHost.ensureAgent = async () => {
      throw new Error('unlocalized core activation failure')
    }
    await assert.rejects(
      api.prepareBotSource(
        {
          connectionId: 'gateway-b',
          connectionLabel: 'Studio Mac',
          name: 'researcher',
          remoteSource: true,
          sourceScoped: true
        },
        null
      ),
      /Agent researcher is unavailable on Studio Mac\./
    )
  } finally {
    sdkHost.ensureAgent = originalEnsure
    sdkHost.activeConnectionId = originalActiveConnectionId
  }
})

test('a materialized draft keeps its immutable source and cancel never deletes a same-name profile elsewhere', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const runtime = {
    request: async (method, params) => calls.push({ door: 'active-b', method, params }),
    requestProfile: async (route, method, params) => {
      calls.push({ door: route.connectionId, method, params, route })
      return { code: 0 }
    }
  }
  const states = []
  const draft = api.createAgentDraftProvenance({
    slug: 'researcher',
    activeConnectionId: 'gateway-a',
    activeProfile: 'lead-a',
    targetMode: 'remote'
  })
  const lifecycle = api.createAgentDraftLifecycle({
    cleanup: value => api.requestAgentDraft(runtime, value, 'cli.exec', { argv: ['profile', 'delete', value.slug] }),
    onChange: value => states.push(value)
  })

  assert.equal(await lifecycle.ensure(draft, value => api.requestAgentDraft(runtime, value, 'profiles.create', { name: value.slug })), 'researcher')
  assert.equal(api.agentCreationFieldsLocked(states.at(-1)), true, 'name, target, model, clone, SOUL and auth controls lock')

  // The form may now repaint against B, which already has a real researcher.
  // Cleanup still uses the immutable route captured for A.
  await lifecycle.cancel()

  assert.deepEqual(
    calls.map(call => [call.door, call.method]),
    [
      ['gateway-a', 'profiles.create'],
      ['gateway-a', 'cli.exec']
    ]
  )
  assert.equal(states.at(-1), null)
})

test('cancel during an in-flight create cleans the origin only after the late create resolves', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  let finishCreate
  const runtime = {
    request: async method => calls.push(['active-b', method]),
    requestProfile: async (route, method) => {
      calls.push([route.connectionId, method])
      if (method === 'profiles.create') {
        return new Promise(resolve => {
          finishCreate = resolve
        })
      }
      return { code: 0 }
    }
  }
  const draft = api.createAgentDraftProvenance({
    slug: 'researcher',
    remoteTarget: true,
    targetConnectionId: 'gateway-a',
    targetMode: 'remote'
  })
  const lifecycle = api.createAgentDraftLifecycle({
    cleanup: value => api.requestAgentDraft(runtime, value, 'cli.exec', { argv: ['profile', 'delete', value.slug] })
  })
  const flight = lifecycle.ensure(draft, value => api.requestAgentDraft(runtime, value, 'profiles.create', { name: value.slug }))

  await Promise.resolve()
  await lifecycle.cancel()
  assert.deepEqual(calls, [['gateway-a', 'profiles.create']], 'Cancel cannot delete a pre-existing profile before create succeeds')

  finishCreate({})
  assert.equal(await flight, null)
  assert.deepEqual(calls, [
    ['gateway-a', 'profiles.create'],
    ['gateway-a', 'cli.exec']
  ])
  await lifecycle.cancel()
  assert.equal(calls.length, 2, 'the late draft cannot leak into or poison a later dialog')
})

test('post-create appearance and finalization retain the immutable origin after an active A to B switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const runtime = {
    request: async (method, params) => calls.push({ door: 'active-b', method, params }),
    requestProfile: async (route, method, params) => {
      calls.push({ door: route.connectionId, method, params })
      return {}
    }
  }
  const draftA = api.createAgentDraftProvenance({
    slug: 'researcher',
    activeConnectionId: 'gateway-a',
    activeProfile: 'lead-a',
    remoteTarget: false,
    targetMode: 'remote'
  })

  await api.applyAgentDraftAppearance(runtime, draftA, {
    image: 'data:image/png;base64,abc',
    title: 'Research A'
  })

  assert.deepEqual(calls.map(call => [call.door, call.method]), [
    ['gateway-a', 'profiles.configure'],
    ['gateway-a', 'profiles.set_asset']
  ])
  assert.equal(calls.some(call => call.door === 'active-b'), false)
  assert.deepEqual(api.agentDraftFinalizePlan(draftA, api.normalizeRosterOwner('gateway-b', 'lead-b')), {
    connectionId: 'gateway-a',
    openCanonical: false,
    remotePresentation: true,
    slug: 'researcher'
  })
  assert.equal(
    api.agentDraftFinalizePlan(draftA, api.normalizeRosterOwner('gateway-a', 'lead-a')).openCanonical,
    true,
    'canonical chat creation is allowed only while the exact origin still owns the active door'
  )
})

test('canonical chat guards and in-flight identities are source-qualified across an A to B switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const ownerB = api.normalizeRosterOwner('gateway-b', 'lead-b')
  let current = ownerA
  const runtime = {
    activeConnectionId: () => current.connectionId,
    state: {
      connectionId: { get: () => current.connectionId },
      profile: { get: () => current.profile }
    }
  }

  assert.equal(api.canonicalCreationKey('researcher', ownerA), 'gateway-a::lead-a::researcher')
  assert.equal(api.canonicalCreationKey('researcher', ownerB), 'gateway-b::lead-b::researcher')
  assert.notEqual(api.canonicalCreationKey('researcher', ownerA), api.canonicalCreationKey('researcher', ownerB))
  assert.equal(api.rosterOwnerStillActive(ownerA, runtime), true)

  current = ownerB
  assert.equal(api.rosterOwnerStillActive(ownerA, runtime), false)
  assert.equal(api.rosterOwnerStillActive(ownerB, runtime), true)
})

test('remote canonical chat creation deduplicates per source and persists the new pin on that source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  let finishCreate
  const runtime = {
    requestProfile: async (route, method, params) => {
      calls.push({ connectionId: route.connectionId, method, params })
      if (method === 'profiles.list') {
        return { profiles: [{ name: 'researcher', ui_meta: { 'hermes-bots': { title: 'Remote A' } } }] }
      }
      if (method === 'session.resume') {
        throw new Error('missing')
      }
      if (method === 'session.create') {
        return new Promise(resolve => {
          finishCreate = resolve
        })
      }
      return { applied: { ui_meta: true } }
    }
  }
  const routeA = { connectionId: 'gateway-a', mode: 'remote', profile: 'researcher', targetProfile: 'researcher' }
  const first = api.ensureRemoteCanonicalChat(routeA, 'researcher', runtime)
  const duplicate = api.ensureRemoteCanonicalChat(routeA, 'researcher', runtime)

  assert.strictEqual(first, duplicate)
  while (!finishCreate) {
    await new Promise(resolve => setImmediate(resolve))
  }
  finishCreate({ session_id: 'runtime-a', stored_session_id: 'stored-a' })
  assert.deepEqual(await first, { runtime: 'runtime-a', stored: 'stored-a' })
  assert.equal(calls.filter(call => call.method === 'session.create').length, 1)
  const pin = calls.find(call => call.method === 'profiles.configure')
  assert.equal(pin.connectionId, 'gateway-a')
  assert.equal(pin.params.ui_meta['hermes-bots'].chat, 'stored-a')
  assert.equal(pin.params.ui_meta['hermes-bots'].title, 'Remote A')
})

test('remote canonical delivery survives unsupported pin writes and never overwrites unreadable metadata', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const route = connectionId => ({ connectionId, mode: 'remote', profile: 'researcher', targetProfile: 'researcher' })
  const unreadable = {
    requestProfile: async (target, method, params) => {
      calls.push([target.connectionId, method, params])
      if (method === 'profiles.list') {
        throw new Error('offline metadata')
      }
      if (method === 'session.resume') {
        return { session_id: 'runtime-old', session_key: 'stored-old' }
      }
      throw new Error('profiles.configure must not run without authoritative metadata')
    }
  }

  assert.deepEqual(
    await api.ensureRemoteCanonicalChat(route('gateway-unreadable'), 'researcher', unreadable),
    { runtime: 'runtime-old', stored: 'stored-old' }
  )
  assert.equal(calls.some(([, method]) => method === 'profiles.configure'), false)

  const unsupported = {
    requestProfile: async (_target, method, params) => {
      if (method === 'profiles.list') {
        return { profiles: [{ name: 'researcher', ui_meta: { 'hermes-bots': { title: 'Keep me' } } }] }
      }
      if (method === 'session.resume') {
        return { session_id: 'runtime-new', session_key: 'stored-new' }
      }
      if (method === 'profiles.configure') {
        assert.equal(params.ui_meta['hermes-bots'].title, 'Keep me')
        throw new Error('old gateway')
      }
      return {}
    }
  }

  assert.deepEqual(
    await api.ensureRemoteCanonicalChat(route('gateway-old'), 'researcher', unsupported),
    { runtime: 'runtime-new', stored: 'stored-new' },
    'pin failure is best-effort and must not block the message session'
  )
})

test('remote create MCP setup is unavailable and cannot call the active gateway', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  let activeMcpCalls = 0
  const beginSetup = () => {
    if (api.agentMcpSetupAvailable(true)) {
      activeMcpCalls += 1
    }
  }

  beginSetup()
  assert.equal(api.agentMcpSetupAvailable(false), true)
  assert.equal(activeMcpCalls, 0)
})

test('profile actions are view-only for remote rows and stale local dialogs fail closed after a source switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const ownerB = api.normalizeRosterOwner('gateway-b', 'lead-b')
  const remoteB = { name: 'researcher', connectionId: 'gateway-b', remoteSource: true }
  const localA = { name: 'researcher', remoteSource: false }
  let edits = 0
  let deletes = 0

  assert.equal(api.captureAgentProfileAction(remoteB, ownerA), null)
  assert.equal(api.invokeAgentProfileAction(remoteB, () => (edits += 1), ownerA), false)

  const capturedA = api.captureAgentProfileAction(localA, ownerA)
  assert.equal(api.invokeAgentProfileAction(capturedA, () => (edits += 1), ownerA), true)
  assert.equal(api.invokeAgentProfileAction(capturedA, () => (deletes += 1), ownerB), false)
  assert.equal(edits, 1)
  assert.equal(deletes, 0, 'a deferred Delete/Edit confirmation from A cannot mutate same-name B')
})

test('group members are stamped from the exact roster owner and never replay source-less history through active B', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const activeRowsAfterUnionFailure = [
    { name: 'researcher', remoteSource: false },
    { name: 'writer', remoteSource: false }
  ]
  const remoteB = { name: 'researcher', connectionId: 'gateway-b', remoteSource: true }
  const durable = api.durableGroupChatMembers(activeRowsAfterUnionFailure, ownerA)
  const calls = []
  const runtime = {
    request: async (method, params) => calls.push(['active-b', method, params]),
    requestProfile: async (route, method, params) => calls.push([route.connectionId, method, params])
  }

  assert.deepEqual(durable.map(member => member.connectionId), ['gateway-a', 'gateway-a'])
  await api.requestForBot(durable[0], 'prompt.submit', { text: 'room transcript' }, runtime)
  assert.equal(calls[0][0], 'gateway-a')

  await assert.rejects(
    api.requestForBot({ name: 'researcher', remoteSource: true }, 'prompt.submit', { text: 'private A room' }, runtime),
    /unavailable on/i
  )
  assert.equal(calls.some(call => call[0] === 'active-b'), false)
  assert.equal(api.groupChatEligibleBots([activeRowsAfterUnionFailure[0], remoteB], ownerA).length, 2)
})

test('durable group identities are authoritative over same-name metadata after A to B switch', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const durableA = {
    name: 'researcher',
    connectionId: 'gateway-a',
    remoteSource: true,
    sourceScoped: true
  }
  const activeB = { name: 'researcher', connectionId: 'gateway-b', remoteSource: false, sourceScoped: true }
  const seated = api.groupChatMemberBots(
    'private-a-room',
    [activeB, durableA],
    { researcher: { groups: ['private-a-room'] } },
    { 'private-a-room': { members: [durableA] } }
  )

  assert.deepEqual(seated.map(member => member.connectionId), ['gateway-a'])
})

test('disband cleanup removes group metadata through every durable member source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const calls = []
  const runtime = {
    request: async (method, params) => calls.push({ connectionId: 'active-b', method, params }),
    requestProfile: async (route, method, params) => {
      calls.push({ connectionId: route.connectionId, method, params })
      if (method === 'profiles.list') {
        return {
          profiles: [
            {
              name: 'researcher',
              ui_meta: { 'hermes-bots': { title: `Research ${route.connectionId}`, groups: ['private', 'keep'] } }
            }
          ]
        }
      }

      return { applied: { ui_meta: true } }
    }
  }

  for (const connectionId of ['gateway-a', 'local']) {
    assert.equal(
      await api.updateDurableGroupMembership(
        { name: 'researcher', connectionId, remoteSource: true, sourceScoped: true },
        'private',
        false,
        runtime
      ),
      true
    )
  }

  assert.equal(calls.some(call => call.connectionId === 'active-b'), false)
  const writes = calls.filter(call => call.method === 'profiles.configure')
  assert.deepEqual(writes.map(call => call.connectionId), ['gateway-a', 'local'])
  assert.deepEqual(
    writes.map(call => call.params.ui_meta['hermes-bots'].groups),
    [['keep'], ['keep']]
  )
})

test('source-qualified row metadata never falls back to another source while legacy local metadata still hydrates', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const cachedA = {
    researcher: {
      title: 'Researcher on A',
      hidden: true,
      pinned: true,
      groups: ['private-a-room']
    }
  }
  const ownerA = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const ownerB = api.normalizeRosterOwner('gateway-b', 'lead-b')
  const localOwner = api.normalizeRosterOwner('local', 'lead-local')
  const richB = {
    name: 'researcher',
    connectionId: 'gateway-b',
    connectionKind: 'remote',
    sourceScoped: true,
    ui_meta: {
      'hermes-bots': {
        title: 'Researcher on B',
        hidden: false,
        pinned: false,
        groups: ['b-room']
      }
    }
  }

  assert.deepEqual(
    api.botRosterMeta(richB, cachedA, ownerB, ownerA),
    richB.ui_meta['hermes-bots'],
    'B renders its own row-level server metadata'
  )
  assert.equal(
    api.botRosterMeta({ ...richB, ui_meta: undefined }, cachedA, ownerB, ownerA),
    null,
    'B defaults instead of borrowing A when its server has no metadata'
  )
  assert.equal(
    api.botRosterMeta(
      { name: 'researcher', connectionId: 'gateway-a', remoteSource: true },
      cachedA,
      ownerB,
      ownerA
    ),
    null,
    'a thin A row cannot expose the bare-name cache either'
  )
  assert.deepEqual(
    api.botRosterMeta({ name: 'researcher', connectionId: 'local', connectionKind: 'local' }, cachedA, localOwner, localOwner),
    cachedA.researcher,
    'legacy metadata remains available under its exact explicit local owner'
  )
})

test('per-session lead and collaborator statuses are visible and localized without inventing activity', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const translate = locale => key => key.split('.').reduce((value, part) => value?.[part], api.AGENT_LOCALES[locale])

  assert.deepEqual(api.sessionAgentStatusPresentation('lead', { runtimeSessionId: 'runtime-a', busy: true }, translate('en')), {
    active: true,
    aria: 'active',
    text: 'active'
  })
  assert.equal(api.sessionAgentStatusPresentation('lead', { runtimeSessionId: 'runtime-a', busy: false }, translate('en')).text, 'ready')
  assert.equal(api.sessionAgentStatusPresentation('collaborator', {}, translate('en')).text, 'Invited · waiting for a task')
  assert.equal(api.sessionAgentStatusPresentation('lead', { runtimeSessionId: 'runtime-a', busy: false }, translate('vi')).text, 'sẵn sàng')
  assert.equal(api.sessionAgentStatusPresentation('collaborator', {}, translate('vi')).aria, 'Đã mời · chờ giao việc')
})
