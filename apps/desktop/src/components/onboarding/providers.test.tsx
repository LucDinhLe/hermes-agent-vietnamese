import { describe, expect, it } from 'vitest'

import type { OAuthProvider } from '@/types/hermes'

import { providerTitle } from './providers'

describe('providerTitle', () => {
  it('labels the Claude Code subscription bridge without the legacy Extra Usage warning', () => {
    const provider = {
      id: 'claude-code',
      name: 'Claude Pro / Max (qua Claude Code)'
    } as OAuthProvider

    expect(providerTitle(provider)).toBe('Claude Pro / Max (qua Claude Code)')
    expect(providerTitle(provider)).not.toContain('Extra Usage')
  })
})
