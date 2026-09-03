#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '../../..')
const root = join(repo, 'apps/desktop/build/python-runtime')
const payload = join(root, 'payload')
const manifest = JSON.parse(readFileSync(join(root, 'python-manifest.json'), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
assert.equal(process.platform, 'win32')
assert.equal(process.arch, 'x64')
assert.equal(manifest.layout, 'portable-cpython-win-x64-v1')
assert.equal(manifest.version, '3.12.10')
assert.equal(manifest.lockSha256, sha(readFileSync(join(repo, 'uv.lock'))))
const expected = new Set(manifest.files.map(file => file.path))
assert.equal(expected.size, manifest.files.length)
assert(!manifest.files.some(file => file.path.startsWith('Lib/site-packages/bin/')), 'Do not ship generated absolute-path console launchers')
// These are installer *templates*, not loaded runtime modules. Their foreign
// architecture is intentional; every actual Python/DLL/PYD runtime stays x64.
const launcherTemplates = new Map([
  ['Lib/site-packages/pip/_vendor/distlib/t32.exe', 0x14c],
  ['Lib/site-packages/pip/_vendor/distlib/w32.exe', 0x14c],
  ['Lib/site-packages/pip/_vendor/distlib/t64-arm.exe', 0xaa64],
  ['Lib/site-packages/pip/_vendor/distlib/w64-arm.exe', 0xaa64],
  ['Lib/site-packages/setuptools/cli-32.exe', 0x14c],
  ['Lib/site-packages/setuptools/gui-32.exe', 0x14c],
  ['Lib/site-packages/setuptools/cli.exe', 0x14c],
  ['Lib/site-packages/setuptools/gui.exe', 0x14c],
  ['Lib/site-packages/setuptools/cli-arm64.exe', 0xaa64],
  ['Lib/site-packages/setuptools/gui-arm64.exe', 0xaa64]
])
function inventory(dir, prefix = '') {
  const names = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    assert(!entry.isSymbolicLink(), `No links: ${name}`)
    if (entry.isDirectory()) names.push(...inventory(join(dir, entry.name), name))
    else { assert(entry.isFile()); names.push(name) }
  }
  return names.sort()
}
function verify() {
  assert.deepEqual(inventory(payload), [...expected].sort())
  for (const entry of manifest.files) {
    assert(!entry.path.includes('..') && !entry.path.includes(':') && !entry.path.startsWith('/'))
    const file = join(payload, entry.path)
    assert(lstatSync(file).isFile())
    const bytes = readFileSync(file)
    assert.equal(bytes.length, entry.size, entry.path)
    assert.equal(sha(bytes), entry.sha256, entry.path)
    if (/\.(?:exe|dll|pyd)$/i.test(entry.path)) {
      assert.equal(bytes.toString('ascii', 0, 2), 'MZ', entry.path)
      const pe = bytes.readUInt32LE(0x3c)
      assert.equal(bytes.toString('ascii', pe, pe + 4), 'PE\0\0', entry.path)
      assert.equal(bytes.readUInt16LE(pe + 4), launcherTemplates.get(entry.path) ?? 0x8664, `Unexpected PE architecture: ${entry.path}`)
    }
  }
}
verify()
const scratch = join(repo, '.tmp-release-python')
mkdirSync(scratch, { recursive: true })
const home = mkdtempSync(join(scratch, 'smoke-'))
const env = { ...process.env, HERMES_HOME: home, PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1',
  HERMES_DISABLE_LAZY_INSTALLS: '1', HF_HUB_OFFLINE: '1' }
for (const key of Object.keys(env)) {
  if (/(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|SECRET|PASSWORD)$/i.test(key) ||
      ['PYTHONHOME', 'PYTHONPATH', 'HERMES_LAZY_INSTALL_TARGET'].includes(key)) delete env[key]
}
execFileSync(join(payload, 'python.exe'), ['-c',
  "import ssl, sqlite3, fastapi, uvicorn, openai, anthropic, numpy, faster_whisper, winpty, win32api; import tui_gateway.server; print('Relocated clean Python and gateway imports PASS')"],
{ cwd: repo, env, stdio: 'inherit', timeout: 120000, windowsHide: true })
verify()
console.log(`PASS: ${manifest.files.length} unchanged files; native Windows x64; no user Python/profile dependency`)
