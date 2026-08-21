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

test('shared-auth creation fails closed and cleans the immutable draft unless the gateway confirms sharing', async () => {
  const api = (await loadHermesBotsPlugin()).default.__testing
  const draft = api.createAgentDraftProvenance({
    slug: 'researcher',
    activeConnectionId: 'gateway-a',
    activeProfile: 'lead-a',
    targetMode: 'remote'
  })

  for (const [label, createResult] of [
    ['missing confirmation', {}],
    ['different confirmation', { mirrored: { auth: true } }]
  ]) {
    const cleaned = []
    let afterCreateCalled = false
    let finalized = false
    const lifecycle = api.createAgentDraftLifecycle({ cleanup: value => cleaned.push(value) })

    await assert.rejects(
      async () => {
        await lifecycle.ensure(
          draft,
          async () => createResult,
          async () => {
            afterCreateCalled = true
          },
          result => {
            if (!api.agentSharedAuthCreateResultAccepted(result, true)) {
              throw new Error('shared_auth_not_supported')
            }
          }
        )
        lifecycle.finalize()
        finalized = true
      },
      /shared_auth_not_supported/,
      label
    )

    assert.deepEqual(cleaned, [draft], `${label}: cleanup keeps the exact captured source`)
    assert.equal(afterCreateCalled, false, `${label}: post-create work must not run`)
    assert.equal(finalized, false, `${label}: rejected creation must not finalize`)
    assert.equal(lifecycle.created(), null, `${label}: rejected creation must not remain materialized`)
    assert.equal(lifecycle.current(), null, `${label}: rejected creation must release the draft lock`)
  }

  const sharedCleanup = []
  const shared = api.createAgentDraftLifecycle({ cleanup: value => sharedCleanup.push(value) })
  assert.equal(
    await shared.ensure(
      draft,
      async () => ({ mirrored: { auth: 'shared' } }),
      undefined,
      result => {
        if (!api.agentSharedAuthCreateResultAccepted(result, true)) {
          throw new Error('shared_auth_not_supported')
        }
      }
    ),
    'researcher'
  )
  assert.strictEqual(shared.created(), draft)
  assert.deepEqual(sharedCleanup, [])

  const isolatedCleanup = []
  const isolated = api.createAgentDraftLifecycle({ cleanup: value => isolatedCleanup.push(value) })
  assert.equal(
    await isolated.ensure(
      draft,
      async () => ({}),
      undefined,
      result => {
        if (!api.agentSharedAuthCreateResultAccepted(result, false)) {
          throw new Error('shared_auth_not_supported')
        }
      }
    ),
    'researcher'
  )
  assert.strictEqual(isolated.created(), draft)
  assert.deepEqual(isolatedCleanup, [])
})
