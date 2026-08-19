import { beforeEach, describe, expect, it } from 'vitest'

import { $pinnedProjectIds, $pinnedSessionIds, setPinnedProjectOrder, setPinnedSessionOrder } from './layout'

beforeEach(() => {
  $pinnedProjectIds.set([])
  $pinnedSessionIds.set([])
})

describe('setPinnedSessionOrder', () => {
  it('applies a full reorder', () => {
    $pinnedSessionIds.set(['a', 'b', 'c'])
    setPinnedSessionOrder(['c', 'b', 'a'])

    expect($pinnedSessionIds.get()).toEqual(['c', 'b', 'a'])
  })

  it('reorders a subset in place, leaving unresolved pins alone', () => {
    // The dragged list only contains pins whose session actually loaded. A pin
    // whose row hasn't arrived is absent from the drag but must keep its slot
    // — requiring the two lists to match length discarded the whole reorder.
    $pinnedSessionIds.set(['loaded1', 'unresolved', 'loaded2'])
    setPinnedSessionOrder(['loaded2', 'loaded1'])

    expect($pinnedSessionIds.get()).toEqual(['loaded2', 'unresolved', 'loaded1'])
  })

  it('ignores ids that are not pinned', () => {
    $pinnedSessionIds.set(['a', 'b'])
    setPinnedSessionOrder(['b', 'stranger', 'a'])

    expect($pinnedSessionIds.get()).toEqual(['b', 'a'])
  })

  it('is a no-op when the drag names nothing pinned', () => {
    const before = ['a', 'b']
    $pinnedSessionIds.set(before)
    setPinnedSessionOrder(['ghost'])

    expect($pinnedSessionIds.get()).toBe(before)
  })

  it('keeps the same array reference when the order is unchanged', () => {
    const before = ['a', 'b']
    $pinnedSessionIds.set(before)
    setPinnedSessionOrder(['a', 'b'])

    expect($pinnedSessionIds.get()).toBe(before)
  })
})

describe('setPinnedProjectOrder', () => {
  it('reorders visible projects without discarding an unresolved pin', () => {
    $pinnedProjectIds.set(['project-a', 'unresolved', 'project-b'])
    setPinnedProjectOrder(['project-b', 'project-a'])

    expect($pinnedProjectIds.get()).toEqual(['project-b', 'unresolved', 'project-a'])
  })

  it('keeps the same array reference when the project order is unchanged', () => {
    const before = ['project-a', 'project-b']
    $pinnedProjectIds.set(before)
    setPinnedProjectOrder(['project-a', 'project-b'])

    expect($pinnedProjectIds.get()).toBe(before)
  })
})
