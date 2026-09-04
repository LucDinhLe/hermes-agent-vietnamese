/**
 * desktop-uninstall.ts
 *
 * Pure, electron-free helpers for the desktop Chat GUI uninstaller. These map
 * the three user-facing uninstall modes to the `hermes uninstall` CLI flags,
 * resolve the running app bundle/exe so a detached cleanup script can remove
 * it after the app quits, and build that cleanup script for each OS.
 *
 * Kept standalone (no ` import 'electron'`) so it can be unit-tested with
 * `node --test` — same pattern as connection-config.ts / backend-probes.ts.
 * main.ts requires these and wires them into the electron-coupled IPC layer.
 *
 * The three modes mirror the CLI's options exactly:
 *   - 'gui'  → remove ONLY the Chat GUI, keep the agent + all user data.
 *              `hermes uninstall --gui --yes`
 *   - 'lite' → remove the GUI + agent code, KEEP user data (config / sessions
 *              / .env) for a future reinstall. `hermes uninstall --yes`
 *   - 'full' → remove everything: GUI + agent + all user data.
 *              `hermes uninstall --full --yes`
 *
 * Why a detached cleanup script: 'lite'/'full' delete the very venv the
 * `hermes` command runs from, and every mode may need to delete the running
 * app bundle (locked on macOS/Windows while the process is alive). So we hand
 * the work to a detached child that waits for this app's PID to exit, runs the
 * Python uninstall, then removes the app bundle — then the app quits. Same
 * shape as the self-update swap-and-relaunch flow already in main.ts.
 */

import path from 'node:path'

const UNINSTALL_MODES = ['gui', 'lite', 'full']
// electron-builder derives this stable NSIS key from
// build.appId=vn.lucledinh.hermes-vietnamese (uuid v5, khớp nsis.guid trong
// package.json). It is the per-user install identity,
// not a release-version key, and must remain stable across upgrades.
const WINDOWS_NSIS_APP_KEY = 'f55add5f-6655-5c1d-b8e3-d7252a8a4152'

/**
 * Map an uninstall mode to the `python -m hermes_cli.uninstall` argv (after the
 * python executable). Uses the dedicated lightweight module entrypoint (not
 * `hermes_cli.main`) so it can run under a system Python OUTSIDE the venv that
 * lite/full delete — see the Finding-3 note in buildWindowsCleanupScript.
 * Throws on an unknown mode so a typo can't silently become a full wipe.
 */
function uninstallArgsForMode(mode, { skipPackagedApps = false } = {}) {
  if (!UNINSTALL_MODES.includes(mode)) {
    throw new Error(`Unknown uninstall mode: ${mode}`)
  }

  const args = ['-m', 'hermes_cli.uninstall', '--mode', mode]

  if (skipPackagedApps) {
    args.push('--skip-packaged-apps')
  }

  return args
}

/** True when `mode` removes the agent (lite/full), false for gui-only. */
function modeRemovesAgent(mode) {
  return mode === 'lite' || mode === 'full'
}

/** True when `mode` removes user data (full only). */
function modeRemovesUserData(mode) {
  return mode === 'full'
}

/** Pass Chromium user data to detached cleanup only for a full wipe. */
function userDataPathForUninstallMode(mode, userDataPath) {
  return modeRemovesUserData(mode) ? userDataPath : null
}

/**
 * Pick the interpreter that drives the detached uninstall process.
 *
 * lite/full delete the managed venv. On Windows a running python.exe is
 * mandatory-locked, so the interpreter must live outside that venv. Packaged
 * resident builds already ship exactly such an interpreter under
 * resources/agent-payload; prefer it so an ordinary user never needs a
 * separately installed Python. Thin/source builds may fall back to a system
 * Python. The final venv fallback is retained only as an explicitly degraded
 * last resort for legacy/thin installations.
 */
function selectUninstallPython(mode, { venvPython, residentPython = null, systemPython = null, isWindows = false }) {
  if (!modeRemovesAgent(mode)) {
    if (venvPython) {
      return { degraded: false, external: false, pythonExe: venvPython, source: 'venv' }
    }

    if (residentPython) {
      return { degraded: false, external: true, pythonExe: residentPython, source: 'resident' }
    }

    return { degraded: false, external: true, pythonExe: systemPython, source: 'system' }
  }

  if (residentPython) {
    return { degraded: false, external: true, pythonExe: residentPython, source: 'resident' }
  }

  if (systemPython) {
    return { degraded: false, external: true, pythonExe: systemPython, source: 'system' }
  }

  return {
    degraded: Boolean(isWindows),
    external: false,
    pythonExe: venvPython,
    source: 'venv-fallback'
  }
}

/**
 * Resolve the on-disk app bundle/dir to remove for the running desktop app,
 * given the path to the running executable (`process.execPath`) and platform.
 *
 *   macOS:   …/Hermes.app/Contents/MacOS/Hermes  → …/Hermes.app
 *   Windows: …\Hermes\Hermes.exe                 → …\Hermes  (install dir)
 *   Linux:   AppImage → the APPIMAGE env path; unpacked → the *-unpacked dir
 *
 * Returns null when we can't confidently identify a removable bundle (e.g.
 * running from a dev checkout, or a system-package install we must not rmtree).
 */
