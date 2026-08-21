import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StarmapGraph } from '@/types/hermes'

const { getStarmapGraph } = vi.hoisted(() => ({ getStarmapGraph: vi.fn() }))

vi.mock('@/hermes', () => ({ getStarmapGraph }))

import type { BackendOwner } from './backend-owner'
import { $starmapGraph, evictStarmapNode, loadStarmapGraph, resetStarmapGraph } from './starmap'

const graph = (source: string): StarmapGraph => ({
  clusters: [],
  edges: [],
  memory: [],
  nodes: [],
  stats: { source }
})

const owner = (connectionId: string): BackendOwner => ({ connectionId, profile: 'default' })

describe('source-qualified Starmap cache', () => {
  beforeEach(() => {
    getStarmapGraph.mockReset()
    resetStarmapGraph()
  })

  it('strands a late source-A graph after source B becomes authoritative', async () => {
    let resolveA: ((value: StarmapGraph) => void) | undefined
    let resolveB: ((value: StarmapGraph) => void) | undefined
    getStarmapGraph
      .mockImplementationOnce(() => new Promise(resolve => (resolveA = resolve)))
      .mockImplementationOnce(() => new Promise(resolve => (resolveB = resolve)))

    const loadingA = loadStarmapGraph(false, owner('source-a'))
    const loadingB = loadStarmapGraph(false, owner('source-b'))

    resolveA?.(graph('source-a'))
    await loadingA
    expect($starmapGraph.get()).toBeNull()

    resolveB?.(graph('source-b'))
    await loadingB
    expect($starmapGraph.get()?.stats).toEqual({ source: 'source-b' })
    expect(getStarmapGraph).toHaveBeenNthCalledWith(1, 'default', 'source-a')
    expect(getStarmapGraph).toHaveBeenNthCalledWith(2, 'default', 'source-b')
  })

  it('does not let a failed source-A optimistic action roll back source B', async () => {
    getStarmapGraph.mockResolvedValueOnce(graph('source-a')).mockResolvedValueOnce(graph('source-b'))
    await loadStarmapGraph(false, owner('source-a'))
    const rollbackA = evictStarmapNode('missing', owner('source-a'))

    await loadStarmapGraph(false, owner('source-b'))
    rollbackA()

    expect($starmapGraph.get()?.stats).toEqual({ source: 'source-b' })
  })
})
