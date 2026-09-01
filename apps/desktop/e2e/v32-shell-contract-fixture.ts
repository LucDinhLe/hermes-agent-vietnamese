import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import { _electron, type ElectronApplication, type Page } from '@playwright/test'

import { startMockServer, type MockServer } from './mock-server'
import { installErrorBannerGuard } from './test'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')

export interface ContractViewport {
  height: number
  width: number
}

interface ContractSandbox {
  appData: string
  electronUserData: string
  fakeHome: string
  gitGlobalConfig: string
  hermesHome: string
  localAppData: string
  root: string
  temp: string
  workspace: string
}

interface PreviewFixtureServer {
  close: () => Promise<void>
  url: string
}

export interface V32ShellContractFixture {
  app: ElectronApplication
  cleanup: () => Promise<void>
  mock: MockServer
  page: Page
  previewUrl: string
  sandbox: ContractSandbox
  terminalMarkerPath: string
  viewport: ContractViewport
}

const PREVIEW_FIXTURE_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hermes Browser Fit</title>
    <style>
      :root { color-scheme: light; font-family: "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 0; background: #fbfaf7; color: #332f2b; }
      main { min-height: 100vh; padding: 32px; display: grid; place-items: center; }
      .canvas { width: min(100%, 960px); border: 1px solid #e7d8ca; border-radius: 18px; background: white; padding: 32px; box-shadow: 0 18px 54px #7d4b2420; }
      .eyebrow { color: #d97316; font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
      h1 { margin: 12px 0 8px; color: #b9580b; font-family: Georgia, serif; font-size: clamp(30px, 7vw, 68px); line-height: .95; }
      p { margin: 0; color: #6f655d; font-size: 16px; line-height: 1.5; }
      .edges { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 28px; }
      .edge { border: 1px solid #efe5dc; border-radius: 12px; padding: 18px; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
      .edge:last-child { text-align: right; }
    </style>
  </head>
  <body>
    <main>
      <section class="canvas">
        <div class="eyebrow">Trang kiểm thử cục bộ</div>
        <h1>Hermes Browser Fit</h1>
        <p>Toàn bộ trang đang nằm gọn trong vùng Trình duyệt dùng chung với agent.</p>
        <div class="edges"><div class="edge">Mép trái</div><div class="edge">Mép phải</div></div>
      </section>
    </main>
  </body>
</html>`

function startPreviewFixtureServer(): Promise<PreviewFixtureServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (request.method === 'GET' && request.url === '/v32-shell-preview') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(PREVIEW_FIXTURE_HTML)
        return
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found')
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve the local Browser-fit fixture address'))
        return
      }

      resolve({
        url: `http://127.0.0.1:${address.port}/v32-shell-preview`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close(error => (error ? rejectClose(error) : resolveClose()))
            server.closeAllConnections()
          })
      })
    })
  })
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))

  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function assertPathWithin(root: string, candidate: string, label: string): void {
  if (!isPathWithin(root, candidate)) {
    throw new Error(`${label} escaped the E2E sandbox: ${candidate} (root: ${root})`)
  }
}

function yamlPath(value: string): string {
  return JSON.stringify(value.replaceAll('\\', '/'))
}

function runGit(sandbox: ContractSandbox, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: sandbox.workspace,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: sandbox.gitGlobalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      HOME: sandbox.fakeHome,
      USERPROFILE: sandbox.fakeHome
    },
    windowsHide: true
  })

  if (result.status !== 0) {
    throw new Error(`Unable to prepare isolated Git fixture: ${result.stderr || result.stdout}`)
  }
}

