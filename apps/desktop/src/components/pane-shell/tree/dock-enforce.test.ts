import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Enforced dock invariants: a pane whose dock hint carries `enforce: true`
// re-homes onto its center anchor at EVERY boot's
// first adoption pass — persisted layouts otherwise pin the stale stacked
// arrangement forever, because adoption only ever places panes MISSING from
// the tree. Unlike the retired one-time heal, nothing exempts the pane: not
// a previously burned heal token, not $userPlacedPanes. The invariant is
// boot-scoped, so an intra-session drag sticks until the next launch.

const TREE_KEY = 'hermes.desktop.layoutTree.v2'
const USER_PLACED_KEY = 'hermes.desktop.userPlacedPanes.v1'
const LEGACY_HEAL_KEY = 'hermes.desktop.paneDockHeals.v1'

// A persisted regression shape: sessions and an owner-enforced pane as
// SIBLING groups in a column, with the workspace beside them.
const stackedTree = {
  type: 'split',
  id: 'root',
  orientation: 'row',
  weights: [1, 3],
  children: [
    {
      type: 'split',
      id: 'left-col',
      orientation: 'column',
      weights: [1, 1],
      children: [
        { type: 'group', id: 'g-sessions', panes: ['sessions'], active: 'sessions' },
        { type: 'group', id: 'g-owner', panes: ['owner:pane'], active: 'owner:pane' }
      ]
    },
    { type: 'group', id: 'g-main', panes: ['workspace'], active: 'workspace' }
  ]
}

describe('enforced dock (stacked owner pane → sessions-zone tab, every boot)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function setup() {
    window.localStorage.setItem(TREE_KEY, JSON.stringify(stackedTree))

    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main' },
      render: () => null
    })
    registry.register({
      id: 'sessions',
      area: 'panes',
      title: 'sessions',
      data: { placement: 'left' },
      render: () => null
    })
    registry.register({
      id: 'owner:pane',
      area: 'panes',
      title: 'Owner pane',
      data: {
        placement: 'left',
        dock: { pane: 'sessions', pos: 'center', enforce: true }
      },
      render: () => null
    })

    return { model, registry, tree }
  }

  it('re-homes a stacked owner pane into the sessions tab strip, keeping sessions active', async () => {
    const { model, tree } = await setup()

    tree.watchContributedPanes()

    const group = model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!

    expect(group.panes).toEqual(['sessions', 'owner:pane'])
    // Silent like adoption — the enforce must not steal the sessions tab.
    expect(group.active).toBe('sessions')
    // The persisted tree carries the tabbed shape (survives the next boot).
    const persisted = JSON.parse(window.localStorage.getItem(TREE_KEY)!) as { children?: unknown[] }

    expect(JSON.stringify(persisted)).toContain('"panes":["sessions","owner:pane"]')
  })

  it('re-homes even a USER-PLACED pane — the owner invariant beats the drag record', async () => {
    window.localStorage.setItem(USER_PLACED_KEY, JSON.stringify(['owner:pane']))

    const { model, tree } = await setup()

    tree.watchContributedPanes()

    const group = model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!

    expect(group.panes).toEqual(['sessions', 'owner:pane'])
  })

  it('re-homes even when the retired heal token was already burned, and clears the stale ledger', async () => {
    window.localStorage.setItem(LEGACY_HEAL_KEY, JSON.stringify(['owner:pane:sessions-tab-v1']))

    const { model, tree } = await setup()

    tree.watchContributedPanes()

    const group = model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!

    expect(group.panes).toEqual(['sessions', 'owner:pane'])
    // The one-time-heal ledger is dead state now — importing the store drops it.
    expect(window.localStorage.getItem(LEGACY_HEAL_KEY)).toBeNull()
  })

  it('is idempotent within a boot and does not fight an intra-session drag', async () => {
    const { model, tree, registry } = await setup()

    tree.watchContributedPanes()

    // Sanity: enforced into the strip.
    expect(model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!.panes).toContain('sessions')

    // The user drags the pane back out into its own zone below sessions.
    tree.$layoutTree.set(JSON.parse(JSON.stringify(stackedTree)))

    // A later registry mutation re-runs the adoption pass (the enforce's
    // caller) — same boot, so the drag sticks until the next launch.
    registry.register({
      id: 'other',
      area: 'panes',
      title: 'other',
      data: { placement: 'right' },
      render: () => null
    })

    const group = model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!

    expect(group.panes).toEqual(['owner:pane'])
  })

  it('re-homes again on the NEXT boot after a drag persisted the stacked shape', async () => {
    const first = await setup()

    first.tree.watchContributedPanes()
    first.tree.$layoutTree.set(JSON.parse(JSON.stringify(stackedTree)))
    first.tree.persistTree()

    // Simulate the next launch: fresh module graph, persisted stacked tree.
    vi.resetModules()

    const second = await setup()

    second.tree.watchContributedPanes()

    const group = second.model.findGroupOfPane(second.tree.$layoutTree.get()!, 'owner:pane')!

    expect(group.panes).toEqual(['sessions', 'owner:pane'])
  })

  it('forces the tab strip visible when already co-located but hidden with the owner pane active', async () => {
    // Sessions and the owner-enforced pane already share one group, the
    // strip is hidden (headerHidden), and the owner pane holds the active tab — the
    // sessions pane exists but is unreachable. The re-home path never runs
    // (nothing to move), so the enforce must repair reachability directly.
    const hiddenStackedTree = {
      type: 'split',
      id: 'root',
      orientation: 'row',
      weights: [1, 3],
      children: [
        {
          type: 'group',
          id: 'g-left',
          panes: ['sessions', 'owner:pane'],
          active: 'owner:pane',
          headerHidden: true
        },
        { type: 'group', id: 'g-main', panes: ['workspace'], active: 'workspace' }
      ]
    }

    window.localStorage.setItem(TREE_KEY, JSON.stringify(hiddenStackedTree))

    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main' },
      render: () => null
    })
    registry.register({
      id: 'sessions',
      area: 'panes',
      title: 'sessions',
      data: { placement: 'left' },
      render: () => null
    })
    registry.register({
      id: 'owner:pane',
      area: 'panes',
      title: 'Owner pane',
      data: { placement: 'left', dock: { pane: 'sessions', pos: 'center', enforce: true } },
      render: () => null
    })

    tree.watchContributedPanes()

    const group = model.findGroupOfPane(tree.$layoutTree.get()!, 'owner:pane')!

    // Both panes stay put — but the strip is forced visible so SESSIONS is
    // reachable again. The active tab is NOT stolen mid-boot.
    expect(group.panes).toEqual(['sessions', 'owner:pane'])
    expect(group.headerHidden).not.toBe(true)
  })
})
