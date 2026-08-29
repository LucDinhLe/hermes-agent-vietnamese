param(
  [Parameter(Mandatory = $true)][string]$Candidate,
  [Parameter(Mandatory = $true)][string]$CandidateSha256,
  [Parameter(Mandatory = $true)][string]$CandidateCommit,
  [Parameter(Mandatory = $true)][string]$Previous,
  [Parameter(Mandatory = $true)][string]$PreviousSha256,
  [Parameter(Mandatory = $true)][string]$SmokeScript,
  [Parameter(Mandatory = $true)][string]$EvidenceRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version 3.0

$ProductId = '48ae4bdc-0f8d-5252-af1e-bf7c0a8c3649'
$ProductKey = "HKCU:\Software\$ProductId"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductId"
$StateRoot = 'C:\HermesLifecycle'
$FirewallGroup = "HermesV33Staging-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT"
$Gates = [ordered]@{}
$Events = New-Object System.Collections.ArrayList
$RecordedInstallDirs = New-Object System.Collections.ArrayList
$ProtectedPrograms = New-Object System.Collections.ArrayList
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Write-Json([string]$Path, [object]$Value) {
  $temporary = "$Path.partial-$PID"
  [System.IO.File]::WriteAllText($temporary, "$(ConvertTo-Json $Value -Depth 20)`n", $Utf8NoBom)
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Add-Gate([string]$Name, [hashtable]$Detail) {
  $Gates[$Name] = [ordered]@{ detail = $Detail; status = 'passed' }
}

function Add-Event([string]$Name, [hashtable]$Detail) {
  [void]$Events.Add([ordered]@{ at = [DateTime]::UtcNow.ToString('o'); detail = $Detail; name = $Name })
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-Exact([string]$Path, [string]$Expected, [string]$Label) {
  Assert-True (Test-Path -LiteralPath $Path -PathType Leaf) "$Label installer is missing"
  Assert-True ((Get-Sha256 $Path) -eq $Expected.ToLowerInvariant()) "$Label installer SHA-256 mismatch"
}

function Get-InstallState {
  Assert-True (Test-Path -LiteralPath $ProductKey) 'Hermes product registry key is missing'
  Assert-True (Test-Path -LiteralPath $UninstallKey) 'Hermes uninstall registry key is missing'
  $product = Get-ItemProperty -LiteralPath $ProductKey
  $uninstall = Get-ItemProperty -LiteralPath $UninstallKey
  $installDir = [string]$product.InstallLocation
  if ([string]::IsNullOrWhiteSpace($installDir)) { $installDir = [string]$uninstall.InstallLocation }
  $installDir = [System.IO.Path]::GetFullPath($installDir).TrimEnd('\')
  Assert-True ($installDir.StartsWith($env:LOCALAPPDATA, [StringComparison]::OrdinalIgnoreCase)) 'install escaped disposable LOCALAPPDATA'
  $binary = Join-Path $installDir 'Hermes.exe'
  Assert-True (Test-Path -LiteralPath $binary -PathType Leaf) 'installed Hermes.exe is missing'
  $uninstallString = [string]$uninstall.UninstallString
  if ($uninstallString -match '^"([^"]+)"') { $uninstaller = $Matches[1] }
  elseif ($uninstallString -match '^([^ ]+\.exe)') { $uninstaller = $Matches[1] }
  else { throw 'registered uninstall command is invalid' }
  Assert-True (Test-Path -LiteralPath $uninstaller -PathType Leaf) 'registered uninstaller is missing'
  return [ordered]@{
    Binary = $binary
    DisplayVersion = [string]$uninstall.DisplayVersion
    InstallDir = $installDir
    Uninstaller = $uninstaller
  }
}

function Wait-InstallState([string]$Stage) {
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    if ((Test-Path -LiteralPath $ProductKey) -and (Test-Path -LiteralPath $UninstallKey)) {
      try { return Get-InstallState } catch {}
    }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "$Stage did not produce a complete registered install"
}

function Protect-Program([string]$Program) {
  $full = [System.IO.Path]::GetFullPath($Program)
  if (@($ProtectedPrograms | Where-Object { [string]::Equals($_, $full, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0) { return }
  foreach ($scope in @('Internet', 'LocalSubnet')) {
    $name = "$FirewallGroup-$($ProtectedPrograms.Count)-$scope"
    New-NetFirewallRule -Name $name -DisplayName $name -Group $FirewallGroup -Direction Outbound -Action Block -Enabled True -Profile Any -Program $full -RemoteAddress $scope | Out-Null
  }
  [void]$ProtectedPrograms.Add($full)
}

function Install-Exact([string]$Installer, [string]$Stage) {
  $process = Start-Process -FilePath $Installer -ArgumentList @('/S', '/currentuser') -PassThru -Wait -WindowStyle Hidden
  [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot "$Stage.log"), "exitCode=$($process.ExitCode)`n", $Utf8NoBom)
  Assert-True ($process.ExitCode -eq 0) "$Stage installer failed with exit code $($process.ExitCode)"
  $state = Wait-InstallState $Stage
  Protect-Program $state.Binary
  if (@($RecordedInstallDirs | Where-Object { [string]::Equals($_, $state.InstallDir, [StringComparison]::OrdinalIgnoreCase) }).Count -eq 0) {
    [void]$RecordedInstallDirs.Add($state.InstallDir)
  }
  Add-Event 'install' @{ displayVersion = $state.DisplayVersion; stage = $Stage }
  return $state
}

function Uninstall-Exact([object]$State, [string]$Stage) {
  $process = Start-Process -FilePath $State.Uninstaller -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
  [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot "$Stage.log"), "exitCode=$($process.ExitCode)`n", $Utf8NoBom)
  Assert-True ($process.ExitCode -eq 0) "$Stage uninstaller failed with exit code $($process.ExitCode)"
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    if (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey) -and -not (Test-Path -LiteralPath $State.InstallDir)) { return }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "$Stage left product registration or installed files"
}

function Assert-SameInstall([object]$Before, [object]$After, [string]$Stage) {
  Assert-True ([string]::Equals($Before.InstallDir, $After.InstallDir, [StringComparison]::OrdinalIgnoreCase)) "$Stage installed side-by-side"
}

function Invoke-Smoke([object]$State, [string]$Phase, [string]$HermesHome, [string]$UserData) {
  $screenshot = Join-Path $EvidenceRoot "$Phase.png"
  $result = Join-Path $EvidenceRoot "$Phase.json"
  & node $SmokeScript --binary $State.Binary --home $HermesHome --user-data $UserData --screenshot $screenshot --result $result --phase $Phase
  Assert-True ($LASTEXITCODE -eq 0) "$Phase installed UI smoke failed"
  Assert-True (Test-Path -LiteralPath $screenshot -PathType Leaf) "$Phase screenshot is missing"
  Assert-True (Test-Path -LiteralPath $result -PathType Leaf) "$Phase result is missing"
}

function Write-Sentinel([string]$HermesHome, [string]$UserData, [string]$Value) {
  New-Item -ItemType Directory -Path $HermesHome, $UserData -Force | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $HermesHome 'v33-lifecycle-sentinel.txt'), $Value, $Utf8NoBom)
  [System.IO.File]::WriteAllText((Join-Path $UserData 'v33-lifecycle-sentinel.txt'), $Value, $Utf8NoBom)
}

function Assert-Sentinel([string]$HermesHome, [string]$UserData, [string]$Value, [string]$Stage) {
  Assert-True ((Get-Content -LiteralPath (Join-Path $HermesHome 'v33-lifecycle-sentinel.txt') -Raw) -eq $Value) "$Stage changed HERMES_HOME sentinel"
  Assert-True ((Get-Content -LiteralPath (Join-Path $UserData 'v33-lifecycle-sentinel.txt') -Raw) -eq $Value) "$Stage changed userData sentinel"
}

$receiptPath = Join-Path $EvidenceRoot 'lifecycle-result.json'
$status = 'failed'
$failure = $null

try {
  Assert-True ($env:GITHUB_ACTIONS -eq 'true') 'lifecycle is restricted to GitHub Actions'
  Assert-True ($env:RUNNER_ENVIRONMENT -eq 'github-hosted') 'lifecycle requires a GitHub-hosted disposable VM'
  Assert-True ($env:RUNNER_OS -eq 'Windows') 'lifecycle requires Windows'
  Assert-True ([Environment]::Is64BitOperatingSystem) 'lifecycle requires Windows x64'
  Assert-True (-not (Test-Path -LiteralPath $StateRoot)) 'lifecycle state root is not empty'
  Assert-True (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey)) 'runner already has Hermes registered'

  New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
  Assert-Exact $Candidate $CandidateSha256 'candidate'
  Assert-Exact $Previous $PreviousSha256 'previous'
  Add-Gate 'exactBytes' @{ candidateSha256 = $CandidateSha256; previousSha256 = $PreviousSha256 }

  $candidateState = Install-Exact $Candidate 'fresh-candidate-install'
  Assert-True ($candidateState.DisplayVersion -eq '0.33.0-dev.4') "candidate registered version is $($candidateState.DisplayVersion), expected 0.33.0-dev.4"
  $resources = Join-Path $candidateState.InstallDir 'resources'
  $editionReceipt = Get-Content -LiteralPath (Join-Path $resources 'edition-receipt.json') -Raw | ConvertFrom-Json
  $installStamp = Get-Content -LiteralPath (Join-Path $resources 'install-stamp.json') -Raw | ConvertFrom-Json
  Assert-True ($editionReceipt.releaseMode -eq $true) 'installed edition receipt is not release-mode'
  Assert-True ([string]$editionReceipt.edition.version -eq '0.33.0-dev.4') 'installed edition version mismatch'
  Assert-True ([string]$editionReceipt.edition.shellCommit -eq $CandidateCommit) 'installed shell commit mismatch'
  Assert-True ([string]$installStamp.commit -match '^[0-9a-f]{40}$') 'installed engine stamp is malformed'
  Add-Gate 'installedProvenance' @{ engineCommit = [string]$installStamp.commit; shellCommit = [string]$editionReceipt.edition.shellCommit }

  $freshHome = "$StateRoot\fresh\home"
  $freshUserData = "$StateRoot\fresh\user-data"
  Invoke-Smoke $candidateState 'fresh-first-launch' $freshHome $freshUserData
  Write-Sentinel $freshHome $freshUserData 'fresh-restart'
  Invoke-Smoke $candidateState 'fresh-restart' $freshHome $freshUserData
  Assert-Sentinel $freshHome $freshUserData 'fresh-restart' 'fresh restart'
  Add-Gate 'freshLaunchRestart' @{ profile = 'isolated'; renderer = 'installed'; sameProfile = $true }
  Uninstall-Exact $candidateState 'fresh-candidate-uninstall'
  Add-Gate 'freshUninstall' @{ registrationRemoved = $true }

  $upgradeHome = "$StateRoot\upgrade\home"
  $upgradeUserData = "$StateRoot\upgrade\user-data"
  $previousState = Install-Exact $Previous 'previous-install'
  Write-Sentinel $upgradeHome $upgradeUserData 'v321-to-v33'
  $candidateState = Install-Exact $Candidate 'v321-to-v33-update'
  Assert-SameInstall $previousState $candidateState 'V32.1-18 to V33 update'
  Assert-Sentinel $upgradeHome $upgradeUserData 'v321-to-v33' 'V32.1-18 to V33 update'
  Invoke-Smoke $candidateState 'update-relaunch' $upgradeHome $upgradeUserData
  Add-Gate 'v321ToV33Update' @{ from = 'vi-v0.32.1-18'; sameInstallDir = $true; to = '0.33.0-dev.4' }
  Uninstall-Exact $candidateState 'update-uninstall'

  $protectedHome = "$StateRoot\rollback\v33-home"
  $protectedUserData = "$StateRoot\rollback\v33-user-data"
  $candidateState = Install-Exact $Candidate 'rollback-candidate-install'
  Write-Sentinel $protectedHome $protectedUserData 'protected-v33-profile'
  $rollbackState = Install-Exact $Previous 'rollback-v32118-install'
  Assert-SameInstall $candidateState $rollbackState 'V33 to V32.1-18 rollback'
  Assert-Sentinel $protectedHome $protectedUserData 'protected-v33-profile' 'rollback install'
  Invoke-Smoke $rollbackState 'rollback-fresh-profile' "$StateRoot\rollback\old-home" "$StateRoot\rollback\old-user-data"
  Add-Gate 'rollbackV32118' @{ protectedV33Profile = $true; rollbackProfile = 'fresh'; sameInstallDir = $true; to = 'vi-v0.32.1-18' }
  Uninstall-Exact $rollbackState 'rollback-final-uninstall'

  Assert-True (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey)) 'final cleanup left Hermes registration'
  foreach ($installDir in $RecordedInstallDirs) {
    Assert-True (-not (Test-Path -LiteralPath $installDir)) "final cleanup left $installDir"
  }
  Add-Gate 'noResidualInstall' @{ installDirectoryCount = $RecordedInstallDirs.Count; registrationPresent = $false }
  Add-Gate 'networkIsolation' @{ firewallGroup = $FirewallGroup; protectedProgramCount = $ProtectedPrograms.Count }
  $status = 'passed'
} catch {
  $failure = $_.Exception.Message
  throw
} finally {
  if (-not (Test-Path -LiteralPath $EvidenceRoot)) { New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null }
  $candidateSignature = if (Test-Path -LiteralPath $Candidate) { Get-AuthenticodeSignature -LiteralPath $Candidate } else { $null }
  $result = [ordered]@{
    candidate = [ordered]@{
      commit = $CandidateCommit
      fileName = Split-Path -Leaf $Candidate
      sha256 = $CandidateSha256.ToLowerInvariant()
      signatureStatus = if ($null -ne $candidateSignature) { [string]$candidateSignature.Status } else { 'Unavailable' }
    }
    events = @($Events)
    failure = $failure
    gates = $Gates
    isolation = [ordered]@{ mechanism = 'github-hosted-ephemeral-vm'; productOutboundBlocked = ($ProtectedPrograms.Count -gt 0) }
    missingReleaseGates = @('realGatewayBootstrap', 'realChatSession', 'safeToolCall')
    schemaVersion = 1
    status = $status
  }
  Write-Json $receiptPath $result
  Remove-NetFirewallRule -Group $FirewallGroup -ErrorAction SilentlyContinue
}
