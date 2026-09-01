import { describe, expect, it } from 'vitest'

import { group, rekeyPane, split } from './model'

describe('rekeyPane', () => {
  it('preserves the exact group, tab order, active state, and split weights', () => {
    const tree = split(
      'row',
      [
        group(['workspace', 'session-tile:draft'], { active: 'session-tile:draft', id: 'main' }),
        group(['files'], { id: 'files' })
      ],
      [3, 1],
      'root'
    )

    expect(rekeyPane(tree, 'session-tile:draft', 'session-tile:durable')).toEqual(
      split(
        'row',
        [
          group(['workspace', 'session-tile:durable'], { active: 'session-tile:durable', id: 'main' }),
          group(['files'], { id: 'files' })
        ],
        [3, 1],
        'root'
      )
    )
  })

  it('fails closed when the source is absent or the durable destination already exists', () => {
    const tree = group(['session-tile:draft', 'session-tile:durable'], { active: 'session-tile:draft' })

    expect(rekeyPane(tree, 'missing', 'session-tile:new')).toBe(tree)
    expect(rekeyPane(tree, 'session-tile:draft', 'session-tile:durable')).toBe(tree)
  })
})
