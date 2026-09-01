import { describe, expect, it } from 'vitest'

import {
  InvalidRendererRuntimeKeyError,
  parseRendererRuntimeKey,
  rawRuntimeSessionId,
  rendererRuntimeKey
} from './session-runtime-key'

describe('renderer runtime identity', () => {
  it('round-trips the complete backend owner and strips only at the RPC edge', () => {
    const key = rendererRuntimeKey(
      { connectionId: 'connection-a', gatewayEpoch: 7, profile: 'mbc' },
      'runtime-shared'
    )

    expect(parseRendererRuntimeKey(key)).toEqual({
      backend: { connectionId: 'connection-a', gatewayEpoch: 7, profile: 'mbc' },
      runtimeSessionId: 'runtime-shared'
    })
    expect(rawRuntimeSessionId(key)).toBe('runtime-shared')
  })

  it('keeps an ordinary raw backend id byte-identical', () => {
    expect(parseRendererRuntimeKey('runtime-raw')).toBeNull()
    expect(rawRuntimeSessionId('runtime-raw')).toBe('runtime-raw')
  })

  it.each([
    ['declared number with a string value', [null, 'default', 'number', '7', 'runtime-a']],
    ['declared string with a number value', [null, 'default', 'string', 7, 'runtime-a']],
    ['unknown epoch tag', [null, 'default', 'boolean', true, 'runtime-a']]
  ])('fails closed for %s', (_label, tuple) => {
    const malformed = `hermes-runtime-v1:${encodeURIComponent(JSON.stringify(tuple))}`

    expect(() => parseRendererRuntimeKey(malformed)).toThrow(InvalidRendererRuntimeKeyError)
    expect(() => rawRuntimeSessionId(malformed)).toThrow(InvalidRendererRuntimeKeyError)
  })
})
