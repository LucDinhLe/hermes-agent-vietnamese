import { describe, expect, it } from 'vitest'

import { normalizeBrowserAddress } from './preview-browser-address'

describe('normalizeBrowserAddress', () => {
  it('adds secure web protocol to ordinary hosts', () => {
    expect(normalizeBrowserAddress('example.com/docs')).toBe('https://example.com/docs')
  })

  it('keeps localhost on http for local preview servers', () => {
    expect(normalizeBrowserAddress('localhost:5173')).toBe('http://localhost:5173/')
  })

  it('rejects non-web schemes', () => {
    expect(normalizeBrowserAddress('javascript:alert(1)')).toBeNull()
    expect(normalizeBrowserAddress('file:///etc/passwd')).toBeNull()
  })
})
