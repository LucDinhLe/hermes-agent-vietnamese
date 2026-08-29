import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PAYLOAD_SCHEMA_VERSION = 2
export const PAYLOAD_ITEMS = ['repo', 'uv', 'python', 'site-packages', 'node']
export const NODE_INPUT = Object.freeze({
  version: 'v26.5.1',
  archive: 'node-v26.5.1-win-x64.zip',
  sha256: 'c432c996b95cbf7568f13a0fbb37526de84a27e3a5c520c3be15f05a9a168212',
  url: 'https://nodejs.org/dist/v26.5.1/node-v26.5.1-win-x64.zip'
})
export const AGENT_BROWSER_INPUT = Object.freeze({
  version: '0.26.0',
  integrity: 'sha512-pdqSfjwbFSp+qnwlb2g23e9wXveIOfMi19xpPA9xZUbzEAUp6W4YBZj6Ybj8z4M7WkcbGDDYc+oDIHDt9R3EDQ==',
  url: 'https://registry.npmjs.org/agent-browser/-/agent-browser-0.26.0.tgz'
})

function fail(message) {
  throw new Error(`[resident-stage] ${message}`)
}

function parseArgs(argv) {
  const values = {}

  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) values[match[1]] = match[2]
  }

  return values
}

function run(command, args, options = {}) {
  console.log(`[resident-stage] ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options
  })

  if (result.error) fail(`${command} did not start: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} exited ${result.status}`)
}

function probe(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    ...options
  })

  if (result.error) fail(`${command} did not start: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} exited ${result.status}: ${String(result.stderr || '').trim()}`)

  return String(result.stdout || '').trim()
}

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

export function sha512IntegrityFile(file) {
  return `sha512-${crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64')}`
}

export function buildManifest({ candidate, engineCommit, receiptSha256, builtAt = new Date().toISOString() }) {
  return {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    candidate,
    engineCommit,
    editionReceiptSha256: receiptSha256,
    platform: 'win32',
    arch: 'x64',
    builtAt,
    inputs: {
      node: NODE_INPUT,
      agentBrowser: AGENT_BROWSER_INPUT
    },
    items: Object.fromEntries(PAYLOAD_ITEMS.map(item => [item, { status: 'staged' }]))
  }
}

function windowsTar() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
}

function download(url, output) {
  run('curl.exe', ['-fsSL', '--retry', '5', '--retry-all-errors', '-o', output, url])
}

function assertFile(file, label) {
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`${label} is missing: ${file}`)
}

function sourceCopyFilter(sourceRoot) {
  const excluded = [
    '.git',
    '.venv',
    'venv',
    'node_modules',
    '.work',
    'apps/desktop/release',
    'apps/desktop/build/agent-payload'
  ]

  return source => {
    const relative = path.relative(sourceRoot, source).replaceAll('\\', '/')
    if (!relative) return true

    return !excluded.some(prefix => relative === prefix || relative.startsWith(`${prefix}/`))
  }
}

