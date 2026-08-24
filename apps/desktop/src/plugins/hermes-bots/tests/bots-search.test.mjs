import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

function loadFilter() {
  const start = source.indexOf('function botHandle')
  const end = source.indexOf('function slugify')

  assert.ok(start >= 0 && end > start, 'bot identity helper block must remain extractable')

  const owner = { connectionId: 'local', profile: 'default' }
  const context = {
    $botMetaOwner: { get: () => owner },
    normalizeRosterOwner: (connectionId, profile) =>
      connectionId && profile ? { connectionId, profile } : null,
    sameRosterOwner: (left, right) =>
      Boolean(left && right && left.connectionId === right.connectionId && left.profile === right.profile)
  }
  vm.runInNewContext(
    `${source.slice(start, end)}\nglobalThis.__filterBots = filterBots;`,
    context
  )

  return (roster, meta, query) => context.__filterBots(roster, meta, query, owner)
}

const roster = [
  { name: 'agency-audio-designer', title: 'Audio Designer' },
  { name: 'agency-ai-engineer', title: 'AI Engineer' },
  { name: 'default' }
]
const meta = {
  'agency-audio-designer': { title: 'Sound Studio' },
  default: {}
}

test('Agent search matches visible display names case-insensitively', () => {
  const filterBots = loadFilter()

  assert.deepEqual(
    filterBots(roster, meta, 'SOUND').map(bot => bot.name),
    ['agency-audio-designer']
  )
})

test('Agent search matches profile handles and preserves roster order', () => {
  const filterBots = loadFilter()

  assert.deepEqual(
    filterBots(roster, meta, 'agency-').map(bot => bot.name),
    ['agency-audio-designer', 'agency-ai-engineer']
  )
  assert.deepEqual(
    filterBots(roster, meta, '@hermes').map(bot => bot.name),
    ['default']
  )
  assert.deepEqual(
    filterBots(roster, meta, 'default').map(bot => bot.name),
    ['default']
  )
})

test('blank Agent search returns the existing roster reference', () => {
  const filterBots = loadFilter()

  assert.equal(filterBots(roster, meta, '   '), roster)
})

test('Agents management renders the localized search field and no-match state', () => {
  assert.match(source, /jsx\(SearchField,\s*\{[\s\S]*?placeholder: copy\('roster\.searchPlaceholder'\)/)
  assert.match(source, /'aria-live': 'polite'/)
  assert.match(source, /copy\('roster\.noMatch', query\.trim\(\)\)/)
})
