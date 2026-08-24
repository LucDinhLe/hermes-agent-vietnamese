import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

const pluginSource = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

// Discord-style creation flow: the header "+" is a dropdown (New Agent /
// New Group Chat), and New Group Chat opens a checkbox-picker modal with
// search, a name input, and a Create button. Source-contract style, like
// the other roster affordance tests.

test('source contract: header + is a dropdown offering agent and group chat', () => {
  assert.match(pluginSource, /DropdownMenuTrigger/)
  assert.match(pluginSource, /'New Agent'/)
  assert.match(pluginSource, /'New Group Chat'/)
})

test('source contract: create-group modal has search, checkboxes, name, create', () => {
  assert.match(pluginSource, /function CreateGroupChatDialog\(/)
  // Reuses the roster search filter so name/@handle/title all match.
  assert.match(pluginSource, /const visible = filterBots\(roster, allMeta, query, rosterOwner\)/)
  // Selection is checkbox-driven and capped at the room member limit.
  assert.match(pluginSource, /const atCap = selected\.length >= GROUP_CHAT_MAX_MEMBERS/)
  // Create requires 2+ members. Membership mutation is covered by the
  // behavioral groupMembershipPatch tests rather than another source regex.
  assert.match(pluginSource, /selected\.length >= 2/)
  // Creating drops the user straight into the room (main window when the
  // desktop offers host.openWorkspace, in-panel fallback otherwise).
  assert.match(pluginSource, /onCreated: groupName => openGroupChat\(groupName\)/)
})

test('source contract: group name falls back to member names, Discord-style', () => {
  assert.match(pluginSource, /selected\.map\(bot => displayName\(bot, botRosterMeta\(bot, allMeta, rosterOwner\)\)\)\.join\(', '\)/)
})

test('every selected machine is persisted with a source-qualified durable identity', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const owner = api.normalizeRosterOwner('gateway-a', 'lead-a')
  const selected = [
    { name: 'writer', remoteSource: false },
    { name: 'researcher', connectionId: 'gateway-b', connectionLabel: 'Gateway B', remoteSource: true }
  ]

  assert.deepEqual(
    api.durableGroupChatMembers(selected, owner).map(member => [member.connectionId, member.name]),
    [
      ['gateway-a', 'writer'],
      ['gateway-b', 'researcher']
    ]
  )
})
