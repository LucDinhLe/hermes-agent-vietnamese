import { atom } from 'nanostores'

import { getStarmapGraph } from '@/hermes'
import type { StarmapGraph } from '@/types/hermes'

import type { BackendOwner } from './backend-owner'

// On-demand cache for the star map. The graph scan touches the skills catalog +
// usage ledger + memory files, so we fetch it only when the panel opens (and on
// an explicit refresh), never on a turn boundary.
export const $starmapGraph = atom<StarmapGraph | null>(null)
export const $starmapLoading = atom(false)
export const $starmapError = atom<null | string>(null)

let graphOwnerKey: string | null = null
let inflight: { key: string; promise: Promise<void> } | null = null

const ownerKey = (owner?: BackendOwner | null) => (owner ? `${owner.connectionId}::${owner.profile}` : 'ambient')

export async function loadStarmapGraph(force = false, owner?: BackendOwner | null): Promise<void> {
  const key = ownerKey(owner)

  if (inflight?.key === key) {
    return inflight.promise
  }

  if ($starmapGraph.get() && graphOwnerKey === key && !force) {
    return
  }

  graphOwnerKey = key
  $starmapGraph.set(null)

  $starmapLoading.set(true)
  $starmapError.set(null)

  const promise = (async () => {
    try {
      const graph = await getStarmapGraph(owner?.profile, owner?.connectionId)

      if (graphOwnerKey === key) {
        $starmapGraph.set(graph)
      }
    } catch (err) {
      if (graphOwnerKey === key) {
        $starmapError.set(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (graphOwnerKey === key) {
        $starmapLoading.set(false)
      }

      if (inflight?.key === key) {
        inflight = null
      }
    }
  })()

  inflight = { key, promise }

  return promise
}

/** Drop one node from the cached graph immediately; return rollback. */
export function evictStarmapNode(id: string, owner?: BackendOwner | null): () => void {
  const key = ownerKey(owner)

  if (graphOwnerKey !== key) {
    return () => {}
  }

  const prev = $starmapGraph.get()

  if (!prev) {
    return () => {}
  }

  const next: StarmapGraph = {
    ...prev,
    nodes: prev.nodes.filter(node => node.id !== id),
    edges: prev.edges.filter(edge => edge.source !== id && edge.target !== id)
  }

  $starmapGraph.set(next)

  return () => {
    if (graphOwnerKey === key) {
      $starmapGraph.set(prev)
    }
  }
}

/** Drop the cache so the next open refetches against the now-active profile. */
export function resetStarmapGraph(): void {
  inflight = null
  graphOwnerKey = null
  $starmapGraph.set(null)
  $starmapLoading.set(false)
  $starmapError.set(null)
}
