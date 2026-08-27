#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ROLLBACK_COMMIT,
  ROLLBACK_TAG,
  V32_SOURCE_COMMIT,
  V32_SOURCE_TAG,
  V321_CANDIDATE_TAG,
  WINDOWS_LIFECYCLE_NODE_SHA256,
  WINDOWS_LIFECYCLE_NODE_VERSION,
  assertSupportedGithubHostedWindowsRunner,
  assertSupportedWindowsSandboxHost,
  buildWindowsSandboxConfig,
  validateLifecycleDescriptor,
  validateLifecycleReceipt
} from './policy.mjs'
import {
  LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS,
  createLocalCandidateProvenanceGuard
} from '../bundled-release-policy.mjs'
import {
  assertEmptyEvidenceDirectory,
  assertEvidenceBoundary,
  isSameOrWithin,
  resolveLifecycleStagingRoot
} from './host-boundary.mjs'
import { fingerprintSnapshot, stagePlaywrightDependencies, stageTrackedSnapshot } from './tracked-snapshot.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const RESULT_NAME = 'lifecycle-result.json'

function usage() {
  return `Usage:
  node scripts/windows-lifecycle-acceptance/run.mjs \\
    --candidate <v32.1 NSIS.exe> [--candidate-tag <vi-v0.32.1-N>] \\
    --candidate-sha256 <sha256> \\
    --candidate-commit <40-char-sha> --harness-commit <40-char-sha> \\
    --previous <vi-v0.32.0-1 NSIS.exe> --previous-sha256 <sha256> \\
    --rollback <vi-v0.20.4-39 NSIS.exe> --rollback-sha256 <sha256> \\
    --node-runtime-dir <pinned Node 26 x64 directory> \\
    --evidence-dir <new or empty directory> \\
    [--isolation-mode windows-sandbox|github-hosted-ephemeral-vm]

This command runs only in Windows Sandbox or a GitHub-hosted ephemeral Windows
VM. It never falls back to a workstation install. The candidate tag must be a
v32.1 successor at or after vi-v0.32.1-17; its full commit must match the exact tag.
Previous and rollback tags are fixed to ${V32_SOURCE_TAG} and ${ROLLBACK_TAG}.`
}

