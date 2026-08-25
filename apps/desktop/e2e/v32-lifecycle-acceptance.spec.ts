/**
 * Windows Sandbox lifecycle phases for an exact installed Hermes binary.
 *
 * This spec is intentionally inert in the ordinary E2E suite. The lifecycle
 * guest invokes it once per phase with HERMES_LIFECYCLE_ACTION and supplies
 * guest-only HERMES_HOME, Electron userData, and screenshot paths. No phase
 * may run outside the disposable isolation mode validated by the lifecycle
 * guest or fall back to a dev Electron binary.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { _electron, expect, installErrorBannerGuard, test, type ElectronApplication, type Page } from './test'
import {
  PACKAGED_BINARY_PATH,
  buildAppEnv,
  type Sandbox,
  validatePackagedCandidateProvenance,
  waitForAppReady,
  waitForOnboarding,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { INTERIM_TEXTS, MOCK_REPLY, restartMockServer, startMockServer, type MockServer } from './mock-server'

const GUEST_STATE_ROOT = 'C:\\HermesLifecycle'
const GUEST_EVIDENCE_ROOT = 'C:\\HermesHarness\\Evidence'
const HOSTED_EVIDENCE_ROOT = 'C:\\HermesEvidence'
const TOOL_TRIGGER = 'E2E_INTERIM_TRIGGER'

const ACTIONS = [
  'onboarding',
  'safe-tool',
  'seed-v31',
  'verify-update',
  'verify-repair',
  'verify-lite-reinstall',
  'seed-v32-rollback',
  'verify-rollback',
  'uninstall-lite',
  'uninstall-full'
] as const

type LifecycleAction = (typeof ACTIONS)[number]

interface LifecycleContext {
  action: LifecycleAction
  binaryPath: string
  hermesHome: string
  screenshotPath: string
  userDataDir: string
}

interface RunningApp {
  app: ElectronApplication
  page: Page
}

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is required for lifecycle acceptance`)
  }

  return value.trim()
}

function requiredMarker(name: 'HERMES_LIFECYCLE_EXPECT_TEXT' | 'HERMES_LIFECYCLE_SEND_TEXT'): string {
  const value = requiredEnv(name)

  if (value.length > 512 || /[\r\n\0]/u.test(value)) {
    throw new Error(`${name} must be one non-empty line of at most 512 characters`)
  }

  return value
}

function isStrictlyWithin(parent: string, candidate: string): boolean {
  const relative = path.win32.relative(path.win32.resolve(parent), path.win32.resolve(candidate))

  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.win32.sep}`) &&
    !path.win32.isAbsolute(relative)
  )
}

function assertDistinctTrees(left: string, right: string, label: string): void {
  if (
    path.win32.resolve(left).toLowerCase() === path.win32.resolve(right).toLowerCase() ||
    isStrictlyWithin(left, right) ||
    isStrictlyWithin(right, left)
  ) {
    throw new Error(`${label} must be two disjoint guest directories`)
  }
}

function parseAction(raw: string): LifecycleAction {
  if (!(ACTIONS as readonly string[]).includes(raw)) {
    throw new Error(`unsupported HERMES_LIFECYCLE_ACTION: ${raw}`)
  }

  return raw as LifecycleAction
}

function requireAbsolutePath(name: string): string {
  const raw = requiredEnv(name)

  if (!path.win32.isAbsolute(raw)) {
    throw new Error(`${name} must be an absolute Windows guest path`)
  }

  return path.win32.resolve(raw)
}

function loadLifecycleContext(): LifecycleContext {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`lifecycle phases require Windows x64, got ${process.platform}/${process.arch}`)
  }

  const username = (process.env.USERNAME || os.userInfo().username).toLowerCase()
  const userProfile = path.win32.resolve(requiredEnv('USERPROFILE'))
  const isolationMode = requiredEnv('HERMES_LIFECYCLE_ISOLATION_MODE')
  const profileUsername = path.win32.basename(userProfile).toLowerCase()

  if (profileUsername !== username) {
    throw new Error('lifecycle phase refused a user profile that does not match the active guest account')
  }
  if (isolationMode === 'windows-sandbox') {
    if (username !== 'wdagutilityaccount') {
      throw new Error('lifecycle phase refused to launch outside Windows Sandbox WDAGUtilityAccount')
    }
  } else if (isolationMode === 'github-hosted-ephemeral-vm') {
    if (
      process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
      process.env.RUNNER_OS !== 'Windows'
    ) {
      throw new Error('lifecycle phase refused to launch outside a GitHub-hosted ephemeral Windows VM')
    }
  } else {
    throw new Error(`unsupported HERMES_LIFECYCLE_ISOLATION_MODE: ${isolationMode}`)
  }

  const action = parseAction(requiredEnv('HERMES_LIFECYCLE_ACTION'))
  const hermesHome = requireAbsolutePath('HERMES_LIFECYCLE_HERMES_HOME')
  const userDataDir = requireAbsolutePath('HERMES_LIFECYCLE_USER_DATA')
  const evidenceRoot = requireAbsolutePath('HERMES_LIFECYCLE_EVIDENCE_ROOT')
  const screenshotPath = requireAbsolutePath('HERMES_LIFECYCLE_SCREENSHOT')
  const binaryPath = requireAbsolutePath('HERMES_PACKAGED_BINARY_PATH')

  if (!isStrictlyWithin(GUEST_STATE_ROOT, hermesHome) || !isStrictlyWithin(GUEST_STATE_ROOT, userDataDir)) {
    throw new Error(`lifecycle state must stay beneath ${GUEST_STATE_ROOT}`)
  }
  if (isolationMode === 'windows-sandbox') {
    if (evidenceRoot.toLowerCase() !== path.win32.resolve(GUEST_EVIDENCE_ROOT).toLowerCase()) {
      throw new Error(`Windows Sandbox evidence root must be ${GUEST_EVIDENCE_ROOT}`)
    }
  } else if (!isStrictlyWithin(HOSTED_EVIDENCE_ROOT, evidenceRoot)) {
    throw new Error(`hosted lifecycle evidence root must stay beneath ${HOSTED_EVIDENCE_ROOT}`)
  }
  if (!isStrictlyWithin(evidenceRoot, screenshotPath)) {
    throw new Error('lifecycle screenshot must stay beneath HERMES_LIFECYCLE_EVIDENCE_ROOT')
  }
  if (path.win32.extname(screenshotPath).toLowerCase() !== '.png') {
    throw new Error('HERMES_LIFECYCLE_SCREENSHOT must name a PNG file')
  }
  if (isStrictlyWithin(userProfile, hermesHome) || isStrictlyWithin(userProfile, userDataDir)) {
    throw new Error('lifecycle state must not use the guest profile, so a host profile can never be substituted')
  }
  assertDistinctTrees(hermesHome, userDataDir, 'HERMES_HOME and Electron userData')

  const binaryStat = fs.statSync(binaryPath, { throwIfNoEntry: false })

  if (!binaryStat?.isFile() || path.win32.extname(binaryPath).toLowerCase() !== '.exe') {
    throw new Error(`exact installed executable is missing: ${binaryPath}`)
  }
  if (path.win32.resolve(PACKAGED_BINARY_PATH).toLowerCase() !== binaryPath.toLowerCase()) {
    throw new Error('fixture packaged path does not match HERMES_PACKAGED_BINARY_PATH')
  }
  if (fs.existsSync(screenshotPath)) {
    throw new Error(`refusing to overwrite lifecycle evidence: ${screenshotPath}`)
  }

  const requireProvenance = process.env.HERMES_LIFECYCLE_REQUIRE_PROVENANCE

  if (requireProvenance !== undefined && requireProvenance !== '0' && requireProvenance !== '1') {
    throw new Error('HERMES_LIFECYCLE_REQUIRE_PROVENANCE must be 0, 1, or unset')
  }
  if (requireProvenance === '1') {
    validatePackagedCandidateProvenance()
  }

  return { action, binaryPath, hermesHome, screenshotPath, userDataDir }
}

function ensureEmptyDirectory(directory: string, label: string): void {
  fs.mkdirSync(directory, { recursive: true })

  const entries = fs.readdirSync(directory)

  if (entries.length > 0) {
    throw new Error(`${label} must be empty before the real first-run phase; found ${entries.length} entries`)
  }
}

function ensureLifecycleDirectories(context: LifecycleContext): void {
  fs.mkdirSync(context.hermesHome, { recursive: true })
  fs.mkdirSync(context.userDataDir, { recursive: true })
  fs.mkdirSync(path.win32.dirname(context.screenshotPath), { recursive: true })
}

function buildExactAppEnv(context: LifecycleContext): Record<string, string> {
  const sandbox: Sandbox = {
    cleanup: () => undefined,
    hermesHome: context.hermesHome,
    root: GUEST_STATE_ROOT,
    userDataDir: context.userDataDir
  }
  const env = buildAppEnv(sandbox, {
    HERMES_DESKTOP_APP_NAME: `HermesLifecycle-${context.action}-${Date.now()}`,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  })

  // The exact installed candidate owns its renderer and resident runtime.
  // Harness controls are also withheld from the app process so it cannot use
  // the writable evidence path as product state.
  delete env.HERMES_DESKTOP_DEV_SERVER
  delete env.HERMES_DESKTOP_HERMES
  delete env.HERMES_DESKTOP_HERMES_ROOT
  delete env.HERMES_DESKTOP_BOOT_FAKE
  delete env.HERMES_DESKTOP_BOOT_FAKE_ERROR
  delete env.HERMES_DESKTOP_BOOT_FAKE_STEP_MS
  delete env.HERMES_PACKAGED_BINARY_PATH
  for (const name of Object.keys(env)) {
    if (name.startsWith('HERMES_LIFECYCLE_')) {
      delete env[name]
    }
  }

  if (env.HERMES_HOME !== context.hermesHome || env.HERMES_DESKTOP_USER_DATA_DIR !== context.userDataDir) {
    throw new Error('packaged launch environment escaped the requested guest-only state paths')
  }

  return env
}

async function launchExactBinary(context: LifecycleContext): Promise<RunningApp> {
  const app = await _electron.launch({
    args: ['--disable-gpu', '--no-sandbox'],
    env: buildExactAppEnv(context),
    executablePath: context.binaryPath
  })

  try {
    const page = await app.firstWindow()

    installErrorBannerGuard(page)

    return { app, page }
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}

async function waitForWindowVisible(app: ElectronApplication, page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        app
          .evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible()))
          .catch(() => false),
      { timeout: 60_000 }
    )
    .toBe(true)
  await page.bringToFront()
}

async function waitForReady(running: RunningApp): Promise<void> {
  await waitForAppReady(running as Parameters<typeof waitForAppReady>[0], 180_000)
  await waitForWindowVisible(running.app, running.page)
}

function transcript(page: Page) {
  return page.locator('[data-slot="aui_thread-viewport"]')
}

function composer(page: Page) {
  return page.locator('[data-slot="composer-rich-input"]:visible, [contenteditable="true"]:visible').first()
}

async function transcriptOccurrences(page: Page, text: string): Promise<number> {
  return transcript(page).evaluate((root, needle) => {
    const content = root.textContent ?? ''
    let count = 0
    let offset = 0

    while ((offset = content.indexOf(needle, offset)) !== -1) {
      count += 1
      offset += needle.length
    }

    return count
  }, text)
}

async function sendAndWaitForReply(
  page: Page,
  mock: MockServer,
  prompt: string,
  expectedReply = MOCK_REPLY
): Promise<void> {
  const input = composer(page)
  const before = mock.receivedPrompts.filter(received => received === prompt).length
  const beforeReply = await transcriptOccurrences(page, expectedReply)

  await expect(input).toBeVisible({ timeout: 30_000 })
  await input.click()
  await page.keyboard.insertText(prompt)
  await page.keyboard.press('Enter')
  await expect(transcript(page)).toContainText(prompt, { timeout: 30_000 })
  await expect
    .poll(() => mock.receivedPrompts.filter(received => received === prompt).length, { timeout: 60_000 })
    .toBeGreaterThan(before)
  await expect.poll(() => transcriptOccurrences(page, expectedReply), { timeout: 120_000 }).toBeGreaterThan(beforeReply)
}

async function proveSafeToolLoop(page: Page, mock: MockServer): Promise<void> {
  await sendAndWaitForReply(page, mock, TOOL_TRIGGER, INTERIM_TEXTS.finalText)

  // Each of the first four model completions asks Hermes to execute the safe
  // built-in todo tool. The fifth request and final answer are reachable only
  // after all four tool results have been returned through the resident agent.
  await expect
    .poll(() => mock.receivedPrompts.filter(received => received === TOOL_TRIGGER).length, { timeout: 120_000 })
    .toBeGreaterThanOrEqual(5)
  await expect(transcript(page)).toContainText(INTERIM_TEXTS.finalText)
}

async function assertPersistedAnchor(page: Page): Promise<void> {
  await expect(transcript(page)).toContainText(requiredMarker('HERMES_LIFECYCLE_EXPECT_TEXT'), {
    timeout: 120_000
  })
}

async function captureEvidence(page: Page, context: LifecycleContext): Promise<void> {
  await page.screenshot({ fullPage: true, path: context.screenshotPath })

  const stat = fs.statSync(context.screenshotPath, { throwIfNoEntry: false })

  if (!stat?.isFile() || stat.size === 0) {
    throw new Error(`lifecycle screenshot was not written: ${context.screenshotPath}`)
  }
}

async function openGuiUninstall(page: Page, mode: 'full' | 'lite'): Promise<void> {
  await page.getByRole('button', { name: /^(Open settings|Mở cài đặt)$/i }).click()
  await page.getByRole('button', { name: /^(About|Giới thiệu)$/i }).click()

  const option =
    mode === 'lite'
      ? page.getByRole('button', {
          name: /^(Uninstall GUI \+ agent, keep my data|Gỡ giao diện và AI agent, giữ dữ liệu)/i
        })
      : page.getByRole('button', {
          name: /^(Uninstall everything|Gỡ toàn bộ Hermes Vietnamese)/i
        })

  await expect(option).toBeVisible({ timeout: 60_000 })
  await option.click()
  await expect(page.getByText(/^(Confirm uninstall|Xác nhận gỡ cài đặt)$/i)).toBeVisible()
}

async function confirmGuiUninstall(running: RunningApp): Promise<void> {
  const child = running.app.process()

  await running.page.getByRole('button', { name: /^(Yes, uninstall|Đồng ý, gỡ cài đặt)$/i }).click()
  await expect.poll(() => child.exitCode !== null || child.signalCode !== null, { timeout: 120_000 }).toBe(true)
  expect(child.signalCode).toBeNull()
  expect(child.exitCode).toBe(0)
}

async function runOnboardingPhase(context: LifecycleContext): Promise<void> {
  ensureEmptyDirectory(context.hermesHome, 'HERMES_LIFECYCLE_HERMES_HOME')
  ensureEmptyDirectory(context.userDataDir, 'HERMES_LIFECYCLE_USER_DATA')
  fs.mkdirSync(path.win32.dirname(context.screenshotPath), { recursive: true })

  const running = await launchExactBinary(context)

  try {
    await waitForOnboarding(running.page, 180_000)
    await waitForWindowVisible(running.app, running.page)
    await expect(
      running.page.getByRole('heading', {
        name: /^(Let's get you setup with Hermes Agent|Hãy thiết lập Hermes Agent)$/i
      })
    ).toBeVisible()
    await expect(
      running.page.getByText(
        /Connect a model provider to start chatting|Kết nối nhà cung cấp model để bắt đầu trò chuyện/i
      )
    ).toBeVisible()

    // The home started truly empty. Seeing this live picker proves the exact
    // installed candidate reached real onboarding without preseeded mock
    // credentials or a fake boot flag.
    await captureEvidence(running.page, context)
  } finally {
    await running.app.close().catch(() => undefined)
  }
}

async function runConfiguredPhase(context: LifecycleContext): Promise<void> {
  ensureLifecycleDirectories(context)
  restartMockServer()
  const mock = await startMockServer()
  let running: RunningApp | null = null
  let uninstalled = false

  try {
    writeMockProviderConfig(context.hermesHome, mock.url)
    writeEnvFile(context.hermesHome)
    running = await launchExactBinary(context)
    await waitForReady(running)

    switch (context.action) {
      case 'safe-tool':
        await proveSafeToolLoop(running.page, mock)
        break
      case 'seed-v31':
      case 'seed-v32-rollback':
      case 'verify-rollback':
        await sendAndWaitForReply(running.page, mock, requiredMarker('HERMES_LIFECYCLE_SEND_TEXT'))
        break
      case 'verify-update':
        await assertPersistedAnchor(running.page)
        await proveSafeToolLoop(running.page, mock)
        break
      case 'verify-repair':
      case 'verify-lite-reinstall':
        await assertPersistedAnchor(running.page)
        await sendAndWaitForReply(running.page, mock, requiredMarker('HERMES_LIFECYCLE_SEND_TEXT'))
        break
      case 'uninstall-lite':
      case 'uninstall-full':
        await openGuiUninstall(running.page, context.action === 'uninstall-lite' ? 'lite' : 'full')
        await captureEvidence(running.page, context)
        await confirmGuiUninstall(running)
        uninstalled = true
        break
      case 'onboarding':
        throw new Error('onboarding must use the unconfigured lifecycle phase')
    }

    if (!uninstalled) {
      await captureEvidence(running.page, context)
    }
  } finally {
    if (!uninstalled && running) {
      await running.app.close().catch(() => undefined)
    }
    await mock.close()
  }
}

const actionConfigured = process.env.HERMES_LIFECYCLE_ACTION !== undefined

test.describe('v32 Windows Sandbox lifecycle phase', () => {
  test.describe.configure({ mode: 'serial', timeout: 360_000 })
  test.skip(!actionConfigured, 'Lifecycle harness controls are absent; this spec is sandbox-only.')

  test('runs one exact, guest-isolated lifecycle action', async () => {
    const context = loadLifecycleContext()

    if (context.action === 'onboarding') {
      await runOnboardingPhase(context)
    } else {
      await runConfiguredPhase(context)
    }
  })
})
