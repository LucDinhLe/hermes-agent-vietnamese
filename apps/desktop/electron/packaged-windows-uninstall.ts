import path from 'node:path'

interface CleanupInput {
  mode: string
  desktopPid: number
  executable: string
  hermesHome: string
  userData: string
  localAppData: string
  roamingAppData: string
  logPath: string
}

export function packagedWindowsUninstallPlan(input: CleanupInput) {
  if (!['gui', 'lite', 'full'].includes(input.mode)) {throw new Error('Invalid uninstall mode')}

  if (!Number.isInteger(input.desktopPid) || input.desktopPid < 1) {throw new Error('Invalid desktop PID')}
  const p = path.win32

  const exact = (actual: string, expected: string) =>
    p.isAbsolute(actual) && p.resolve(actual).toLowerCase() === p.resolve(expected).toLowerCase()

  if (!p.isAbsolute(input.localAppData) || !p.isAbsolute(input.roamingAppData) ||
    !exact(input.hermesHome, p.join(input.localAppData, 'hermes')) ||
    !exact(input.userData, p.join(input.roamingAppData, 'Hermes'))) {
    throw new Error('Uninstall data paths must be the exact managed Hermes profile')
  }

  if (!p.isAbsolute(input.executable) || p.basename(input.executable).toLowerCase() !== 'hermes.exe') {
    throw new Error('Uninstall requires the running packaged Hermes executable')
  }

  const hermesHome = p.resolve(input.hermesHome)
  const userData = p.resolve(input.userData)

  const remove = input.mode === 'full' ? [hermesHome, userData] : input.mode === 'lite'
    ? [p.join(hermesHome, 'runtimes'), p.join(hermesHome, 'runtime-current.txt'), p.join(hermesHome, 'hermes-agent')]
    : []

  return { mode: input.mode, pid: input.desktopPid, executable: p.resolve(input.executable),
    uninstaller: p.join(p.dirname(input.executable), 'Uninstall Hermes.exe'),
    hermesHome, userData, remove, logPath: input.logPath }
}

export function buildPackagedWindowsUninstallScript(input: CleanupInput): string {
  const encoded = Buffer.from(JSON.stringify(packagedWindowsUninstallPlan(input)), 'utf8').toString('base64')

  // Native PowerShell owns all deletion. Never run the Python being removed,
  // depend on developer tools, or interpolate a user path into a shell command.
  return `$ErrorActionPreference = 'Stop'
$spec = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
function Assert-NoLinkedParents([string]$target) {
  $current = [IO.Path]::GetFullPath($target)
  while ($current) {
    if (Test-Path -LiteralPath $current) {
      if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Refusing an uninstall target beneath a linked directory'
      }
    }
    $current = [IO.Path]::GetDirectoryName($current)
  }
}
function Assert-NoLinks([string]$target) {
  if (-not (Test-Path -LiteralPath $target)) { return }
  $item = Get-Item -LiteralPath $target -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to traverse a linked uninstall target' }
  if ($item.PSIsContainer) {
    foreach ($child in Get-ChildItem -LiteralPath $target -Force) { Assert-NoLinks $child.FullName }
  }
}
try {
  $hermesDir = [IO.Path]::GetFullPath([string]$spec.hermesHome).TrimEnd('\\')
  $userDataDir = [IO.Path]::GetFullPath([string]$spec.userData).TrimEnd('\\')
  foreach ($target in @($spec.remove)) {
    $full = [IO.Path]::GetFullPath([string]$target).TrimEnd('\\')
    if ($full -ne $hermesDir -and $full -ne $userDataDir -and -not $full.StartsWith($hermesDir+'\\', [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Uninstall target escaped the managed profile'
    }
    Assert-NoLinkedParents $full
    Assert-NoLinks $full
  }
  Wait-Process -Id ([int]$spec.pid) -Timeout 90 -ErrorAction SilentlyContinue
  if (Get-Process -Id ([int]$spec.pid) -ErrorAction SilentlyContinue) { throw 'Desktop has not stopped' }
  $run = Start-Process -FilePath ([string]$spec.uninstaller) -ArgumentList @('/S') -Wait -PassThru -WindowStyle Hidden
  if ($run.ExitCode -ne 0) { throw 'Windows uninstaller failed; user data was not removed' }
  $deadline = [DateTime]::UtcNow.AddSeconds(120)
  while (Test-Path -LiteralPath ([string]$spec.executable)) {
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Windows uninstaller did not remove the application; data kept' }
    Start-Sleep -Milliseconds 500
  }
  foreach ($target in @($spec.remove)) {
    if (Test-Path -LiteralPath ([string]$target)) {
      Assert-NoLinkedParents ([string]$target)
      Assert-NoLinks ([string]$target)
      Remove-Item -LiteralPath ([string]$target) -Recurse -Force
    }
  }
  'Completed packaged Hermes uninstall: ' + $spec.mode | Out-File -LiteralPath ([string]$spec.logPath) -Encoding utf8
  exit 0
} catch {
  $_ | Out-File -LiteralPath ([string]$spec.logPath) -Encoding utf8
  exit 1
}
`
}
