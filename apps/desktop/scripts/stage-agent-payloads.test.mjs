import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'

import {
  assertBanner,
  bannerExpectations,
  buildManifest,
  bundlePthLines,
  parseSkips,
  PAYLOAD_ITEMS,
  parseVietnameseReleaseTag,
  payloadImportProbe,
  pipTargetArgs,
  pythonDirPattern,
  pythonRequest,
  repositoryGitQueries,
  resolveAgentBrowserPackageRoot,
  resolveTag,
  resolveTargets,
  stageAgentBrowserLaunchers
} from '../scripts/stage-agent-payloads.mjs'

test('repository tag peeling is passed to git as one argument on Windows too', () => {
  const queries = repositoryGitQueries('vi-v0.20.0-18')
  assert.deepEqual(queries.commit, ['rev-parse', 'vi-v0.20.0-18^{commit}'])
  assert.deepEqual(queries.commitDate, ['log', '-1', '--format=%ct', 'vi-v0.20.0-18'])
})

// ─── resolveTargets ────────────────────────────────────────────────

test('resolveTargets covers every shipping (platform, arch) pair', () => {
  for (const [platform, arch] of [
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'x64'],
    ['win32', 'arm64']
  ]) {
    const t = resolveTargets(platform, arch)
    // Invariant: every target specifies all three toolchain descriptors.
    assert.ok(t.uvTarget && t.pythonPlatform && t.nodeDist, `${platform}-${arch}`)
    assert.equal(t.platform, platform)
    assert.equal(t.arch, arch)
  }
})

test('resolveTargets rejects unknown pairs (no universal2, no ia32)', () => {
  assert.throws(() => resolveTargets('darwin', 'universal'), /unsupported/)
  assert.throws(() => resolveTargets('win32', 'ia32'), /unsupported/)
})

test('windows targets map to msvc toolchains, darwin to apple, linux to gnu', () => {
  assert.match(resolveTargets('win32', 'x64').pythonPlatform, /windows-msvc$/)
  assert.match(resolveTargets('darwin', 'arm64').pythonPlatform, /apple-darwin$/)
  assert.match(resolveTargets('linux', 'x64').pythonPlatform, /linux-gnu$/)
})

// ─── pipTargetArgs ─────────────────────────────────────────────────

test('site-packages install refuses sdists and targets the payload dir', () => {
  const args = pipTargetArgs({ sitePackagesDir: '/out/site-packages' })
  // Invariants: the requirements come from the frozen lockfile, and the
  // install is binary-only. An sdist would try to compile on the build
  // runner for packages we did not explicitly allow-list. The install is
  // native, so no --platform cross-tags belong here.
  assert.equal(args[0], 'install')
  assert.ok(args.includes('--require-hashes'))
  // uv export already emits the complete, hash-locked closure. Asking the
  // installer to resolve dependencies again makes uv reject transitive
  // metadata requirements such as bare `cryptography`, even though the
  // exported top-level entry is exactly pinned and hashed.
  assert.ok(args.includes('--no-deps'))
  // Installing an exported lock must not rediscover [tool.uv] project
  // overrides and replace a pinned, hashed artifact with a newer version.
  assert.ok(args.includes('--no-config'))
  assert.ok(args.includes('--only-binary'))
  assert.equal(args[args.indexOf('-r') + 1], 'requirements-payload.txt')
  assert.equal(args[args.indexOf('--target') + 1], '/out/site-packages')
  assert.ok(!args.includes('--platform'))
})

// ─── bundlePthLines ────────────────────────────────────────────────

test('bundle .pth entries are relative and name repo before site-packages', () => {
  // POSIX layout: purelib nests three levels under the payload root, so
  // the entries climb out with ../ segments — never absolute paths.
  const payload = '/build/agent-payload'
  const purelib = '/build/agent-payload/python/cpython-3.11.15-macos-aarch64-none/lib/python3.11/site-packages'
  const lines = bundlePthLines(purelib, payload, path.posix)
  assert.equal(lines.length, 2)
  assert.ok(lines.every((line) => !path.posix.isAbsolute(line)), lines.join(','))
  assert.match(lines[0], /repo$/)
  assert.match(lines[1], /site-packages$/)

  // Windows layout (Lib/site-packages) stays relative too.
  const winLines = bundlePthLines(
    'C:\\b\\agent-payload\\python\\cpython-3.11.15-windows-x86_64-none\\Lib\\site-packages',
    'C:\\b\\agent-payload',
    path.win32
  )
  assert.ok(winLines.every((line) => !path.win32.isAbsolute(line)), winLines.join(','))
  assert.match(winLines[0], /repo$/)
})

