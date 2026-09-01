import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

const syncScript = join(import.meta.dirname, 'Sync-Hermes-Advisor-Runtime.ps1')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hermes-advisor-runtime-'))
  const experiment = join(root, 'experiment')
  const profile = join(experiment, 'profile')
  const legacy = join(profile, 'hermes-agent')
  const bundle = join(root, 'bundle')
  const payload = join(bundle, 'payload')
  const deepPayloadPath = join(
    'optional-skills', 'software-development', 'subagent-driven-development', 'references',
    'path-budget', 'path-budget', 'path-budget', 'path-budget', 'context-budget-discipline.md',
  )
  mkdirSync(join(legacy, '.venv', 'Scripts'), { recursive: true })
  mkdirSync(join(legacy, '.venv', 'Lib', 'site-packages'), { recursive: true })
  mkdirSync(join(payload, 'agent'), { recursive: true })
  writeFileSync(join(legacy, '.venv', 'pyvenv.cfg'), 'home = fixture')
  writeFileSync(join(legacy, '.venv', 'Scripts', 'python.exe'), 'fixture-python')
  writeFileSync(join(legacy, '.venv', 'Scripts', 'python.marker'), 'legacy-scripts')
  writeFileSync(join(legacy, '.venv', 'Lib', 'site-packages', 'site-packages.marker'), 'legacy-lib')
  writeFileSync(join(legacy, 'old-backend.py'), 'exp1')
  const body = Buffer.from('exp4-runtime')
  writeFileSync(join(payload, 'agent', 'review_runner.py'), body)
  mkdirSync(join(payload, deepPayloadPath, '..'), { recursive: true })
  const deepBody = Buffer.from('windows-path-budget')
  writeFileSync(join(payload, deepPayloadPath), deepBody)
  writeFileSync(join(bundle, 'runtime-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    candidateId: 'exp4-test',
    productVersion: '0.33.0-dev.11-advisor-exp.9',
    sourceCommit: 'abc123',
    files: [
      { path: 'agent/review_runner.py', sha256: sha(body), size: body.length },
      { path: deepPayloadPath.replaceAll('\\', '/'), sha256: sha(deepBody), size: deepBody.length },
    ]
  }))
  return { root, experiment, profile, legacy, bundle }
}

function sync(f) {
  return execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', syncScript,
    '-ExperimentRoot', f.experiment, '-ProfileRoot', f.profile, '-BundleRoot', f.bundle
  ], { encoding: 'utf8' }).trim()
}

function syncLikePackagedLauncher(f) {
  const packagedScript = join(f.bundle, 'Sync-Hermes-Advisor-Runtime.ps1')
  copyFileSync(syncScript, packagedScript)
  return execFileSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', packagedScript,
    '-ExperimentRoot', f.experiment, '-ProfileRoot', f.profile
  ], { encoding: 'utf8' }).trim()
}

test('resolves the packaged bundle from the script directory when the launcher omits BundleRoot', () => {
  const f = fixture()
  try {
    const current = syncLikePackagedLauncher(f)
    assert.equal(readFileSync(join(current, 'agent', 'review_runner.py'), 'utf8'), 'exp4-runtime')
    assert.equal(readFileSync(join(f.experiment, 'runtime-current.txt'), 'utf8').trim(), current)
  } finally {
    rmSync(f.root, { force: true, recursive: true })
  }
})

test('upgrades exp1 to a verified versioned runtime while preserving its venv and data root', () => {
  const f = fixture()
  try {
    const current = sync(f)
    assert.equal(readFileSync(join(current, 'agent', 'review_runner.py'), 'utf8'), 'exp4-runtime')
    assert.equal(readFileSync(join(current, '.venv', 'Scripts', 'python.marker'), 'utf8'), 'legacy-scripts')
    const bridge = readFileSync(
      join(current, '.venv', 'Lib', 'site-packages', '_hermes_legacy_site_packages.pth'),
      'utf8',
    )
    assert.match(bridge, /import site; site\.addsitedir\(/)
    assert.match(bridge, /hermes-agent.*\.venv.*Lib.*site-packages/i)
    const receipt = JSON.parse(readFileSync(join(current, 'advisor-runtime-receipt.json'), 'utf8'))
    assert.equal(receipt.schemaVersion, 2)
    assert.equal(receipt.venvLayout, 'copied-scripts-pth-lib-v2')
    assert.equal(readFileSync(join(f.legacy, 'old-backend.py'), 'utf8'), 'exp1')
    assert.equal(readFileSync(join(f.experiment, 'runtime-current.txt'), 'utf8').trim(), current)
  } finally {
    rmSync(f.root, { force: true, recursive: true })
  }
})

test('the copied Python launcher imports packages through the real-directory bridge', t => {
  if (process.platform !== 'win32') {
    t.skip('Windows venv layout contract')

    return
  }

  const python = spawnSync('python.exe', ['--version'], { encoding: 'utf8' })
  if (python.status !== 0) {
    t.skip('python.exe is unavailable')

    return
  }

  const f = fixture()
  try {
    const legacyVenv = join(f.legacy, '.venv')
    rmSync(legacyVenv, { force: true, recursive: true })
    execFileSync('python.exe', ['-m', 'venv', legacyVenv])
    const legacyPython = join(legacyVenv, 'Scripts', 'python.exe')
    const sitePackages = execFileSync(
      legacyPython,
      ['-c', "import site; print(next(p for p in site.getsitepackages() if p.endswith('site-packages')))"],
      { encoding: 'utf8' },
    ).trim()
    writeFileSync(join(sitePackages, 'hermes_runtime_bridge_probe.py'), 'VALUE = "bridge-ok"\n')

    const current = sync(f)
    const copiedPython = join(current, '.venv', 'Scripts', 'python.exe')
    const imported = execFileSync(
      copiedPython,
      ['-c', 'import hermes_runtime_bridge_probe as probe; print(probe.VALUE)'],
      { encoding: 'utf8' },
    ).trim()
    assert.equal(imported, 'bridge-ok')
  } finally {
    rmSync(f.root, { force: true, recursive: true })
  }
})

test('corrupt payload fails closed and does not switch away from the prior runtime', () => {
  const f = fixture()
  try {
    const current = sync(f)
    writeFileSync(join(f.bundle, 'payload', 'agent', 'review_runner.py'), 'tampered')
    const manifest = JSON.parse(readFileSync(join(f.bundle, 'runtime-manifest.json'), 'utf8'))
    manifest.candidateId = 'exp4-corrupt'
    writeFileSync(join(f.bundle, 'runtime-manifest.json'), JSON.stringify(manifest))
    assert.throws(() => sync(f))
    assert.equal(readFileSync(join(f.experiment, 'runtime-current.txt'), 'utf8').trim(), current)
  } finally {
    rmSync(f.root, { force: true, recursive: true })
  }
})
