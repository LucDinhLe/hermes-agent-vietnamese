#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

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

const versionMatch = pkg.version.match(/-dev\.(\d+)-advisor-exp\.(\d+)$/)
if (!versionMatch) {
  throw new Error(`Unsupported Experimental version for runtime id: ${pkg.version}`)
}
const candidateId = `d${versionMatch[1]}e${versionMatch[2]}-${sourceCommit.slice(0, 8)}-${buildCommit.slice(0, 8)}`
if (candidateId.length > 32) {
  throw new Error(`Advisor runtime id exceeds the Windows path budget: ${candidateId}`)
}
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

const manifest = {
  schemaVersion: 1,
  candidateId,
  productVersion: pkg.version,
  sourceCommit,
  buildCommit,
  fileCount: files.length,
  files
}
writeFileSync(join(outRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
cpSync(join(desktopRoot, 'scripts', 'Sync-Hermes-Advisor-Runtime.ps1'), join(outRoot, 'Sync-Hermes-Advisor-Runtime.ps1'))

console.log(`[advisor-runtime] staged ${files.length} tracked files for ${candidateId}`)
