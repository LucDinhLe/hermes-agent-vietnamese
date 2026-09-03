import fs from 'node:fs'
import path from 'node:path'

import { _electron, expect, test, type ElectronApplication } from '@playwright/test'

import { PACKAGED_BINARY_PATH, stripCredentials, writeEnvFile, writeMockProviderConfig } from './fixtures'
import { startMockServer } from './mock-server'

// Opt-in: this Windows packaged candidate forces profile paths from APPDATA.
// The caller must seed ONLY Python dependencies in this isolated sandbox and
// preserve/restore the OS protocol registration around the test invocation.
test('packaged plus creates distinct tabs, sends once, and restores history on relaunch', async ({}, testInfo) => {
  test.setTimeout(600_000)
  const sandbox = process.env.HERMES_TAB_PLUS_SANDBOX
  test.skip(!sandbox || process.platform !== 'win32', 'Requires an isolated, dependency-seeded Windows sandbox')
  const root = path.resolve(sandbox!)
  expect(path.basename(root)).toMatch(/^hermes-tab-plus-/)
  const local = path.join(root, 'local')
  const roaming = path.join(root, 'roaming')
  const profile = path.join(local, 'hermes')
  const workspace = path.join(root, 'workspace')
  fs.mkdirSync(workspace, { recursive: true })
  expect(fs.existsSync(path.join(profile, 'hermes-agent', '.venv', 'Scripts', 'python.exe'))).toBe(true)
  expect(fs.existsSync(path.join(profile, 'auth.json'))).toBe(false)
  fs.mkdirSync(path.join(roaming, 'Hermes'), { recursive: true })
  fs.writeFileSync(path.join(roaming, 'Hermes', 'zoom-state.json'), '{"zoomLevel":0}')
  const mock = await startMockServer()
  writeMockProviderConfig(profile, mock.url, undefined, 'advisor:\n  enabled: false')
  writeEnvFile(profile)
  const env = {
    ...stripCredentials(process.env),
    LOCALAPPDATA: local,
    APPDATA: roaming,
    HERMES_DESKTOP_APP_NAME: 'HermesTabPlusAcceptance',
    HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1',
    HERMES_DESKTOP_CWD: workspace,
    PYTHONDONTWRITEBYTECODE: '1',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  }
  for (const key of [
    'HERMES_DESKTOP_BOOT_FAKE',
    'HERMES_DESKTOP_DEV_SERVER',
    'HERMES_DESKTOP_HERMES_ROOT',
    'HERMES_DESKTOP_HERMES'
  ])
    delete (env as Record<string, string>)[key]
  let app: ElectronApplication | undefined
  const launch = async () => {
    app = await _electron.launch({
      executablePath: PACKAGED_BINARY_PATH,
      // Electron resolves OS userData independently of the APPDATA env var.
      // Pin Chromium's path too so the real app's single-instance lock and
      // localStorage are never reused by this packaged acceptance process.
      args: ['--disable-gpu', '--no-sandbox', `--user-data-dir=${path.join(roaming, 'Hermes')}`],
      env,
      cwd: workspace,
      timeout: 300_000
    })
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(path.join(roaming, 'Hermes'))
    const page = await app.firstWindow()
    await page.locator('[data-session-tab-plus] button').first().waitFor({ state: 'visible', timeout: 300_000 })
    return page
  }
  try {
    const page = await launch()
    const group = page
      .locator('[data-tree-group]')
      .filter({ has: page.locator('[data-session-tab-plus]') })
      .first()
    const tabs = group.locator('[data-tree-tab]')
    const initial = await tabs.count()
    for (let index = 1; index <= 3; index++) {
      await group.locator('[data-session-tab-plus] button').click()
      await expect(tabs).toHaveCount(initial + index, { timeout: 30_000 })
      await expect(group.locator('[contenteditable="true"]:visible').first()).toBeEditable()
    }
    const message = 'Tab plus persistence acceptance 7319'
    const composer = group.locator('[contenteditable="true"]:visible').first()
    await composer.click()
    await composer.pressSequentially(message, { delay: 20 })
    await group.locator('button[type="submit"]:visible').click()
    await expect(composer).toHaveText('', { timeout: 15_000 })
    await expect(group.getByText(/Hello from the mock inference server/)).toBeVisible({ timeout: 90_000 })
    await page.screenshot({ path: testInfo.outputPath('three-tabs-first-send.png') })
    await app!.close()
    app = undefined
    const reopened = await launch()
    await expect(reopened.getByText(message, { exact: true }).first()).toBeVisible({ timeout: 90_000 })
    await expect(reopened.getByText(/Hello from the mock inference server/).first()).toBeVisible({ timeout: 30_000 })
    await reopened.screenshot({ path: testInfo.outputPath('tab-history-after-relaunch.png') })
  } finally {
    if (app) {
      const page = app.windows()[0]
      if (page) await page.screenshot({ path: testInfo.outputPath('last-state.png') }).catch(() => undefined)
      await app.close().catch(() => undefined)
    }
    await mock.close()
  }
})