function createContractSandbox(viewport: ContractViewport): ContractSandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-v32-shell-contract-'))

  if (isPathWithin(REPO_ROOT, root)) {
    throw new Error(`Refusing to create the E2E sandbox inside the source checkout: ${root}`)
  }

  const rootStat = fs.lstatSync(root)

  if (rootStat.isSymbolicLink()) {
    throw new Error(`Refusing a linked E2E sandbox root: ${root}`)
  }

  const sandbox: ContractSandbox = {
    appData: path.join(root, 'appdata'),
    electronUserData: path.join(root, 'electron-user-data'),
    fakeHome: path.join(root, 'user-profile'),
    gitGlobalConfig: path.join(root, 'gitconfig'),
    hermesHome: path.join(root, 'hermes-home'),
    localAppData: path.join(root, 'local-appdata'),
    root,
    temp: path.join(root, 'temp'),
    workspace: path.join(root, 'workspace')
  }

  for (const directory of [
    sandbox.appData,
    sandbox.electronUserData,
    sandbox.fakeHome,
    sandbox.hermesHome,
    sandbox.localAppData,
    sandbox.temp,
    sandbox.workspace
  ]) {
    assertPathWithin(root, directory, 'fixture directory')
    fs.mkdirSync(directory, { recursive: true })
  }

  fs.writeFileSync(sandbox.gitGlobalConfig, '', 'utf8')
  fs.writeFileSync(path.join(sandbox.workspace, 'README.md'), '# Hermes V32 shell contract fixture\n', 'utf8')

  runGit(sandbox, ['init', '--quiet'])
  runGit(sandbox, ['config', 'user.name', 'Hermes E2E'])
  runGit(sandbox, ['config', 'user.email', 'hermes-e2e@invalid.local'])
  runGit(sandbox, ['add', 'README.md'])
  runGit(sandbox, ['commit', '--quiet', '-m', 'seed isolated workspace'])

  fs.writeFileSync(
    path.join(sandbox.electronUserData, 'window-state.json'),
    JSON.stringify(
      {
        height: viewport.height,
        isMaximized: false,
        width: viewport.width,
        x: 0,
        y: 0
      },
      null,
      2
    ),
    'utf8'
  )
  fs.writeFileSync(
    path.join(sandbox.electronUserData, 'zoom-state.json'),
    JSON.stringify({ zoomLevel: 0 }, null, 2),
    'utf8'
  )

  return sandbox
}

