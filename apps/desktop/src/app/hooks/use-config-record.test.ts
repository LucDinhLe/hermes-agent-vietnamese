import { describe, expect, it } from 'vitest'

import { HERMES_CONFIG_KEY, hermesConfigKey } from './use-config-record'

describe('Hermes config cache scope', () => {
  it('keeps same-profile records isolated by explicit backend source', () => {
    expect(hermesConfigKey('default', 'source-a')).not.toEqual(hermesConfigKey('default', 'source-b'))
  })

  it('preserves the legacy key for callers without an explicit source or profile', () => {
    expect(hermesConfigKey()).toEqual(HERMES_CONFIG_KEY)
  })
})
