import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const clone = value => JSON.parse(JSON.stringify(value))

test('malformed legacy or future collaboration data normalizes to an empty additive store', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing

  assert.deepEqual(clone(api.normalizeCollaborationMemberships(null)), clone(api.emptyCollaborationMemberships()))
  assert.deepEqual(
    clone(
      api.normalizeCollaborationMemberships({
        projects: [],
        sessions: {
          nope: 'not-an-array',
          invalid: [{ profile: '../escape' }, null, { profile: '' }],
          sourceLess: [{ profile: 'researcher' }]
        }
      })
    ),
    clone(api.emptyCollaborationMemberships())
  )

  const future = api.normalizeCollaborationMemberships({
    schemaVersion: 7,
    futureRootField: { keep: true },
    projects: {},
    sessions: {}
  })
  assert.equal(future.schemaVersion, 7, 'normalization must not silently downgrade a future additive store')
  assert.deepEqual(future.futureRootField, { keep: true })

  const futureUpdate = api.updateCollaborationMembership(
    future,
    {
      leadConnectionId: 'gateway-a',
      leadProfile: 'lead',
      runtimeSessionId: 'runtime-1',
      projectKey: ''
    },
    'session',
    { connectionId: 'gateway-a', profile: 'writer' },
    true,
    'gateway-a'
  )
  assert.equal(futureUpdate.store.schemaVersion, 7)
  assert.equal(futureUpdate.changed, false, 'an older build must fail closed instead of rewriting a future schema')
  assert.deepEqual(futureUpdate.store.futureRootField, { keep: true })
})

test('late collaboration hydration unions live invitations and never clobbers them', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surface = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'lead',
    storedSessionId: 'stored-1'
  }
  const stored = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    surface,
    'session',
    { connectionId: 'gateway-b', profile: 'researcher' },
    true,
    'gateway-a'
  ).store
  const live = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    surface,
    'session',
    { connectionId: 'gateway-c', profile: 'writer' },
    true,
    'gateway-a'
  ).store
  const merged = api.mergeCollaborationMemberships(stored, live)

  assert.deepEqual(
    api.collaborationMembersInScope(merged, surface, 'session', 'gateway-a')
      .map(member => api.collaborationMemberKey(member))
      .sort(),
    ['gateway-b::researcher', 'gateway-c::writer']
  )
})

test('session and project membership merge without collapsing source-qualified Agents', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surface = {
    leadProfile: 'lead',
    leadConnectionId: 'gateway-a',
    storedSessionId: 'session-1',
    projectKey: 'C:\\work\\hermes\\',
    projectResolutionKnown: true
  }
  const projectKey = api.collaborationScopeKey('project', surface, 'gateway-a')
  const sessionKey = api.collaborationScopeKey('session', surface, 'gateway-a')
  const shared = { connectionId: 'gateway-a', profile: 'researcher', invitedAt: 1, role: 'collaborator' }
  const sameProfileOtherSource = {
    connectionId: 'gateway-c',
    profile: 'researcher',
    invitedAt: 2,
    role: 'collaborator'
  }
  const writer = { connectionId: 'gateway-a', profile: 'writer', invitedAt: 3, role: 'collaborator' }
  const store = {
    schemaVersion: 1,
    projects: { [projectKey]: [shared, writer] },
    sessions: { [sessionKey]: [shared, sameProfileOtherSource] }
  }
  const members = clone(api.collaborationMembersForSurface(store, surface, 'gateway-a'))

  assert.equal(projectKey, 'project:gateway-a:lead:C:/work/hermes')
  assert.equal(sessionKey, 'session:gateway-a:lead:session-1')
  assert.equal(members.length, 3)
  assert.deepEqual(
    members.map(member => [member.connectionId, member.profile, member.scopes]).sort(),
    [
      ['gateway-a', 'researcher', ['project', 'session']],
      ['gateway-a', 'writer', ['project']],
      ['gateway-c', 'researcher', ['session']]
    ]
  )
})