function removeContractSandbox(sandbox: ContractSandbox): void {
  assertPathWithin(os.tmpdir(), sandbox.root, 'sandbox root')

  const stat = fs.lstatSync(sandbox.root)

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to remove a linked E2E sandbox root: ${sandbox.root}`)
  }

  fs.rmSync(sandbox.root, {
    force: true,
    maxRetries: process.platform === 'win32' ? 20 : 0,
    recursive: true,
    retryDelay: 250
  })
}

function writeContractConfig(sandbox: ContractSandbox, mockUrl: string): void {
  const config = `# Generated by the V32 shell geometry contract E2E
model:
  default: mock-model
  provider: mock
  context_length: 65536
providers:
  mock:
    api: ${mockUrl}/v1
    name: Mock
    api_mode: chat_completions
    key_env: MOCK_API_KEY
    models:
      mock-model: {}
    context_length: 65536
model_catalog:
  enabled: false
display:
  language: vi
terminal:
  cwd: ${yamlPath(sandbox.workspace)}
security:
  allow_lazy_installs: false
`

  fs.writeFileSync(path.join(sandbox.hermesHome, 'config.yaml'), config, 'utf8')
  fs.writeFileSync(path.join(sandbox.hermesHome, '.env'), 'MOCK_API_KEY=e2e-isolated-key\n', 'utf8')
}

function resolveElectronBinary(): string {
  const binary = process.platform === 'win32' ? 'electron.exe' : 'electron'
  const candidates = [
    path.join(DESKTOP_ROOT, 'node_modules', 'electron', 'dist', binary),
    path.join(REPO_ROOT, 'node_modules', 'electron', 'dist', binary)
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(finder, ['electron'], {
    encoding: 'utf8',
    windowsHide: true
  })
  const fromPath = result.status === 0 ? result.stdout.split(/\r?\n/u).find(Boolean) : undefined

  if (fromPath && fs.existsSync(fromPath.trim())) {
    return fromPath.trim()
  }

  throw new Error(
    `Electron runtime not found for ${process.platform}. Run the root npm install with lifecycle scripts before this E2E.`
  )
}

function resolveContractPython(): string {
  const candidate =
    process.platform === 'win32'
      ? path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe')
      : path.join(REPO_ROOT, '.venv', 'bin', 'python')

  if (!fs.existsSync(candidate)) {
    throw new Error(
      `The V32 shell E2E requires the materialized tree's locked Python environment at ${candidate}. ` +
        'Run `uv sync --locked --offline --python <Python-3.11> --no-dev` in the materialized tree first.'
    )
  }

  const resolved = fs.realpathSync(candidate)

  if (!isPathWithin(REPO_ROOT, resolved)) {
    throw new Error(`Contract Python escaped the materialized source tree: ${resolved}`)
  }

  const probe = spawnSync(
    resolved,
    [
      '-I',
      '-c',
      [
        'import importlib.metadata, importlib.util, json, pathlib, sys',
        'import fastapi, uvicorn',
        "spec = importlib.util.find_spec('hermes_cli')",
        "assert spec is not None and spec.origin, 'hermes_cli is not installed'",
        "print(json.dumps({'executable': sys.executable, 'hermes_cli': str(pathlib.Path(spec.origin).resolve()), 'prefix': sys.prefix, 'python': list(sys.version_info[:2]), 'version': importlib.metadata.version('hermes-agent')}))"
      ].join('; ')
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true }
  )

  if (probe.status !== 0) {
    throw new Error(`Contract Python dependency probe failed: ${probe.stderr || probe.stdout}`)
  }

  const provenance = JSON.parse(probe.stdout.trim()) as {
    executable?: string
    hermes_cli?: string
    prefix?: string
    python?: number[]
    version?: string
  }

  if (!provenance.executable || fs.realpathSync(provenance.executable) !== resolved) {
    throw new Error(`Contract Python resolved a different interpreter: ${probe.stdout.trim()}`)
  }

  if (!provenance.hermes_cli || !isPathWithin(path.join(REPO_ROOT, 'hermes_cli'), provenance.hermes_cli)) {
    throw new Error(`Contract Python did not import hermes_cli from the materialized tree: ${probe.stdout.trim()}`)
  }

  const expectedPrefix = fs.realpathSync(path.dirname(path.dirname(resolved)))

  if (!provenance.prefix || fs.realpathSync(provenance.prefix) !== expectedPrefix) {
    throw new Error(`Contract Python reported an unexpected environment prefix: ${probe.stdout.trim()}`)
  }

  if (provenance.python?.[0] !== 3 || provenance.python[1] !== 11 || provenance.version !== '0.20.5') {
    throw new Error(`Contract Python does not match the locked Hermes 0.20.5 runtime: ${probe.stdout.trim()}`)
  }

  return resolved
}

function isolatedEnvironment(sandbox: ContractSandbox, contractPython: string): Record<string, string> {
  const clean: Record<string, string> = {}
  const credentialSuffixes = [
    '_ACCESS_KEY',
    '_API_KEY',
    '_CREDENTIALS',
    '_OAUTH_TOKEN',
    '_PASSWORD',
    '_PRIVATE_KEY',
    '_SECRET',
    '_TOKEN'
  ]
  const inheritedPythonKeys = new Set([
    'HERMES_DESKTOP_PYTHON',
    'PYTHONHOME',
    'PYTHONPATH',
    'PYTHONUSERBASE',
    'VIRTUAL_ENV'
  ])
  const inheritedPythonPrefixes = ['CONDA_', 'PIP_', 'UV_']

  for (const [key, value] of Object.entries(process.env)) {
    if (
      !value ||
      inheritedPythonKeys.has(key) ||
      inheritedPythonPrefixes.some(prefix => key.startsWith(prefix)) ||
      credentialSuffixes.some(suffix => key.endsWith(suffix))
    ) {
      continue
    }

    clean[key] = value
  }

  const homeRoot = path.parse(sandbox.fakeHome).root
  const virtualEnvironment = path.dirname(path.dirname(contractPython))

  return {
    ...clean,
    ALL_PROXY: 'http://127.0.0.1:9',
    APPDATA: sandbox.appData,
    GIT_CONFIG_GLOBAL: sandbox.gitGlobalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    HERMES_DESKTOP_APP_NAME: `HermesV32ShellContract-${process.pid}-${Date.now()}`,
    HERMES_DESKTOP_HERMES_ROOT: REPO_ROOT,
    HERMES_DESKTOP_IGNORE_EXISTING: '1',
    HERMES_DESKTOP_PYTHON: contractPython,
    HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1',
    HERMES_DESKTOP_USER_DATA_DIR: sandbox.electronUserData,
    HERMES_DISABLE_LAZY_INSTALLS: '1',
    HERMES_HOME: sandbox.hermesHome,
    HOME: sandbox.fakeHome,
    HOMEDRIVE: homeRoot.replace(/[\\/]$/u, ''),
    HOMEPATH: sandbox.fakeHome.slice(homeRoot.length - 1),
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    LOCALAPPDATA: sandbox.localAppData,
    NO_PROXY: '127.0.0.1,localhost',
    PATH: `${path.dirname(contractPython)}${path.delimiter}${clean.PATH ?? ''}`,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONNOUSERSITE: '1',
    TEMP: sandbox.temp,
    TMP: sandbox.temp,
    USERPROFILE: sandbox.fakeHome,
    VIRTUAL_ENV: virtualEnvironment,
    XDG_CACHE_HOME: path.join(sandbox.fakeHome, '.cache'),
    XDG_CONFIG_HOME: path.join(sandbox.fakeHome, '.config'),
    XDG_DATA_HOME: path.join(sandbox.fakeHome, '.local', 'share')
  }
}

