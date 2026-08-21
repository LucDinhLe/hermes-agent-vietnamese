import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

// v31 removes the dismissible Bots/Routines panes. Agents live in each
// session header and the stable management route is always reachable from
// that dropdown and the command palette.
const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

test('the plugin no longer registers a Bots or Routines pane', () => {
  assert.doesNotMatch(source, /id: 'pane'/)
  assert.doesNotMatch(source, /id: 'routines'/)
  assert.doesNotMatch(source, /registerRoutinesPane|paneVisibility|dock:\s*\{/)
  assert.doesNotMatch(source, /dismissedPanes/)
})

test('Agents register a fixed session-header control and stable management route', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const contributions = []
  const result = api.registerAgentSurfaces(
    { register: contribution => contributions.push(contribution) },
    { SESSION_AGENTS_AREA: 'session-agents', ROUTES_AREA: 'routes' }
  )

  assert.deepEqual(result, ['session-control', 'management-page'])
  assert.equal(contributions[0].id, 'session-control')
  assert.equal(contributions[0].area, 'session-agents')
  assert.equal(typeof contributions[0].data.render, 'function')
  assert.equal(contributions[1].id, 'management-page')
  assert.equal(contributions[1].area, 'routes')
  assert.equal(contributions[1].data.path, '/agent-profiles')
  assert.equal(typeof contributions[1].render, 'function')
})
