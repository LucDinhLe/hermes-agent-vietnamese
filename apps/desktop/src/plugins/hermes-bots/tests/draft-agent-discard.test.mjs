import assert from 'node:assert/strict'
import test from 'node:test'

import { loadHermesBotsPlugin } from './plugin-behavior-fixture.mjs'

test('Cancel deletes a settled draft on its captured route while finalize keeps it', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const cleaned = []
  const draftA = api.createAgentDraftProvenance({
    slug: 'researcher',
    activeConnectionId: 'gateway-a',
    activeProfile: 'lead-a',
    targetMode: 'remote'
  })
  const cancelled = api.createAgentDraftLifecycle({ cleanup: draft => cleaned.push(draft) })

  assert.equal(await cancelled.ensure(draftA, async () => ({})), 'researcher')
  await cancelled.cancel()
  assert.strictEqual(cleaned[0], draftA)

  const finalized = api.createAgentDraftLifecycle({ cleanup: draft => cleaned.push(draft) })
  assert.equal(await finalized.ensure(draftA, async () => ({})), 'researcher')
  finalized.finalize()
  await finalized.cancel()
  assert.equal(cleaned.length, 1, 'Create finalization must not discard the real profile')
})

test('materialization locks the draft name and its own slug remains reusable by the lifecycle', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const draft = api.createAgentDraftProvenance({ slug: 'researcher', activeConnectionId: 'local' })
  const lifecycle = api.createAgentDraftLifecycle()

  assert.equal(await lifecycle.ensure(draft, async () => ({})), 'researcher')
  assert.equal(api.agentCreationFieldsLocked(lifecycle.current()), true)
  assert.equal(await lifecycle.ensure(draft, async () => assert.fail('must not create twice')), 'researcher')
})