async function waitForShellReady(app: ElectronApplication, page: Page): Promise<void> {
  await page.locator('[data-slot="composer-rich-input"]').first().waitFor({ state: 'visible', timeout: 120_000 })
  await page.waitForFunction(
    () => {
      const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)

      if (!target) {
        return false
      }

      for (let element: Element | null = target; element; element = element.parentElement) {
        const style = getComputedStyle(element)
        const box = element.getBoundingClientRect()

        if (
          style.position === 'fixed' &&
          box.left <= 0 &&
          box.top <= 0 &&
          box.right >= window.innerWidth &&
          box.bottom >= window.innerHeight
        ) {
          return false
        }
      }

      return true
    },
    undefined,
    { timeout: 120_000 }
  )

  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]

    if (window && !window.isVisible()) {
      window.show()
    }
  })
}

async function seedAcceptedV32Appearance(page: Page): Promise<void> {
  const changed = await page.evaluate(() => {
    const expected = {
      'hermes-desktop-mode-v1': 'light',
      'hermes-desktop-theme-v2': 'ember'
    }
    let dirty = false

    for (const [key, value] of Object.entries(expected)) {
      if (localStorage.getItem(key) !== value) {
        localStorage.setItem(key, value)
        dirty = true
      }
    }

    return dirty
  })

  if (changed) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}

async function forceContractViewport(app: ElectronApplication, page: Page, viewport: ContractViewport): Promise<void> {
  await app.evaluate(({ BrowserWindow }, target) => {
    const window = BrowserWindow.getAllWindows()[0]

    if (!window) {
      throw new Error('Hermes Electron window was not created')
    }

    window.unmaximize()
    window.setMinimumSize(800, 600)
    window.setContentSize(target.width, target.height, false)
  }, viewport)

  await page.waitForFunction(
    target => window.innerWidth === target.width && window.innerHeight === target.height,
    viewport,
    { timeout: 30_000 }
  )
  await page.evaluate(
    () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  )
}