// ─── resolveTag ────────────────────────────────────────────────────

test('Vietnamese release tags map deterministically to Electron SemVer', () => {
  assert.deepEqual(parseVietnameseReleaseTag('vi-v0.20.0-15'), {
    tag: 'vi-v0.20.0-15',
    baseVersion: '0.20.0',
    iteration: 15,
    appVersion: '0.20.0-vi.15',
    calver: false,
    channel: 'legacy'
  })
  assert.throws(() => parseVietnameseReleaseTag('v0.20.0'), /vi-vX.Y.Z-N/)
  assert.throws(() => parseVietnameseReleaseTag('vi-v0.20.0-rc1'), /vi-vX.Y.Z-N/)
})

test('explicit --tag wins and must be a final Vietnamese release', () => {
  assert.equal(resolveTag(['--tag=vi-v0.20.0-15'], () => null), 'vi-v0.20.0-15')
  assert.throws(() => resolveTag(['--tag=v1.2.3'], () => null), /vi-vX.Y.Z-N/)
  assert.throws(() => resolveTag(['--tag=main'], () => null), /vi-vX.Y.Z-N/)
})

test('bundled wrapper environment resolves the tag and conflicts fail closed', () => {
  const env = { HERMES_PAYLOAD_TAG: 'vi-v0.32.0-1' }
  assert.equal(resolveTag([], () => null, env), 'vi-v0.32.0-1')
  assert.equal(resolveTag(['--tag=vi-v0.32.0-1'], () => null, env), 'vi-v0.32.0-1')
  assert.throws(
    () => resolveTag(['--tag=vi-v0.31.0-7'], () => null, env),
    /does not match HERMES_PAYLOAD_TAG/
  )
  assert.throws(() => resolveTag([], () => null, { HERMES_PAYLOAD_TAG: 'v0.32.0' }), /vi-vX.Y.Z-N/)
})

test('falls back to git describe only for exact release tags', () => {
  assert.equal(resolveTag([], () => 'vi-v0.20.0-15'), 'vi-v0.20.0-15')
  assert.throws(() => resolveTag([], () => 'vi-v0.20.0-15-14-gdeadbeef'), /no Vietnamese release tag/)
  assert.throws(() => resolveTag([], () => null), /no Vietnamese release tag/)
})

// ─── parseSkips ────────────────────────────────────────────────────

test('parseSkips accepts known items and rejects unknown ones', () => {
  assert.deepEqual([...parseSkips(['--skip=site-packages,node'])].sort(), ['node', 'site-packages'])
  assert.equal(parseSkips([]).size, 0)
  assert.throws(() => parseSkips(['--skip=venv']), /unknown --skip/)
  // Retired payload items must not silently no-op in CI caching configs.
  assert.throws(() => parseSkips(['--skip=wheels']), /unknown --skip/)
})

// ─── buildManifest ─────────────────────────────────────────────────

test('manifest records staged vs explicitly-skipped vs failed per item', () => {
  const target = resolveTargets('linux', 'x64')
  const manifest = buildManifest({
    tag: 'vi-v1.0.0-1',
    commit: 'a'.repeat(40),
    releaseClass: 'community-prerelease',
    target,
    staged: ['repo', 'uv', 'python'],
    skipped: new Set(['site-packages'])
  })
  assert.equal(manifest.tag, 'vi-v1.0.0-1')
  assert.equal(manifest.releaseClass, 'community-prerelease')
  assert.equal(manifest.updateChannel, 'community-prerelease')
  assert.equal(manifest.updateFeedEnabled, false)
  // Invariant: every payload item has an entry. The resident-runtime gate
  // reads presence. An absent entry is ambiguous.
  for (const item of PAYLOAD_ITEMS) {
    assert.ok(manifest.items[item], item)
  }
  assert.equal(manifest.items.repo.status, 'staged')
  assert.equal(manifest.items['site-packages'].status, 'skipped')
  assert.equal(manifest.items['site-packages'].reason, 'explicit-skip')
  // node was not staged and not explicitly skipped, so its status is failed.
  assert.equal(manifest.items.node.reason, 'failed')
})

