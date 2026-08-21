import { type LayoutNode, removePane } from './model'

export const RETIRED_AGENT_PANE_IDS = ['hermes-bots:pane', 'hermes-bots:routines'] as const
const retiredAgentPaneIds = new Set<string>(RETIRED_AGENT_PANE_IDS)

export function hasRetiredAgentPane(tree: LayoutNode | null): boolean {
  if (!tree) {
    return false
  }

  if (tree.type === 'group') {
    return tree.panes.some(paneId => retiredAgentPaneIds.has(paneId))
  }

  return tree.children.some(hasRetiredAgentPane)
}

export function hasRetiredAgentPaneList(values: unknown): boolean {
  return Array.isArray(values) && values.some(value => typeof value === 'string' && retiredAgentPaneIds.has(value))
}

export function hasRetiredAgentPaneRecord(values: unknown): boolean {
  return Boolean(
    values &&
    typeof values === 'object' &&
    !Array.isArray(values) &&
    RETIRED_AGENT_PANE_IDS.some(paneId => Object.hasOwn(values, paneId))
  )
}

export function retireAgentPanes(tree: LayoutNode | null): LayoutNode | null {
  let next = tree

  for (const paneId of RETIRED_AGENT_PANE_IDS) {
    next = next ? removePane(next, paneId) : null
  }

  return next
}

export function retireAgentPaneList(values: unknown): string[] | null {
  if (!Array.isArray(values)) {
    return null
  }

  const next = values.filter((value): value is string => typeof value === 'string' && !retiredAgentPaneIds.has(value))

  return next.length ? next : null
}

export function retireAgentPaneRecord(values: unknown): Record<string, number> | null {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return null
  }

  const next = { ...(values as Record<string, number>) }

  for (const paneId of RETIRED_AGENT_PANE_IDS) {
    delete next[paneId]
  }

  return Object.keys(next).length ? next : null
}