test('membership reducer is scope-local and cannot replace the lead Agent', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surface = {
    leadProfile: 'lead',
    leadConnectionId: 'gateway-a',
    runtimeSessionId: 'runtime-1',
    projectKey: 'C:/work/hermes'
  }
  let store = api.emptyCollaborationMemberships()

  const update = (scope, profile, present, connectionId = 'gateway-a') => {
    const result = api.updateCollaborationMembership(
      store,
      surface,
      scope,
      { connectionId, profile, invitedAt: 1, role: 'collaborator' },
      present,
      'gateway-a'
    )
    store = result.store
    return result.changed
  }

  assert.equal(update('project', 'researcher', true), true)
  assert.equal(update('session', 'researcher', true), true)
  assert.equal(update('session', 'writer', true), true)
  assert.equal(update('session', 'researcher', false), true)

  const projectKey = api.collaborationScopeKey('project', surface, 'gateway-a')
  const sessionKey = api.collaborationScopeKey('session', surface, 'gateway-a')

  assert.deepEqual(store.projects[projectKey].map(member => member.profile), ['researcher'])
  assert.deepEqual(store.sessions[sessionKey].map(member => member.profile), ['writer'])

  const beforeLeadAttempt = clone(store)
  assert.equal(update('session', 'lead', true), false)
  assert.deepEqual(clone(store), beforeLeadAttempt)
  assert.equal(api.collaborationMemberForBot({ name: 'researcher', remoteSource: true }), null)
})

test('a fresh runtime-session invite migrates to the durable session id without orphaning or reload loss', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const draft = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'lead',
    runtimeSessionId: 'runtime-fresh',
    storedSessionId: null,
    projectKey: ''
  }
  const member = { connectionId: 'gateway-b', profile: 'researcher', role: 'collaborator' }
  const invited = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    draft,
    'session',
    member,
    true,
    'gateway-a'
  )
  const runtimeKey = api.collaborationScopeKey('session', draft, 'gateway-a')
  const durable = { ...draft, storedSessionId: 'stored-durable' }
  const durableKey = api.collaborationScopeKey('session', durable, 'gateway-a')

  assert.equal(runtimeKey, 'session:gateway-a:lead:runtime-fresh')
  assert.deepEqual(
    api.collaborationMembersInScope(invited.store, durable, 'session', 'gateway-a').map(value => value.profile),
    ['researcher'],
    'dual-read keeps the invite visible before the migration effect persists'
  )

  const migrated = api.migrateRuntimeCollaborationSessionScope(invited.store, durable, 'gateway-a')
  assert.equal(migrated.changed, true)
  assert.equal(migrated.store.sessions[runtimeKey], undefined)
  assert.deepEqual(migrated.store.sessions[durableKey].map(value => value.profile), ['researcher'])

  const reloaded = api.normalizeCollaborationMemberships(clone(migrated.store))
  assert.deepEqual(
    api.collaborationMembersForSurface(reloaded, { ...durable, runtimeSessionId: null }).map(value => value.profile),
    ['researcher']
  )
  assert.equal(api.migrateRuntimeCollaborationSessionScope(reloaded, durable, 'gateway-a').changed, false)
})