function resolveRemovableAppPath(execPath, platform, env: any = {}) {
  const exe = String(execPath || '')

  if (!exe) {
    return null
  }

  // Use the path flavor that matches the TARGET platform, not the host running
  // this code — so the Windows branch parses backslash paths correctly even
  // when these pure helpers are unit-tested on Linux/macOS CI.
  const p = platform === 'win32' ? path.win32 : path.posix

  if (platform === 'darwin') {
    // …/Hermes.app/Contents/MacOS/Hermes → strip 3 segments to the .app
    const macOsDir = p.dirname(exe) // …/Contents/MacOS
    const contents = p.dirname(macOsDir) // …/Contents
    const appBundle = p.dirname(contents) // …/Hermes.app

    if (appBundle.endsWith('.app')) {
      return appBundle
    }

    return null
  }

  if (platform === 'win32') {
    // NSIS per-user installs Hermes.exe directly in the install dir.
    const dir = p.dirname(exe)

    if (/[\\/]Hermes$/i.test(dir) || /[\\/]hermes-desktop$/i.test(dir)) {
      return dir
    }

    return null
  }

  // Linux: an AppImage exposes its own path via the APPIMAGE env var.
  if (env.APPIMAGE) {
    return env.APPIMAGE
  }

  // Unpacked electron-builder tree: …/linux-unpacked/hermes
  const dir = p.dirname(exe)

  if (/-unpacked$/.test(dir)) {
    return dir
  }

  return null
}

/**
 * Should we even try to remove the running app bundle from a cleanup script?
 * Only when packaged AND we resolved a concrete removable path. Dev runs
 * (electron from node_modules) and system-package installs return null above
 * and are left to the OS package manager.
 */
function shouldRemoveAppBundle(isPackaged, appPath) {
  return Boolean(isPackaged) && Boolean(appPath)
}

/**
 * Build a POSIX cleanup shell script (macOS / Linux). It:
 *   1. waits (bounded ~30s) for the desktop PID to exit (venv/bundle unlock),
 *   2. runs the Python uninstall module with the mode,
 *   3. removes the app bundle if one was resolved.
 *
 * `pythonExe` should be a Python OUTSIDE the venv for lite/full (the venv is
 * being deleted); `pythonPath` is prepended to PYTHONPATH so `import hermes_cli`
 * resolves from the agent source. `q()` single-quote-escapes for the shell
 * (closes-escapes-reopens any embedded apostrophe), defending against spaces.
 */
