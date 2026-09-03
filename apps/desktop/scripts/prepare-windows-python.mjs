#!/usr/bin/env node
// Build-time only. First launch never calls this script or a package registry.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { isExcludedWindowsPythonTemplate } from './windows-python-distribution.mjs'

const repo = resolve(import.meta.dirname, '../../..')
const output = join(repo, 'apps/desktop/build/python-runtime')
const uv = process.argv[2]
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build on native Windows x64')
if (!uv || sha(readFileSync(uv)) !== '8da6cedef60c27ac997ebf400fbfc6d373c5b0a7ae6a299b9d52be7fe63723fb') {
  throw new Error('Pass the verified Windows x64 uv 0.12.5 executable')
}
if (existsSync(output)) throw new Error('Prepared Python already exists; preserve it or explicitly stage a new candidate')
const scratchParent = join(repo, '.tmp-release-python')
mkdirSync(scratchParent, { recursive: true })
const scratch = mkdtempSync(join(scratchParent, 'build-'))
const env = { ...process.env, UV_CACHE_DIR: join(scratchParent, 'cache'), UV_PYTHON_INSTALL_DIR: join(scratch, 'python'),
  UV_PYTHON_BIN_DIR: join(scratch, 'bin'), PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1' }
delete env.PYTHONHOME
delete env.PYTHONPATH
const run = args => execFileSync(uv, args, { cwd: repo, env, stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true })
run(['python', 'install', '3.12.10', '--no-bin', '--no-progress'])
const prefix = join(scratch, 'python/cpython-3.12.10-windows-x86_64-none')
const requirements = join(scratch, 'requirements.txt')
run(['export', '--frozen', '--no-emit-project', '--no-dev', '--extra', 'web', '--extra', 'voice', '--extra', 'anthropic', '--format', 'requirements-txt', '--output-file', requirements])
run(['--no-config', 'pip', 'install', '--python', join(prefix, 'python.exe'), '--target', join(prefix, 'Lib/site-packages'),
  '--require-hashes', '--only-binary', ':all:', '-r', requirements, '--no-progress'])
mkdirSync(output, { recursive: true })
console.log('Copying the clean relocatable Python prefix...')
cpSync(prefix, join(output, 'payload'), { recursive: true, filter: source => {
  const name = relative(prefix, source).replaceAll('\\', '/')
  if (lstatSync(source).isSymbolicLink()) throw new Error(`Unexpected Python link: ${name}`)
  // Console launchers embed a build-machine interpreter path. Hermes uses
  // python -m entrypoints; do not ship those non-relocatable launchers or pyc.
  return !name.split('/').some(part => part === '__pycache__' || part === 'Scripts') && !name.endsWith('.pyc') &&
    name !== 'Lib/site-packages/bin' && !name.startsWith('Lib/site-packages/bin/') &&
    !isExcludedWindowsPythonTemplate(name)
} })
const files = []
console.log('Hashing the prepared Python inventory...')
function visit(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) visit(join(dir, entry.name), name)
    else {
      const bytes = readFileSync(join(dir, entry.name))
      files.push({ path: name, size: bytes.length, sha256: sha(bytes) })
    }
  }
}
visit(join(output, 'payload'))
writeFileSync(join(output, 'python-manifest.json'), JSON.stringify({
  schemaVersion: 1, layout: 'portable-cpython-win-x64-v1', version: '3.12.10',
  uvSha256: sha(readFileSync(uv)), lockSha256: sha(readFileSync(join(repo, 'uv.lock'))),
  requirementsSha256: sha(readFileSync(requirements)),
  pythonSource: 'https://github.com/astral-sh/python-build-standalone/releases/download/20250529/cpython-3.12.10%2B20250529-x86_64-pc-windows-msvc-install_only_stripped.tar.gz',
  files: files.sort((a, b) => a.path.localeCompare(b.path))
}, null, 2) + '\n')
console.log(`Prepared ${files.length} verified clean Python files in ${output}`)
