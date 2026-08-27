import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { listPackage } from '@electron/asar'

import PACKAGE_JSON from '../package.json' with { type: 'json' }
import { freshInstallSandboxPrefix } from './fresh-install-sandbox.mjs'
import { isMacDmgArtifactName, packagedAppDirectoryName } from './packaged-layout.mjs'
import {
  expectedBundledProvenanceFromEnv,
  validateBundledProvenance,
  validateExpectedDistributionArtifact
} from './packaged-provenance.mjs'

const MODE = process.argv[2] || 'help'
const ARCH = process.arch === 'arm64' ? 'arm64' : 'x64'
const DESKTOP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE_ROOT = path.join(DESKTOP_ROOT, 'release')
const PLATFORM = process.platform

// Platform-specific packaged-app layout. Candidate release builds ship a
// complete resources-resident runtime; ordinary development packs may still
// carry the thin stub manifest.
const APP = (() => {
  if (PLATFORM === 'darwin') {
    const appPath = path.join(RELEASE_ROOT, packagedAppDirectoryName(PLATFORM, ARCH), 'Hermes.app')
    return {
      appPath,
      binary: path.join(appPath, 'Contents', 'MacOS', 'Hermes'),
      resourcesPath: path.join(appPath, 'Contents', 'Resources'),
      asarPath: path.join(appPath, 'Contents', 'Resources', 'app.asar'),
      unpackedDistIndex: path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'dist', 'index.html')
    }
  }
  if (PLATFORM === 'win32') {
    const unpacked = path.join(RELEASE_ROOT, packagedAppDirectoryName(PLATFORM, ARCH))
    return {
      appPath: unpacked,
      binary: path.join(unpacked, 'Hermes.exe'),
      resourcesPath: path.join(unpacked, 'resources'),
      asarPath: path.join(unpacked, 'resources', 'app.asar'),
      unpackedDistIndex: path.join(unpacked, 'resources', 'app.asar.unpacked', 'dist', 'index.html')
    }
  }
  // linux unpacked layout matches windows but with different binary name
  const unpacked = path.join(RELEASE_ROOT, packagedAppDirectoryName(PLATFORM, ARCH))
  return {
    appPath: unpacked,
    binary: path.join(unpacked, 'Hermes'),
    resourcesPath: path.join(unpacked, 'resources'),
    asarPath: path.join(unpacked, 'resources', 'app.asar'),
    unpackedDistIndex: path.join(unpacked, 'resources', 'app.asar.unpacked', 'dist', 'index.html')
  }
})()

// Default HERMES_HOME for non-sandboxed runs -- matches main.ts's
// resolveHermesHome(). On Windows it's %LOCALAPPDATA%\hermes; elsewhere
// it's ~/.hermes. The fresh-install sandbox launchFresh() sets its own
// HERMES_HOME and never touches this.
const DEFAULT_HERMES_HOME = (() => {
  if (PLATFORM === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'hermes')
  }
  return path.join(os.homedir(), '.hermes')
})()
const VENV_ROOT = path.join(DEFAULT_HERMES_HOME, 'hermes-agent', 'venv')
const FRESH_SANDBOX_PREFIX = freshInstallSandboxPrefix({
  platform: PLATFORM,
  localAppData: process.env.LOCALAPPDATA || '',
  homeDir: os.homedir(),
  tempDir: os.tmpdir()
})

