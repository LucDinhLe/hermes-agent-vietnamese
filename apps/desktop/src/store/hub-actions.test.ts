import { beforeEach, describe, expect, it, vi } from 'vitest'

const getActionStatus = vi.fn()
const installSkillFromHub = vi.fn()

vi.mock('@/hermes', () => ({
  getActionStatus: (...args: unknown[]) => getActionStatus(...args),
  installSkillFromHub: (...args: unknown[]) => installSkillFromHub(...args),
  setApiRequestConnection: vi.fn(),
  setApiRequestProfile: vi.fn(),
  uninstallSkillFromHub: vi.fn(),
  updateSkillsFromHub: vi.fn()
}))

vi.mock('@/store/activity', () => ({ upsertDesktopActionTask: vi.fn() }))

describe('source-qualified hub actions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { $hubActions, $hubInstalledOverride, $hubActiveLog } = await import('./hub-actions')
    $hubActions.set({})
    $hubInstalledOverride.set({})
    $hubActiveLog.set(null)
  })

  it('keeps deferred same-profile actions isolated across backend sources', async () => {
    let finishSourceA: ((value: unknown) => void) | undefined

    const sourceAStatus = new Promise(resolve => {
      finishSourceA = resolve
    })

    installSkillFromHub.mockImplementation(async (_identifier, _profile, connectionId) => ({
      name: `install-${connectionId}`
    }))
    getActionStatus.mockImplementation(async (_name, _lines, _profile, connectionId) => {
      if (connectionId === 'source-a') {
        return sourceAStatus
      }

      return { exit_code: 0, lines: ['done-b'], name: 'install-source-b', running: false }
    })

    const { $hubActions, hubActionKey, installHubSkill } = await import('./hub-actions')
    const actionA = installHubSkill('research', 'default', 'source-a')
    const actionB = installHubSkill('research', 'default', 'source-b')

    await actionB

    const keyA = hubActionKey('research', 'default', 'source-a')
    const keyB = hubActionKey('research', 'default', 'source-b')
    expect($hubActions.get()[keyA]?.running).toBe(true)
    expect($hubActions.get()[keyB]).toMatchObject({ lines: ['done-b'], running: false })

    finishSourceA?.({ exit_code: 0, lines: ['done-a'], name: 'install-source-a', running: false })
    await actionA

    expect($hubActions.get()[keyA]).toMatchObject({ lines: ['done-a'], running: false })
    expect($hubActions.get()[keyB]).toMatchObject({ lines: ['done-b'], running: false })
  })
})
