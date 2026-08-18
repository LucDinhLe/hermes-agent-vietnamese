import { describe, expect, it } from 'vitest'

import { FILE_BROWSER_MAX_WIDTH } from './layout'

describe('right workspace rail sizing', () => {
  it('can expand beyond the old 20rem cap while remaining viewport-bounded', () => {
    expect(FILE_BROWSER_MAX_WIDTH).toBe('min(65vw, 90rem)')
  })
})