function stageSource(sourceRoot, payloadRoot, workRoot, candidate, engineCommit) {
  // outputRoot lives under sourceRoot/apps/desktop/build. Snapshot outside
  // the source first; Node correctly refuses a direct recursive copy into a
  // descendant even when the filter excludes that descendant.
  const snapshot = path.join(workRoot, 'repo-snapshot')
  fs.rmSync(snapshot, { recursive: true, force: true })
  fs.cpSync(sourceRoot, snapshot, {
    recursive: true,
    dereference: true,
    filter: sourceCopyFilter(sourceRoot)
  })

  const surfaces = ['ui-tui/dist', 'ui-tui/node_modules', 'hermes_cli/web_dist']
  for (const surface of surfaces) {
    const from = path.join(sourceRoot, ...surface.split('/'))
    if (!fs.existsSync(from)) fail(`prebuilt surface is missing: ${surface}`)

    const to = path.join(snapshot, ...surface.split('/'))
    fs.rmSync(to, { recursive: true, force: true })
    fs.cpSync(from, to, { recursive: true, dereference: true })
  }

  const installStamp = path.join(sourceRoot, 'apps', 'desktop', 'build', 'install-stamp.json')
  assertFile(installStamp, 'desktop install stamp')
  fs.copyFileSync(installStamp, path.join(snapshot, '.hermes_build_info.json'))
  fs.writeFileSync(
    path.join(snapshot, '.hermes-install.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        installMode: 'bundled',
        channel: 'development',
        candidate,
        pinnedCommit: engineCommit
      },
      null,
      2
    )}\n`
  )

  const repo = path.join(payloadRoot, 'repo')
  fs.rmSync(repo, { recursive: true, force: true })
  fs.cpSync(snapshot, repo, { recursive: true, dereference: true })

  return repo
}

function prepareAgentBrowser(workRoot, repoRoot) {
  const archive = path.join(workRoot, 'agent-browser.tgz')
  const extract = path.join(workRoot, 'agent-browser')
  fs.mkdirSync(extract, { recursive: true })
  download(AGENT_BROWSER_INPUT.url, archive)

  const integrity = sha512IntegrityFile(archive)
  if (integrity !== AGENT_BROWSER_INPUT.integrity) {
    fail(`agent-browser integrity mismatch: expected ${AGENT_BROWSER_INPUT.integrity}, got ${integrity}`)
  }

  run(windowsTar(), ['-xf', archive, '-C', extract])
  const packageRoot = path.join(extract, 'package')
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  if (manifest.name !== 'agent-browser' || manifest.version !== AGENT_BROWSER_INPUT.version) {
    fail(`unexpected agent-browser package ${manifest.name}@${manifest.version}`)
  }

  assertFile(path.join(packageRoot, 'bin', 'agent-browser-win32-x64.exe'), 'agent-browser Windows x64 binary')
  const target = path.join(repoRoot, 'node_modules', 'agent-browser')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(packageRoot, target, { recursive: true, dereference: true })

  const bin = path.join(repoRoot, 'node_modules', '.bin')
  fs.mkdirSync(bin, { recursive: true })
  fs.writeFileSync(
    path.join(bin, 'agent-browser.cmd'),
    '@ECHO off\r\nSETLOCAL\r\nSET "basedir=%~dp0"\r\nIF EXIST "%basedir%node.exe" (SET "_prog=%basedir%node.exe") ELSE (SET "_prog=node")\r\n"%_prog%" "%basedir%..\\agent-browser\\bin\\agent-browser.js" %*\r\n'
  )
}

function stageNode(workRoot, payloadRoot) {
  const archive = path.join(workRoot, NODE_INPUT.archive)
  const extract = path.join(workRoot, 'node-extract')
  fs.mkdirSync(extract, { recursive: true })
  download(NODE_INPUT.url, archive)

  const digest = sha256File(archive)
  if (digest !== NODE_INPUT.sha256) fail(`Node SHA-256 mismatch: expected ${NODE_INPUT.sha256}, got ${digest}`)

  run(windowsTar(), ['-xf', archive, '-C', extract])
  const roots = fs.readdirSync(extract, { withFileTypes: true }).filter(entry => entry.isDirectory())
  if (roots.length !== 1) fail('Node archive did not contain exactly one root directory')

  const target = path.join(payloadRoot, 'node')
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(path.join(extract, roots[0].name), target, { recursive: true, dereference: true })
  assertFile(path.join(target, 'node.exe'), 'resident Node')
  if (probe(path.join(target, 'node.exe'), ['-p', 'process.arch']) !== 'x64') fail('resident Node is not x64')
}

function findUv() {
  const locations = probe('where.exe', ['uv']).split(/\r?\n/).filter(Boolean)
  if (locations.length === 0) fail('uv.exe is not on PATH')
  return locations[0]
}

function findPayloadPython(pythonRoot) {
  const dirs = fs
    .readdirSync(pythonRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => path.join(pythonRoot, entry.name, 'python.exe'))
    .filter(file => fs.existsSync(file))
    .sort()
    .reverse()

  if (dirs.length === 0) fail(`payload Python was not installed under ${pythonRoot}`)
  return dirs[0]
}

function stagePython(sourceRoot, payloadRoot) {
  const uvRoot = path.join(payloadRoot, 'uv')
  const pythonRoot = path.join(payloadRoot, 'python')
  fs.rmSync(uvRoot, { recursive: true, force: true })
  fs.rmSync(pythonRoot, { recursive: true, force: true })
  fs.mkdirSync(uvRoot, { recursive: true })
  fs.mkdirSync(pythonRoot, { recursive: true })

  const stagedUv = path.join(uvRoot, 'uv.exe')
  fs.copyFileSync(findUv(), stagedUv)
  run(stagedUv, [
    'python',
    'install',
    '--no-bin',
    '--install-dir',
    pythonRoot,
    'cpython-3.11-windows-x86_64-none'
  ])

  const python = findPayloadPython(pythonRoot)
  if (!/AMD64|x86_64/i.test(probe(python, ['-c', 'import platform; print(platform.machine())']))) {
    fail('resident Python is not Windows x64')
  }

  const requirements = path.join(payloadRoot, 'requirements-payload.txt')
  run(stagedUv, ['export', '--frozen', '--no-emit-project', '-o', requirements], { cwd: sourceRoot })

  const sitePackages = path.join(payloadRoot, 'site-packages')
  fs.rmSync(sitePackages, { recursive: true, force: true })
  fs.mkdirSync(sitePackages, { recursive: true })
  run(
    stagedUv,
    [
      'pip',
      'install',
      '--python',
      python,
      '--require-hashes',
      '--no-deps',
      '--no-config',
      '--only-binary',
      ':all:',
      '-r',
      requirements,
      '--target',
      sitePackages,
      '--upgrade',
      '--no-compile'
    ],
    { cwd: sourceRoot }
  )

  probe(python, [
    '-c',
    `import sys; sys.path.insert(0, ${JSON.stringify(sitePackages)}); import pydantic_core, cryptography, charset_normalizer`
  ])

  const versionText = fs.readFileSync(path.join(sourceRoot, 'hermes_cli', '__init__.py'), 'utf8')
  const version = /__version__\s*=\s*["']([^"']+)/.exec(versionText)?.[1]
  if (!version) fail('could not read hermes_cli version')

  const distInfo = path.join(sitePackages, `hermes_agent-${version}.dist-info`)
  fs.mkdirSync(distInfo, { recursive: true })
  fs.writeFileSync(path.join(distInfo, 'METADATA'), `Metadata-Version: 2.1\nName: hermes-agent\nVersion: ${version}\n`)
  fs.writeFileSync(path.join(distInfo, 'INSTALLER'), 'hermes-v33-resident-bundle\n')

  const purelib = probe(python, ['-c', "import sysconfig; print(sysconfig.get_paths()['purelib'])"])
  assertFile(path.join(pythonRoot, path.relative(pythonRoot, python)), 'resident Python')
  fs.writeFileSync(
    path.join(purelib, 'hermes-bundle.pth'),
    `${path.relative(purelib, path.join(payloadRoot, 'repo'))}\n${path.relative(
      purelib,
      path.join(payloadRoot, 'site-packages')
    )}\n`
  )

  probe(python, ['-c', 'import hermes_cli, tui_gateway.server; print(hermes_cli.__version__)'])
}

export function stageResidentRuntime({ sourceRoot, outputRoot, candidate, engineCommit, receiptSha256 }) {
  if (process.platform !== 'win32' || process.arch !== 'x64') fail('dev.7 resident staging currently supports Windows x64 only')
  if (!/^[0-9a-f]{40}$/.test(engineCommit)) fail('engine commit must be a full lowercase SHA-1')
  if (!/^[0-9a-f]{64}$/.test(receiptSha256)) fail('receipt SHA-256 must be lowercase hex')

  sourceRoot = path.resolve(sourceRoot)
  outputRoot = path.resolve(outputRoot)
  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.mkdirSync(outputRoot, { recursive: true })
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-v33-resident-'))

  try {
    const repo = stageSource(sourceRoot, outputRoot, workRoot, candidate, engineCommit)
    prepareAgentBrowser(workRoot, repo)
    stagePython(sourceRoot, outputRoot)
    stageNode(workRoot, outputRoot)

    const manifest = buildManifest({ candidate, engineCommit, receiptSha256 })
    fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`[resident-stage] complete: ${outputRoot}`)
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true })
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  for (const required of ['source', 'output', 'candidate', 'engine-commit', 'receipt-sha256']) {
    if (!args[required]) fail(`missing --${required}=...`)
  }

  stageResidentRuntime({
    sourceRoot: args.source,
    outputRoot: args.output,
    candidate: args.candidate,
    engineCommit: args['engine-commit'],
    receiptSha256: args['receipt-sha256']
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