test('session lineage rotation migrates memberships and project bindings through the stable runtime identity', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const tip = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'lead',
    runtimeSessionId: 'runtime-stable',
    storedSessionId: 'stored-tip',
    projectKey: 'C:/work/hermes',
    projectResolutionKnown: true
  }
  const tipSessionBinding = api.updateCollaborationSessionBinding({}, tip).bindings
  const projectBindings = api.updateCollaborationProjectBinding({}, tip, tipSessionBinding).bindings
  const invited = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    tip,
    'session',
    { connectionId: 'gateway-b', profile: 'researcher' },
    true,
    'gateway-a',
    tipSessionBinding
  ).store
  const root = {
    ...tip,
    storedSessionId: 'stored-root',
    projectKey: '',
    projectResolutionKnown: false
  }

  assert.deepEqual(
    api.collaborationMembersInScope(invited, root, 'session', 'gateway-a', tipSessionBinding)
      .map(member => member.profile),
    ['researcher'],
    'the prior stored tip remains visible before the migration save'
  )
  assert.equal(
    api.resolveCollaborationSurface(root, projectBindings, tipSessionBinding).projectKey,
    'C:/work/hermes',
    'the background project follows the stable runtime identity'
  )

  const migrated = api.migrateRuntimeCollaborationSessionScope(
    invited,
    root,
    'gateway-a',
    tipSessionBinding
  )
  const rootKey = api.collaborationScopeKey('session', root, 'gateway-a')
  const tipKey = api.collaborationScopeKey('session', tip, 'gateway-a')
  assert.equal(migrated.changed, true)
  assert.equal(migrated.store.sessions[tipKey], undefined)
  assert.deepEqual(migrated.store.sessions[rootKey].map(member => member.profile), ['researcher'])

  const rootSessionBinding = api.updateCollaborationSessionBinding(tipSessionBinding, root).bindings
  assert.deepEqual(rootSessionBinding[api.collaborationSessionBindingKey(root)], ['stored-root', 'stored-tip'])
  const bridgedProjects = api.updateCollaborationProjectBinding(projectBindings, root, rootSessionBinding)
  assert.equal(bridgedProjects.changed, true)
  assert.equal(
    api.resolveCollaborationSurface(
      { ...root, runtimeSessionId: null },
      bridgedProjects.bindings,
      rootSessionBinding
    ).projectKey,
    'C:/work/hermes',
    'the new lineage root is durable even if a background tile omits the runtime id'
  )

  const reloadedSessions = api.normalizeCollaborationSessionBindings(clone(rootSessionBinding))
  const reloadedStore = api.normalizeCollaborationMemberships(clone(migrated.store))
  assert.deepEqual(
    api.collaborationMembersInScope(
      reloadedStore,
      { ...root, runtimeSessionId: null },
      'session',
      'gateway-a',
      reloadedSessions
    ).map(member => member.profile),
    ['researcher']
  )
})

test('cold or draft surfaces without a lead source cannot create membership scope or invite', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surface = {
    leadProfile: 'default',
    leadConnectionId: null,
    runtimeSessionId: 'draft-session',
    projectKey: 'C:/work/hermes'
  }
  const initial = api.emptyCollaborationMemberships()

  assert.equal(api.collaborationScopeKey('session', surface), '')
  assert.equal(api.collaborationScopeKey('project', surface), '')
  assert.equal(api.collaborationScopeKey('session', surface, 'globally-active-but-not-the-lead'), '')
  assert.equal(api.collaborationScopeKey('project', surface, 'globally-active-but-not-the-lead'), '')
  assert.deepEqual(api.collaborationScopeAvailability(surface), {
    project: false,
    session: false,
    sourceAvailable: false,
    sourceId: ''
  })
  assert.deepEqual(api.collaborationMembersForSurface(initial, surface), [])
  assert.deepEqual(api.collaborationMembersForSurface(initial, surface, 'globally-active-but-not-the-lead'), [])
  assert.equal(api.collaborationScopeMessageKey('session', api.collaborationScopeAvailability(surface)), 'session.unavailable')
  let writes = 0
  assert.equal(
    api.setCollaborationMember(
      surface,
      'session',
      { connectionId: 'globally-active-but-not-the-lead', name: 'researcher' },
      true,
      { store: initial, save: () => (writes += 1) }
    ),
    false
  )
  assert.equal(writes, 0)

  for (const scope of ['session', 'project']) {
    const result = api.updateCollaborationMembership(
      initial,
      surface,
      scope,
      { connectionId: 'globally-active-but-not-the-lead', profile: 'researcher', role: 'collaborator' },
      true,
      null
    )

    assert.equal(result.changed, false)
    assert.deepEqual(result.store, initial)
  }
})