function buildPosixCleanupScript({
  desktopPid,
  pythonExe,
  pythonPath,
  agentRoot,
  uninstallArgs,
  appPath,
  userDataPath = null,
  hermesHome
}) {
  const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`

  const lines = [
    '#!/bin/bash',
    'set -u',
    '# Wait (up to ~30s) for the desktop process to exit so the venv python',
    '# and the app bundle are no longer in use.',
    `pid=${Number(desktopPid) || 0}`,
    'if [ "$pid" -gt 0 ]; then',
    '  for _ in $(seq 1 60); do',
    '    kill -0 "$pid" 2>/dev/null || break',
    '    sleep 0.5',
    '  done',
    'fi',
    `export HERMES_HOME=${q(hermesHome)}`
  ]

  if (pythonPath) {
    lines.push(`export PYTHONPATH=${q(pythonPath)}\${PYTHONPATH:+:$PYTHONPATH}`)
  }

  lines.push(`cd ${q(agentRoot)} 2>/dev/null || true`, `${q(pythonExe)} ${uninstallArgs.map(q).join(' ')} || true`)

  // The Python uninstaller also attempts this removal, but Electron helper
  // processes can keep Chromium files open for a moment after the main PID
  // exits. The detached handoff owns the final, post-exit cleanup.
  if (userDataPath) {
    lines.push(`rm -rf ${q(userDataPath)} || true`)
  }

  if (appPath) {
    lines.push(`rm -rf ${q(appPath)} || true`)
  }

  // Self-delete the script.
  lines.push('rm -f "$0" 2>/dev/null || true')
  lines.push('')

  return lines.join('\n')
}

/**
 * Build a Windows cleanup batch script. Same three steps, cmd.exe flavored.
 *
 * Finding 3 (venv self-deletion): for lite/full the agent uninstall rmtree's
 * the venv that contains `python.exe`. A running .exe is mandatory-locked on
 * Windows, so running the uninstall from the venv's OWN python half-fails. The
 * desktop passes a system Python (findSystemPython) as `pythonExe` for those
 * modes + `pythonPath`=agentRoot so `import hermes_cli` resolves from source
 * while the venv is torn down. gui-only doesn't touch the venv, so it can use
 * either interpreter.
 *
 * Wait-loop: bounded (matches POSIX's ~30s cap) so a never-exiting / mismatched
 * PID can't wedge the cleanup forever. `tasklist` and `findstr` deliberately
 * run as separate commands through a temporary file. A detached `cmd.exe`
 * pipeline can leave `findstr` holding an inherited pipe open forever, which
 * wedges uninstall before Python ever runs. The whole-token match keeps PID
 * 99 from matching 990.
 *
 * Removal: even after the desktop PID is gone, Windows releases directory
 * handles lazily, so a single `rmdir /s /q` can half-fail — retry up to 10x.
 */
function buildWindowsCleanupScript({
  desktopPid,
  pythonExe,
  pythonPath,
  agentRoot,
  uninstallArgs,
  appPath,
  userDataPath = null,
  hermesHome,
  windowsNsisAppKey = null
}) {
  const pid = Number(desktopPid) || 0
  // cmd.exe has no string escaping inside quotes; strip embedded quotes (paths
  // under %LOCALAPPDATA% never contain them). `&`/`^` in a path would still be
  // a problem, but Hermes install paths don't use them.
  const q = s => `"${String(s).replace(/"/g, '')}"`

  const lines = [
    '@echo off',
    'setlocal enableextensions',
    `set "HERMES_HOME=${String(hermesHome).replace(/"/g, '')}"`,
    `set "PID=${pid}"`,
    'set "TASKLIST_TMP=%~dpn0-tasklist.tmp"'
  ]

  if (pythonPath) {
    lines.push(`set "PYTHONPATH=${String(pythonPath).replace(/"/g, '')};%PYTHONPATH%"`)
  }

  lines.push(
    'set /a waited=0',
    ':waitloop',
    'rem Avoid a shell pipeline here. Detached cmd pipelines can',
    'rem inherit a write handle and leave findstr blocked forever waiting for EOF.',
    'tasklist /NH /FI "PID eq %PID%" >"%TASKLIST_TMP%" 2>nul',
    'findstr /r /c:" %PID% " "%TASKLIST_TMP%" >nul 2>&1',
    'if %ERRORLEVEL% neq 0 goto waited_done',
    'set /a waited+=1',
    'if %waited% geq 60 goto waited_done',
    'timeout /t 1 /nobreak >nul',
    'goto waitloop',
    ':waited_done',
    'del "%TASKLIST_TMP%" >nul 2>&1',
    `cd /d ${q(agentRoot)}`,
    `${q(pythonExe)} ${uninstallArgs.map(q).join(' ')}`
  )

  if (userDataPath) {
    lines.push(
      'rem Chromium helper processes can release userData handles after the',
      'rem main PID exits. Retry the post-exit cleanup instead of leaving data behind.',
      'set /a userdata_tries=0',
      ':rmuserdataloop',
      `if not exist ${q(userDataPath)} goto rmuserdatadone`,
      `rmdir /s /q ${q(userDataPath)} >nul 2>&1`,
      `if not exist ${q(userDataPath)} goto rmuserdatadone`,
      'set /a userdata_tries+=1',
      'if %userdata_tries% geq 10 goto rmuserdatadone',
      'timeout /t 1 /nobreak >nul',
      'goto rmuserdataloop',
      ':rmuserdatadone'
    )
  }

  if (appPath) {
    if (windowsNsisAppKey) {
      const installKey = `HKCU\\Software\\${windowsNsisAppKey}`
      const uninstallKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${windowsNsisAppKey}`

      lines.push(
        'rem Delete registration only when it belongs to this exact app path.',
        `set "HERMES_INSTALL_KEY=${installKey}"`,
        `set "HERMES_UNINSTALL_KEY=${uninstallKey}"`,
        'set "REGISTERED_INSTALL="',
        'for /f "tokens=2,*" %%A in (\'reg query "%HERMES_INSTALL_KEY%" /v InstallLocation 2^>nul ^| findstr /i /c:"InstallLocation"\') do set "REGISTERED_INSTALL=%%B"',
        `if /i not "%REGISTERED_INSTALL%"==${q(appPath)} goto registry_cleanup_done`,
        'reg delete "%HERMES_UNINSTALL_KEY%" /f >nul 2>&1',
        'reg delete "%HERMES_INSTALL_KEY%" /f >nul 2>&1',
        ':registry_cleanup_done'
      )
    }

    lines.push(
      'rem Leave the app tree before removing it. Windows cannot delete the',
      'rem current working directory of this cleanup cmd process.',
      'cd /d "%~dp0"',
      'set /a app_tries=0',
      ':rmapploop',
      `if not exist ${q(appPath)} goto rmapdone`,
      `rmdir /s /q ${q(appPath)} >nul 2>&1`,
      `if not exist ${q(appPath)} goto rmapdone`,
      'set /a app_tries+=1',
      'if %app_tries% geq 10 goto rmapdone',
      'timeout /t 1 /nobreak >nul',
      'goto rmapploop',
      ':rmapdone'
    )
  }

  lines.push('del "%~f0"')
  lines.push('')

  return lines.join('\r\n')
}

export {
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
}