async function assertRuntimeIsolation(
  app: ElectronApplication,
  sandbox: ContractSandbox,
  contractPython: string
): Promise<void> {
  const paths = await app.evaluate(({ app: electronApp }) => ({
    appHome: electronApp.getPath('home'),
    cwd: process.cwd(),
    envAppData: process.env.APPDATA || '',
    envHermesHome: process.env.HERMES_HOME || '',
    envLocalAppData: process.env.LOCALAPPDATA || '',
    envPython: process.env.HERMES_DESKTOP_PYTHON || '',
    envTemp: process.env.TEMP || process.env.TMP || '',
    envUserProfile: process.env.USERPROFILE || process.env.HOME || '',
    temp: electronApp.getPath('temp'),
    userData: electronApp.getPath('userData')
  }))

  const { appHome, envPython, ...isolatedPaths } = paths

  for (const [label, value] of Object.entries(isolatedPaths)) {
    assertPathWithin(sandbox.root, value, `Electron ${label}`)
  }

  if (fs.realpathSync(envPython) !== contractPython) {
    throw new Error(`Electron inherited an unapproved Python interpreter: ${envPython}`)
  }

  if (process.platform === 'win32') {
    // Chromium resolves app.getPath('home') from the Windows known-folder API,
    // not HOME/USERPROFILE. It is not a writable Hermes state root: userData,
    // temp, APPDATA, LOCALAPPDATA, USERPROFILE and HERMES_HOME above remain
    // sandboxed. Still fail if a future launch points this value into source.
    if (isPathWithin(REPO_ROOT, appHome)) {
      throw new Error(`Electron appHome must not resolve inside the source checkout: ${appHome}`)
    }
  } else {
    assertPathWithin(sandbox.root, appHome, 'Electron appHome')
  }
}

async function assertBackendOwnership(sandbox: ContractSandbox, contractPython: string): Promise<void> {
  const ownershipPath = path.join(sandbox.electronUserData, 'backend-ownership.json')
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    if (fs.existsSync(ownershipPath)) {
      const ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf8')) as {
        backends?: Array<{ command?: string }>
      }
      const command = ownership.backends?.[0]?.command

      if (command) {
        const expectedPrefix = `${contractPython} -m hermes_cli.main serve `

        if (!command.startsWith(expectedPrefix)) {
          throw new Error(`Electron launched an unapproved backend interpreter: ${command}`)
        }

        return
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error(`Electron did not record backend ownership at ${ownershipPath}`)
}

export async function setupV32ShellContract(viewport: ContractViewport): Promise<V32ShellContractFixture> {
  const sandbox = createContractSandbox(viewport)
  const terminalMarkerPath = path.join(sandbox.temp, 'v32-terminal-ui-ok.txt')

  assertPathWithin(sandbox.root, terminalMarkerPath, 'terminal marker')
  const mock = await startMockServer()
  let preview: PreviewFixtureServer | null = null
  let app: ElectronApplication | null = null

  try {
    preview = await startPreviewFixtureServer()
    const activePreview = preview
    writeContractConfig(sandbox, mock.url)

    const electronMain = path.join(DESKTOP_ROOT, 'dist', 'electron-main.mjs')
    const renderer = path.join(DESKTOP_ROOT, 'dist', 'index.html')

    if (!fs.existsSync(electronMain) || !fs.existsSync(renderer)) {
      throw new Error('Desktop dist is missing. Run `npm run build` in apps/desktop before this E2E.')
    }

    const contractPython = resolveContractPython()
    const env = isolatedEnvironment(sandbox, contractPython)

    delete env.HERMES_DESKTOP_DEV_SERVER
    delete env.HERMES_DESKTOP_HERMES

    app = await _electron.launch({
      args: [DESKTOP_ROOT, '--no-sandbox'],
      cwd: sandbox.workspace,
      env,
      executablePath: resolveElectronBinary()
    })

    const page = await app.firstWindow()

    installErrorBannerGuard(page)
    await seedAcceptedV32Appearance(page)
    await waitForShellReady(app, page)
    await forceContractViewport(app, page, viewport)
    await assertRuntimeIsolation(app, sandbox, contractPython)
    await assertBackendOwnership(sandbox, contractPython)

    return {
      app,
      mock,
      page,
      previewUrl: activePreview.url,
      sandbox,
      terminalMarkerPath,
      viewport,
      cleanup: async () => {
        await app?.close().catch(() => undefined)
        await Promise.all([mock.close(), activePreview.close()])
        removeContractSandbox(sandbox)
      }
    }
  } catch (error) {
    await app?.close().catch(() => undefined)
    await Promise.allSettled([mock.close(), preview?.close()])
    removeContractSandbox(sandbox)
    throw error
  }
}