test('same-named Agents expose distinct source-qualified labels for selection', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const roster = [
    {
      connectionId: 'laptop',
      connectionLabel: 'Laptop',
      handle: 'researcher-laptop',
      name: 'researcher',
      remoteSource: false
    },
    {
      connectionId: 'lab',
      connectionLabel: 'Lab',
      handle: 'researcher-lab',
      name: 'researcher',
      remoteSource: true
    }
  ]

  assert.deepEqual(api.agentSourcePresentation(roster[0], roster), {
    accessible: '@researcher-laptop · Laptop',
    handle: '@researcher-laptop',
    source: 'Laptop',
    visible: true
  })
  assert.deepEqual(api.agentSourcePresentation(roster[1], roster), {
    accessible: '@researcher-lab · Lab',
    handle: '@researcher-lab',
    source: 'Lab',
    visible: true
  })
  assert.equal(api.agentAccessibleLabel(roster[0], roster, null), 'Researcher · @researcher-laptop · Laptop')
  assert.equal(api.agentAccessibleLabel(roster[1], roster, null), 'Researcher · @researcher-lab · Lab')
})

test('a known session keeps project-only collaborators when its background surface loses projectKey', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const foreground = {
    leadProfile: 'lead',
    leadConnectionId: 'gateway-a',
    storedSessionId: 'stored-1',
    runtimeSessionId: 'runtime-1',
    projectKey: 'C:\\work\\hermes\\',
    projectResolutionKnown: true
  }
  let persistedBindings

  assert.equal(
    api.rememberCollaborationProject(foreground, {
      bindings: {},
      save: value => {
        persistedBindings = value
      }
    }),
    true
  )

  const invited = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    foreground,
    'project',
    { connectionId: 'gateway-b', profile: 'researcher', role: 'collaborator' },
    true,
    'gateway-a'
  )
  const background = { ...foreground, projectKey: '', projectResolutionKnown: false }
  const resolved = api.resolveCollaborationSurface(background, persistedBindings)

  assert.equal(resolved.projectKey, 'C:/work/hermes')
  assert.equal(api.collaborationScopeAvailability(resolved).project, true)
  assert.deepEqual(api.collaborationMembersForSurface(invited.store, resolved), [
    {
      connectionId: 'gateway-b',
      invitedAt: 0,
      profile: 'researcher',
      role: 'collaborator',
      scopes: ['project']
    }
  ])

  const removed = api.updateCollaborationMembership(
    invited.store,
    resolved,
    'project',
    { connectionId: 'gateway-b', profile: 'researcher', role: 'collaborator' },
    false,
    'gateway-a'
  )
  assert.equal(removed.changed, true, 'the background selector can remove from the recovered project scope')
  assert.deepEqual(api.collaborationMembersForSurface(removed.store, resolved), [])

  for (const unrelated of [
    { ...background, leadConnectionId: 'gateway-c' },
    { ...background, leadProfile: 'other-lead' }
  ]) {
    const isolated = api.resolveCollaborationSurface(unrelated, persistedBindings)

    assert.equal(isolated.projectKey, '')
    assert.equal(api.collaborationScopeAvailability(isolated).project, false)
    assert.deepEqual(api.collaborationMembersForSurface(invited.store, isolated), [])
  }

  assert.equal(api.resolveCollaborationSurface(background, {}).projectKey, '')
})

test('authoritative known-empty project resolution clears a stale binding while unknown background retains it', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const foreground = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'lead',
    projectKey: 'project-one',
    projectResolutionKnown: true,
    storedSessionId: 'stored-1'
  }
  const remembered = api.updateCollaborationProjectBinding({}, foreground)
  const unknownBackground = { ...foreground, projectKey: '', projectResolutionKnown: false }
  const knownEmpty = { ...foreground, projectKey: '', projectResolutionKnown: true }

  assert.equal(api.resolveCollaborationSurface(unknownBackground, remembered.bindings).projectKey, 'project-one')
  assert.equal(api.resolveCollaborationSurface(knownEmpty, remembered.bindings).projectKey, '')

  const cleared = api.updateCollaborationProjectBinding(remembered.bindings, knownEmpty)
  assert.equal(cleared.changed, true)
  assert.deepEqual(cleared.bindings, {})
  assert.equal(api.resolveCollaborationSurface(unknownBackground, cleared.bindings).projectKey, '')
})