// ─── agent-browser launchers ──────────────────────────────────────

test('resident agent-browser must come from the verified release-only package root', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-agent-browser-package-'))
  try {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'agent-browser', version: '0.26.0' }))
    assert.equal(resolveAgentBrowserPackageRoot({ HERMES_AGENT_BROWSER_PACKAGE_ROOT: tempDir }), path.resolve(tempDir))
    assert.throws(() => resolveAgentBrowserPackageRoot({}), /PACKAGE_ROOT is required/)

    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'agent-browser', version: '0.27.0' }))
    assert.throws(
      () => resolveAgentBrowserPackageRoot({ HERMES_AGENT_BROWSER_PACKAGE_ROOT: tempDir }),
      /expected agent-browser 0\.26\.0/
    )
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('agent-browser launchers ignore host-specific npm bin entries', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-agent-browser-shims-'))
  try {
    const packageDir = path.join(tempDir, 'node_modules', 'agent-browser')
    const sourceBinDir = path.join(tempDir, 'node_modules', '.bin')
    const stagedBinDir = path.join(tempDir, 'staged', 'node_modules', '.bin')
    fs.mkdirSync(path.join(packageDir, 'bin'), { recursive: true })
    fs.writeFileSync(path.join(packageDir, 'bin', 'agent-browser.js'), '#!/usr/bin/env node\nconsole.log("launcher-ok")\n')
    // Reproduce the directory-shaped Unix entry that broke the v16 matrix.
    fs.mkdirSync(path.join(sourceBinDir, 'agent-browser'), { recursive: true })

    fs.cpSync(packageDir, path.join(tempDir, 'staged', 'node_modules', 'agent-browser'), { recursive: true })
    stageAgentBrowserLaunchers(packageDir, stagedBinDir)

    const shellPath = path.join(stagedBinDir, 'agent-browser')
    assert.match(fs.readFileSync(shellPath, 'utf8'), /\.\.\/agent-browser\/bin\/agent-browser\.js/)
    if (process.platform !== 'win32') assert.notEqual(fs.statSync(shellPath).mode & 0o111, 0)
    assert.match(fs.readFileSync(path.join(stagedBinDir, 'agent-browser.cmd'), 'utf8'), /agent-browser\\bin/)
    assert.match(fs.readFileSync(path.join(stagedBinDir, 'agent-browser.ps1'), 'utf8'), /agent-browser\/bin/)

    const launcher = path.join(stagedBinDir, process.platform === 'win32' ? 'agent-browser.cmd' : 'agent-browser')
    const probe = spawnSync(launcher, [], { encoding: 'utf8', shell: process.platform === 'win32' })
    assert.equal(probe.status, 0, probe.stderr)
    assert.equal(probe.stdout.trim(), 'launcher-ok')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('agent-browser launcher staging rejects an incomplete npm package', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-agent-browser-missing-'))
  try {
    const packageDir = path.join(tempDir, 'agent-browser')
    fs.mkdirSync(packageDir, { recursive: true })
    assert.throws(
      () => stageAgentBrowserLaunchers(packageDir, path.join(tempDir, '.bin')),
      /missing bin\/agent-browser\.js/
    )
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

// ─── arch guards ────────────────────────────────────────────────────

test('assertBanner passes on a matching triple and throws on a foreign one', () => {
  const target = resolveTargets('win32', 'arm64')
  const expect = bannerExpectations(target)

  assert.doesNotThrow(() =>
    assertBanner('uv', 'uv 0.12.1 (329541a50 aarch64-pc-windows-msvc)', expect.uv)
  )
  // The exact failure from the first Windows test build: an x64 uv from
  // PATH staged into an arm64 artifact (it ran via emulation).
  assert.throws(
    () => assertBanner('uv', 'uv 0.12.1 (329541a50 x86_64-pc-windows-msvc)', expect.uv),
    /wrong-architecture/
  )
})

test('banner expectations name the target, not the build host', () => {
  const linuxArm = resolveTargets('linux', 'arm64')
  assert.equal(bannerExpectations(linuxArm).uv, 'aarch64-unknown-linux-gnu')
  assert.equal(bannerExpectations(linuxArm).node, 'arm64')
  assert.ok(bannerExpectations(linuxArm).pythonAny.includes('aarch64'))
})

test('python install requests name the full build, not just the version', () => {
  // A bare "3.11" lets uv substitute another architecture when the native
  // build is missing — the silent x86_64-on-arm64 failure. The request
  // must pin cpython-<ver>-<os>-<arch>-<libc>.
  assert.equal(pythonRequest(resolveTargets('win32', 'arm64'), '3.11'), 'cpython-3.11-windows-aarch64-none')
  assert.equal(pythonRequest(resolveTargets('linux', 'x64'), '3.11'), 'cpython-3.11-linux-x86_64-gnu')
  assert.equal(pythonRequest(resolveTargets('darwin', 'arm64'), '3.12'), 'cpython-3.12-macos-aarch64-none')
})

test('python dir matcher accepts patch-versioned installs and rejects foreign builds', () => {
  const winArm = resolveTargets('win32', 'arm64')
  const pattern = pythonDirPattern(winArm, '3.11')

  // uv creates the patch-versioned directory plus a minor-version alias.
  assert.ok(pattern.test('cpython-3.11.15-windows-aarch64-none'))
  assert.ok(pattern.test('cpython-3.11-windows-aarch64-none'))
  // Another arch, another version, or a partial name must not match.
  assert.ok(!pattern.test('cpython-3.11.15-windows-x86_64-none'))
  assert.ok(!pattern.test('cpython-3.12.1-windows-aarch64-none'))
  assert.ok(!pattern.test('cpython-3.115-windows-aarch64-none'))
})

test('source-build exceptions stay target-specific and exclude covered native wheels', () => {
  // Fully wheel-covered targets keep the pure only-binary shape.
  const linux = resolveTargets('linux', 'x64')
  assert.deepEqual(pipTargetArgs({ sitePackagesDir: '/sp', sourceBuild: linux.sourceBuild ?? [] }), [
    'install', '--require-hashes', '--no-deps', '--no-config', '--only-binary', ':all:', '-r', 'requirements-payload.txt',
    '--target', '/sp', '--upgrade', '--no-compile'
  ])

  // cryptography 50.0.0 publishes macOS ARM64 wheels but no Intel wheel.
  // Only the Intel target may build its exact hash-locked sdist.
  const macIntel = resolveTargets('darwin', 'x64')
  const macIntelArgs = pipTargetArgs({ sitePackagesDir: '/sp', sourceBuild: macIntel.sourceBuild })
  assert.equal(macIntelArgs[macIntelArgs.indexOf('--no-binary') + 1], 'cryptography')
  const macArm = resolveTargets('darwin', 'arm64')
  const macArmArgs = pipTargetArgs({ sitePackagesDir: '/sp', sourceBuild: macArm.sourceBuild ?? [] })
  assert.ok(!macArmArgs.includes('--no-binary'))

  // win32-arm64 names the packages with no published win_arm64 wheel;
  // pip's later --no-binary overrides --only-binary per package, so
  // exactly these build from sdist and everything else stays wheels-only.
  // pywinpty 3.0.5 has a complete native wheel and must never fall back to
  // the broken source-build path that linked an x64 winpty.lib on ARM64.
  const winArm = resolveTargets('win32', 'arm64')
  const args = pipTargetArgs({ sitePackagesDir: '/sp', sourceBuild: winArm.sourceBuild })
  const noBinary = args[args.indexOf('--no-binary') + 1]
  assert.ok(args.indexOf('--no-binary') > args.indexOf('--only-binary'))
  assert.equal(noBinary, 'cryptography,httptools,ruamel-yaml-clib,pyyaml')
  assert.ok(!noBinary.split(',').includes('pywinpty'))
})

test('packaged runtime import probe loads pywinpty on both Windows architectures', () => {
  for (const arch of ['x64', 'arm64']) {
    const probe = payloadImportProbe(resolveTargets('win32', arch))
    assert.match(probe, /\bwinpty\b/)
  }
  assert.doesNotMatch(payloadImportProbe(resolveTargets('linux', 'x64')), /\bwinpty\b/)
})
