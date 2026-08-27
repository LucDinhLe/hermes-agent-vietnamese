#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  expectedBundledProvenanceFromEnv,
  readAndValidateBundledProvenance,
  validateExpectedDistributionArtifact
} from './packaged-provenance.mjs'

const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux'])

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
    timeout: 360_000,
    ...options
  })
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim()
    throw new Error(`${command} failed (${result.status ?? 'spawn'})${detail ? `: ${detail}` : ''}`)
  }
  return result
}

export function findPackagedResourcesPath(root) {
  const matches = []
  const pending = [path.resolve(root)]
  while (pending.length > 0) {
    const current = pending.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    const names = new Set(entries.map(entry => entry.name))
    if (
      names.has('install-stamp.json') &&
      fs.statSync(path.join(current, 'agent-payload', 'manifest.json'), { throwIfNoEntry: false })?.isFile()
    ) {
      matches.push(current)
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(path.join(current, entry.name))
    }
  }
  if (matches.length !== 1) {
    throw new Error(`expected exactly one packaged Resources directory, found ${matches.length}`)
  }
  return matches[0]
}

export function validateExtractedNativeProvenance({ expected, extractedRoot }) {
  const resourcesPath = findPackagedResourcesPath(extractedRoot)
  return readAndValidateBundledProvenance({ expected, resourcesPath }).provenance
}

function verifyMacDmg({ artifactPath, expected, tempRoot }) {
  const mountPoint = path.join(tempRoot, 'mounted')
  fs.mkdirSync(mountPoint)
  let attached = false
  try {
    run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mountPoint, artifactPath])
    attached = true
    return validateExtractedNativeProvenance({ expected, extractedRoot: mountPoint })
  } finally {
    if (attached) run('hdiutil', ['detach', mountPoint])
  }
}

function verifyLinuxAppImage({ artifactPath, expected, tempRoot }) {
  fs.chmodSync(artifactPath, 0o755)
  run(artifactPath, ['--appimage-extract'], {
    cwd: tempRoot
  })
  return validateExtractedNativeProvenance({
    expected,
    extractedRoot: path.join(tempRoot, 'squashfs-root')
  })
}

export function verifyNativeDistributionProvenance({ arch, artifactPath, desktopRoot, env = process.env, platform }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`native distribution verifier supports darwin|linux, got: ${platform}`)
  }
  const expected = expectedBundledProvenanceFromEnv(env)
  const exactArtifact = validateExpectedDistributionArtifact({
    arch,
    desktopRoot,
    expectedPath: artifactPath,
    platform,
    tag: expected.tag
  })
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `hermes-${platform}-provenance-`))
  try {
    const provenance =
      platform === 'darwin'
        ? verifyMacDmg({ artifactPath: exactArtifact, expected, tempRoot })
        : verifyLinuxAppImage({ artifactPath: exactArtifact, expected, tempRoot })
    return Object.freeze({ artifactPath: exactArtifact, ...provenance })
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true })
  }
}

function parseArgs(argv) {
  const [artifactPath, ...options] = argv
  const values = new Map()
  for (const option of options) {
    const match = /^--([a-z-]+)=(.+)$/.exec(option)
    if (!match) throw new Error(`unknown option: ${option}`)
    values.set(match[1], match[2])
  }
  if (!artifactPath || !values.get('platform') || !values.get('arch')) {
    throw new Error(
      'usage: verify-native-distribution-provenance.mjs <artifact> --platform=darwin|linux --arch=x64|arm64'
    )
  }
  return { artifactPath, arch: values.get('arch'), platform: values.get('platform') }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const result = verifyNativeDistributionProvenance({ ...args, desktopRoot })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
