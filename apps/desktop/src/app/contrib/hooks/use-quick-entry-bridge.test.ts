import { describe, expect, it } from 'vitest'

import { sessionTileIdentity } from '@/store/session-states'

import { resolveQuickEntrySubmissionTarget } from './use-quick-entry-bridge'

describe('resolveQuickEntrySubmissionTarget', () => {
  it('keeps a captured A target routed to A after same-profile B replaces the published list', () => {
    const ownerA = { connectionId: 'source-a', profile: 'default' }
    const ownerB = { connectionId: 'source-b', profile: 'default' }
    const targetA = `session:${sessionTileIdentity(ownerA, 'same-id')}`

    expect(
      resolveQuickEntrySubmissionTarget(targetA, [
        {
          connectionId: ownerB.connectionId,
          id: 'same-id',
          profile: ownerB.profile,
          target: `session:${sessionTileIdentity(ownerB, 'same-id')}`,
          title: 'B session'
        }
      ])
    ).toEqual({ owner: ownerA, storedSessionId: 'same-id' })
  })

  it('accepts a legacy bare id only when one published owner is unambiguous', () => {
    const option = { connectionId: 'source-a', id: 'legacy-id', profile: 'writer', title: 'Legacy session' }

    expect(resolveQuickEntrySubmissionTarget('legacy-id', [option])).toEqual({
      owner: { connectionId: 'source-a', profile: 'writer' },
      storedSessionId: 'legacy-id'
    })
    expect(
      resolveQuickEntrySubmissionTarget('legacy-id', [
        option,
        { ...option, connectionId: 'source-b', title: 'Same id on B' }
      ])
    ).toBeNull()
  })
})
