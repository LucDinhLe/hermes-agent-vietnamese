// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getActionStatus = vi.fn()
const getCuratorStatus = vi.fn()
const getMemoryStatus = vi.fn()
const revealDesktopPath = vi.fn()
const runBackup = vi.fn()
const runImportBackup = vi.fn()

vi.mock('@/hermes', () => ({
  getActionStatus: (...args: unknown[]) => getActionStatus(...args),
  getCuratorStatus: () => getCuratorStatus(),
  getMemoryStatus: () => getMemoryStatus(),
  resetMemory: vi.fn(),
  runBackup: () => runBackup(),
  runCurator: vi.fn(),
  runDebugShare: vi.fn(),
  runDoctor: vi.fn(),
  runImportBackup: (archive: string) => runImportBackup(archive),
  runSecurityAudit: vi.fn(),
  setCuratorPaused: vi.fn()
}))

vi.mock('@/lib/desktop-fs', () => ({
  revealDesktopPath: (path: string) => revealDesktopPath(path)
}))

vi.mock('@/store/activity', () => ({ upsertDesktopActionTask: vi.fn() }))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

beforeEach(() => {
  getCuratorStatus.mockResolvedValue({ enabled: false, last_run_at: null, paused: false })
  getMemoryStatus.mockResolvedValue({ active: 'builtin', builtin_files: { memory: 0, user: 0 } })
  getActionStatus.mockImplementation(async (name: string) => ({ exit_code: 0, lines: [], name, running: false }))

  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      selectPaths: vi.fn().mockResolvedValue(['C:\\Backups\\hermes-backup.zip'])
    }
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  Reflect.deleteProperty(window, 'hermesDesktop')
})

describe('MaintenancePanel backup flows', () => {
  it('creates a backup and reveals it only after the action succeeds', async () => {
    const archive = 'C:\\Backups\\hermes-backup.zip'
    runBackup.mockResolvedValue({ archive, name: 'backup', ok: true, pid: 42 })

    const { MaintenancePanel } = await import('./maintenance')
    render(<MaintenancePanel />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create backup' }))
    })

    await waitFor(() => expect(runBackup).toHaveBeenCalledOnce())
    const showButton = await screen.findByRole('button', { name: 'Show backup' })
    await waitFor(() => expect((showButton as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(showButton)
    expect(revealDesktopPath).toHaveBeenCalledWith(archive)
  })

  it('restores the zip selected in the native file picker after confirmation', async () => {
    runImportBackup.mockResolvedValue({ name: 'import', ok: true, pid: 43 })

    const { MaintenancePanel } = await import('./maintenance')
    render(<MaintenancePanel />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }))
    })

    await waitFor(() => expect(runImportBackup).toHaveBeenCalledWith('C:\\Backups\\hermes-backup.zip'))
    expect(window.confirm).toHaveBeenCalledOnce()
  })
})
