import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  compareElectronBaseline,
  hasCompleteVitestSummary,
  parseVitestFailures
} from '../scripts/compare-electron-baseline.mjs'

function logWithFailures(failures) {
  return [
    ...failures.map((failure) => ` FAIL  electron  ${failure}`),
    ' Test Files  1 failed | 2 passed (3)',
    '      Tests  1 failed | 9 passed (10)'
  ].join('\n')
}

test('failure parser normalizes ANSI, separators and duplicate Vitest summaries', () => {
  const log = [
    '\u001b[41m FAIL \u001b[0m electron electron\\ssh-config.test.ts > config > rejects blank',
    ' FAIL  electron  electron/ssh-config.test.ts > config > rejects blank',
    ' FAIL  electron  scripts/stage-native-deps.test.mjs',
    ' Test Files  2 failed | 1 passed (3)',
    '      Tests  2 failed | 8 passed (10)'
  ].join('\n')

  assert.deepEqual(parseVitestFailures(log), [
    'electron/ssh-config.test.ts > config > rejects blank',
    'scripts/stage-native-deps.test.mjs > <file-level failure>'
  ])
  assert.equal(hasCompleteVitestSummary(log), true)
})

test('candidate passes without needing a green upstream baseline', () => {
  const result = compareElectronBaseline({
    candidateLog: ' Test Files  3 passed (3)\n      Tests  10 passed (10)',
    upstreamLog: 'checkout failed',
    candidateExit: 0,
    upstreamExit: 1
  })

  assert.equal(result.allowed, true)
  assert.equal(result.reason, 'candidate-electron-suite-passed')
})

test('known candidate failures are allowed only when pristine upstream reproduces them', () => {
  const shared = 'electron/hardening.test.ts > permissions > keeps owner only'
  const result = compareElectronBaseline({
    candidateLog: logWithFailures([shared]),
    upstreamLog: logWithFailures([shared, 'electron/ssh-config.test.ts > parse > keeps hosts']),
    candidateExit: 1,
    upstreamExit: 1
  })

  assert.equal(result.allowed, true)
  assert.equal(result.reason, 'candidate-failures-contained-by-pristine-upstream-baseline')
  assert.deepEqual(result.additionalFailures, [])
})

test('a candidate-only failure blocks the gate', () => {
  const shared = 'electron/hardening.test.ts > permissions > keeps owner only'
  const added = 'electron/api-transport.test.ts > timeout > never replays POST'
  const result = compareElectronBaseline({
    candidateLog: logWithFailures([shared, added]),
    upstreamLog: logWithFailures([shared]),
    candidateExit: 1,
    upstreamExit: 1
  })

  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'candidate-introduced-electron-failures')
  assert.deepEqual(result.additionalFailures, [added])
})

test('candidate failure is blocked when pristine upstream passes', () => {
  const result = compareElectronBaseline({
    candidateLog: logWithFailures(['electron/api-transport.test.ts > timeout > marks ETIMEDOUT']),
    upstreamLog: ' Test Files  3 passed (3)\n      Tests  10 passed (10)',
    candidateExit: 1,
    upstreamExit: 0
  })

  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'candidate-failed-while-pristine-upstream-passed')
})

test('incomplete or unparseable logs fail closed', () => {
  const incompleteCandidate = compareElectronBaseline({
    candidateLog: 'process terminated',
    upstreamLog: logWithFailures(['electron/hardening.test.ts > permissions > keeps owner only']),
    candidateExit: 1,
    upstreamExit: 1
  })
  assert.equal(incompleteCandidate.allowed, false)
  assert.equal(incompleteCandidate.reason, 'candidate-log-incomplete')

  const incompleteUpstream = compareElectronBaseline({
    candidateLog: logWithFailures(['electron/hardening.test.ts > permissions > keeps owner only']),
    upstreamLog: 'npm failed before Vitest summary',
    candidateExit: 1,
    upstreamExit: 1
  })
  assert.equal(incompleteUpstream.allowed, false)
  assert.equal(incompleteUpstream.reason, 'upstream-log-incomplete')
})
