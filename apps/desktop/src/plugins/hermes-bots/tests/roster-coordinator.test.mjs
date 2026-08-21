import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const plain = value => JSON.parse(JSON.stringify(value))

function coordinatorFixture(api) {
  const calls = []
  let lastRoster = []
  let lastOwner = null
  const coordinate = api.createRosterSnapshotCoordinator({
    setLastRoster: (value, owner) => {
      lastRoster = value
      lastOwner = owner
      calls.push(['last', value.map(bot => bot.name)])
    },
    mergeMeta: roster => calls.push(['meta', roster.map(bot => bot.name)]),
    pullAvatars: roster => calls.push(['avatars', roster.map(bot => bot.name)]),
    trackActivity: roster => calls.push(['activity', roster.map(bot => bot.name)]),
    backfillProtocol: (roster, owner, protocolInjected) =>
      calls.push(['protocol', roster.map(bot => bot.name), plain(owner), protocolInjected])
  })

  return { calls, coordinate, getLastOwner: () => plain(lastOwner), getLastRoster: () => plain(lastRoster) }
}

test('a shared roster snapshot coordinates every side effect once', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const { calls, coordinate, getLastOwner, getLastRoster } = coordinatorFixture(api)
  const meta = { alpha: { pinned: true } }
  const data = {
    bot_mode_protocol: true,
    profiles: [
      { name: 'beta', last_session: { last_active: 3 } },
      { name: 'remote', remoteSource: true, last_session: { last_active: 99 } },
      {
        name: 'alpha',
        last_session: { last_active: 1 },
        ui_meta: { 'hermes-bots': { pinned: true } }
      }
    ]
  }

  assert.equal(coordinate(data, 'gateway-a', meta, 'lead'), true)
  assert.deepEqual(getLastRoster().map(bot => bot.name), ['alpha', 'remote', 'beta'])
  assert.deepEqual(getLastOwner(), { connectionId: 'gateway-a', profile: 'lead' })
  assert.deepEqual(plain(calls), [
    ['last', ['alpha', 'remote', 'beta']],
    ['meta', ['alpha', 'beta']],
    ['avatars', ['alpha', 'beta']],
    ['activity', ['alpha', 'beta']],
    ['protocol', ['alpha', 'beta'], { connectionId: 'gateway-a', profile: 'lead' }, true]
  ])

  assert.equal(coordinate(data, 'gateway-a', meta, 'lead'), false)
  assert.equal(calls.length, 5)
})

test('connection, data, or metadata identity changes re-run reconciliation', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const { calls, coordinate } = coordinatorFixture(api)
  const data = { profiles: [{ name: 'alpha' }] }
  const meta = {}

  assert.equal(coordinate(data, 'gateway-a', meta), true)
  assert.equal(coordinate(data, 'gateway-b', meta), true)
  assert.equal(coordinate({ profiles: [{ name: 'beta' }] }, 'gateway-b', meta), true)
  assert.equal(coordinate(data, 'gateway-b', { alpha: { pinned: true } }), true)
  assert.equal(calls.filter(([kind]) => kind === 'protocol').length, 4)
})
