/**
 * Windows Sandbox lifecycle phases for an exact installed Hermes binary.
 *
 * This spec is intentionally inert in the ordinary E2E suite. The lifecycle
 * guest invokes it once per phase with HERMES_LIFECYCLE_ACTION and supplies
 * guest-only HERMES_HOME, Electron userData, and screenshot paths. No phase
 * may run outside the disposable isolation mode validated by the lifecycle
 * guest or fall back to a dev Electron binary.
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import {
  buildAppEnv,
  PACKAGED_BINARY_PATH,
  type Sandbox,
  validatePackagedCandidateProvenance,
  waitForAppReady,
  waitForOnboarding,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { INTERIM_TEXTS, MOCK_REPLY, type MockServer, restartMockServer, startMockServer } from './mock-server'
import { _electron, type ElectronApplication, expect, installErrorBannerGuard, type Page, test } from './test'

const GUEST_STATE_ROOT = 'C:\\HermesLifecycle'
const GUEST_EVIDENCE_ROOT = 'C:\\HermesHarness\\Evidence'
const HOSTED_EVIDENCE_ROOT = 'C:\\HermesEvidence'
const TOOL_TRIGGER = 'E2E_INTERIM_TRIGGER'
const PROJECT_SESSION_MARKER = 'V321_PROJECT_SESSION_SAFETY_ANCHOR'
const PROJECT_SESSION_TITLE = 'V32.1 project session safety'
const PROJECT_HIDE_ID = 'p_lifecycle_hide'
const PROJECT_HIDE_NAME = 'Lifecycle Hide Safety'
const PROJECT_DELETE_ID = 'p_lifecycle_delete'
const PROJECT_DELETE_NAME = 'Lifecycle Delete Safety'

const selfUninstallAction =
  process.env.HERMES_LIFECYCLE_ACTION === 'uninstall-lite' || process.env.HERMES_LIFECYCLE_ACTION === 'uninstall-full'

// A GUI uninstall intentionally terminates the Electron transport itself.
// The generic Playwright recorder otherwise retains that dead transport until
// the worker timeout even after the test and after-hooks finish. Uninstall
// phases preserve their mandatory explicit screenshot before confirmation;
// only their generic per-page recorder is disabled.
test.use(selfUninstallAction ? { screenshot: 'off', trace: 'off' } : {})

const ACTIONS = [
  'onboarding',
  'project-session-safety',
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
  evidenceRoot: string
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

  return { action, binaryPath, evidenceRoot, hermesHome, screenshotPath, userDataDir }
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
    no_proxy: '127.0.0.1,localhost',
    // These two phases deliberately exercise a real multi-turn tool loop.
    // Pin only the built-in, side-effect-free todo schema so the isolated
    // profile cannot inherit a workspace coding posture or expose any host-
    // facing toolsets. The installed runtime still owns tool validation and
    // execution; the harness only makes the exact tested schema available.
    ...(context.action === 'safe-tool' || context.action === 'verify-update' ? { HERMES_TUI_TOOLSETS: 'todo' } : {})
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

interface SessionSafetySnapshot {
  archived: number
  cwd: string
  hidden: number
  id: string
  messageCount: number
  messageDigest: string
  title: string
}

function readSessionSafetySnapshot(hermesHome: string): SessionSafetySnapshot {
  const database = new DatabaseSync(path.win32.join(hermesHome, 'state.db'), { readOnly: true })

  try {
    const match = database
      .prepare(
        `SELECT session_id
           FROM messages
          WHERE instr(COALESCE(content, ''), ?) > 0
          ORDER BY id DESC
          LIMIT 1`
      )
      .get(PROJECT_SESSION_MARKER) as { session_id?: string } | undefined

    if (!match?.session_id) {
      throw new Error('project/session safety marker is missing from state.db')
    }

    const session = database
      .prepare('SELECT id, cwd, title, archived, hidden FROM sessions WHERE id = ?')
      .get(match.session_id) as
      { archived: number; cwd: null | string; hidden: number; id: string; title: null | string } | undefined

    const messages = database
      .prepare('SELECT id, role, content, active, compacted FROM messages WHERE session_id = ? ORDER BY id')
      .all(match.session_id) as Array<Record<string, unknown>>

    if (!session || !session.cwd) {
      throw new Error('project/session safety session is missing a project-addressable cwd')
    }

    return {
      archived: Number(session.archived),
      cwd: session.cwd,
      hidden: Number(session.hidden),
      id: session.id,
      messageCount: messages.length,
      messageDigest: createHash('sha256').update(JSON.stringify(messages), 'utf8').digest('hex'),
      title: session.title ?? ''
    }
  } finally {
    database.close()
  }
}

function setSessionSafetyTitle(hermesHome: string, sessionId: string): void {
  const database = new DatabaseSync(path.win32.join(hermesHome, 'state.db'))

  try {
    database
      .prepare("UPDATE sessions SET title = ?, title_source = 'user' WHERE id = ?")
      .run(PROJECT_SESSION_TITLE, sessionId)
  } finally {
    database.close()
  }
}

function seedProjectSafetyFixtures(hermesHome: string, cwd: string): void {
  const database = new DatabaseSync(path.win32.join(hermesHome, 'projects.db'))
  const parent = path.win32.dirname(cwd)
  const now = Math.floor(Date.now() / 1000)

  try {
    database.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        description TEXT, icon TEXT, color TEXT, board_slug TEXT,
        primary_path TEXT, created_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS project_folders (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL, label TEXT, is_primary INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL, PRIMARY KEY (project_id, path)
      );
      CREATE INDEX IF NOT EXISTS idx_project_folders_path ON project_folders(path);
      CREATE TABLE IF NOT EXISTS project_meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS discovered_repos (
        root TEXT PRIMARY KEY, label TEXT, last_seen INTEGER NOT NULL
      );
      DELETE FROM project_folders WHERE project_id IN ('${PROJECT_HIDE_ID}', '${PROJECT_DELETE_ID}');
      DELETE FROM projects WHERE id IN ('${PROJECT_HIDE_ID}', '${PROJECT_DELETE_ID}');
    `)

    const insertProject = database.prepare(
      `INSERT INTO projects (id, slug, name, primary_path, created_at, archived)
       VALUES (?, ?, ?, ?, ?, 0)`
    )

    const insertFolder = database.prepare(
      `INSERT INTO project_folders (project_id, path, label, is_primary, added_at)
       VALUES (?, ?, NULL, 1, ?)`
    )

    database.exec('BEGIN IMMEDIATE')

    try {
      insertProject.run(PROJECT_HIDE_ID, 'lifecycle-hide-safety', PROJECT_HIDE_NAME, cwd, now)
      insertFolder.run(PROJECT_HIDE_ID, cwd, now)
      insertProject.run(PROJECT_DELETE_ID, 'lifecycle-delete-safety', PROJECT_DELETE_NAME, parent, now + 1)
      insertFolder.run(PROJECT_DELETE_ID, parent, now + 1)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  } finally {
    database.close()
  }
}

function readProjectArchived(hermesHome: string, projectId: string): null | number {
  const database = new DatabaseSync(path.win32.join(hermesHome, 'projects.db'), { readOnly: true })

  try {
    const row = database.prepare('SELECT archived FROM projects WHERE id = ?').get(projectId) as
      { archived: number } | undefined

    return row ? Number(row.archived) : null
  } finally {
    database.close()
  }
}

function expectSessionSafetyUnchanged(before: SessionSafetySnapshot, after: SessionSafetySnapshot): void {
  expect(after.id).toBe(before.id)
  expect(after.archived).toBe(0)
  expect(after.hidden).toBe(0)
  expect(after.messageCount).toBe(before.messageCount)
  expect(after.messageDigest).toBe(before.messageDigest)
  expect(after.title).toBe(PROJECT_SESSION_TITLE)
}

async function openProjectsManager(page: Page): Promise<void> {
  const projectsNavigation = page
    .locator('button[data-sidebar="menu-button"]')
    .filter({ hasText: /^(Projects|Dự án)$/i })

  await expect(projectsNavigation).toHaveAccessibleName(/^(Projects|Dự án)$/i)
  await projectsNavigation.press('Enter')
  await expect(page.getByRole('heading', { name: /^(Projects|Dự án)$/i })).toBeVisible({ timeout: 60_000 })
}

function projectCard(page: Page, name: string) {
  return page.locator('article').filter({ has: page.getByRole('heading', { exact: true, name }) })
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
  // The rich input is contenteditable inside an interactive composer surface.
  // Targeting the inner node with a pointer can be intercepted by that surface
  // even though the editor is visible; Playwright's contenteditable fill plus
  // Enter exercises the same keyboard send path without hit-testing a child
  // beneath its pointer-owning wrapper.
  await input.fill(prompt)
  await expect(input).toHaveText(prompt)
  await input.press('Enter')
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

async function activateTopmostVisibleButton(page: Page, name: RegExp, timeout = 30_000): Promise<void> {
  const buttons = page.getByRole('button', { name })

  await expect
    .poll(
      async () => {
        for (let index = (await buttons.count()) - 1; index >= 0; index -= 1) {
          const button = buttons.nth(index)

          if (!(await button.isVisible())) {
            continue
          }

          // Keep the exact handle that passed hit-testing. Settings contains a
          // responsive navigation copy behind the modal; re-resolving the
          // locator after this check can select that covered copy if React
          // reorders the matching nodes between animation frames.
          const element = await button.elementHandle()

          if (element === null) {
            continue
          }

          try {
            // About places the uninstall choices below the initial viewport.
            // Reveal the exact semantic button first, then require it to pass
            // a fresh topmost hit-test before any keyboard activation.
            await element.scrollIntoViewIfNeeded()

            const receivesPointer = await element.evaluate(node => {
              const rect = node.getBoundingClientRect()
              const x = rect.left + rect.width / 2
              const y = rect.top + rect.height / 2
              const hitTarget = document.elementFromPoint(x, y)

              return hitTarget !== null && (hitTarget === node || node.contains(hitTarget))
            })

            if (!receivesPointer) {
              continue
            }

            // The Electron shell can still consume pointer dispatch between
            // DOM hit-testing and a click in this responsive Settings modal.
            // Activate the exact, on-screen native button through its standard
            // keyboard path; Enter is a real user input and does not require a
            // forced click or a synthetic DOM event.
            await element.press('Enter')

            return true
          } catch {
            // A responsive Settings render may detach a previously visible
            // node. Rescan and activate only a newly hit-testable exact handle.
          } finally {
            await element.dispose()
          }
        }

        return false
      },
      { timeout }
    )
    .toBe(true)
}

async function openGuiUninstall(page: Page, mode: 'full' | 'lite'): Promise<void> {
  // The public Windows settings shortcut is intentionally global, including
  // while the composer owns focus. Use that real user path here because the
  // fixed settings glyph can share pixels with Electron's draggable titlebar
  // strip in a narrow lifecycle window; a locator click would then fail at hit
  // testing before it could exercise the uninstall UI at all.
  await page.keyboard.press('Control+,')

  await activateTopmostVisibleButton(page, /^(About|Giới thiệu)$/i)

  const optionName =
    mode === 'lite'
      ? /^(Uninstall GUI \+ agent, keep my data|Gỡ giao diện và AI agent, giữ dữ liệu)/i
      : /^(Uninstall everything|Gỡ toàn bộ Hermes Vietnamese)/i

  await activateTopmostVisibleButton(page, optionName, 60_000)
  await expect(page.getByText(/^(Confirm uninstall|Xác nhận gỡ cài đặt)$/i)).toBeVisible()
}

async function confirmGuiUninstall(running: RunningApp): Promise<void> {
  const child = running.app.process()

  await activateTopmostVisibleButton(running.page, /^(Yes, uninstall|Đồng ý, gỡ cài đặt)$/i)
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

async function runProjectSessionSafetyPhase(context: LifecycleContext): Promise<void> {
  ensureLifecycleDirectories(context)
  restartMockServer()
  const mock = await startMockServer()
  const projectWorkspace = path.win32.join(GUEST_STATE_ROOT, 'ProjectSafety', 'HideWorkspace')
  let running: RunningApp | null = null

  try {
    fs.mkdirSync(projectWorkspace, { recursive: true })
    writeMockProviderConfig(context.hermesHome, mock.url)
    writeEnvFile(context.hermesHome)
    // Seed the isolated project database before Hermes opens it. Writing the
    // fixture after launch races the app's project-store initialization and
    // can fail with SQLITE_BUSY even though the product data is healthy.
    seedProjectSafetyFixtures(context.hermesHome, projectWorkspace)
    running = await launchExactBinary(context)
    await waitForReady(running)

    // A bare new chat is intentionally detached (`cwd = null`). Seed only the
    // isolated project metadata, enter that project through the public UI, and
    // then start a new session through the real shortcut. The send path must
    // derive its cwd from the entered project; no existing session is coerced.
    await openProjectsManager(running.page)

    const hideCard = projectCard(running.page, PROJECT_HIDE_NAME)
    const deleteCard = projectCard(running.page, PROJECT_DELETE_NAME)

    await expect(hideCard).toBeVisible({ timeout: 60_000 })
    await expect(deleteCard).toBeVisible({ timeout: 60_000 })
    await hideCard.getByRole('button', { name: /^(Open project|Mở dự án)$/i }).press('Enter')

    const sessionsRoot = running.page.locator('[data-sessions-mode]')
    await expect(sessionsRoot).toHaveAttribute('data-sessions-project', PROJECT_HIDE_ID, { timeout: 60_000 })
    await running.page.keyboard.press('Control+N')
    await expect(transcript(running.page)).not.toContainText(MOCK_REPLY, { timeout: 30_000 })
    await sendAndWaitForReply(running.page, mock, PROJECT_SESSION_MARKER)
    await expect
      .poll(() => readSessionSafetySnapshot(context.hermesHome).messageCount, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2)

    const seeded = readSessionSafetySnapshot(context.hermesHome)
    setSessionSafetyTitle(context.hermesHome, seeded.id)
    const before = readSessionSafetySnapshot(context.hermesHome)

    expect(before.archived).toBe(0)
    expect(before.hidden).toBe(0)
    expect(before.messageCount).toBeGreaterThanOrEqual(2)
    expect(before.title).toBe(PROJECT_SESSION_TITLE)
    expect(path.win32.resolve(before.cwd).toLowerCase()).toBe(path.win32.resolve(projectWorkspace).toLowerCase())
    await running.page
      .getByRole('button', {
        name: new RegExp(`^(Hide ${PROJECT_HIDE_NAME} sessions|Ẩn ${PROJECT_HIDE_NAME} phiên)$`, 'i')
      })
      .press('Enter')
    await expect(
      running.page.getByRole('button', {
        name: new RegExp(`^(Show ${PROJECT_HIDE_NAME} sessions|Hiển thị ${PROJECT_HIDE_NAME} phiên)$`, 'i')
      })
    ).toBeVisible()
    await running.page
      .getByRole('button', {
        name: new RegExp(`^(Show ${PROJECT_HIDE_NAME} sessions|Hiển thị ${PROJECT_HIDE_NAME} phiên)$`, 'i')
      })
      .press('Enter')
    await running.page.getByRole('button', { name: /^(All projects|Tất cả dự án)/i }).press('Enter')
    await expect(sessionsRoot).toHaveAttribute('data-sessions-mode', 'projects')

    await openProjectsManager(running.page)
    await projectCard(running.page, PROJECT_HIDE_NAME)
      .getByRole('button', { name: /^(Hide from projects|Ẩn khỏi danh sách dự án)$/i })
      .click()
    await expect.poll(() => readProjectArchived(context.hermesHome, PROJECT_HIDE_ID), { timeout: 30_000 }).toBe(1)
    expectSessionSafetyUnchanged(before, readSessionSafetySnapshot(context.hermesHome))

    const remainingDeleteCard = projectCard(running.page, PROJECT_DELETE_NAME)
    await expect(remainingDeleteCard).toBeVisible({ timeout: 60_000 })
    await remainingDeleteCard.getByRole('button', { name: /^(Delete|Xóa)$/i }).click()
    const confirm = running.page.getByRole('dialog').filter({ hasText: PROJECT_DELETE_NAME })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: /^(Delete|Xóa)$/i }).click()
    await expect.poll(() => readProjectArchived(context.hermesHome, PROJECT_DELETE_ID), { timeout: 30_000 }).toBeNull()
    expectSessionSafetyUnchanged(before, readSessionSafetySnapshot(context.hermesHome))

    await running.app.close()
    running = null

    // Relaunch the same exact installed binary and profile. Project scope must
    // not persist; the session and every message must still be discoverable.
    running = await launchExactBinary(context)
    await waitForReady(running)
    const search = running.page.getByPlaceholder(/^(Search sessions|Tìm phiên)/i)
    await expect(search).toBeVisible({ timeout: 60_000 })
    await search.fill(PROJECT_SESSION_TITLE)

    const sessionResult = running.page
      .locator('[data-sessions-mode]')
      .getByText(PROJECT_SESSION_TITLE, { exact: true })
      .first()

    await expect(sessionResult).toBeVisible({ timeout: 60_000 })
    await sessionResult.click()
    await assertPersistedAnchor(running.page)
    await expect
      .poll(() => running?.page.locator('[data-sessions-mode]').getAttribute('data-sessions-mode'))
      .not.toBe('project')

    const afterRelaunch = readSessionSafetySnapshot(context.hermesHome)
    expectSessionSafetyUnchanged(before, afterRelaunch)
    await captureEvidence(running.page, context)
    fs.writeFileSync(
      path.win32.join(context.evidenceRoot, 'project-session-safety.json'),
      `${JSON.stringify(
        {
          actions: ['open', 'collapse', 'return-all-projects', 'hide-metadata', 'delete-metadata', 'relaunch'],
          messageCount: afterRelaunch.messageCount,
          messageDigest: afterRelaunch.messageDigest,
          projectDeleteRemoved: readProjectArchived(context.hermesHome, PROJECT_DELETE_ID) === null,
          projectHideArchived: readProjectArchived(context.hermesHome, PROJECT_HIDE_ID) === 1,
          relaunchScope: 'all-projects',
          sessionArchived: afterRelaunch.archived,
          sessionHidden: afterRelaunch.hidden,
          sessionId: afterRelaunch.id
        },
        null,
        2
      )}\n`,
      'utf8'
    )
  } finally {
    if (running) {
      await running.app.close().catch(() => undefined)
    }

    await mock.close()
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

      case 'project-session-safety':
        throw new Error('project-session-safety must use its dedicated relaunch phase')

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
  // Every phase mutates a real installed profile. A Playwright retry would
  // reuse that dirty state and replace the original failure with a misleading
  // "first run must be empty" error, so the lifecycle harness retries only by
  // starting a fresh disposable VM.
  test.describe.configure({ mode: 'serial', retries: 0, timeout: 360_000 })
  test.skip(!actionConfigured, 'Lifecycle harness controls are absent; this spec is sandbox-only.')

  test('runs one exact, guest-isolated lifecycle action', async () => {
    const context = loadLifecycleContext()

    if (context.action === 'onboarding') {
      await runOnboardingPhase(context)
    } else if (context.action === 'project-session-safety') {
      await runProjectSessionSafetyPhase(context)
    } else {
      await runConfiguredPhase(context)
    }
  })
})
