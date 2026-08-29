param(
  [Parameter(Mandatory = $true)][string]$Candidate,
  [Parameter(Mandatory = $true)][string]$CandidateSha256,
  [Parameter(Mandatory = $true)][string]$CandidateCommit,
  [Parameter(Mandatory = $true)][string]$CandidateVersion,
  [Parameter(Mandatory = $true)][string]$EngineCommit,
  [Parameter(Mandatory = $true)][string]$HarnessRoot,
  [Parameter(Mandatory = $true)][string]$EvidenceRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version 3.0

$ProductId = '48ae4bdc-0f8d-5252-af1e-bf7c0a8c3649'
$ProductKey = "HKCU:\Software\$ProductId"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductId"
$StateRoot = 'C:\HermesUpstreamRuntimeAcceptance'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$InstallState = $null
$TestExitCode = $null
$Failure = $null
$UninstallPassed = $false
$NetworkPreflight = $null

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Write-Json([string]$Path, [object]$Value) {
  $temporary = "$Path.partial-$PID"
  [System.IO.File]::WriteAllText($temporary, "$(ConvertTo-Json $Value -Depth 20)`n", $Utf8NoBom)
  Move-Item -LiteralPath $temporary -Destination $Path -Force
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
  return [ordered]@{
    Binary = $binary
    DisplayVersion = [string]$uninstall.DisplayVersion
    InstallDir = $installDir
    Uninstaller = $uninstaller
  }
}

function Wait-InstallState {
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    if ((Test-Path -LiteralPath $ProductKey) -and (Test-Path -LiteralPath $UninstallKey)) {
      try { return Get-InstallState } catch {}
    }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'candidate did not produce a complete registered install'
}

function Uninstall-Candidate([object]$State) {
  if ($null -eq $State) { return }
  $process = Start-Process -FilePath $State.Uninstaller -ArgumentList @('/S') -PassThru -Wait -WindowStyle Hidden
  Assert-True ($process.ExitCode -eq 0) "uninstaller failed with exit code $($process.ExitCode)"
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    if (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey) -and -not (Test-Path -LiteralPath $State.InstallDir)) { return }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'uninstall left product registration or installed files'
}

