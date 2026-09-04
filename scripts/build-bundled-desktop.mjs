#!/usr/bin/env node
// build-bundled-desktop.mjs — build the fully bundled desktop installer
// locally, on any of the three platforms. This is the same sequence as
// .github/workflows/desktop-bundled-release.yml, in one runnable script:
//
//   1. preflight: uv, git, npm exist; a release tag is resolvable
//   2. npm ci at the repo root (skip with --no-install)
//   3. build ui-tui (with hermes-ink) and the dashboard SPA
//   4. download the digest-pinned payload Node dist and agent-browser package
//   5. npm run build in apps/desktop with HERMES_DESKTOP_BUNDLED=1
//   6. npm run builder -- <platform targets>   (skip with --no-package)
//
// Usage:
//   node scripts/build-bundled-desktop.mjs --tag=vi-v0.20.0-15 --release-class=stable
//   node scripts/build-bundled-desktop.mjs --tag=vi-v0.32.0-1 --release-class=community-prerelease \
//     --local-candidate --commit=<full-clean-HEAD-sha>
//
// Signing is CI's job (Azure/Apple secrets). Local builds are unsigned.

import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { hostTarBin } from '../apps/desktop/scripts/stage-agent-payloads.mjs'
import { purgeLocalCandidateDerivedOutputs } from './local-candidate-derived-outputs.mjs'
import {
  LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS,
  LOCAL_CANDIDATE_STATUS_COMMAND,
  createLocalCandidateProvenanceGuard,
  resolveBundledReleaseClass,
  validateBundledBuildNpm,
  validateBundledBuildNode
} from './bundled-release-policy.mjs'
import { prepareAgentBrowserPackage } from './prepare-agent-browser-native.mjs'
import {
  payloadNodeDescriptor,
  resolveVietnameseReleaseCandidate,
  sha256File,
  validateVietnameseCandidateCheckout
} from './vietnamese-release.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const tagArg = args.find(a => a.startsWith('--tag='))?.slice('--tag='.length)
const commitArg = args.find(a => a.startsWith('--commit='))?.slice('--commit='.length)
const releaseClassArg = args.find(a => a.startsWith('--release-class='))?.slice('--release-class='.length)
const localCandidate = args.includes('--local-candidate')
const skipInstall = args.includes('--no-install')
const skipPackage = args.includes('--no-package')
// Everything after `--` goes to electron-builder verbatim (CI appends its
// signing configuration this way).
const dashDash = process.argv.indexOf('--')
const extraBuilderArgs = dashDash === -1 ? [] : process.argv.slice(dashDash + 1)

function fail(message) {
  console.error(`[build-bundled] ${message}`)
  process.exit(1)
}

function run(cmd, argv, opts = {}) {
  console.log(`[build-bundled] $ ${cmd} ${argv.join(' ')}`)
  const result = spawnSync(cmd, argv, {
    stdio: 'inherit',
    cwd: REPO_ROOT,
    shell: process.platform === 'win32',
    ...opts
  })
  if (result.status !== 0) {
    fail(`${cmd} exited ${result.status}`)
  }
}