test('a missing local roster row never borrows the active remote same-name Agent for removal', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surface = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'lead',
    projectKey: '',
    runtimeSessionId: 'runtime-1',
    storedSessionId: 'stored-1'
  }
  const persisted = { connectionId: 'local', profile: 'researcher', role: 'collaborator' }
  const store = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    surface,
    'session',
    persisted,
    true,
    'gateway-a'
  ).store
  const remoteActiveRoster = [
    {
      connectionId: 'gateway-b',
      connectionKind: 'ssh',
      name: 'researcher',
      remoteSource: false
    }
  ]

  assert.equal(api.rosterBotForMember(remoteActiveRoster, persisted, 'gateway-b'), null)

  const displayed = api.rosterBotForMember(remoteActiveRoster, persisted, 'gateway-b') || {
    connectionId: persisted.connectionId,
    name: persisted.profile,
    remoteSource: false
  }
  assert.equal(api.collaborationMemberKey(api.collaborationMemberForBot(displayed)), 'local::researcher')
  const removed = api.updateCollaborationMembership(
    store,
    surface,
    'session',
    api.collaborationMemberForBot(displayed),
    false,
    'gateway-a'
  )

  assert.equal(removed.changed, true)
  assert.deepEqual(api.collaborationMembersForSurface(removed.store, surface), [])
})

test('project membership is isolated by source, lead profile, and project id with foreground-only legacy migration', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const alpha = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'alpha',
    projectKey: 'shared-project',
    projectResolutionKnown: true,
    storedSessionId: 'alpha-session'
  }
  const beta = {
    ...alpha,
    leadProfile: 'beta',
    storedSessionId: 'beta-session'
  }
  const alphaKey = api.collaborationScopeKey('project', alpha, 'gateway-a')
  const betaKey = api.collaborationScopeKey('project', beta, 'gateway-a')
  const alphaMember = { connectionId: 'gateway-a', profile: 'researcher', role: 'collaborator' }
  const alphaStore = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    alpha,
    'project',
    alphaMember,
    true,
    'gateway-a'
  ).store

  assert.equal(alphaKey, 'project:gateway-a:alpha:shared-project')
  assert.equal(betaKey, 'project:gateway-a:beta:shared-project')
  assert.notEqual(alphaKey, betaKey)
  assert.equal(api.collaborationMembersForSurface(alphaStore, alpha).length, 1)
  assert.deepEqual(api.collaborationMembersForSurface(alphaStore, beta), [])

  const legacyKey = 'project:gateway-a:shared-project'
  const legacyStore = {
    schemaVersion: 1,
    projects: { [legacyKey]: [alphaMember] },
    sessions: {}
  }
  const unknownAlpha = { ...alpha, projectResolutionKnown: false }

  assert.deepEqual(api.collaborationMembersForSurface(legacyStore, unknownAlpha), [])
  assert.equal(api.collaborationMembersForSurface(legacyStore, alpha).length, 1)

  const migrated = api.migrateLegacyCollaborationProjectScope(legacyStore, alpha, 'gateway-a')
  assert.equal(migrated.changed, true)
  assert.equal(migrated.store.projects[legacyKey], undefined)
  assert.equal(migrated.store.projects[alphaKey].length, 1)
  assert.deepEqual(api.collaborationMembersForSurface(migrated.store, beta), [])
})

