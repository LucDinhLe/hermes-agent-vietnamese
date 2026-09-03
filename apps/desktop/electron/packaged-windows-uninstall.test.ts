import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { buildPackagedWindowsUninstallScript, PACKAGED_UNINSTALL_LAUNCH_OPTIONS, packagedWindowsUninstallPlan } from './packaged-windows-uninstall'

const input = {
  mode: 'lite', desktopPid: 123, executable: 'C:\\Program Files\\Hermes\\Hermes.exe',
  localAppData: 'C:\\Users\\Test\\AppData\\Local', roamingAppData: 'C:\\Users\\Test\\AppData\\Roaming',
  hermesHome: 'C:\\Users\\Test\\AppData\\Local\\hermes', userData: 'C:\\Users\\Test\\AppData\\Roaming\\Hermes',
  logPath: 'C:\\Temp\\hermes-uninstall.log'
}

describe('portable packaged Windows uninstall', () => {
  test.skipIf(process.platform !== 'win32')('native hidden worker runs after its Node parent exits', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-uninstall-launch-test-'))
    const scriptPath = path.join(root, 'cleanup.ps1')
    const logPath = path.join(root, 'cleanup.log')
    // No real uninstaller or removal target exists. Exercise only the native
    // launcher and the worker's caught missing-uninstaller error/log.
    fs.writeFileSync(scriptPath, buildPackagedWindowsUninstallScript({
      ...input, mode: 'gui', desktopPid: 2147483647,
      executable: path.join(root, 'Hermes.exe'), logPath
    }))
    const runner = path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe')
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Launch']
    const parentCode = `const c=require('node:child_process').spawn(${JSON.stringify(runner)},${JSON.stringify(args)},${JSON.stringify(PACKAGED_UNINSTALL_LAUNCH_OPTIONS)});c.once('exit',code=>{process.exitCode=code});`
    const parent = spawnSync(process.execPath, ['-e', parentCode], { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
    expect(parent.status, parent.stderr).toBe(0)
    await expect.poll(() => fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '',
      { timeout: 10_000 }).toContain('Start-Process')
  }, 25_000)
  test('lite removes only managed code and runtime pointer, preserving profile data', () => {
    const plan = packagedWindowsUninstallPlan(input)
    expect(plan.remove).toEqual([`${input.hermesHome}\\runtimes`, `${input.hermesHome}\\runtime-current.txt`, `${input.hermesHome}\\hermes-agent`])
    expect(plan.uninstaller).toBe('C:\\Program Files\\Hermes\\Uninstall Hermes.exe')
  })
  test('GUI-only keeps materialized agent and data; full removes only the two product data roots', () => {
    expect(packagedWindowsUninstallPlan({ ...input, mode: 'gui' }).remove).toEqual([])
    expect(packagedWindowsUninstallPlan({ ...input, mode: 'full' }).remove).toEqual([input.hermesHome, input.userData])
  })
  test('rejects a broad or redirected data target and invalid mode', () => {
    for (const change of [{ mode: 'oops' }, { hermesHome: 'C:\\Users\\Test' }, { userData: 'C:\\' },
      { executable: 'C:\\Windows\\explorer.exe' }, { desktopPid: 0 }]) {
      expect(() => packagedWindowsUninstallPlan({ ...input, ...change })).toThrow()
    }
  })
  test('uses literal-path native deletion, link guards and the real NSIS uninstaller, not an absent venv', () => {
    const script = buildPackagedWindowsUninstallScript(input)
    expect(script).toContain('Remove-Item -LiteralPath')
    expect(script).toContain('ReparsePoint')
    expect(script).toContain('Windows uninstaller failed; user data was not removed')
    expect(script).not.toMatch(/python|cmd \/c|rmdir|PYTHONPATH/i)
  })
  test('encodes paths as data, including Unicode and shell metacharacters', () => {
    const logPath = "C:\\Temp\\Đại ca's $test [1];x.log"
    const script = buildPackagedWindowsUninstallScript({ ...input, logPath })
    expect(script).not.toContain(logPath)
    const encoded = script.match(/FromBase64String\('([^']+)'\)/)![1]
    expect(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')).logPath).toBe(logPath)
  })
  test.skipIf(process.platform !== 'win32')('generated cleanup parses in OS PowerShell without executing it', () => {
    const result = execFileSync(path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command',
        '$tokens=$null; $parseErrors=$null; [void][System.Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(), [ref]$tokens, [ref]$parseErrors); if ($parseErrors.Count) { $parseErrors | Out-String; exit 1 }; Write-Output "syntax PASS"'],
      { input: buildPackagedWindowsUninstallScript(input), encoding: 'utf8', windowsHide: true, timeout: 15_000 })

    expect(result).toContain('syntax PASS')
  })
})
