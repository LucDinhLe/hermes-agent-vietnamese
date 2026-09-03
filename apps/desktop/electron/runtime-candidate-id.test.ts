import { describe, expect, it } from 'vitest'

import { expectedRuntimeCandidateId, RUNTIME_CANDIDATE_PATTERN } from './runtime-candidate-id'

const source = '643343c3cd671d8f2b7c2841b45653d1f431d661'
const build = '7087998fca6e25967a88feffb1beafc400f26b3a'

describe('runtime candidate identity', () => {
  it('uses the monthly version without dropping source or build identity', () => {
    const id = expectedRuntimeCandidateId('2026.9.2', source, build)
    expect(id).toBe('c2026m9r2-643343c3-7087998f')
    expect(id.length).toBeLessThanOrEqual(32)
    expect(RUNTIME_CANDIDATE_PATTERN.test(id)).toBe(true)
    expect(expectedRuntimeCandidateId('2026.9.3', source, build)).not.toBe(id)
    expect(expectedRuntimeCandidateId('2026.10.1', source, build)).not.toBe(id)
    expect(expectedRuntimeCandidateId('2026.9.2', build, source)).not.toBe(id)
  })

  it('keeps the installed legacy runtime identity compatible', () => {
    const id = expectedRuntimeCandidateId('0.33.0-dev.14-advisor-exp.14', source, build)
    expect(id).toBe('d14e14-643343c3-7087998f')
    expect(RUNTIME_CANDIDATE_PATTERN.test(id)).toBe(true)
  })

  it.each([
    '2026.9.02',
    '2026.09.2',
    '2026.0.2',
    '2026.13.1',
    '2026.9.0',
    '2026.9.-1',
    '../2026.9.2',
    '2026.9.2-rc.1',
    '2026.9.123456789012345'
  ])('rejects ambiguous, unsafe or overlong version %s', version => {
    expect(() => expectedRuntimeCandidateId(version, source, build)).toThrow()
  })

  it.each(['', 'abc', '0'.repeat(40), '../' + 'a'.repeat(37)])('rejects invalid provenance %s', commit => {
    expect(() => expectedRuntimeCandidateId('2026.9.2', commit, build)).toThrow()
    expect(() => expectedRuntimeCandidateId('2026.9.2', source, commit)).toThrow()
  })
})