function capture(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

function captureArgv(cmd, argv) {
  const result = spawnSync(cmd, argv, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: false
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${cmd} ${argv.join(' ')} exited ${result.status}: ${String(result.stderr || '').trim()}`)
  }
  return String(result.stdout || '').trim()
}

// ── 1. preflight ────────────────────────────────────────────────────────────

try {
  validateBundledBuildNode(process.versions.node)
} catch (error) {
  fail(error.message)
}

// The script may be launched through an absolute Node 26 path while `npm.cmd`
// still resolves `node.exe` from an older PATH. Gate both interpreters so the
// host build and every npm child share the same v32 floor.
const pathNodeProbe = spawnSync('node', ['--version'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32'
})
if (pathNodeProbe.status !== 0) {
  fail('required tool missing: node')
}
try {
  validateBundledBuildNode(pathNodeProbe.stdout)
} catch (error) {
  fail(`PATH node used by npm is unsupported: ${error.message}`)
}

const npmProbe = spawnSync('npm', ['--version'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32'
})
if (npmProbe.status !== 0) {
  fail('required tool missing: npm')
}
try {
  validateBundledBuildNpm(npmProbe.stdout)
} catch (error) {
  fail(error.message)
}

for (const tool of ['uv', 'git', 'tar']) {
  const probe = spawnSync(tool, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
  if (probe.status !== 0) {
    fail(`required tool missing: ${tool}`)
  }
}

let tag = tagArg
if (localCandidate && !tag) {
  fail('--local-candidate requires --tag=vi-vX.Y.Z-N as its package label')
}
if (!localCandidate && commitArg) {
  fail('--commit is only valid with the explicit --local-candidate mode')
}
if (!tag) {
  try {
    tag = capture('git describe --tags --exact-match')
  } catch {
    fail('no --tag=vi-vX.Y.Z-N given and HEAD is not at an exact release tag')
  }
}
let release
try {
  release = resolveVietnameseReleaseCandidate(tag)
} catch (error) {
  fail(error.message)
}

let releaseClass
try {
  const envReleaseClass = process.env.HERMES_RELEASE_CLASS || ''
  if (releaseClassArg && envReleaseClass && releaseClassArg !== envReleaseClass) {
    throw new Error(`--release-class ${releaseClassArg} does not match HERMES_RELEASE_CLASS ${envReleaseClass}`)
  }
  releaseClass = resolveBundledReleaseClass(releaseClassArg || envReleaseClass, { localCandidate })
} catch (error) {
  fail(error.message)
}

let localCandidateProvenance = null
if (localCandidate) {
  try {
    localCandidateProvenance = createLocalCandidateProvenanceGuard({
      expectedCommit: commitArg,
      skipInstall
    })
  } catch (error) {
    fail(error.message)
  }
}

// Normal release builds retain the exact-tag contract. The explicit local
// candidate path treats --tag only as a package/manifest label and archives
// the caller-supplied immutable HEAD commit. It can never be staged or
// promoted until the unchanged CI/tag path independently proves the tag.
let checkout
try {
  const headCommit = capture('git rev-parse HEAD')
  if (localCandidate) {
    checkout = localCandidateProvenance.check({
      headCommit,
      // The desktop build consumes the live checkout (including public/** and
      // assets/**), while the Python payload is archived from the commit.
      // Reject every tracked or untracked change so both surfaces are bound to
      // the exact --commit bytes before any install, download, or build runs.
      ignoredBuildInputs: captureArgv('git', LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS),
      worktreeStatus: capture(LOCAL_CANDIDATE_STATUS_COMMAND)
    })
  } else {
    checkout = validateVietnameseCandidateCheckout({
      tag,
      tagCommit: capture(`git rev-list -n 1 refs/tags/${tag}`),
      headCommit,
      status: capture('git status --porcelain=v1 --untracked-files=normal')
    })
  }
} catch (error) {
  fail(error.message)
}

// Hermes Vietnamese owns a product/technical version distinct from the
// embedded upstream Hermes Agent core. resolveVietnameseReleaseCandidate()
// already locked the tag to product-metadata.json's technicalVersion.
// Keep pyproject.toml aligned with the separately-displayed upstream version
// so a product version bump never claims that upstream itself changed.
const pyprojectVersion = fs
  .readFileSync(path.join(REPO_ROOT, 'pyproject.toml'), 'utf8')
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1]
if (!pyprojectVersion) {
  fail('could not read version from pyproject.toml')
}
if (release.upstreamVersion !== pyprojectVersion) {
  fail(
    `product metadata upstream version ${release.upstreamVersion} does not match pyproject.toml version ${pyprojectVersion}`
  )
}

// HERMES_BUILD_TARGETS ghi đè mục tiêu electron-builder (ví dụ "--linux AppImage deb" để bỏ rpm,
// hay "--mac dmg" để chỉ ra dmg); mặc định giữ nguyên như bản gốc.
const targets =
  process.env.HERMES_BUILD_TARGETS?.trim() ||
  { linux: '--linux AppImage deb rpm', darwin: '--mac dmg zip', win32: '--win nsis' }[process.platform]
if (!targets) {
  fail(`unsupported platform: ${process.platform}`)
}

console.log(
  `[build-bundled] tag=${tag} commit=${checkout.commit} releaseClass=${releaseClass} ` +
    `source=${localCandidate ? 'clean-HEAD-local-candidate' : 'tag'} platform=${process.platform}-${process.arch}`
)

if (localCandidate) {
  const purged = purgeLocalCandidateDerivedOutputs(REPO_ROOT)
  console.log(`[build-bundled] cleared ${purged.length} derived package-input roots`)
}

// ── 2-3. deps + JS surfaces ─────────────────────────────────────────────────

// ui-tui, ui-tui/packages/*, and web are npm workspaces of the repo root:
// ONE root `npm ci` installs all of them, hoisted into the root
// node_modules. Never run npm ci inside a workspace directory — that
// builds a partial shadow tree beside the hoisted one and breaks module
// resolution for the workspace builds below.
if (!skipInstall) {
  run('npm', ['ci', '--no-audit', '--no-fund'])
}
run('npm', ['run', 'build', '--workspace', 'ui-tui'])
run('npm', ['run', 'build', '--workspace', 'web'])

// ── 4. payload node dist ────────────────────────────────────────────────────

const nodeInput = payloadNodeDescriptor(process.platform, process.arch)

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-node-payload-'))
const archive = nodeInput.archive
const extractDir = path.join(work, 'extract')
const nodeDir = path.join(work, 'node-payload')
fs.mkdirSync(extractDir, { recursive: true })

console.log(`[build-bundled] payload node: ${nodeInput.version} (${nodeInput.sha256})`)
const archivePath = path.join(work, archive)
run('curl', ['-fsSL', '-o', archivePath, nodeInput.url])
const actualNodeSha = sha256File(archivePath)
if (actualNodeSha !== nodeInput.sha256) {
  fail(`payload Node SHA-256 mismatch: expected ${nodeInput.sha256}, got ${actualNodeSha}`)
}
run(hostTarBin(), ['-xf', archivePath, '-C', extractDir])
const [topDir] = fs.readdirSync(extractDir)
fs.renameSync(path.join(extractDir, topDir), nodeDir)

const nodeBinary = process.platform === 'win32' ? path.join(nodeDir, 'node.exe') : path.join(nodeDir, 'bin', 'node')
if (!fs.existsSync(nodeBinary)) {
  fail(`extracted node dist has no runnable node at ${nodeBinary}`)
}

const browserPackage = prepareAgentBrowserPackage(
  path.join(work, 'agent-browser-package'),
  process.platform,
  process.arch
)

// ── 5-6. bundled desktop build + package ────────────────────────────────────

const env = {
  ...process.env,
  HERMES_DESKTOP_BUNDLED: '1',
  HERMES_RELEASE_CLASS: releaseClass,
  HERMES_PAYLOAD_TAG: tag,
  ...(localCandidate
    ? {
        HERMES_LOCAL_CANDIDATE: '1',
        HERMES_PAYLOAD_GIT_REF: checkout.commit
      }
    : {}),
  HERMES_PAYLOAD_PYTHON: process.env.HERMES_PAYLOAD_PYTHON || '3.11',
  HERMES_PAYLOAD_NODE_DIST: nodeDir,
  HERMES_AGENT_BROWSER_PACKAGE_ROOT: browserPackage
}

const desktop = path.join(REPO_ROOT, 'apps', 'desktop')
run('npm', ['run', 'build'], { cwd: desktop, env })

let completionMessage
if (skipPackage) {
  completionMessage = '[build-bundled] --no-package: stopped after payload staging'
} else {
  run(
    'npm',
    [
      'run',
      'builder',
      '--',
      ...targets.split(' '),
      `-c.extraMetadata.version=${release.appVersion}`,
      ...extraBuilderArgs
    ],
    { cwd: desktop, env }
  )
  completionMessage = `[build-bundled] artifacts: ${path.join(desktop, 'release')}`
}

if (localCandidate) {
  try {
    localCandidateProvenance.check({
      headCommit: capture('git rev-parse HEAD'),
      ignoredBuildInputs: captureArgv('git', LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS),
      worktreeStatus: capture(LOCAL_CANDIDATE_STATUS_COMMAND)
    })
  } catch (error) {
    fail(`final local-candidate provenance check failed: ${error.message}`)
  }
}

console.log(completionMessage)

fs.rmSync(work, { recursive: true, force: true })