function die(message) {
  console.error(`\n${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || DESKTOP_ROOT,
    env: options.env || process.env,
    shell: Boolean(options.shell) || PLATFORM === 'win32',
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    die(`${command} ${args.join(' ')} failed`)
  }
}

function exists(target) {
  return fs.existsSync(target)
}

function releaseGate(callback) {
  try {
    return callback()
  } catch (error) {
    die(error instanceof Error ? error.message : String(error))
  }
}

function resolvePinnedDistributionArtifact({ required = false } = {}) {
  const expectedPath = process.env.HERMES_DESKTOP_EXPECTED_ARTIFACT
  if (!expectedPath) {
    if (required) {
      die('HERMES_DESKTOP_EXPECTED_ARTIFACT is required when a bundled release uses HERMES_DESKTOP_SKIP_BUILD=1')
    }
    return null
  }
  return releaseGate(() => {
    const expected = expectedBundledProvenanceFromEnv(process.env)
    return validateExpectedDistributionArtifact({
      arch: ARCH,
      desktopRoot: DESKTOP_ROOT,
      expectedPath,
      platform: PLATFORM,
      tag: expected.tag
    })
  })
}

// Match node-pty native binding location to what the bundled electron-main.cjs
// resolves at runtime. stage-native-deps.mjs stages node-pty into
// dist/node_modules/node-pty, and dist/** is asarUnpacked (see package.json
// build.asarUnpack), so in a packaged build it lands under
// resources/app.asar.unpacked/dist/node_modules/node-pty — reachable by a bare
// require('node-pty') from the bundle. Upstream node-pty 1.x is N-API based and
// ships per-arch prebuilts under prebuilds/<platform>-<arch>/; nix/local builds
// instead compile from source into build/Release/. The stage script copies
// whichever is present, so we accept either as the native payload.
function expectedNativeDepPaths() {
  const root = path.join(APP.resourcesPath, 'app.asar.unpacked', 'dist', 'node_modules', 'node-pty')
  const prebuildsDir = path.join(root, 'prebuilds', `${PLATFORM}-${ARCH}`)
  const buildReleaseDir = path.join(root, 'build', 'Release')
  return {
    packageJson: path.join(root, 'package.json'),
    prebuildsDir,
    buildReleaseDir,
    libIndex: path.join(root, 'lib', 'index.js')
  }
}

function ensurePlatformBuilds() {
  if (PLATFORM === 'darwin') return
  if (PLATFORM === 'win32') return
  if (PLATFORM === 'linux') return
  die(`Desktop bundle validation is only wired for darwin / win32 / linux; platform=${PLATFORM} is not supported.`)
}

function ensurePackagedApp() {
  if (process.env.HERMES_DESKTOP_SKIP_BUILD === '1') {
    if (!exists(APP.binary)) {
      die(`HERMES_DESKTOP_SKIP_BUILD=1 forbids rebuilding the missing packaged app: ${APP.binary}`)
    }
    return
  }

  run('npm', ['run', 'pack'])
}

function resolveDmgPath() {
  const pinned = resolvePinnedDistributionArtifact()
  if (pinned) return pinned
  if (!exists(RELEASE_ROOT)) {
    return path.join(RELEASE_ROOT, `Hermes-${PACKAGE_JSON.version}-${ARCH}.dmg`)
  }

  const candidates = fs
    .readdirSync(RELEASE_ROOT)
    .filter(name => isMacDmgArtifactName(name, ARCH))
    .sort()

  if (candidates.length > 1) {
    die(`Expected at most one mac-${ARCH} DMG in ${RELEASE_ROOT}; found: ${candidates.join(', ')}`)
  }
  return candidates.length === 1
    ? path.join(RELEASE_ROOT, candidates[0])
    : path.join(RELEASE_ROOT, `Hermes-${PACKAGE_JSON.version}-${ARCH}.dmg`)
}

function resolveNsisPath() {
  const pinned = resolvePinnedDistributionArtifact()
  if (pinned) return pinned
  // electron-builder NSIS artifactName template is 'Hermes-${version}-${os}-${arch}.${ext}'
  if (!exists(RELEASE_ROOT)) return null
  const candidates = fs
    .readdirSync(RELEASE_ROOT)
    .filter(name => name.toLowerCase().endsWith(`-win-${ARCH}.exe`))
    .sort()
  if (candidates.length > 1) {
    die(`Expected at most one win-${ARCH} NSIS artifact in ${RELEASE_ROOT}; found: ${candidates.join(', ')}`)
  }
  return candidates.length === 1 ? path.join(RELEASE_ROOT, candidates[0]) : null
}

function ensureDmg() {
  if (PLATFORM !== 'darwin') {
    die('DMG mode is macOS-only; on Windows use the `nsis` mode instead.')
  }
  if (process.env.HERMES_DESKTOP_SKIP_BUILD === '1') {
    const artifact =
      resolvePinnedDistributionArtifact({
        required: process.env.HERMES_DESKTOP_BUNDLED === '1'
      }) || resolveDmgPath()
    if (!artifact || !exists(artifact)) {
      die(`HERMES_DESKTOP_SKIP_BUILD=1 forbids rebuilding the missing DMG: ${artifact || '(unresolved)'}`)
    }
    return
  }
  run('npm', ['run', 'dist:mac:dmg'])
}

function ensureNsis() {
  if (PLATFORM !== 'win32') {
    die('NSIS mode is win32-only; on macOS use the `dmg` mode instead.')
  }
  if (process.env.HERMES_DESKTOP_SKIP_BUILD === '1') {
    const artifact =
      resolvePinnedDistributionArtifact({
        required: process.env.HERMES_DESKTOP_BUNDLED === '1'
      }) || resolveNsisPath()
    if (!artifact || !exists(artifact)) {
      die(`HERMES_DESKTOP_SKIP_BUILD=1 forbids rebuilding the missing NSIS artifact: ${artifact || '(unresolved)'}`)
    }
    return
  }
  run('npm', ['run', 'dist:win:nsis'])
}

function openApp() {
  if (!exists(APP.binary)) {
    die(`Missing packaged app: ${APP.binary}`)
  }

  if (PLATFORM === 'darwin') {
    run('open', ['-n', APP.appPath])
  } else if (PLATFORM === 'win32') {
    // Spawn detached so the test script exits while the app keeps running.
    spawn(APP.binary, [], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn(APP.binary, [], { detached: true, stdio: 'ignore' }).unref()
  }
}

function openDmg() {
  if (PLATFORM !== 'darwin') {
    die('DMG mode is macOS-only.')
  }
  const dmgPath = resolveDmgPath()
  if (!exists(dmgPath)) {
    die(`Missing DMG: ${dmgPath}`)
  }
  run('open', [dmgPath])
}

const CREDENTIAL_ENV_SUFFIXES = [
  '_API_KEY',
  '_TOKEN',
  '_SECRET',
  '_PASSWORD',
  '_CREDENTIALS',
  '_ACCESS_KEY',
  '_PRIVATE_KEY',
  '_OAUTH_TOKEN'
]

const CREDENTIAL_ENV_NAMES = new Set([
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'CUSTOM_API_KEY',
  'GEMINI_BASE_URL',
  'OPENAI_BASE_URL',
  'OPENROUTER_BASE_URL',
  'OLLAMA_BASE_URL',
  'GROQ_BASE_URL',
  'XAI_BASE_URL'
])

function isCredentialEnvVar(name) {
  if (CREDENTIAL_ENV_NAMES.has(name)) return true
  return CREDENTIAL_ENV_SUFFIXES.some(suffix => name.endsWith(suffix))
}

function launchFresh() {
  if (!exists(APP.binary)) {
    die(`Missing app executable: ${APP.binary}`)
  }

  fs.mkdirSync(path.dirname(FRESH_SANDBOX_PREFIX), { recursive: true })
  const sandbox = fs.mkdtempSync(FRESH_SANDBOX_PREFIX)
  const userDataDir = path.join(sandbox, 'electron-user-data')
  const hermesHome = path.join(sandbox, 'hermes-home')
  const cwd = path.join(sandbox, 'workspace')

  fs.mkdirSync(userDataDir, { recursive: true })
  fs.mkdirSync(hermesHome, { recursive: true })
  fs.mkdirSync(cwd, { recursive: true })

  // Strip every credential-shaped env var so the sandbox is actually fresh.
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (isCredentialEnvVar(key)) continue
    env[key] = value
  }

  env.HERMES_DESKTOP_CWD = cwd
  env.HERMES_DESKTOP_IGNORE_EXISTING = '1'
  env.HERMES_DESKTOP_TEST_MODE = 'fresh-install-auto'
  env.HERMES_DESKTOP_USER_DATA_DIR = userDataDir
  env.HERMES_HOME = hermesHome
  delete env.HERMES_DESKTOP_HERMES
  delete env.HERMES_DESKTOP_HERMES_ROOT

  const child = spawn(APP.binary, [], {
    cwd: os.homedir(),
    detached: true,
    env,
    stdio: 'ignore'
  })
  child.unref()

  console.log('\nFresh install sandbox:')
  console.log(`  root: ${sandbox}`)
  console.log(`  electron userData: ${userDataDir}`)
  console.log(`  HERMES_HOME: ${hermesHome}`)
  console.log(`  cwd: ${cwd}`)

  return { runtimeRoot: path.join(hermesHome, 'hermes-agent', 'venv') }
}

function resolvePayloadPython(payloadRoot) {
  const pythonRoot = path.join(payloadRoot, 'python')
  if (!exists(pythonRoot)) return null
  const binaryName = PLATFORM === 'win32' ? 'python.exe' : 'python3'
  for (const entry of fs
    .readdirSync(pythonRoot)
    .filter(name => name.startsWith('cpython-'))
    .sort()
    .reverse()) {
    const candidate =
      PLATFORM === 'win32' ? path.join(pythonRoot, entry, binaryName) : path.join(pythonRoot, entry, 'bin', binaryName)
    if (exists(candidate)) return candidate
  }
  return null
}

function validateResidentPayload(stamp) {
  const payloadRoot = path.join(APP.resourcesPath, 'agent-payload')
  const manifestPath = path.join(payloadRoot, 'manifest.json')
  if (!exists(manifestPath)) die(`Missing resident payload manifest: ${manifestPath}`)

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    die(`Resident payload manifest is not valid JSON: ${err.message}`)
  }
  const expected = releaseGate(() => expectedBundledProvenanceFromEnv(process.env))
  releaseGate(() => validateBundledProvenance({ expected, manifest, stamp }))
  for (const item of ['repo', 'uv', 'python', 'site-packages', 'node']) {
    if (manifest.items?.[item]?.status !== 'staged') {
      die(`Resident payload item is not staged: ${item}`)
    }
  }
  const browserLauncher = path.join(
    payloadRoot,
    'repo',
    'node_modules',
    '.bin',
    PLATFORM === 'win32' ? 'agent-browser.cmd' : 'agent-browser'
  )
  const required = [
    path.join(payloadRoot, 'repo', 'hermes_cli', 'main.py'),
    path.join(payloadRoot, 'repo', '.hermes-install.json'),
    path.join(payloadRoot, 'repo', '.hermes_build_info.json'),
    path.join(payloadRoot, 'repo', 'node_modules', 'agent-browser', 'package.json'),
    path.join(
      payloadRoot,
      'repo',
      'node_modules',
      'agent-browser',
      'bin',
      `agent-browser-${PLATFORM === 'win32' ? 'win32' : PLATFORM}-${ARCH}${PLATFORM === 'win32' ? '.exe' : ''}`
    ),
    path.join(payloadRoot, 'site-packages', 'cryptography', '__init__.py'),
    browserLauncher,
    path.join(payloadRoot, 'node', PLATFORM === 'win32' ? 'node.exe' : path.join('bin', 'node')),
    path.join(payloadRoot, 'uv', PLATFORM === 'win32' ? 'uv.exe' : 'uv')
  ]
  for (const file of required) {
    if (!exists(file)) die(`Resident payload is incomplete: ${file}`)
  }
  if (!fs.statSync(browserLauncher).isFile()) {
    die(`Resident agent-browser launcher is not a file: ${browserLauncher}`)
  }
  if (PLATFORM !== 'win32' && (fs.statSync(browserLauncher).mode & 0o111) === 0) {
    die(`Resident agent-browser launcher is not executable: ${browserLauncher}`)
  }
  if (exists(path.join(payloadRoot, 'repo', '.git'))) {
    die(`Resident payload must be a Git-independent source snapshot: ${path.join(payloadRoot, 'repo', '.git')}`)
  }

  const python = resolvePayloadPython(payloadRoot)
  if (!python) die(`Resident payload has no runnable Python for ${PLATFORM}-${ARCH}`)
  const probe = spawnSync(
    python,
    [
      '-c',
      [
        'import json, cryptography, hermes_cli, pydantic_core',
        'major = int(cryptography.__version__.split(".", 1)[0])',
        'assert major >= 50, cryptography.__version__',
        'print(json.dumps({"cryptography": cryptography.__version__, "hermes": hermes_cli.__version__}))'
      ].join('; ')
    ],
    {
      cwd: os.tmpdir(),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUTF8: '1' },
      encoding: 'utf8'
    }
  )
  if (probe.status !== 0) {
    die(`Resident Python import probe failed (${probe.status}): ${(probe.stderr || probe.stdout || '').trim()}`)
  }
  console.log(`  resident runtime: ${probe.stdout.trim()}`)
  return { manifest, python }
}

// Validate the packaged bundle:
//   - candidate mode requires the complete resident Python/Node/uv payload;
//   - install-stamp.json agrees with the payload's immutable provenance;
//   - node-pty IS shipped inside app.asar.unpacked/dist/node_modules/node-pty
//     with package.json + lib/ + at least one .node binary (the renderer's
//     integrated terminal needs this; see Phase 1F.6).
//   - The renderer's dist/index.html is reachable (either unpacked or
//     inside app.asar).
function validateBundle() {
  if (!exists(APP.binary)) {
    die(`Missing packaged app binary: ${APP.binary}`)
  }

  // Positive assertion: install-stamp.json carries a sane immutable commit.
  const stampPath = path.join(APP.resourcesPath, 'install-stamp.json')
  if (!exists(stampPath)) {
    die(`Missing install-stamp.json (required for first-launch bootstrap pinning): ${stampPath}`)
  }
  let stamp
  try {
    stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'))
  } catch (err) {
    die(`install-stamp.json is not valid JSON: ${err.message}`)
  }
  if (!stamp.commit || typeof stamp.commit !== 'string' || stamp.commit.length < 7) {
    die(`install-stamp.json is missing a usable commit field: ${JSON.stringify(stamp)}`)
  }
  const resident = process.env.HERMES_DESKTOP_BUNDLED === '1' ? validateResidentPayload(stamp) : null
  const expectedArtifact =
    process.env.HERMES_DESKTOP_BUNDLED === '1' && process.env.HERMES_DESKTOP_SKIP_BUILD === '1'
      ? resolvePinnedDistributionArtifact({ required: true })
      : null
  if (expectedArtifact) {
    const verifier = path.join(
      DESKTOP_ROOT,
      'scripts',
      PLATFORM === 'win32' ? 'verify-windows-nsis-provenance.mjs' : 'verify-native-distribution-provenance.mjs'
    )
    const verifierArgs =
      PLATFORM === 'win32'
        ? [verifier, expectedArtifact, `--arch=${ARCH}`]
        : [verifier, expectedArtifact, `--platform=${PLATFORM}`, `--arch=${ARCH}`]
    const verification = spawnSync(process.execPath, verifierArgs, {
      cwd: DESKTOP_ROOT,
      env: process.env,
      shell: false,
      stdio: 'inherit',
      timeout: 360_000,
      windowsHide: true
    })
    if (verification.error || verification.status !== 0) {
      die(`Exact embedded distribution provenance validation failed (${verification.status ?? 'spawn'})`)
    }
  }

  // Positive assertion: node-pty native deps shipped
  const native = expectedNativeDepPaths()
  if (!exists(native.packageJson)) {
    die(`Missing node-pty package.json in app.asar.unpacked: ${native.packageJson}`)
  }
  if (!exists(native.libIndex)) {
    die(`Missing node-pty lib/index.js in app.asar.unpacked: ${native.libIndex}`)
  }
  // The native binary lands in prebuilds/<platform>-<arch>/ (downloaded prebuild)
  // OR build/Release/ (compiled from source). stage-native-deps.mjs copies
  // whichever is present, so accept either.
  const nativeBinaryDirs = [native.prebuildsDir, native.buildReleaseDir].filter(exists)
  if (nativeBinaryDirs.length === 0) {
    die(
      `Missing node-pty native binary dir for ${PLATFORM}-${ARCH}: neither ` +
        `${native.prebuildsDir} nor ${native.buildReleaseDir} exists`
    )
  }
  const nodeBinaries = nativeBinaryDirs.flatMap(dir => fs.readdirSync(dir).filter(name => name.endsWith('.node')))
  if (nodeBinaries.length === 0) {
    die(`No .node native binaries found in: ${nativeBinaryDirs.join(', ')}`)
  }
  // Darwin requires a runtime-execed spawn-helper alongside pty.node; missing
  // it manifests as "ENOENT: spawn-helper" on first pty.spawn() call.
  if (PLATFORM === 'darwin') {
    const spawnHelper = nativeBinaryDirs.map(dir => path.join(dir, 'spawn-helper')).find(exists)
    if (!spawnHelper) {
      die(`Missing node-pty spawn-helper (required on darwin) in: ${nativeBinaryDirs.join(', ')}`)
    }
  }

  // Renderer payload check (either unpacked or in the asar)
  if (exists(APP.unpackedDistIndex)) {
    return { stamp, nodeBinaries, resident, expectedArtifact }
  }
  if (!exists(APP.asarPath)) {
    die(`Missing renderer payload: neither ${APP.unpackedDistIndex} nor ${APP.asarPath} exists`)
  }
  const files = listPackage(APP.asarPath)
  // Normalize separators because @electron/asar's listPackage returns
  // backslash-prefixed entries on Windows ('\\dist\\index.html') and
  // forward-slash on Unix.
  const normalized = files.map(f => f.replace(/\\/g, '/').replace(/^\/+/, ''))
  if (!normalized.includes('dist/index.html')) {
    die(`Missing renderer payload file in app.asar: ${APP.asarPath} (expected dist/index.html)`)
  }
  return { stamp, nodeBinaries, resident, expectedArtifact }
}

function printArtifacts(options = {}) {
  const runtimeRoot = options.runtimeRoot || VENV_ROOT
  const stamp = options.stamp

  console.log('\nDesktop artifacts:')
  console.log(`  app: ${APP.appPath}`)
  if (PLATFORM === 'darwin') {
    console.log(`  dmg: ${resolveDmgPath()}`)
  } else if (PLATFORM === 'win32') {
    const exe = resolveNsisPath()
    if (exe) console.log(`  installer: ${exe}`)
  }
  console.log(`  runtime: ${runtimeRoot}`)
  if (stamp) {
    console.log(`  install-stamp: ${stamp.commit.slice(0, 12)} (${stamp.tag || stamp.branch || 'detached'})`)
  }
  if (options.expectedArtifact) {
    console.log(`  expected distribution artifact: ${options.expectedArtifact}`)
  }
  if (options.nodeBinaries && options.nodeBinaries.length > 0) {
    console.log(`  node-pty binaries: ${options.nodeBinaries.join(', ')}`)
  }
}

function help() {
  console.log(`Usage:
  npm run test:desktop:existing  # build packaged app, launch with normal PATH/existing Hermes
  npm run test:desktop:fresh     # build packaged app, launch with temp userData + HERMES_HOME
  npm run test:desktop:dmg       # (macOS only) build DMG and open it
  npm run test:desktop:nsis      # (win32 only) build NSIS installer
  npm run test:desktop:all       # build installer, validate app payload, print paths

Fail-closed validation of already-built bundled bytes (never rebuilds):
  HERMES_DESKTOP_BUNDLED=1 HERMES_DESKTOP_SKIP_BUILD=1 \\
    HERMES_PAYLOAD_TAG=vi-vX.Y.Z-N HERMES_PAYLOAD_GIT_REF=<40-char-sha> \\
    HERMES_RELEASE_CLASS=<class> HERMES_DESKTOP_EXPECTED_ARTIFACT=release/<exact-name> \\
    npm run test:desktop:all
`)
}

ensurePlatformBuilds()

if (MODE === 'existing') {
  ensurePackagedApp()
  const result = validateBundle()
  openApp()
  printArtifacts(result)
} else if (MODE === 'fresh') {
  ensurePackagedApp()
  const result = validateBundle()
  printArtifacts({ ...launchFresh(), ...result })
} else if (MODE === 'dmg') {
  ensureDmg()
  openDmg()
  printArtifacts()
} else if (MODE === 'nsis') {
  ensureNsis()
  printArtifacts(validateBundle())
} else if (MODE === 'all') {
  if (PLATFORM === 'darwin') {
    ensureDmg()
  } else if (PLATFORM === 'win32') {
    ensureNsis()
  } else {
    ensurePackagedApp()
  }
  printArtifacts(validateBundle())
} else {
  help()
}