function parseArgs(argv) {
  const values = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (!arg.startsWith('--')) throw new Error(`unexpected positional argument: ${arg}`)
    const splitAt = arg.indexOf('=')
    const key = splitAt === -1 ? arg.slice(2) : arg.slice(2, splitAt)
    const value = splitAt === -1 ? argv[++i] : arg.slice(splitAt + 1)
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`)
    if (values.has(key)) throw new Error(`--${key} was supplied more than once`)
    values.set(key, value)
  }

  const required = [
    'candidate',
    'candidate-sha256',
    'candidate-commit',
    'harness-commit',
    'previous',
    'previous-sha256',
    'rollback',
    'rollback-sha256',
    'node-runtime-dir',
    'evidence-dir'
  ]
  const allowed = new Set([...required, 'candidate-tag', 'isolation-mode', 'timeout-minutes'])
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new Error(`unknown option: --${key}`)
  }
  for (const key of required) {
    if (!values.has(key)) throw new Error(`--${key} is required`)
  }

  const timeoutMinutes = Number(values.get('timeout-minutes') || 90)
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes < 15 || timeoutMinutes > 240) {
    throw new Error('--timeout-minutes must be between 15 and 240')
  }
  const isolationMode = values.get('isolation-mode') || 'windows-sandbox'
  if (!['windows-sandbox', 'github-hosted-ephemeral-vm'].includes(isolationMode)) {
    throw new Error('--isolation-mode must be windows-sandbox or github-hosted-ephemeral-vm')
  }

  return {
    candidate: path.resolve(values.get('candidate')),
    candidateCommit: values.get('candidate-commit'),
    candidateTag: values.get('candidate-tag') || V321_CANDIDATE_TAG,
    candidateSha256: values.get('candidate-sha256').toLowerCase(),
    evidenceDir: path.resolve(values.get('evidence-dir')),
    harnessCommit: values.get('harness-commit'),
    isolationMode,
    nodeRuntimeDir: path.resolve(values.get('node-runtime-dir')),
    previous: path.resolve(values.get('previous')),
    previousSha256: values.get('previous-sha256').toLowerCase(),
    rollback: path.resolve(values.get('rollback')),
    rollbackSha256: values.get('rollback-sha256').toLowerCase(),
    timeoutMs: timeoutMinutes * 60_000
  }
}

function sha256(file) {
  const hash = crypto.createHash('sha256')
  const handle = fs.openSync(file, 'r')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let read = 0
    do {
      read = fs.readSync(handle, buffer, 0, buffer.length, null)
      if (read > 0) hash.update(buffer.subarray(0, read))
    } while (read > 0)
  } finally {
    fs.closeSync(handle)
  }
  return hash.digest('hex')
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function inspectInstaller(file, expectedSha256, tag, commit) {
  const stat = fs.statSync(file, { throwIfNoEntry: false })
  if (!stat?.isFile()) throw new Error(`installer is missing: ${file}`)
  const actualSha256 = sha256(file)
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `installer SHA-256 mismatch for ${path.basename(file)}; expected ${expectedSha256}, got ${actualSha256}`
    )
  }
  return {
    ...(commit ? { commit } : {}),
    fileName: path.basename(file),
    sha256: actualSha256,
    size: stat.size,
    tag
  }
}

function listEvidenceFiles(directory) {
  const ignored = new Set([RESULT_NAME, 'expected-lifecycle.json', 'host-launch.json', 'host-validation.json'])
  const files = []
  const walk = current => {
    for (const name of fs.readdirSync(current)) {
      const absolute = path.join(current, name)
      const stat = fs.lstatSync(absolute)
      if (stat.isSymbolicLink()) throw new Error(`evidence may not contain links: ${absolute}`)
      if (stat.isDirectory()) {
        walk(absolute)
      } else if (stat.isFile()) {
        const relative = path.relative(directory, absolute).split(path.sep).join('/')
        if (!ignored.has(relative)) files.push({ absolute, relative, size: stat.size })
      } else {
        throw new Error(`unsupported evidence entry: ${absolute}`)
      }
    }
  }
  walk(directory)
  return files.sort((left, right) => left.relative.localeCompare(right.relative))
}

function verifyEvidenceFiles(directory, receipt) {
  const actual = listEvidenceFiles(directory)
  const expected = [...receipt.evidenceManifest].sort((left, right) => left.path.localeCompare(right.path))
  if (actual.length !== expected.length) {
    throw new Error(`evidence file count mismatch; receipt=${expected.length}, host=${actual.length}`)
  }
  const verified = actual.map((file, index) => {
    const claim = expected[index]
    const digest = sha256(file.absolute)
    if (claim.path !== file.relative || claim.size !== file.size || claim.sha256 !== digest) {
      throw new Error(`evidence file does not match receipt: ${file.relative}`)
    }
    return { path: file.relative, sha256: digest, size: file.size }
  })
  return {
    files: verified,
    manifestSha256: sha256Text(`${JSON.stringify(verified)}\n`),
    receiptSha256: sha256(path.join(directory, RESULT_NAME))
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(command)} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`
    )
  }
  return result.stdout.trim()
}

function inspectWindowsVirtualMachine() {
  const output = runChecked('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$system = Get-CimInstance Win32_ComputerSystem; [pscustomobject]@{ hypervisorPresent = [bool]$system.HypervisorPresent; model = [string]$system.Model } | ConvertTo-Json -Compress'
  ])
  const result = JSON.parse(output)
  return { hypervisorPresent: result.hypervisorPresent === true, model: String(result.model || '') }
}

function scrubCredentialEnvironment(environment) {
  const denied = /(?:api[_-]?key|token|secret|password|credential|cookie|authorization)/i
  const deniedExact = new Set([
    'GITHUB_ENV',
    'GITHUB_OUTPUT',
    'GITHUB_PATH',
    'GITHUB_STEP_SUMMARY',
    'GIT_ASKPASS',
    'NPM_CONFIG_USERCONFIG',
    'SSH_AUTH_SOCK'
  ])
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name, value]) => value !== undefined && !denied.test(name) && !deniedExact.has(name)
    )
  )
}

