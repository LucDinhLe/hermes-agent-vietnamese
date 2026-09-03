// Stage into apps/desktop/e2e only after freezing the candidate bytes.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { _electron, expect, test, type ElectronApplication } from '@playwright/test'
import { stripCredentials, writeEnvFile, writeMockProviderConfig } from './fixtures'
import { startMockServer } from './mock-server'

type UninstallWindow = Window & {
  hermesDesktop: {
    uninstall: {
      summary(): Promise<{ agent_installed: boolean }>
      run(mode: 'lite' | 'full'): Promise<{ ok: boolean }>
    }
  }
}

test('exact installed calendar lifecycle', async ({}, testInfo) => {
  test.setTimeout(720_000)
  expect(process.env.GITHUB_ACTIONS).toBe('true')
  expect(process.env.RUNNER_ENVIRONMENT).toBe('github-hosted')
  expect(process.platform).toBe('win32')
  const binary = process.env.HERMES_ACCEPTANCE_BINARY!
  const root = path.resolve(process.env.HERMES_TAB_PLUS_SANDBOX!)
  expect(path.basename(root)).toMatch(/^hermes-tab-plus-/)
  const action = process.env.HERMES_CALENDAR_ACTION ?? 'smoke'
  const legacy = process.env.HERMES_ACCEPTANCE_LEGACY === '1'
  const local = path.join(root, 'local')
  const roaming = path.join(root, 'roaming')
  const profile = path.join(local, 'hermes')
  const workspace = path.join(root, 'workspace')
  fs.mkdirSync(workspace, { recursive: true })
  fs.mkdirSync(profile, { recursive: true })
  fs.mkdirSync(path.join(roaming, 'Hermes'), { recursive: true })
  fs.writeFileSync(path.join(roaming, 'Hermes', 'zoom-state.json'), '{"zoomLevel":0}')
  const mock = await startMockServer()
  writeMockProviderConfig(profile, mock.url, undefined, 'advisor:\n  enabled: false')
  writeEnvFile(profile)
  const env: Record<string, string | undefined> = {
    ...stripCredentials(process.env),
    LOCALAPPDATA: local,
    APPDATA: roaming,
    HERMES_HOME: profile,
    HERMES_DESKTOP_USER_DATA_DIR: path.join(roaming, 'Hermes'),
    HERMES_DESKTOP_APP_NAME: 'HermesCalendarAcceptance',
    HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1',
    HERMES_DESKTOP_CWD: workspace,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONNOUSERSITE: '1',
    PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot};${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0`,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  }
  for (const key of [
    'HERMES_DESKTOP_BOOT_FAKE',
    'HERMES_DESKTOP_DEV_SERVER',
    'HERMES_DESKTOP_HERMES_ROOT',
    'HERMES_DESKTOP_HERMES',
    'PYTHONHOME',
    'PYTHONPATH'
  ])
    delete env[key]
  let app: ElectronApplication | undefined
  const launchEnv = Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
  const launch = async () => {
    const diagnostics = setInterval(() => {
      try {
      const runtimeDir = path.join(profile, 'runtimes')
      console.log('Startup progress:', fs.existsSync(runtimeDir)
        ? fs.readdirSync(runtimeDir).map(name => ({ name, files: fs.readdirSync(path.join(runtimeDir, name), { recursive: true }).length }))
        : 'runtime not materialized')
      console.log(execFileSync(path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-Command',
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; Get-Process Hermes -ErrorAction SilentlyContinue | ForEach-Object { $text=@(); if ($_.MainWindowHandle -ne 0) { $window=[System.Windows.Automation.AutomationElement]::FromHandle($_.MainWindowHandle); $text=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name }) }; [pscustomobject]@{Id=$_.Id;CPU=$_.CPU;Title=$_.MainWindowTitle;Text=$text} } | ConvertTo-Json -Depth 5; exit 0"],
        { encoding: 'utf8', windowsHide: true, timeout: 10_000 }))
      } catch (error) {
        console.log('Startup diagnostics unavailable:', String(error))
      }
    }, 30_000)
    try {
      app = await _electron.launch({
      executablePath: binary,
      cwd: workspace,
      env: launchEnv,
      args: ['--disable-gpu', '--no-sandbox', `--user-data-dir=${path.join(roaming, 'Hermes')}`],
      timeout: 300_000
      })
    } finally {
      clearInterval(diagnostics)
    }
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(path.join(roaming, 'Hermes'))
    const page = await app.firstWindow()
    await page.locator('[data-session-tab-plus] button').first().waitFor({ state: 'visible', timeout: 300_000 })
    await page
      .getByRole('button', { name: 'Gateway: Đã kết nối', exact: true })
      .waitFor({ state: 'visible', timeout: 300_000 })
    return page
  }
  try {
    const page = await launch()
    if (action.startsWith('uninstall-')) {
      const mode = action.slice('uninstall-'.length)
      expect(['lite', 'full']).toContain(mode)
      const summary = await page.evaluate(() =>
        (window as unknown as UninstallWindow).hermesDesktop.uninstall.summary()
      )
      expect(summary.agent_installed).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('before-uninstall.png') })
      const result = await page.evaluate(
        mode => (window as unknown as UninstallWindow).hermesDesktop.uninstall.run(mode as 'lite' | 'full'),
        mode
      )
      expect(result.ok).toBe(true)
      const child = app!.process()
      if (child.exitCode === null) await new Promise<void>(resolve => child.once('exit', () => resolve()))
      app = undefined
      return
    }
    if (process.env.HERMES_EXPECT_OLD_HISTORY === '1') {
      await page
        .getByText(/Hello from the mock inference server/)
        .first()
        .click({ timeout: 90_000 })
      await expect(page.getByText('Calendar persisted message 9127', { exact: true }).first()).toBeVisible({
        timeout: 60_000
      })
    }
    const group = page
      .locator('[data-tree-group]')
      .filter({ has: page.locator('[data-session-tab-plus]') })
      .first()
    const tabs = group.locator('[data-tree-tab]')
    const initial = await tabs.count()
    for (let i = 1; i <= 3; i++) {
      await group.locator('[data-session-tab-plus] button').click()
      await expect(tabs).toHaveCount(initial + i, { timeout: 30_000 })
    }
    const composer = group.locator('[contenteditable="true"]:visible').first()
    await composer.fill('Calendar persisted message 9127')
    await group.locator('button[type="submit"]:visible').click()
    await expect(group.getByText(/Hello from the mock inference server/)).toBeVisible({ timeout: 90_000 })
    await page.screenshot({ path: testInfo.outputPath('three-tabs-chat.png') })
    if (!legacy) {
      await composer.fill('E2E_INTERIM_TRIGGER')
      await group.locator('button[type="submit"]:visible').click()
      await expect(group.getByText('All done! Here is the complete summary of what I found.')).toBeVisible({
        timeout: 120_000
      })
      await page.screenshot({ path: testInfo.outputPath('safe-todo-tool.png') })
    }
    await app!.close()
    app = undefined
    if (!legacy) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(path.dirname(binary), 'resources/advisor-runtime/runtime-manifest.json'), 'utf8')
      )
      expect(manifest.productVersion).toBe('2026.9.2')
      expect(manifest.buildCommit).toBe(process.env.HERMES_CANDIDATE_COMMIT)
      const python = path.join(local, 'hermes/runtimes', manifest.candidateId, '.python/python.exe')
      const result = execFileSync(
        python,
        [
          '-I',
          '-B',
          '-c',
          "import sqlite3,sys; c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); rows=c.execute(\"select content from messages where role='tool' and tool_name='todo'\").fetchall(); assert rows, 'no persisted todo result'; assert any('error' not in str(r[0]).lower() for r in rows), 'todo failed'; print('persisted safe todo result PASS')",
          path.join(profile, 'state.db')
        ],
        { env, encoding: 'utf8', timeout: 30_000, windowsHide: true }
      )
      expect(result).toContain('PASS')
    }
    const reopened = await launch()
    await reopened
      .getByText(/Hello from the mock inference server|All done! Here is the complete summary/)
      .first()
      .click({ timeout: 90_000 })
    await expect(reopened.getByText('Calendar persisted message 9127', { exact: true }).first()).toBeVisible({
      timeout: 60_000
    })
    await reopened.screenshot({ path: testInfo.outputPath('history-after-relaunch.png') })
  } finally {
    if (app) {
      await app
        .windows()[0]
        ?.screenshot({ path: testInfo.outputPath('last-state.png') })
        .catch(() => undefined)
      await app.close().catch(() => undefined)
    }
    await mock.close()
  }
})