try {
  Assert-True ($env:GITHUB_ACTIONS -eq 'true') 'acceptance is restricted to GitHub Actions'
  Assert-True ($env:RUNNER_ENVIRONMENT -eq 'github-hosted') 'acceptance requires a GitHub-hosted disposable VM'
  Assert-True ($env:RUNNER_OS -eq 'Windows') 'acceptance requires Windows'
  Assert-True ([Environment]::Is64BitOperatingSystem) 'acceptance requires Windows x64'
  Assert-True (-not (Test-Path -LiteralPath $StateRoot)) 'acceptance state root is not empty'
  Assert-True (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey)) 'runner already has Hermes registered'
  Assert-True (Test-Path -LiteralPath $Candidate -PathType Leaf) 'exact candidate is missing'
  Assert-True ((Get-FileHash -LiteralPath $Candidate -Algorithm SHA256).Hash.ToLowerInvariant() -eq $CandidateSha256.ToLowerInvariant()) 'candidate SHA-256 mismatch'

  New-Item -ItemType Directory -Path $StateRoot, $EvidenceRoot -Force | Out-Null
  $installScriptUrl = "https://raw.githubusercontent.com/NousResearch/hermes-agent/$EngineCommit/scripts/install.ps1"
  $installScriptPath = Join-Path $EvidenceRoot 'upstream-install.ps1'
  Invoke-WebRequest -Uri $installScriptUrl -OutFile $installScriptPath -UseBasicParsing -TimeoutSec 60
  $NetworkPreflight = [ordered]@{
    installScriptUrl = $installScriptUrl
    installScriptSha256 = (Get-FileHash -LiteralPath $installScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
    status = 'passed'
  }

  $installer = Start-Process -FilePath $Candidate -ArgumentList @('/S', '/currentuser') -PassThru -Wait -WindowStyle Hidden
  Assert-True ($installer.ExitCode -eq 0) "candidate installer failed with exit code $($installer.ExitCode)"
  $InstallState = Wait-InstallState
  Assert-True ($InstallState.DisplayVersion -eq $CandidateVersion) "installed version is $($InstallState.DisplayVersion)"

  $resources = Join-Path $InstallState.InstallDir 'resources'
  $receipt = Get-Content -LiteralPath (Join-Path $resources 'edition-receipt.json') -Raw | ConvertFrom-Json
  $stamp = Get-Content -LiteralPath (Join-Path $resources 'install-stamp.json') -Raw | ConvertFrom-Json
  Assert-True ($receipt.releaseMode -eq $true) 'installed receipt is not release-mode'
  Assert-True ([string]$receipt.edition.shellCommit -eq $CandidateCommit) 'installed shell commit mismatch'
  Assert-True ([string]$receipt.edition.version -eq $CandidateVersion) 'installed edition version mismatch'
  Assert-True ([string]$stamp.commit -eq $EngineCommit) 'installed engine commit mismatch'

  $env:HERMES_ACCEPTANCE_BINARY = [string]$InstallState.Binary
  $env:HERMES_ACCEPTANCE_HERMES_HOME = "$StateRoot\home"
  $env:HERMES_ACCEPTANCE_USER_DATA = "$StateRoot\user-data"
  $env:HERMES_ACCEPTANCE_EVIDENCE_ROOT = $EvidenceRoot
  $env:HERMES_ACCEPTANCE_CANDIDATE_COMMIT = $CandidateCommit
  $env:HERMES_ACCEPTANCE_CANDIDATE_VERSION = $CandidateVersion
  $env:HERMES_ACCEPTANCE_CANDIDATE_SHA256 = $CandidateSha256.ToLowerInvariant()
  $env:HERMES_ACCEPTANCE_ENGINE_COMMIT = $EngineCommit
  $env:HERMES_ACCEPTANCE_NETWORK_ALLOWED = '1'

  Push-Location (Join-Path $HarnessRoot 'apps\desktop')
  try {
    & npm exec -- playwright test e2e/v33-upstream-runtime-acceptance.spec.ts --reporter=list --workers=1
    $TestExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  Assert-True ($TestExitCode -eq 0) "runtime acceptance failed with exit code $TestExitCode"
} catch {
  $Failure = $_.Exception.Message
} finally {
  try {
    Uninstall-Candidate $InstallState
    $UninstallPassed = $true
  } catch {
    if ($null -eq $Failure) { $Failure = $_.Exception.Message }
    else { $Failure = "$Failure; cleanup: $($_.Exception.Message)" }
  }

  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
  $runtimeLogs = Get-ChildItem -LiteralPath "$StateRoot\home\logs" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'bootstrap-*.log' -or $_.Name -eq 'desktop.log' }
  foreach ($log in $runtimeLogs) {
    $content = Get-Content -LiteralPath $log.FullName -Raw
    $content = $content -replace 'e2e-mock-key', '[REDACTED-MOCK-KEY]'
    $content = $content -replace '(?im)(api[_-]?key\s*[:=]\s*)\S+', '$1[REDACTED]'
    $content = $content -replace '(?im)(authorization\s*[:=]\s*)\S+', '$1[REDACTED]'
    [System.IO.File]::WriteAllText((Join-Path $EvidenceRoot $log.Name), $content, $Utf8NoBom)
  }
  Write-Json (Join-Path $EvidenceRoot 'orchestration-result.json') ([ordered]@{
    candidate = [ordered]@{
      commit = $CandidateCommit
      installerSha256 = $CandidateSha256.ToLowerInvariant()
      version = $CandidateVersion
    }
    controller = [ordered]@{ commit = $env:GITHUB_SHA; runId = $env:GITHUB_RUN_ID }
    failure = $Failure
    installedProvenanceChecked = ($null -ne $InstallState)
    networkPreflight = $NetworkPreflight
    schemaVersion = 1
    testExitCode = $TestExitCode
    uninstallPassed = $UninstallPassed
  })
}

if ($null -ne $Failure) { throw $Failure }
