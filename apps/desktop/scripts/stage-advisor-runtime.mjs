#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { expectedRuntimeCandidateId } from '../electron/runtime-candidate-id.ts'
import { isExcludedWindowsPythonTemplate } from './windows-python-distribution.mjs'

const desktopRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(desktopRoot, '..', '..')
const outRoot = join(desktopRoot, 'build', 'advisor-runtime')
const payloadRoot = join(outRoot, 'payload')
const pkg = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8'))
const buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
const composition = JSON.parse(readFileSync(join(desktopRoot, 'build', 'experimental-composition.json'), 'utf8'))
const sourceCommit = String(composition.experimentalEngineHead || buildCommit)
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()

if (dirty) {
  throw new Error('Advisor runtime staging requires a clean committed source tree')
}

const candidateId = expectedRuntimeCandidateId(pkg.version, sourceCommit, buildCommit)
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter(path => path !== '.gitkeep' && !path.endsWith('/.gitkeep'))
  .filter(path => !(
    path.startsWith('apps/desktop/') ||
    path.startsWith('tests/') ||
    path.startsWith('docs/') ||
    path.startsWith('.github/') ||
    path.startsWith('website/') ||
    path.startsWith('packaging/') ||
    path.startsWith('scripts/release/')
  ))

rmSync(outRoot, { force: true, recursive: true })
mkdirSync(payloadRoot, { recursive: true })

const files = []
for (const path of tracked) {
  const source = join(repoRoot, path)
  if (!existsSync(source)) continue
  const target = join(payloadRoot, path)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target)
  const bytes = readFileSync(target)
  files.push({ path: path.replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length })
}

let python
if (/^[1-9]\d{3}\./.test(pkg.version)) {
  const pythonRoot = join(desktopRoot, 'build', 'python-runtime')
  const receipt = JSON.parse(readFileSync(join(pythonRoot, 'python-manifest.json'), 'utf8'))
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  if (receipt.layout !== 'portable-cpython-win-x64-v1' || receipt.version !== '3.12.10' ||
      receipt.lockSha256 !== digest(readFileSync(join(repoRoot, 'uv.lock')))) {
    throw new Error('Prepare a clean Windows Python bundle against this exact dependency lock')
  }
  for (const entry of receipt.files) {
    if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.includes('\\') ||
        entry.path.includes(':') || entry.path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Unsafe prepared Python path')
    }
    const bytes = readFileSync(join(pythonRoot, 'payload', entry.path))
    if (bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error(`Prepared Python changed: ${entry.path}`)
    // Also support the already verified, immutable C1 preparation cache. All
    // entries still pass their original hashes; only these unneeded templates
    // are excluded from the new candidate's exact manifest and payload.
    if (isExcludedWindowsPythonTemplate(entry.path)) continue
    const target = join(payloadRoot, '.python', entry.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    files.push({ ...entry, path: `.python/${entry.path}` })
  }
  python = { layout: receipt.layout, version: receipt.version, lockSha256: receipt.lockSha256,
    preparationManifestSha256: digest(readFileSync(join(pythonRoot, 'python-manifest.json'))),
    excludedInstallerTemplates: receipt.files.map(entry => entry.path).filter(isExcludedWindowsPythonTemplate) }
}

const manifest = {
  schemaVersion: 1,
  candidateId,
  productVersion: pkg.version,
  sourceCommit,
  buildCommit,
  ...(python ? { python } : {}),
  fileCount: files.length,
  files
}
writeFileSync(join(outRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
cpSync(join(desktopRoot, 'scripts', 'Sync-Hermes-Advisor-Runtime.ps1'), join(outRoot, 'Sync-Hermes-Advisor-Runtime.ps1'))

console.log(`[advisor-runtime] staged ${files.length} tracked files for ${candidateId}`)
