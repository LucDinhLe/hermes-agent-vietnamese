param(
  [Parameter(Mandatory=$true)][string]$Installer,
  [Parameter(Mandatory=$true)][string]$Sha256,
  [Parameter(Mandatory=$true)][string]$SourceCommit,
  [Parameter(Mandatory=$true)][string]$PreviousInstaller,
  [Parameter(Mandatory=$true)][string]$RepoRoot,
  [ValidateSet('currentuser','allusers')][string]$InstallScope='currentuser'
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or
    $env:RUNNER_OS -ne 'Windows' -or $env:RUNNER_ARCH -ne 'X64') {
  throw 'Run only on a disposable GitHub-hosted Windows x64 VM'
}
if ($SourceCommit -notmatch '^[0-9a-f]{40}$' -or $Sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Exact inputs required' }
function Hash([string]$File) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
if ((Hash $Installer) -ne $Sha256) { throw 'Candidate bytes changed' }
if ((Hash $PreviousInstaller) -ne '565e1313162505999238b9c3b4f1422ec37256a1da153bae5149b5795c83c5ac') { throw 'Wrong previous Latest bytes' }
$state = Join-Path $env:RUNNER_TEMP 'hermes-calendar-lifecycle'
if (Test-Path -LiteralPath $state) { throw 'Fresh lifecycle state required' }
New-Item -ItemType Directory -Path $state | Out-Null
$installDir = Join-Path $state 'installed'
$productId = '48ae4bdc-0f8d-5252-af1e-bf7c0a8c3649'
$keys = @("HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$productId", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$productId", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$productId")
foreach ($key in $keys) { if (Test-Path -LiteralPath $key) { throw 'Runner already has Hermes' } }
$evidence = Join-Path $RepoRoot 'calendar-lifecycle-evidence'
New-Item -ItemType Directory -Path $evidence | Out-Null
$events = @()
$firewallGroup = "HermesCalendar-$env:GITHUB_RUN_ID"
$env:HERMES_CANDIDATE_COMMIT = $SourceCommit
function Under([string]$Path, [string]$Parent) {
  [IO.Path]::GetFullPath($Path).StartsWith([IO.Path]::GetFullPath($Parent).TrimEnd('\')+'\', [StringComparison]::OrdinalIgnoreCase)
}
function Event([string]$Stage, [hashtable]$Detail=@{}) {
  $script:events += [ordered]@{ stage=$Stage; at=[DateTime]::UtcNow.ToString('o'); status='passed'; detail=$Detail }
  Write-Host "Lifecycle gate passed: $Stage"
}
function Installed {
  $found = @($keys | Where-Object { Test-Path -LiteralPath $_ })
  if ($found.Count -ne 1) { throw "Expected one registered Hermes, found $($found.Count)" }
  $reg = Get-ItemProperty -LiteralPath $found[0]
  $location = [string]$reg.InstallLocation
  if ([string]::IsNullOrWhiteSpace($location)) {
    $productKey = $found[0].Split(':')[0]+":\Software\$productId"
    $location = [string](Get-ItemProperty -LiteralPath $productKey).InstallLocation
  }
  [ordered]@{ scope=$InstallScope; key=$found[0]; location=$location; version=$reg.DisplayVersion; uninstall=$reg.UninstallString } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence 'last-registration.json') -Encoding utf8
  if (-not (Under $location $state)) { throw 'Registered installation escaped isolated state' }
  $expectedHive = $(if ($InstallScope -eq 'currentuser') {'HKCU:'} else {'HKLM:'})
  if (-not $found[0].StartsWith($expectedHive)) { throw 'Installer changed existing registration scope' }
  $command = [string]$reg.UninstallString
  if ($command -notmatch '^"([^"]+)"') { throw 'Expected quoted uninstaller path' }
  $uninstaller = $Matches[1]
  if (-not (Under $uninstaller $location)) { throw 'Uninstaller escaped installation directory' }
  $binary = Join-Path $location 'Hermes.exe'
  if (-not (Test-Path -LiteralPath $binary)) { throw 'Installed Hermes.exe missing' }
  return @{ binary=$binary; directory=$location; uninstaller=$uninstaller }
}
function Install([string]$File, [string]$Stage, [bool]$Legacy=$false, [bool]$First=$false) {
  if (Get-Process Hermes -ErrorAction SilentlyContinue) { throw 'Hermes process remains before install' }
  $arguments = @('/S')
  # Scope and destination are explicit only on fresh installs. Upgrade/repair
  # must detect the existing registration; /D would conceal a relocation bug.
  if ($First) { $arguments += "/$InstallScope"; $arguments += "/D=$installDir" }
  $run = Start-Process -FilePath $File -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($run.ExitCode -ne 0) { throw "Installer failed in $Stage ($($run.ExitCode))" }
  $current = Installed
  if ([IO.Path]::GetFullPath($current.directory).TrimEnd('\') -ne $installDir) { throw "$Stage was not an in-place install" }
  if (-not $Legacy) {
    $version = (Get-Item -LiteralPath $current.binary).VersionInfo.FileVersion
    if ($version -ne '2026.9.2.0') { throw "Wrong PE version: $version" }
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $current.directory 'resources\advisor-runtime\runtime-manifest.json') | ConvertFrom-Json
    if ($manifest.buildCommit -ne $SourceCommit -or $manifest.productVersion -ne '2026.9.2') { throw 'Installed provenance mismatch' }
    if ($manifest.python.layout -ne 'portable-cpython-win-x64-v1') { throw 'Bundled Python absent' }
    $payloadRoot = Join-Path $current.directory 'resources\advisor-runtime\payload'
    $actualFiles = @(Get-ChildItem -LiteralPath $payloadRoot -Recurse -File -Force | ForEach-Object { [IO.Path]::GetRelativePath($payloadRoot, $_.FullName).Replace('\','/') })
    $difference = @(Compare-Object -ReferenceObject @($manifest.files.path) -DifferenceObject $actualFiles -CaseSensitive)
    $difference | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence "$Stage-inventory-difference.json") -Encoding utf8
    if ($difference.Count -gt 0) {
      $difference | Format-Table -AutoSize | Out-String -Width 300 | Write-Host
      throw 'Installed payload file inventory differs from the frozen manifest'
    }
  }
  $env:HERMES_ACCEPTANCE_BINARY = $current.binary
  Event $Stage @{ sha256=(Hash $File); location=$current.directory; scope=$InstallScope }
}
function Block-ProductNetwork {
  $current = Installed
  $programs = @($current.binary)
  $programs += @(Get-ChildItem -LiteralPath $current.directory -Recurse -File | Where-Object { $_.Name -match '^(python|pythonw|node|codex)\.exe$' } | ForEach-Object FullName)
  $manifestPath = Join-Path $current.directory 'resources\advisor-runtime\runtime-manifest.json'
  if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    foreach ($name in @('python.exe','pythonw.exe')) {
      $programs += Join-Path $env:HERMES_TAB_PLUS_SANDBOX "local\hermes\runtimes\$($manifest.candidateId)\.python\$name"
    }
  }
  foreach ($program in ($programs | Sort-Object -Unique)) {
    if (-not (Under $program $state)) { throw 'Firewall program escaped isolated state' }
    foreach ($remote in @('Internet','LocalSubnet')) {
      New-NetFirewallRule -DisplayName "$firewallGroup-$([Guid]::NewGuid())" -Group $firewallGroup -Direction Outbound -Action Block -Program $program -RemoteAddress $remote -Profile Any | Out-Null
    }
  }
  Event 'product-network-blocked' @{ programs=$programs.Count; loopbackMockAllowed=$true }
}
function Smoke([string]$Stage, [bool]$Legacy=$false, [bool]$OldHistory=$false, [string]$Action='smoke') {
  $env:HERMES_ACCEPTANCE_LEGACY = $(if ($Legacy) {'1'} else {'0'})
  $env:HERMES_EXPECT_OLD_HISTORY = $(if ($OldHistory) {'1'} else {'0'})
  $env:HERMES_CALENDAR_ACTION = $Action
  Block-ProductNetwork
  Push-Location (Join-Path $RepoRoot 'apps\desktop')
  try {
    & node ../../node_modules/@playwright/test/cli.js test e2e/calendar-installed.spec.ts --workers=1 --retries=0 --reporter=list --output (Join-Path $evidence $Stage)
    if ($LASTEXITCODE -ne 0) { throw "Installed UI failed: $Stage" }
  } finally { Pop-Location }
  Event $Stage @{ legacy=$Legacy; action=$Action; mockProvider=$true }
}
function Wait-Uninstalled {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  do {
    if (-not (Test-Path -LiteralPath (Join-Path $installDir 'Hermes.exe')) -and @($keys | Where-Object { Test-Path -LiteralPath $_ }).Count -eq 0) { return }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'Uninstaller left product registration or executable'
}
function Nsis-Uninstall {
  $current = Installed
  $run = Start-Process -FilePath $current.uninstaller -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
  if ($run.ExitCode -ne 0) { throw 'NSIS uninstall failed' }
  Wait-Uninstalled
}
try {
  $env:HERMES_TAB_PLUS_SANDBOX = Join-Path $state 'hermes-tab-plus-fresh'
  Install $Installer 'fresh-install' $false $true
  Smoke 'fresh-offline-tabs-tools-relaunch'
  Nsis-Uninstall
  $env:HERMES_TAB_PLUS_SANDBOX = Join-Path $state 'hermes-tab-plus-upgrade'
  Install $PreviousInstaller 'previous-latest-install' $true $true
  Smoke 'previous-latest-history' $true
  $db = Join-Path $env:HERMES_TAB_PLUS_SANDBOX 'local\hermes\state.db'
  $before = Hash $db
  Install $Installer 'upgrade-from-previous-latest'
  if ((Hash $db) -ne $before) { throw 'Installer changed previous conversations' }
  Smoke 'upgrade-retains-history-and-relaunch' $false $true
  $before = Hash $db
  Install $Installer 'repair-install'
  if ((Hash $db) -ne $before) { throw 'Repair changed conversations' }
  Smoke 'repaired-start-tools-relaunch'
  Smoke 'uninstall-keep-data' $false $false 'uninstall-lite'
  Wait-Uninstalled
  if (-not (Test-Path -LiteralPath $db)) { throw 'Keep-data uninstall removed conversations' }
  Install $Installer 'reinstall-preserved-data' $false $true
  Smoke 'reinstall-retains-history' $false $true
  Nsis-Uninstall
  Install $PreviousInstaller 'rollback-to-previous-latest' $true $true
  Smoke 'rollback-retains-history' $true $true
  Nsis-Uninstall
  Install $Installer 'candidate-after-rollback' $false $true
  Smoke 'uninstall-delete-data' $false $false 'uninstall-full'
  Wait-Uninstalled
  if (Test-Path -LiteralPath $db) { throw 'Full uninstall retained the selected user database' }
  if (Get-Process Hermes -ErrorAction SilentlyContinue) { throw 'Hermes remained after lifecycle' }
  $residual = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and (Under $_.ExecutablePath $state) })
  if ($residual.Count -gt 0) { throw 'An isolated product process remained after lifecycle' }
  Event 'complete' @{ candidateSha256=$Sha256; sourceCommit=$SourceCommit }
} finally {
  # Test-owned logs only: never upload config, auth, databases or inherited profiles.
  Get-ChildItem -LiteralPath $state -Recurse -File -Filter '*.log' -ErrorAction SilentlyContinue | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($state, $_.FullName)
    $destination = Join-Path $evidence "product-logs\$relative"
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
  }
  $events | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $evidence 'events.json') -Encoding utf8
  Get-NetFirewallRule -Group $firewallGroup -ErrorAction SilentlyContinue | Remove-NetFirewallRule
}
