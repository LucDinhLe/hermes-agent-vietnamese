/**
 * Runtime acceptance for the immutable V33 dev.8 Windows candidate.
 *
 * The installed application owns Electron and the complete upstream first-run
 * bootstrap. The harness supplies only a fresh profile and a loopback
 * OpenAI-compatible model endpoint. It does not provide, patch, or replace any
 * Hermes runtime file.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import {
  buildAppEnv,
  type Sandbox,
  waitForAppReady,
  writeEnvFile,
  writeMockProviderConfig
} from './fixtures'
import { INTERIM_TEXTS, MOCK_REPLY, startMockServer, type MockServer } from './mock-server'
import { _electron, expect, installErrorBannerGuard, type ElectronApplication, type Page, test } from './test'

const TOOL_TRIGGER = 'Thực hiện kiểm thử nhiều bước E2E_INTERIM_TRIGGER và hoàn tất toàn bộ'
const SIMPLE_PROMPT = 'Chào em'
const HOST_CREDENTIAL_KEYS = [
  'ANTHROPIC_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AZURE_OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GOOGLE_API_KEY',
  'NOUS_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY'
] as const

test.use({ screenshot: 'off', trace: 'off' })
test.describe.configure({ mode: 'serial', retries: 0, timeout: 1_800_000 })

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function atomicJson(file: string, value: unknown): void {
  const temporary = `${file}.partial-${process.pid}`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temporary, file)
}

function transcript(page: Page) {
  return page.locator('[data-slot="aui_thread-viewport"]')
}

function composer(page: Page) {
  return page.locator('[data-slot="composer-rich-input"]:visible, [contenteditable="true"]:visible').first()
}

async function occurrences(page: Page, text: string): Promise<number> {
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

async function sendAndWait(page: Page, mock: MockServer, prompt: string, reply: string): Promise<number> {
  const input = composer(page)
  const beforeRequests = mock.receivedPrompts.filter(value => value === prompt).length
  const beforeReply = await occurrences(page, reply)

  await expect(input).toBeVisible({ timeout: 60_000 })
  await input.fill(prompt)
  await expect(input).toHaveText(prompt)
  await input.press('Enter')
  await expect(transcript(page)).toContainText(prompt, { timeout: 60_000 })
  await expect
    .poll(() => mock.receivedPrompts.filter(value => value === prompt).length, { timeout: 180_000 })
    .toBeGreaterThan(beforeRequests)
  await expect.poll(() => occurrences(page, reply), { timeout: 180_000 }).toBeGreaterThan(beforeReply)

  return mock.receivedPrompts.filter(value => value === prompt).length - beforeRequests
}

function buildInstalledEnvironment(hermesHome: string, userDataDir: string): Record<string, string> {
  const sandbox: Sandbox = {
    root: path.win32.dirname(hermesHome),
    hermesHome,
    userDataDir,
    cleanup: () => undefined
  }
  const workspace = path.win32.join(hermesHome, 'workspace')
  fs.mkdirSync(workspace, { recursive: true })

  const env = buildAppEnv(sandbox, {
    HERMES_DESKTOP_APP_NAME: `HermesV33RuntimeAcceptance-${Date.now()}`,
    HERMES_DESKTOP_CWD: workspace,
    HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1',
    HERMES_TUI_TOOLSETS: 'todo',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  })

  // The product must perform its own upstream bootstrap. The checked-out test
  // harness is never exposed as a product runtime fallback.
  delete env.HERMES_DESKTOP_DEV_SERVER
  delete env.HERMES_DESKTOP_HERMES
  delete env.HERMES_DESKTOP_HERMES_ROOT
  delete env.HERMES_DESKTOP_BOOT_FAKE
  delete env.HERMES_DESKTOP_BOOT_FAKE_ERROR
  delete env.HERMES_DESKTOP_BOOT_FAKE_STEP_MS
  delete env.HERMES_PACKAGED_BINARY_PATH

  // Explorer does not inject the GitHub runner's PowerShell 7 module path. The
  // product starts Windows PowerShell 5.1 for upstream install.ps1.
  delete env.PSModulePath
  for (const key of HOST_CREDENTIAL_KEYS) delete env[key]

  return env
}

async function launch(binary: string, env: Record<string, string>): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    executablePath: binary,
    args: ['--disable-gpu', '--no-sandbox'],
    env
  })
  const page = await app.firstWindow()
  installErrorBannerGuard(page)
  return { app, page }
}

type BootstrapTransition = {
  active: boolean
  error: string | null
  setupChoice: boolean
  atMs: number
}

async function completeInstalledStartup(
  active: { app: ElectronApplication; page: Page },
  timeoutMs: number,
  transitions: BootstrapTransition[]
): Promise<void> {
  const startedAt = Date.now()
  const deadline = startedAt + timeoutMs
  let localInstallStarted = false
  let previous = ''

  while (Date.now() < deadline) {
    const state = await active.page.evaluate(() => window.hermesDesktop?.getBootstrapState?.())
    if (state) {
      const snapshot = {
        active: Boolean(state.active),
        error: state.error ? String(state.error) : null,
        setupChoice: Boolean(state.setupChoice)
      }
      const serialized = JSON.stringify(snapshot)
      if (serialized !== previous) {
        transitions.push({ ...snapshot, atMs: Date.now() - startedAt })
        previous = serialized
      }
      if (snapshot.error) throw new Error(`upstream bootstrap failed: ${snapshot.error}`)
      if (snapshot.setupChoice && !localInstallStarted) {
        localInstallStarted = true
        await active.page.evaluate(async () => {
          await window.hermesDesktop?.continueBootstrapLocal?.()
        })
      }
      if (!snapshot.active && !snapshot.setupChoice) {
        await waitForAppReady(active as Parameters<typeof waitForAppReady>[0], 300_000)
        return
      }
    }
    await active.page.waitForTimeout(1_000)
  }

  throw new Error(`upstream bootstrap did not complete within ${timeoutMs}ms`)
}

function upstreamRuntimeProvenance(hermesHome: string, expectedEngineCommit: string) {
  const runtimeRoot = path.win32.join(hermesHome, 'hermes-agent')
  const markerPath = path.win32.join(runtimeRoot, '.hermes-bootstrap-complete')
  const marker = fs.statSync(markerPath, { throwIfNoEntry: false })?.isFile()
    ? JSON.parse(fs.readFileSync(markerPath, 'utf8'))
    : null
  let checkoutCommit: string | null = null
  if (fs.statSync(path.win32.join(runtimeRoot, '.git'), { throwIfNoEntry: false })) {
    try {
      checkoutCommit = execFileSync('git', ['-C', runtimeRoot, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true
      }).trim()
    } catch {
      checkoutCommit = null
    }
  }

  const pythonCandidates = [
    path.win32.join(runtimeRoot, 'venv', 'Scripts', 'python.exe'),
    path.win32.join(runtimeRoot, '.venv', 'Scripts', 'python.exe')
  ]
  const pythonPath = pythonCandidates.find(candidate => fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) ?? null
  const importProbe = pythonPath
    ? spawnSync(pythonPath, ['-c', 'import json, hermes_cli; print(json.dumps({"import":"ok"}))'], {
        cwd: runtimeRoot,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: runtimeRoot },
        timeout: 120_000,
        windowsHide: true
      })
    : null
  const markerCommit = marker?.pinnedCommit ? String(marker.pinnedCommit) : null
  const checkoutMatches = checkoutCommit?.toLowerCase() === expectedEngineCommit.toLowerCase()
  const markerMatches = markerCommit?.toLowerCase() === expectedEngineCommit.toLowerCase()
  const importOk = importProbe?.status === 0 && importProbe.stdout.includes('"import": "ok"')

  return {
    runtimeRoot,
    sourceRootExists: fs.statSync(runtimeRoot, { throwIfNoEntry: false })?.isDirectory() ?? false,
    expectedEngineCommit,
    checkoutCommit,
    markerCommit,
    checkoutMatches,
    markerMatches,
    pythonPath,
    importOk,
    importExitCode: importProbe?.status ?? null,
    importOutput: importProbe ? `${importProbe.stdout}${importProbe.stderr}`.trim().slice(0, 2_000) : null,
    passed: Boolean(checkoutMatches && markerMatches && importOk)
  }
}

function stateCounts(hermesHome: string) {
  const statePath = path.win32.join(hermesHome, 'state.db')
  if (!fs.statSync(statePath, { throwIfNoEntry: false })?.isFile()) return null
  const database = new DatabaseSync(statePath, { readOnly: true })
  try {
    const sessions = database.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }
    const messages = database.prepare('SELECT COUNT(*) AS count FROM messages').get() as { count: number }
    return { sessions: Number(sessions.count), messages: Number(messages.count), stateDbSha256: sha256(statePath) }
  } finally {
    database.close()
  }
}

test('bootstraps exact upstream, chats, executes a safe tool, and persists', async () => {
  expect(requiredEnv('HERMES_ACCEPTANCE_NETWORK_ALLOWED')).toBe('1')
  const binary = path.win32.resolve(requiredEnv('HERMES_ACCEPTANCE_BINARY'))
  const hermesHome = path.win32.resolve(requiredEnv('HERMES_ACCEPTANCE_HERMES_HOME'))
  const userDataDir = path.win32.resolve(requiredEnv('HERMES_ACCEPTANCE_USER_DATA'))
  const evidenceRoot = path.win32.resolve(requiredEnv('HERMES_ACCEPTANCE_EVIDENCE_ROOT'))
  const expectedEngineCommit = requiredEnv('HERMES_ACCEPTANCE_ENGINE_COMMIT')
  const resultPath = path.win32.join(evidenceRoot, 'runtime-acceptance-result.json')
  const mock = await startMockServer()
  const gates: Record<string, { status: 'failed' | 'passed'; detail?: unknown }> = {
    upstreamBootstrap: { status: 'failed' },
    runtimeProvenance: { status: 'failed' },
    realChatSession: { status: 'failed' },
    safeToolCall: { status: 'failed' },
    persistedRelaunch: { status: 'failed' }
  }
  let active: { app: ElectronApplication; page: Page } | null = null
  let failure: string | null = null
  let simpleModelCalls = 0
  let safeToolModelCalls = 0
  let runtime: ReturnType<typeof upstreamRuntimeProvenance> | null = null
  const bootstrapTransitions: BootstrapTransition[] = []

  fs.mkdirSync(hermesHome, { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.mkdirSync(evidenceRoot, { recursive: true })
  writeMockProviderConfig(hermesHome, mock.url)
  writeEnvFile(hermesHome)
  const env = buildInstalledEnvironment(hermesHome, userDataDir)

  try {
    active = await launch(binary, env)
    await completeInstalledStartup(active, 1_500_000, bootstrapTransitions)
    await expect(active.page).toHaveTitle(/Hermes Vietnamese/)
    gates.upstreamBootstrap = {
      status: 'passed',
      detail: { networkAllowed: true, transitions: bootstrapTransitions }
    }

    runtime = upstreamRuntimeProvenance(hermesHome, expectedEngineCommit)
    gates.runtimeProvenance = { status: runtime.passed ? 'passed' : 'failed', detail: runtime }

    simpleModelCalls = await sendAndWait(active.page, mock, SIMPLE_PROMPT, MOCK_REPLY)
    gates.realChatSession = {
      status: simpleModelCalls >= 1 ? 'passed' : 'failed',
      detail: { modelCalls: simpleModelCalls, prompt: SIMPLE_PROMPT }
    }

    safeToolModelCalls = await sendAndWait(active.page, mock, TOOL_TRIGGER, INTERIM_TEXTS.finalText)
    gates.safeToolCall = {
      status: safeToolModelCalls >= 1 ? 'passed' : 'failed',
      detail: { modelCalls: safeToolModelCalls, tool: 'todo' }
    }
    await active.page.screenshot({ fullPage: true, path: path.win32.join(evidenceRoot, 'chat-and-safe-tool.png') })

    await active.app.close()
    active = await launch(binary, env)
    await waitForAppReady(active as Parameters<typeof waitForAppReady>[0], 300_000)
    await expect(transcript(active.page)).toContainText(SIMPLE_PROMPT, { timeout: 120_000 })
    await expect(transcript(active.page)).toContainText(INTERIM_TEXTS.finalText, { timeout: 120_000 })
    gates.persistedRelaunch = { status: 'passed', detail: stateCounts(hermesHome) }
    await active.page.screenshot({ fullPage: true, path: path.win32.join(evidenceRoot, 'persisted-relaunch.png') })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
    if (active && !active.page.isClosed()) {
      await active.page
        .screenshot({ fullPage: true, path: path.win32.join(evidenceRoot, 'failure.png') })
        .catch(() => undefined)
    }
  } finally {
    await active?.app.close().catch(() => undefined)
    await mock.close()
  }

  runtime ??= upstreamRuntimeProvenance(hermesHome, expectedEngineCommit)
  gates.runtimeProvenance = { status: runtime.passed ? 'passed' : 'failed', detail: runtime }
  const status = Object.values(gates).every(gate => gate.status === 'passed') ? 'passed' : 'failed'
  if (!failure && status === 'failed') failure = 'one or more runtime acceptance gates failed'

  atomicJson(resultPath, {
    schemaVersion: 1,
    status,
    failure,
    candidate: {
      commit: requiredEnv('HERMES_ACCEPTANCE_CANDIDATE_COMMIT'),
      version: requiredEnv('HERMES_ACCEPTANCE_CANDIDATE_VERSION'),
      installerSha256: requiredEnv('HERMES_ACCEPTANCE_CANDIDATE_SHA256'),
      engineCommit: expectedEngineCommit
    },
    controller: { commit: requiredEnv('GITHUB_SHA'), runId: requiredEnv('GITHUB_RUN_ID') },
    isolation: {
      mechanism: 'github-hosted-ephemeral-vm',
      hermesHome,
      networkAllowed: true,
      provider: 'loopback-mock',
      hostCredentialsStripped: true,
      runnerPowerShellModulePathNeutralized: true
    },
    gates,
    bootstrapTransitions,
    runtime,
    state: stateCounts(hermesHome)
  })

  if (status !== 'passed') throw new Error(failure ?? 'runtime acceptance failed')
})
