/**
 * Tests for electron/desktop-uninstall.ts.
 *
 * Run with: node --test electron/desktop-uninstall.test.ts
 * (Wired into npm test:desktop:platforms in package.json.)
 *
 * These are the pure helpers behind the desktop Chat GUI uninstaller: the
 * mode → CLI-flag mapping, the running-app-bundle resolution per OS, and the
 * cleanup-script builders (POSIX + Windows).
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { UUID } from 'builder-util-runtime'
import { test } from 'vitest'

import {
  buildPosixCleanupScript,
  buildWindowsCleanupScript,
  modeRemovesAgent,
  modeRemovesUserData,
  resolveRemovableAppPath,
  selectUninstallPython,
  shouldRemoveAppBundle,
  UNINSTALL_MODES,
  uninstallArgsForMode,
  userDataPathForUninstallMode,
  WINDOWS_NSIS_APP_KEY
} from './desktop-uninstall'

test('Windows NSIS app key matches electron-builder derivation from build.appId', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const electronBuilderNamespace = UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3')

  assert.equal(WINDOWS_NSIS_APP_KEY, UUID.v5(packageJson.build.appId, electronBuilderNamespace))
})

// --- uninstallArgsForMode ---

test('uninstallArgsForMode maps each mode to the module-runner argv', () => {
  assert.deepEqual(uninstallArgsForMode('gui'), ['-m', 'hermes_cli.uninstall', '--mode', 'gui'])
  assert.deepEqual(uninstallArgsForMode('lite'), ['-m', 'hermes_cli.uninstall', '--mode', 'lite'])
  assert.deepEqual(uninstallArgsForMode('full'), ['-m', 'hermes_cli.uninstall', '--mode', 'full'])
})

test('uninstallArgsForMode throws on an unknown mode (no silent full wipe)', () => {
  assert.throws(() => uninstallArgsForMode('nuke'), /Unknown uninstall mode/)
  assert.throws(() => uninstallArgsForMode(''), /Unknown uninstall mode/)
})

test('every desktop handoff tells Python not to scan packaged app locations', () => {
  for (const mode of UNINSTALL_MODES) {
    assert.deepEqual(uninstallArgsForMode(mode, { skipPackagedApps: true }), [
      '-m',
      'hermes_cli.uninstall',
      '--mode',
      mode,
      '--skip-packaged-apps'
    ])
  }
})

test('UNINSTALL_MODES lists exactly the three supported modes', () => {
  assert.deepEqual([...UNINSTALL_MODES].sort(), ['full', 'gui', 'lite'])
})

// --- modeRemovesAgent / modeRemovesUserData ---

test('mode predicates classify what each mode removes', () => {
  assert.equal(modeRemovesAgent('gui'), false)
  assert.equal(modeRemovesAgent('lite'), true)
  assert.equal(modeRemovesAgent('full'), true)

  assert.equal(modeRemovesUserData('gui'), false)
  assert.equal(modeRemovesUserData('lite'), false)
  assert.equal(modeRemovesUserData('full'), true)
})

test('detached cleanup receives user data only for a full wipe', () => {
  const userDataPath = 'C:\\Users\\x\\AppData\\Roaming\\Hermes'

  assert.equal(userDataPathForUninstallMode('gui', userDataPath), null)
  assert.equal(userDataPathForUninstallMode('lite', userDataPath), null)
  assert.equal(userDataPathForUninstallMode('full', userDataPath), userDataPath)
})

// --- selectUninstallPython ---

test('selectUninstallPython prefers the bundled resident runtime for lite/full', () => {
  const selection = selectUninstallPython('full', {
    venvPython: 'C:\\home\\venv\\Scripts\\python.exe',
    residentPython: 'C:\\app\\resources\\agent-payload\\python\\python.exe',
    systemPython: 'C:\\Python313\\python.exe',
    isWindows: true
  })

  assert.deepEqual(selection, {
    degraded: false,
    external: true,
    pythonExe: 'C:\\app\\resources\\agent-payload\\python\\python.exe',
    source: 'resident'
  })
})

test('selectUninstallPython falls back to system Python for thin/source installs', () => {
  const selection = selectUninstallPython('lite', {
    venvPython: '/home/x/.hermes/venv/bin/python',
    residentPython: null,
    systemPython: '/usr/bin/python3'
  })

  assert.equal(selection.pythonExe, '/usr/bin/python3')
  assert.equal(selection.external, true)
  assert.equal(selection.degraded, false)
  assert.equal(selection.source, 'system')
})

test('selectUninstallPython keeps gui mode on its venv and marks a Windows full fallback degraded', () => {
  assert.deepEqual(
    selectUninstallPython('gui', {
      venvPython: 'C:\\home\\venv\\Scripts\\python.exe',
      residentPython: 'C:\\app\\python.exe',
      isWindows: true
    }),
    {
      degraded: false,
      external: false,
      pythonExe: 'C:\\home\\venv\\Scripts\\python.exe',
      source: 'venv'
    }
  )

  const degraded = selectUninstallPython('full', {
    venvPython: 'C:\\home\\venv\\Scripts\\python.exe',
    isWindows: true
  })

  assert.equal(degraded.pythonExe, 'C:\\home\\venv\\Scripts\\python.exe')
  assert.equal(degraded.external, false)
  assert.equal(degraded.degraded, true)
  assert.equal(degraded.source, 'venv-fallback')
})

test('selectUninstallPython lets a resident-only packaged app uninstall its GUI', () => {
  const selection = selectUninstallPython('gui', {
    venvPython: null,
    residentPython: 'C:\\app\\resources\\agent-payload\\python\\python.exe',
    isWindows: true
  })

  assert.deepEqual(selection, {
    degraded: false,
    external: true,
    pythonExe: 'C:\\app\\resources\\agent-payload\\python\\python.exe',
    source: 'resident'
  })
})

// --- resolveRemovableAppPath ---

test('resolveRemovableAppPath finds the .app bundle on macOS', () => {
  assert.equal(
    resolveRemovableAppPath('/Applications/Hermes.app/Contents/MacOS/Hermes', 'darwin'),
    '/Applications/Hermes.app'
  )
  assert.equal(
    resolveRemovableAppPath('/Users/x/Applications/Hermes.app/Contents/MacOS/Hermes', 'darwin'),
    '/Users/x/Applications/Hermes.app'
  )
})

test('resolveRemovableAppPath: dev-run .app resolves (safety is shouldRemoveAppBundle, not null)', () => {
  // A dev run from node_modules' Electron DOES resolve to a .app — the real
  // dev-run safety gate is shouldRemoveAppBundle(isPackaged=false,...), not a
  // null return here. This test documents that contract.
  assert.equal(
    resolveRemovableAppPath('/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron', 'darwin'),
    '/repo/node_modules/electron/dist/Electron.app'
  )
  assert.equal(shouldRemoveAppBundle(false, '/repo/node_modules/electron/dist/Electron.app'), false)
  // A bare path with no .app ancestor → null.
  assert.equal(resolveRemovableAppPath('/usr/bin/electron', 'darwin'), null)
})

test('resolveRemovableAppPath finds the install dir on Windows', () => {
  assert.equal(
    resolveRemovableAppPath('C:\\Users\\x\\AppData\\Local\\Programs\\Hermes\\Hermes.exe', 'win32'),
    'C:\\Users\\x\\AppData\\Local\\Programs\\Hermes'
  )
  assert.equal(
    resolveRemovableAppPath('C:\\Users\\x\\AppData\\Local\\hermes-desktop\\Hermes.exe', 'win32'),
    'C:\\Users\\x\\AppData\\Local\\hermes-desktop'
  )
})

test('resolveRemovableAppPath returns null for an unrecognized Windows dir', () => {
  assert.equal(resolveRemovableAppPath('C:\\Temp\\foo\\Hermes.exe', 'win32'), null)
})

test('resolveRemovableAppPath uses APPIMAGE on Linux when set', () => {
  assert.equal(
    resolveRemovableAppPath('/tmp/.mount_HermesXXXX/hermes', 'linux', { APPIMAGE: '/home/x/Apps/Hermes.AppImage' }),
    '/home/x/Apps/Hermes.AppImage'
  )
})

test('resolveRemovableAppPath finds the unpacked dir on Linux', () => {
  assert.equal(resolveRemovableAppPath('/opt/hermes/linux-unpacked/hermes', 'linux', {}), '/opt/hermes/linux-unpacked')
  // A system-package install (/usr/bin) → null, left to apt/dnf.
  assert.equal(resolveRemovableAppPath('/usr/bin/hermes', 'linux', {}), null)
})

test('resolveRemovableAppPath returns null for an empty exe path', () => {
  assert.equal(resolveRemovableAppPath('', 'darwin'), null)
  assert.equal(resolveRemovableAppPath(null, 'win32'), null)
})

// --- shouldRemoveAppBundle ---

test('shouldRemoveAppBundle requires packaged AND a resolved path', () => {
  assert.equal(shouldRemoveAppBundle(true, '/Applications/Hermes.app'), true)
  assert.equal(shouldRemoveAppBundle(false, '/Applications/Hermes.app'), false)
  assert.equal(shouldRemoveAppBundle(true, null), false)
  assert.equal(shouldRemoveAppBundle(false, null), false)
})

// --- buildPosixCleanupScript ---

test('buildPosixCleanupScript waits for the PID, runs the uninstall module, removes bundle', () => {
  const script = buildPosixCleanupScript({
    desktopPid: 4321,
    pythonExe: '/home/x/.hermes/hermes-agent/venv/bin/python',
    pythonPath: null,
    agentRoot: '/home/x/.hermes/hermes-agent',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'gui'],
    appPath: '/opt/hermes/linux-unpacked',
    userDataPath: '/home/x/.config/Hermes',
    hermesHome: '/home/x/.hermes'
  })

  assert.match(script, /^#!\/bin\/bash/)
  assert.match(script, /pid=4321/)
  assert.match(script, /kill -0 "\$pid"/)
  // bounded wait (~30s), not unbounded
  assert.match(script, /seq 1 60/)
  assert.match(script, /'-m' 'hermes_cli\.uninstall' '--mode' 'gui'/)
  assert.match(script, /rm -rf '\/opt\/hermes\/linux-unpacked'/)
  assert.match(script, /rm -rf '\/home\/x\/\.config\/Hermes'/)
  assert.match(script, /export HERMES_HOME='\/home\/x\/\.hermes'/)
})

test('buildPosixCleanupScript exports PYTHONPATH when pythonPath is set (lite/full)', () => {
  const script = buildPosixCleanupScript({
    desktopPid: 1,
    pythonExe: '/usr/bin/python3',
    pythonPath: '/home/x/.hermes/hermes-agent',
    agentRoot: '/home/x/.hermes/hermes-agent',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'full'],
    appPath: null,
    hermesHome: '/home/x/.hermes'
  })

  // System python + source on PYTHONPATH so import hermes_cli works while the
  // venv is torn down.
  assert.match(script, /export PYTHONPATH='\/home\/x\/\.hermes\/hermes-agent'/)
  assert.match(script, /'\/usr\/bin\/python3' '-m' 'hermes_cli\.uninstall' '--mode' 'full'/)
})

test('buildPosixCleanupScript omits PYTHONPATH when pythonPath is null (gui)', () => {
  const script = buildPosixCleanupScript({
    desktopPid: 1,
    pythonExe: '/p/python',
    pythonPath: null,
    agentRoot: '/a',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'gui'],
    appPath: null,
    hermesHome: '/h'
  })

  assert.doesNotMatch(script, /export PYTHONPATH/)
})

test('buildPosixCleanupScript omits the bundle rm when appPath is null', () => {
  const script = buildPosixCleanupScript({
    desktopPid: 1,
    pythonExe: '/p/python',
    pythonPath: null,
    agentRoot: '/a',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'lite'],
    appPath: null,
    hermesHome: '/h'
  })

  assert.doesNotMatch(script, /rm -rf '\//)
  // Still runs the uninstall.
  assert.match(script, /'-m' 'hermes_cli\.uninstall' '--mode' 'lite'/)
})

test('buildPosixCleanupScript single-quote-escapes paths with apostrophes', () => {
  const script = buildPosixCleanupScript({
    desktopPid: 1,
    pythonExe: "/home/o'brien/python",
    pythonPath: null,
    agentRoot: '/a',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'gui'],
    appPath: null,
    hermesHome: '/h'
  })

  // The apostrophe is closed-escaped-reopened so the shell sees the literal.
  assert.match(script, /'\/home\/o'\\''brien\/python'/)
})

// --- buildWindowsCleanupScript ---

test('buildWindowsCleanupScript waits (bounded) for PID, runs uninstall, rmdir bundle', () => {
  const script = buildWindowsCleanupScript({
    desktopPid: 9988,
    pythonExe: 'C:\\Python313\\python.exe',
    pythonPath: 'C:\\hermes',
    agentRoot: 'C:\\hermes',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'full'],
    appPath: 'C:\\Users\\x\\AppData\\Local\\Programs\\Hermes',
    userDataPath: 'C:\\Users\\x\\AppData\\Roaming\\Hermes',
    hermesHome: 'C:\\Users\\x\\AppData\\Local\\hermes',
    windowsNsisAppKey: WINDOWS_NSIS_APP_KEY
  })

  assert.match(script, /@echo off/)
  assert.match(script, /set "PID=9988"/)
  // PYTHONPATH set so a system python can import hermes_cli from source.
  assert.match(script, /set "PYTHONPATH=C:\\hermes;%PYTHONPATH%"/)
  assert.match(script, /"C:\\Python313\\python.exe" "-m" "hermes_cli\.uninstall" "--mode" "full"/)
  // Bounded wait-loop (no infinite loop), whole-token PID match (no substring).
  assert.match(script, /if %waited% geq 60 goto waited_done/)
  assert.match(script, /set "TASKLIST_TMP=%~dpn0-tasklist\.tmp"/)
  assert.match(script, /tasklist \/NH \/FI "PID eq %PID%" >"%TASKLIST_TMP%" 2>nul/)
  assert.match(script, /findstr \/r \/c:" %PID% " "%TASKLIST_TMP%" >nul 2>&1/)
  assert.doesNotMatch(script, /^tasklist[^\r\n]*\|[^\r\n]*findstr/m)
  assert.match(script, /del "%TASKLIST_TMP%" >nul 2>&1/)
  assert.doesNotMatch(script, /find "%PID%"/) // the old substring-prone form is gone
  // Removal is a retry loop (Windows releases dir handles lazily).
  assert.match(script, /cd \/d "%~dp0"/)
  assert.match(script, /:rmuserdataloop/)
  assert.match(script, /rmdir \/s \/q "C:\\Users\\x\\AppData\\Roaming\\Hermes" >nul 2>&1/)
  assert.match(script, /if %userdata_tries% geq 10 goto rmuserdatadone/)
  // Remove only this per-user NSIS registration. A sibling HKLM install or a
  // differently located HKCU install must not match the exact InstallLocation.
  assert.match(script, /HKCU\\Software\\f55add5f-6655-5c1d-b8e3-d7252a8a4152/)
  assert.match(
    script,
    /HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\f55add5f-6655-5c1d-b8e3-d7252a8a4152/
  )
  assert.match(script, /reg query "%HERMES_INSTALL_KEY%" \/v InstallLocation/)
  assert.match(
    script,
    /if \/i not "%REGISTERED_INSTALL%"=="C:\\Users\\x\\AppData\\Local\\Programs\\Hermes" goto registry_cleanup_done/
  )
  assert.match(script, /reg delete "%HERMES_UNINSTALL_KEY%" \/f >nul 2>&1/)
  assert.match(script, /reg delete "%HERMES_INSTALL_KEY%" \/f >nul 2>&1/)
  assert.match(script, /:rmapploop/)
  assert.match(script, /rmdir \/s \/q "C:\\Users\\x\\AppData\\Local\\Programs\\Hermes" >nul 2>&1/)
  assert.match(script, /if %app_tries% geq 10 goto rmapdone/)
  assert.match(script, /del "%~f0"/)
})

test.skipIf(process.platform !== 'win32')(
  'buildWindowsCleanupScript executes to completion and removes its app tree',
  () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-uninstall-wait-'))
    const scriptPath = path.join(directory, 'cleanup.cmd')
    const appPath = path.join(directory, 'app')
    const userDataPath = path.join(directory, 'user-data')
    const agentRoot = path.join(appPath, 'resources', 'agent-payload', 'repo')

    try {
      fs.mkdirSync(agentRoot, { recursive: true })
      fs.mkdirSync(userDataPath, { recursive: true })
      fs.writeFileSync(path.join(agentRoot, 'payload.txt'), 'runtime payload')
      fs.writeFileSync(path.join(userDataPath, 'state.json'), 'desktop state')
      fs.writeFileSync(
        scriptPath,
        buildWindowsCleanupScript({
          desktopPid: 2147483647,
          pythonExe: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe'),
          pythonPath: null,
          agentRoot,
          uninstallArgs: ['cmd.exe'],
          appPath,
          userDataPath,
          hermesHome: path.join(directory, 'home')
        })
      )

      const completed = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', scriptPath], {
        encoding: 'utf8',
        timeout: 15_000,
        windowsHide: true
      })

      assert.equal(completed.error, undefined)
      assert.notEqual(completed.status, null, completed.stderr || completed.stdout)
      assert.match(completed.stdout, /cmd\.exe/i)
      assert.equal(fs.existsSync(scriptPath), false)
      assert.equal(fs.existsSync(path.join(directory, 'cleanup-tasklist.tmp')), false)
      assert.equal(fs.existsSync(userDataPath), false)
      assert.equal(fs.existsSync(appPath), false)
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
)

test('buildWindowsCleanupScript omits PYTHONPATH + rmdir when neither bundle nor userData is removable', () => {
  const script = buildWindowsCleanupScript({
    desktopPid: 2,
    pythonExe: 'C:\\h\\venv\\Scripts\\python.exe',
    pythonPath: null,
    agentRoot: 'C:\\h',
    uninstallArgs: ['-m', 'hermes_cli.uninstall', '--mode', 'gui'],
    appPath: null,
    hermesHome: 'C:\\h'
  })

  assert.doesNotMatch(script, /rmdir/)
  assert.doesNotMatch(script, /set "PYTHONPATH=/)
})