test('a stale unscoped roster owner cannot stamp an Agent into another or unknown session source', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const ownerA = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const surfaceB = {
    leadConnectionId: 'gateway-b',
    leadProfile: 'lead-b',
    projectKey: '',
    runtimeSessionId: 'runtime-b',
    storedSessionId: 'stored-b'
  }
  const unknownSurface = { ...surfaceB, leadConnectionId: null }
  const staleThinRow = { name: 'researcher', remoteSource: false }
  const initial = api.emptyCollaborationMemberships()
  let writes = 0

  assert.equal(api.collaborationRosterOwnerForSurface(ownerA, surfaceB), null)
  assert.equal(api.collaborationRosterOwnerForSurface(ownerA, unknownSurface), null)
  assert.equal(api.collaborationMemberForBot(staleThinRow, null), null)

  for (const surface of [surfaceB, unknownSurface]) {
    assert.equal(
      api.setCollaborationMember(surface, 'session', staleThinRow, true, {
        rosterOwner: api.collaborationRosterOwnerForSurface(ownerA, surface),
        save: () => (writes += 1),
        store: initial
      }),
      false
    )
  }
  assert.equal(writes, 0)

  const ownerB = api.normalizeRosterOwner('gateway-b', 'lead-b')
  assert.equal(
    api.collaborationMemberKey(
      api.collaborationMemberForBot(staleThinRow, api.collaborationRosterOwnerForSurface(ownerB, surfaceB))
    ),
    'gateway-b::researcher'
  )

  const explicitLocalOwner = api.normalizeRosterOwner('local', 'default')
  const localSurface = { ...surfaceB, leadConnectionId: 'local', leadProfile: 'default' }
  assert.equal(
    api.collaborationMemberKey(
      api.collaborationMemberForBot(
        staleThinRow,
        api.collaborationRosterOwnerForSurface(explicitLocalOwner, localSurface)
      )
    ),
    'local::researcher'
  )
})

test('an unannotated same-name row cannot impersonate another source lead', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const surfaceA = { leadConnectionId: 'gateway-a', leadProfile: 'researcher' }
  const unannotated = { name: 'researcher', remoteSource: false }
  const explicitA = { name: 'researcher', connectionId: 'gateway-a', remoteSource: false }

  assert.equal(api.isCollaborationLeadRosterBot(unannotated, surfaceA, api.normalizeRosterOwner('gateway-b', 'researcher')), false)
  assert.equal(api.isCollaborationLeadRosterBot(unannotated, surfaceA, api.normalizeRosterOwner('gateway-a', 'researcher')), true)
  assert.equal(api.isCollaborationLeadRosterBot(explicitA, surfaceA, null), true)
})

test('a rotated lead is not rendered twice while its durable membership remains available to other leads', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const leadA = {
    leadConnectionId: 'gateway-a',
    leadProfile: 'alpha',
    projectKey: 'shared-project',
    projectResolutionKnown: true,
    storedSessionId: 'session-a'
  }
  const leadB = { ...leadA, leadProfile: 'beta', storedSessionId: 'session-b' }
  const beta = { connectionId: 'gateway-a', profile: 'beta', role: 'collaborator' }
  const store = api.updateCollaborationMembership(
    api.emptyCollaborationMemberships(),
    leadA,
    'project',
    beta,
    true,
    'gateway-a'
  ).store

  assert.deepEqual(api.collaborationMembersForSurface(store, leadA).map(member => member.profile), ['beta'])

  const sharedProjectForB = {
    ...store,
    projects: {
      ...store.projects,
      [api.collaborationScopeKey('project', leadB, 'gateway-a')]: [beta]
    }
  }
  assert.deepEqual(
    api.collaborationMembersForSurface(sharedProjectForB, leadB),
    [],
    'the current lead row owns its status and is excluded from collaborator rendering'
  )
  assert.deepEqual(
    api.collaborationMembersForSurface(sharedProjectForB, leadA).map(member => member.profile),
    ['beta'],
    'the same durable record is still available when another profile leads'
  )
})
