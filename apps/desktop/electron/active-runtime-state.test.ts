import assert from 'node:assert/strict'

import { test } from 'vitest'

import { classifyActiveRuntime, hasValidBootstrapMarker, shouldRefreshManagedRuntime } from './active-runtime-state'

const VALID_MARKER = {
  pinnedCommit: '1234567890abcdef1234567890abcdef12345678',
  schemaVersion: 1
}

test('hasValidBootstrapMarker accepts the current schema with a real-looking commit', () => {
  assert.equal(hasValidBootstrapMarker(VALID_MARKER, 1), true)
})

test('hasValidBootstrapMarker rejects missing, wrong-schema, and too-short markers', () => {
  assert.equal(hasValidBootstrapMarker(null, 1), false)
  assert.equal(hasValidBootstrapMarker({ schemaVersion: 2, pinnedCommit: VALID_MARKER.pinnedCommit }, 1), false)
  assert.equal(hasValidBootstrapMarker({ schemaVersion: 1, pinnedCommit: 'abc123' }, 1), false)
})

test('classifyActiveRuntime uses a healthy active runtime even when the bootstrap marker is missing', () => {
  assert.deepEqual(classifyActiveRuntime(null, 1, true), {
    hasValidMarker: false,
    shouldUseActiveRuntime: true,
    usabilityReason: 'usable'
  })
})

test('classifyActiveRuntime uses a healthy active runtime even when the marker is stale or malformed', () => {
  assert.deepEqual(classifyActiveRuntime({ schemaVersion: 999, pinnedCommit: 'abc1234' }, 1, true), {
    hasValidMarker: false,
    shouldUseActiveRuntime: true,
    usabilityReason: 'usable'
  })
})

test('classifyActiveRuntime refuses an unusable runtime even if a valid marker exists', () => {
  assert.deepEqual(classifyActiveRuntime(VALID_MARKER, 1, false), {
    hasValidMarker: true,
    shouldUseActiveRuntime: false,
    usabilityReason: 'unusable'
  })
})

test('a CLI-installed runtime with no marker launches instead of re-running bootstrap', () => {
  // The reported symptom (#60721): install.sh / install.ps1 produced a healthy
  // repo+venv, no desktop-managed marker was ever written, and every launch
  // dropped the user back into the first-run installer.
  const state = classifyActiveRuntime(null, 1, true)

  assert.equal(state.shouldUseActiveRuntime, true, 'a usable runtime must launch')
  assert.equal(state.hasValidMarker, false, 'marker provenance stays honest')
})

test('a repair that deleted the marker does not strand a healthy install', () => {
  // #72166: the repair handler clears the marker unconditionally. Runtime
  // usability, not marker presence, must decide the next boot.
  assert.equal(classifyActiveRuntime(null, 1, true).shouldUseActiveRuntime, true)
})

test('a managed runtime refreshes once when a packaged desktop pin changes', () => {
  const newerStamp = { commit: 'fedcba9876543210fedcba9876543210fedcba98' }

  assert.equal(shouldRefreshManagedRuntime(VALID_MARKER, 1, newerStamp), true)
  assert.equal(
    shouldRefreshManagedRuntime({ ...VALID_MARKER, pinnedCommit: newerStamp.commit }, 1, newerStamp),
    false,
    'the refreshed marker suppresses repeat installs'
  )
})

test('desktop does not take ownership of CLI installs or fallback build stamps', () => {
  assert.equal(shouldRefreshManagedRuntime(null, 1, { commit: 'f'.repeat(40) }), false)
  assert.equal(
    shouldRefreshManagedRuntime({ schemaVersion: 999, pinnedCommit: 'a'.repeat(40) }, 1, { commit: 'f'.repeat(40) }),
    false
  )
  assert.equal(shouldRefreshManagedRuntime(VALID_MARKER, 1, { commit: '0'.repeat(40) }), false)
})
