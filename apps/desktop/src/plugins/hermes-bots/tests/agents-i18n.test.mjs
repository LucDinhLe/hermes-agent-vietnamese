import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key

    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, result)
    } else {
      result.set(path, typeof child)
    }
  }

  return result
}

test('Agent locale bundles have exact EN/VI key and value-type parity', async () => {
  const { AGENT_LOCALES: locales } = (await loadHermesBotsPlugin()).default.__testing
  const en = flatten(locales.en)
  const vi = flatten(locales.vi)

  assert.deepEqual([...vi.keys()].sort(), [...en.keys()].sort())
  assert.deepEqual([...vi.entries()].sort(), [...en.entries()].sort())
})

test('share-account copy explains permissions, quota, and cost and the create payload keeps its default', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const locales = api.AGENT_LOCALES
  const enLabel = locales.en.create.shareAuth
  const enHelp = locales.en.create.shareAuthHelp
  const viLabel = locales.vi.create.shareAuth
  const viHelp = locales.vi.create.shareAuthHelp

  assert.match(enLabel, /provider accounts/i)
  assert.match(enLabel, /copy API keys/i)
  assert.match(enHelp, /OAuth/i)
  assert.match(enHelp, /permissions/i)
  assert.match(enHelp, /quota/i)
  assert.match(enHelp, /charges/i)
  assert.match(viLabel, /tài khoản.*khóa API/i)
  assert.match(viHelp, /OAuth/i)
  assert.match(viHelp, /quyền/i)
  assert.match(viHelp, /hạn mức/i)
  assert.match(viHelp, /chi phí/i)
  assert.deepEqual(api.agentCreateAuthPayload(), { share_auth: true })
  assert.deepEqual(api.agentCreateAuthPayload(false), { share_auth: false })
})

test('source-unavailable failures identify the Agent and source in EN and VI', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const translate = locale => (key, ...args) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], api.AGENT_LOCALES[locale])
    return typeof value === 'function' ? value(...args) : value
  }

  assert.equal(
    api.agentSourceUnavailableMessage(translate('en'), 'researcher', 'Studio Mac'),
    'Agent researcher is unavailable on Studio Mac.'
  )
  assert.equal(
    api.agentSourceUnavailableMessage(translate('vi'), 'researcher', 'Studio Mac'),
    'Agent researcher hiện không khả dụng trên Studio Mac.'
  )
})

test('locale registration and palette labels execute through runtime seams', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const registered = []

  assert.equal(api.registerAgentLocales({ i18n: { register: locales => registered.push(locales) } }), true)
  assert.strictEqual(registered[0], api.AGENT_LOCALES)
  assert.equal(api.registerAgentLocales({}), false)

  let locale = 'en'
  const navigations = []
  let queued = 0
  const text = key => key.split('.').reduce((value, part) => value?.[part], api.AGENT_LOCALES[locale])
  const contributions = api.createAgentPaletteContributions({
    navigate: path => navigations.push(path),
    queueNew: () => (queued += 1),
    text
  })
  const manage = contributions.find(value => value.id === 'manage-agents')
  const create = contributions.find(value => value.id === 'new-agent')

  assert.equal(manage.data.label(), 'Agents: Manage')
  assert.equal(create.data.label(), 'Agents: New Agent…')
  locale = 'vi'
  assert.equal(manage.data.label(), 'Agents: Quản lý')
  assert.equal(create.data.label(), 'Agents: Agent mới…')

  manage.data.run()
  create.data.run()
  assert.deepEqual(navigations, ['/agent-profiles', '/agent-profiles'])
  assert.equal(queued, 1)
  assert.deepEqual(
    api.createAgentPaletteContributions({ routeAvailable: false, text }),
    [],
    'an older SDK without the management route never receives dead-link palette commands'
  )
})

test('the executable plugin preserves its legacy identity and localized manifest fallback', async () => {
  const plugin = (await loadHermesBotsPlugin()).default

  assert.equal(plugin.id, 'hermes-bots')
  assert.equal(plugin.name, 'Agents')
  assert.equal(plugin.description(), 'Create and manage Agent profiles, capabilities, groups, and routines.')
})