function assertCandidateCheckout(guard) {
  const head = runChecked('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'])
  const dirty = runChecked('git', ['-C', REPO_ROOT, 'status', '--porcelain=v1', '--untracked-files=all'])
  const ignoredBuildInputs = runChecked('git', ['-C', REPO_ROOT, ...LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS])
  guard.check({
    headCommit: head,
    ignoredBuildInputs,
    worktreeStatus: dirty
  })
  const playwrightCli = path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js')
  if (!fs.statSync(playwrightCli, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Playwright dependencies are missing: ${playwrightCli}`)
  }
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.partial-${process.pid}`
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temp, file)
}

async function waitForReceipt({ child, descriptor, evidenceDir, timeoutMs }) {
  const resultPath = path.join(evidenceDir, RESULT_NAME)
  const deadline = Date.now() + timeoutMs
  let exit = null
  child.once('exit', (code, signal) => {
    exit = { code, signal, time: Date.now() }
  })

  while (Date.now() < deadline) {
    const receiptExists = fs.statSync(resultPath, { throwIfNoEntry: false })?.isFile() === true
    if (receiptExists && exit) {
      let receipt
      try {
        receipt = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
      } catch (error) {
        throw new Error(
          `isolated lifecycle result is invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      const validated = validateLifecycleReceipt(receipt, descriptor)
      return { ...validated, evidence: verifyEvidenceFiles(evidenceDir, receipt) }
    }
    if (exit && Date.now() - exit.time > 10_000) {
      throw new Error(
        `isolated lifecycle runner exited before producing a valid receipt (code=${exit.code}, signal=${exit.signal})`
      )
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`isolated Windows lifecycle acceptance timed out after ${Math.round(timeoutMs / 60_000)} minutes`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }

  const windowsDir = process.env.WINDIR || 'C:\\Windows'
  const sandboxExe = path.join(windowsDir, 'System32', 'WindowsSandbox.exe')
  const hostVirtualMachine = inspectWindowsVirtualMachine()
  if (args.isolationMode === 'windows-sandbox') {
    assertSupportedWindowsSandboxHost({
      arch: process.arch,
      nodeVersion: process.version,
      platform: process.platform,
      sandboxExecutableExists: fs.statSync(sandboxExe, { throwIfNoEntry: false })?.isFile() === true
    })
  } else {
    assertSupportedGithubHostedWindowsRunner({
      arch: process.arch,
      githubActions: process.env.GITHUB_ACTIONS,
      ...hostVirtualMachine,
      nodeVersion: process.version,
      platform: process.platform,
      runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
      runnerOs: process.env.RUNNER_OS
    })
  }

  const portableNode = path.join(args.nodeRuntimeDir, 'node.exe')
  if (!fs.statSync(portableNode, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`pinned Node runtime is missing node.exe: ${args.nodeRuntimeDir}`)
  }
  const portableVersion = runChecked(portableNode, ['--version'])
  const portablePlatform = runChecked(portableNode, ['-p', 'process.platform + "/" + process.arch'])
  const portableSha256 = sha256(portableNode)
  if (portableVersion !== WINDOWS_LIFECYCLE_NODE_VERSION) {
    throw new Error(`pinned Node runtime must be ${WINDOWS_LIFECYCLE_NODE_VERSION}, got ${portableVersion}`)
  }
  if (portableSha256 !== WINDOWS_LIFECYCLE_NODE_SHA256) {
    throw new Error(
      `pinned Node runtime SHA-256 mismatch; expected ${WINDOWS_LIFECYCLE_NODE_SHA256}, got ${portableSha256}`
    )
  }
  if (portablePlatform !== 'win32/x64') {
    throw new Error(`pinned Node runtime must be Windows x64, got ${portablePlatform}`)
  }
  if (args.isolationMode === 'windows-sandbox') {
    assertSupportedWindowsSandboxHost({
      arch: 'x64',
      nodeVersion: portableVersion,
      platform: 'win32',
      sandboxExecutableExists: true
    })
  } else {
    assertSupportedGithubHostedWindowsRunner({
      arch: 'x64',
      githubActions: process.env.GITHUB_ACTIONS,
      ...hostVirtualMachine,
      nodeVersion: portableVersion,
      platform: 'win32',
      runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
      runnerOs: process.env.RUNNER_OS
    })
  }

  const checkoutGuard = createLocalCandidateProvenanceGuard({ expectedCommit: args.harnessCommit })
  assertCandidateCheckout(checkoutGuard)
  assertEmptyEvidenceDirectory(args.evidenceDir)
  assertEvidenceBoundary(args.evidenceDir, [
    REPO_ROOT,
    args.nodeRuntimeDir,
    path.dirname(args.candidate),
    path.dirname(args.previous),
    path.dirname(args.rollback),
    os.homedir(),
    os.tmpdir()
  ])

  const runId = crypto.randomUUID()
  const descriptor = validateLifecycleDescriptor({
    candidate: inspectInstaller(args.candidate, args.candidateSha256, args.candidateTag, args.candidateCommit),
    harnessCommit: args.harnessCommit,
    previous: inspectInstaller(args.previous, args.previousSha256, V32_SOURCE_TAG, V32_SOURCE_COMMIT),
    releaseClass: 'community-prerelease',
    rollback: inspectInstaller(args.rollback, args.rollbackSha256, ROLLBACK_TAG, ROLLBACK_COMMIT),
    runId,
    schemaVersion: 1
  })

  const stagingRoot = resolveLifecycleStagingRoot({
    isolationMode: args.isolationMode,
    runnerTemp: process.env.RUNNER_TEMP,
    systemTemp: os.tmpdir()
  })
  const inputDir = fs.mkdtempSync(path.join(stagingRoot, `hermes-v32-lifecycle-${runId}-`))
  let sandbox = null
  try {
    const repoSnapshotDir = path.join(inputDir, 'repo-snapshot')
    stageTrackedSnapshot({
      destination: repoSnapshotDir,
      expectedCommit: args.harnessCommit,
      repoRoot: REPO_ROOT
    })
    const dependencyPackages = stagePlaywrightDependencies({
      destinationRepo: repoSnapshotDir,
      nodeModulesRoot: path.join(REPO_ROOT, 'node_modules')
    })
    const snapshotFingerprint = fingerprintSnapshot(repoSnapshotDir)
    assertEvidenceBoundary(args.evidenceDir, [
      REPO_ROOT,
      args.nodeRuntimeDir,
      path.dirname(args.candidate),
      path.dirname(args.previous),
      path.dirname(args.rollback),
      os.homedir(),
      os.tmpdir(),
      inputDir
    ])
    const guestInputs = {
      candidate: path.join(inputDir, 'candidate.exe'),
      previous: path.join(inputDir, 'previous.exe'),
      rollback: path.join(inputDir, 'rollback.exe')
    }
    fs.copyFileSync(args.candidate, guestInputs.candidate)
    fs.copyFileSync(args.previous, guestInputs.previous)
    fs.copyFileSync(args.rollback, guestInputs.rollback)
    fs.copyFileSync(
      path.join(repoSnapshotDir, 'scripts', 'windows-lifecycle-acceptance', 'guest.ps1'),
      path.join(inputDir, 'guest.ps1')
    )

    for (const [kind, file] of Object.entries(guestInputs)) {
      if (sha256(file) !== descriptor[kind].sha256) {
        throw new Error(`${kind} installer changed while staging the isolated input`)
      }
    }

    const hostedPaths = {
      candidate: guestInputs.candidate,
      evidence: args.evidenceDir,
      nodeRuntime: args.nodeRuntimeDir,
      previous: guestInputs.previous,
      repo: repoSnapshotDir,
      rollback: guestInputs.rollback
    }
    const sandboxPaths = {
      candidate: 'C:\\HermesHarness\\Input\\candidate.exe',
      evidence: 'C:\\HermesHarness\\Evidence',
      nodeRuntime: 'C:\\HermesHarness\\Node',
      previous: 'C:\\HermesHarness\\Input\\previous.exe',
      repo: 'C:\\HermesHarness\\Repo',
      rollback: 'C:\\HermesHarness\\Input\\rollback.exe'
    }
    const guestManifest = {
      ...descriptor,
      isolation: { mechanism: args.isolationMode },
      paths: args.isolationMode === 'windows-sandbox' ? sandboxPaths : hostedPaths
    }
    writeJsonAtomic(path.join(inputDir, 'manifest.json'), guestManifest)
    if (args.isolationMode === 'windows-sandbox') {
      fs.writeFileSync(
        path.join(inputDir, 'lifecycle.wsb'),
        buildWindowsSandboxConfig({
          evidenceDir: args.evidenceDir,
          inputDir,
          nodeRuntimeDir: args.nodeRuntimeDir,
          repoSnapshotDir
        }),
        'utf8'
      )
    }
    const expectedPath = path.join(args.evidenceDir, 'expected-lifecycle.json')
    const hostLaunchPath = path.join(args.evidenceDir, 'host-launch.json')
    writeJsonAtomic(expectedPath, descriptor)
    writeJsonAtomic(hostLaunchPath, {
      candidate: descriptor.candidate,
      nodeRuntime: {
        sha256: portableSha256,
        source: 'official-signed-shasums256',
        version: portableVersion
      },
      previous: descriptor.previous,
      releaseClass: descriptor.releaseClass,
      rollback: descriptor.rollback,
      runId,
      schemaVersion: 1,
      isolation: {
        mechanism: args.isolationMode,
        ...(args.isolationMode === 'github-hosted-ephemeral-vm' ? hostVirtualMachine : {})
      },
      sourceSnapshot: {
        commit: args.harnessCommit,
        dependencyPackages,
        fileCount: snapshotFingerprint.fileCount,
        sha256: snapshotFingerprint.sha256
      },
      startedAt: new Date().toISOString()
    })

    if (args.isolationMode === 'windows-sandbox') {
      sandbox = spawn(sandboxExe, [path.join(inputDir, 'lifecycle.wsb')], {
        detached: false,
        stdio: 'ignore',
        windowsHide: false
      })
    } else {
      const powerShell = path.join(windowsDir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      sandbox = spawn(
        powerShell,
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(inputDir, 'guest.ps1'),
          '-ManifestPath',
          path.join(inputDir, 'manifest.json')
        ],
        {
          detached: false,
          env: scrubCredentialEnvironment(process.env),
          stdio: 'inherit',
          windowsHide: true
        }
      )
    }
    const validated = await waitForReceipt({
      child: sandbox,
      descriptor,
      evidenceDir: args.evidenceDir,
      timeoutMs: args.timeoutMs
    })
    const finalSnapshotFingerprint = fingerprintSnapshot(repoSnapshotDir)
    if (
      finalSnapshotFingerprint.fileCount !== snapshotFingerprint.fileCount ||
      finalSnapshotFingerprint.sha256 !== snapshotFingerprint.sha256
    ) {
      throw new Error('tracked source/dependency snapshot changed while mapped into Windows Sandbox')
    }
    assertCandidateCheckout(checkoutGuard)
    writeJsonAtomic(path.join(args.evidenceDir, 'host-validation.json'), {
      finishedAt: new Date().toISOString(),
      evidenceFileCount: validated.evidence.files.length,
      evidenceManifestSha256: validated.evidence.manifestSha256,
      expectedLifecycleSha256: sha256(expectedPath),
      hostLaunchSha256: sha256(hostLaunchPath),
      receiptSha256: validated.evidence.receiptSha256,
      requiredGates: Object.keys(validated.receipt.gates),
      runId,
      schemaVersion: 1,
      status: 'passed'
    })
    console.log(`Windows x64 lifecycle acceptance passed: ${path.join(args.evidenceDir, RESULT_NAME)}`)
  } finally {
    if (sandbox && sandbox.exitCode === null && !sandbox.killed) sandbox.kill()
    if (!isSameOrWithin(inputDir, stagingRoot) || path.resolve(inputDir) === path.resolve(stagingRoot)) {
      throw new Error(`refusing to remove an unexpected staging directory: ${inputDir}`)
    }
    fs.rmSync(inputDir, { force: true, maxRetries: 12, recursive: true, retryDelay: 250 })
  }
}

main().catch(error => {
  console.error(`Windows lifecycle acceptance failed closed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
