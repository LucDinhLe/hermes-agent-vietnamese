param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version 2.0

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ProductId = 'f55add5f-6655-5c1d-b8e3-d7252a8a4152'
$ProductKey = "HKCU:\Software\$ProductId"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductId"
$StateRoot = $null
$ExpectedGuest = $null
$ExpectedProfile = $null
$Gates = [ordered]@{}
$Events = New-Object System.Collections.ArrayList
$Manifest = $null
$EvidenceRoot = $null
$CurrentInstallDir = $null
$RecordedInstallDirs = New-Object System.Collections.ArrayList
$ProtectedPrograms = New-Object System.Collections.ArrayList
$HostRegistryReachable = $null
$HypervisorBoundary = $false
$ProductOutboundBlocked = $false
$FirewallGroup = $null
$FirewallRuleCount = 0
$RegistryProbe = $null
$IsolationMechanism = $null

function Write-JsonAtomic {
  param([string]$Path, [object]$Value)
  $temporary = "$Path.partial-$PID"
  $json = $Value | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($temporary, "$json`n", $Utf8NoBom)
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Add-Event {
  param([string]$Name, [hashtable]$Detail = @{})
  [void]$Events.Add([ordered]@{
    at = [DateTime]::UtcNow.ToString('o')
    detail = $Detail
    name = $Name
  })
}

function Add-Gate {
  param([string]$Name, [string[]]$Evidence, [hashtable]$Detail = @{})
  if ($Gates.Contains($Name)) { throw "duplicate lifecycle gate: $Name" }
  $Gates[$Name] = [ordered]@{
    detail = $Detail
    evidence = @($Evidence)
    status = 'passed'
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Assert-GuestPath {
  param([string]$Path, [string]$AllowedRoot, [string]$Label)
  $full = [System.IO.Path]::GetFullPath($Path)
  $root = [System.IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\') + '\'
  Assert-True ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) "$Label escaped its isolated guest root"
}

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ArtifactRecord {
  param([object]$Artifact)
  $record = [ordered]@{
    fileName = [string]$Artifact.fileName
    sha256 = [string]$Artifact.sha256
    size = [Int64]$Artifact.size
    tag = [string]$Artifact.tag
  }
  if ($null -ne $Artifact.PSObject.Properties['commit']) { $record.commit = [string]$Artifact.commit }
  if ($null -ne $Artifact.PSObject.Properties['identitySource']) { $record.identitySource = [string]$Artifact.identitySource }
  return $record
}

function Assert-ExactInput {
  param([string]$Path, [object]$Artifact, [string]$Label)
  Assert-True (Test-Path -LiteralPath $Path -PathType Leaf) "$Label installer is absent inside the guest"
  $item = Get-Item -LiteralPath $Path
  Assert-True ($item.Length -eq [Int64]$Artifact.size) "$Label installer size mismatch inside the guest"
  $digest = Get-Sha256 $Path
  Assert-True ($digest -eq [string]$Artifact.sha256) "$Label installer SHA-256 mismatch inside the guest"
}

function Protect-OutboundPrograms {
  param([string[]]$Programs, [string]$Stage)
  if ($IsolationMechanism -ne 'github-hosted-ephemeral-vm') { return }
  foreach ($rawProgram in @($Programs)) {
    if ([string]::IsNullOrWhiteSpace($rawProgram)) { continue }
    $program = [System.IO.Path]::GetFullPath($rawProgram)
    Assert-True (Test-Path -LiteralPath $program -PathType Leaf) "$Stage outbound-isolation target is missing: $program"
    $alreadyProtected = @($script:ProtectedPrograms | Where-Object {
      [string]::Equals([string]$_, $program, [StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
    if ($alreadyProtected) { continue }
    foreach ($scope in @('Internet', 'LocalSubnet')) {
      $ruleName = "HermesLifecycle-$($Manifest.runId)-$($script:FirewallRuleCount + 1)"
      New-NetFirewallRule `
        -Name $ruleName `
        -DisplayName $ruleName `
        -Group $FirewallGroup `
        -Direction Outbound `
        -Action Block `
        -Enabled True `
        -Profile Any `
        -Program $program `
        -RemoteAddress $scope | Out-Null
      $script:FirewallRuleCount += 1
    }
    [void]$script:ProtectedPrograms.Add($program)
  }

  $rules = @(Get-NetFirewallRule -Group $FirewallGroup -ErrorAction Stop | Where-Object {
    $_.Enabled -eq 'True' -and $_.Direction -eq 'Outbound' -and $_.Action -eq 'Block'
  })
  Assert-True ($rules.Count -eq $script:FirewallRuleCount) "$Stage did not preserve every product firewall rule"
  foreach ($program in @($script:ProtectedPrograms)) {
    $applicationRules = @($rules | Get-NetFirewallApplicationFilter | Where-Object {
      [string]::Equals([string]$_.Program, [string]$program, [StringComparison]::OrdinalIgnoreCase)
    })
    Assert-True ($applicationRules.Count -eq 2) "$Stage did not block both Internet and local-subnet egress for $program"
  }
  $script:ProductOutboundBlocked = $true
  Add-Event 'product-outbound-firewall-verified' @{
    programCount = $script:ProtectedPrograms.Count
    ruleCount = $script:FirewallRuleCount
    stage = $Stage
  }
}

function Protect-InstalledProduct {
  param([string]$Binary, [string]$Stage)
  if ($IsolationMechanism -ne 'github-hosted-ephemeral-vm') { return }
  $installDir = Split-Path -Parent $Binary
  $programs = @($Binary)
  $programs += @(Get-ChildItem -LiteralPath $installDir -File -Recurse | Where-Object {
    $_.Name -match '^(?:node|python|pythonw|codex)\.exe$'
  } | ForEach-Object { $_.FullName })
  Protect-OutboundPrograms $programs $Stage
}

function Get-InstallState {
  Assert-True (Test-Path -LiteralPath $ProductKey) "Hermes product registry key is missing"
  Assert-True (Test-Path -LiteralPath $UninstallKey) "Hermes uninstall registry key is missing"
  $product = Get-ItemProperty -LiteralPath $ProductKey
  $uninstall = Get-ItemProperty -LiteralPath $UninstallKey
  $installLocation = [string]$product.InstallLocation
  if ([string]::IsNullOrWhiteSpace($installLocation)) { $installLocation = [string]$uninstall.InstallLocation }
  Assert-True (-not [string]::IsNullOrWhiteSpace($installLocation)) 'registered InstallLocation is empty'
  $installLocation = [System.IO.Path]::GetFullPath($installLocation).TrimEnd('\')
  Assert-GuestPath $installLocation $env:LOCALAPPDATA 'registered Hermes install'
  $binary = Join-Path $installLocation 'HermesVietnamese.exe'
  Assert-True (Test-Path -LiteralPath $binary -PathType Leaf) 'registered HermesVietnamese.exe is missing'
  $uninstallString = [string]$uninstall.UninstallString
  $uninstaller = $null
  if ($uninstallString -match '^"([^"]+)"') {
    $uninstaller = $Matches[1]
  } elseif ($uninstallString -match '^([^ ]+\.exe)') {
    $uninstaller = $Matches[1]
  }
  Assert-True (-not [string]::IsNullOrWhiteSpace($uninstaller)) 'registered uninstall command is invalid'
  $uninstaller = [System.IO.Path]::GetFullPath($uninstaller)
  Assert-GuestPath $uninstaller $installLocation 'registered Hermes uninstaller'
  Assert-True (Test-Path -LiteralPath $uninstaller -PathType Leaf) 'registered Hermes uninstaller is missing'
  return [ordered]@{ Binary = $binary; InstallDir = $installLocation; Uninstaller = $uninstaller }
}

function Wait-InstallState {
  param([string]$Stage)
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  $lastFailure = 'the NSIS product and uninstall keys are not both present'
  do {
    if ((Test-Path -LiteralPath $ProductKey) -and (Test-Path -LiteralPath $UninstallKey)) {
      try {
        return Get-InstallState
      } catch {
        $lastFailure = $_.Exception.Message
      }
    }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  try { Write-InstallDiagnostics $Stage } catch {}
  throw "$Stage did not reach a complete registered install within 3 minutes: $lastFailure"
}

function Write-InstallDiagnostics {
  param([string]$Stage)
  $registryPaths = [ordered]@{
    hkcuProduct = $ProductKey
    hkcuUninstall = $UninstallKey
    hklmProduct = "Registry::HKEY_LOCAL_MACHINE\Software\$ProductId"
    hklmUninstall = "Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductId"
    hklm32Product = "Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\$ProductId"
    hklm32Uninstall = "Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$ProductId"
  }
  $registry = [ordered]@{}
  foreach ($entry in $registryPaths.GetEnumerator()) {
    $registry[$entry.Key] = [bool](Test-Path -LiteralPath $entry.Value)
  }
  $installPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Hermes Vietnamese'),
    (Join-Path $env:ProgramFiles 'Hermes Vietnamese')
  )
  if (-not [string]::IsNullOrWhiteSpace(${env:ProgramFiles(x86)})) {
    $installPaths += Join-Path ${env:ProgramFiles(x86)} 'Hermes Vietnamese'
  }
  $paths = @($installPaths | ForEach-Object {
    [ordered]@{ path = $_; exists = [bool](Test-Path -LiteralPath $_) }
  })
  $installerPaths = @(
    [string]$Manifest.paths.candidate,
    [string]$Manifest.paths.previous,
    [string]$Manifest.paths.rollback
  )
  $processes = @(Get-CimInstance Win32_Process | Where-Object {
    $executable = [string]$_.ExecutablePath
    $commandLine = [string]$_.CommandLine
    ($_.Name -match '(?i)(?:Hermes|nsis|setup)') -or
      @($installerPaths | Where-Object {
        ($executable -and [string]::Equals($executable, $_, [StringComparison]::OrdinalIgnoreCase)) -or
        ($commandLine -and $commandLine.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0)
      }).Count -gt 0
  } | ForEach-Object {
    [ordered]@{
      name = [string]$_.Name
      processId = [int]$_.ProcessId
      parentProcessId = [int]$_.ParentProcessId
      executablePath = [string]$_.ExecutablePath
      commandLine = [string]$_.CommandLine
    }
  })
  Write-JsonAtomic (Join-Path $EvidenceRoot ("install-diagnostics-$Stage.json")) ([ordered]@{
    installPaths = $paths
    processes = $processes
    registry = $registry
    stage = $Stage
  })
}

function Get-HermesProcesses {
  $matches = @()
  foreach ($process in @(Get-CimInstance Win32_Process)) {
    $name = [string]$process.Name
    $executable = [string]$process.ExecutablePath
    $commandLine = [string]$process.CommandLine
    $isHermesName = $name -match '^Hermes(?:\.exe)?$'
    $isInstalledBinary = $CurrentInstallDir -and $executable.StartsWith($CurrentInstallDir, [StringComparison]::OrdinalIgnoreCase)
    $isLifecycleChild = $commandLine -and $commandLine.IndexOf($StateRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
    if ($isHermesName -or $isInstalledBinary -or $isLifecycleChild) {
      $matches += [ordered]@{ Name = $name; ProcessId = [int]$process.ProcessId }
    }
  }
  return @($matches)
}

function Assert-NoHermesProcesses {
  param([string]$Stage)
  $remaining = @(Get-HermesProcesses)
  Assert-True ($remaining.Count -eq 0) "$Stage left Hermes lifecycle processes running"
}

function Wait-Uninstalled {
  param([string]$InstallDir, [string]$Stage)
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  do {
    $registered = (Test-Path -LiteralPath $ProductKey) -or (Test-Path -LiteralPath $UninstallKey)
    $directoryExists = Test-Path -LiteralPath $InstallDir
    if (-not $registered -and -not $directoryExists) { break }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True (-not (Test-Path -LiteralPath $ProductKey)) "$Stage left the product registry key"
  Assert-True (-not (Test-Path -LiteralPath $UninstallKey)) "$Stage left the uninstall registry key"
  Assert-True (-not (Test-Path -LiteralPath $InstallDir)) "$Stage left the installed app directory"
  Assert-NoHermesProcesses $Stage
  $script:CurrentInstallDir = $null
}

function Invoke-NativeLogged {
  param([string]$Executable, [string[]]$Arguments, [string]$LogName)
  $logPath = Join-Path $EvidenceRoot $LogName
  $nativeOutput = @()
  $exitCode = $null
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Native stderr may contain non-fatal Node/Chromium warnings. Capture it as
    # evidence without allowing ErrorActionPreference=Stop to turn a zero exit
    # code into a PowerShell terminating error.
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = 0
    $nativeOutput = @(& $Executable @Arguments 2>&1)
    $exitCode = $global:LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $nativeLines = @($nativeOutput | ForEach-Object { $_.ToString() })
  if ($nativeLines.Count -gt 0) {
    $nativeLines | Tee-Object -FilePath $logPath
  } else {
    [System.IO.File]::WriteAllText($logPath, '', $Utf8NoBom)
  }
  Assert-True ($exitCode -eq 0) "native command failed with exit code $exitCode; see $LogName"
  return $LogName
}

function Invoke-NsisInstall {
  param([string]$Installer, [string]$LogName)
  $process = Start-Process `
    -FilePath $Installer `
    -ArgumentList @('/S', '/currentuser') `
    -PassThru `
    -Wait `
    -WindowStyle Hidden
  $exitCode = [int]$process.ExitCode
  [System.IO.File]::WriteAllText(
    (Join-Path $EvidenceRoot $LogName),
    "exitCode=$exitCode`narguments=/S /currentuser`n",
    $Utf8NoBom
  )
  Assert-True ($exitCode -eq 0) "NSIS installer failed with exit code $exitCode; see $LogName"
  return $LogName
}

function Install-Exact {
  param([string]$Installer, [string]$LogName)
  Assert-NoHermesProcesses "before $LogName"
  $log = Invoke-NsisInstall $Installer $LogName
  $state = Wait-InstallState $LogName
  $script:CurrentInstallDir = [string]$state.InstallDir
  Protect-InstalledProduct ([string]$state.Binary) $LogName
  $alreadyRecorded = @($RecordedInstallDirs | Where-Object {
    [string]::Equals([string]$_, [string]$state.InstallDir, [StringComparison]::OrdinalIgnoreCase)
  }).Count -gt 0
  if (-not $alreadyRecorded) { [void]$RecordedInstallDirs.Add([string]$state.InstallDir) }
  Assert-NoHermesProcesses "after $LogName"
  Add-Event 'nsis-install-finished' @{ log = $LogName; mechanism = 'exact-full-nsis'; installDir = 'guest-local-app-data' }
  return $state
}

function Assert-InPlaceTransition {
  param([object]$Before, [object]$After, [string]$Stage)
  $beforeDir = [System.IO.Path]::GetFullPath([string]$Before.InstallDir).TrimEnd('\')
  $afterDir = [System.IO.Path]::GetFullPath([string]$After.InstallDir).TrimEnd('\')
  Assert-True ([string]::Equals($beforeDir, $afterDir, [StringComparison]::OrdinalIgnoreCase)) "$Stage installed side-by-side instead of replacing the registered product"
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $beforeDir 'HermesVietnamese.exe')) -or (Join-Path $beforeDir 'HermesVietnamese.exe') -eq [string]$After.Binary) "$Stage left a superseded registered executable"
  Add-Event 'in-place-install-transition' @{ stage = $Stage; sameRegisteredInstallDir = $true }
}

function Uninstall-NsisOnly {
  param([object]$State, [string]$LogName)
  Assert-NoHermesProcesses "before $LogName"
  [void](Invoke-NativeLogged ([string]$State.Uninstaller) @('/S') $LogName)
  Wait-Uninstalled ([string]$State.InstallDir) $LogName
}

function Clear-LifecycleEnvironment {
  foreach ($name in @(
    'HERMES_LIFECYCLE_ACTION', 'HERMES_LIFECYCLE_HERMES_HOME', 'HERMES_LIFECYCLE_USER_DATA',
    'HERMES_LIFECYCLE_EXPECT_TEXT', 'HERMES_LIFECYCLE_SEND_TEXT', 'HERMES_LIFECYCLE_SCREENSHOT',
    'HERMES_LIFECYCLE_EVIDENCE_ROOT', 'HERMES_LIFECYCLE_ISOLATION_MODE',
    'HERMES_LIFECYCLE_REQUIRE_PROVENANCE', 'HERMES_PACKAGED_BINARY_PATH',
    'HERMES_PAYLOAD_TAG', 'HERMES_PAYLOAD_GIT_REF', 'HERMES_RELEASE_CLASS',
    'HERMES_REQUIRE_PACKAGED_CANDIDATE'
  )) {
    Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  }
}

function Invoke-PlaywrightPhase {
  param(
    [string]$Action,
    [string]$Binary,
    [string]$HermesHome,
    [string]$UserData,
    [string]$LogName,
    [bool]$RequireProvenance,
    [string]$ExpectedText = '',
    [string]$SendText = ''
  )
  Assert-GuestPath $HermesHome $StateRoot 'phase HERMES_HOME'
  Assert-GuestPath $UserData $StateRoot 'phase userData'
  New-Item -ItemType Directory -Path $HermesHome -Force | Out-Null
  New-Item -ItemType Directory -Path $UserData -Force | Out-Null
  $node = Join-Path ([string]$Manifest.paths.nodeRuntime) 'node.exe'
  $repo = [string]$Manifest.paths.repo
  $cli = Join-Path $repo 'node_modules\@playwright\test\cli.js'
  $config = Join-Path $repo 'apps\desktop\playwright.config.ts'
  $output = Join-Path $EvidenceRoot ("playwright-" + $Action)
  Assert-True (Test-Path -LiteralPath $node -PathType Leaf) 'pinned guest node.exe is missing'
  Assert-True (Test-Path -LiteralPath $cli -PathType Leaf) 'mapped Playwright CLI is missing'
  Assert-True (Test-Path -LiteralPath $Binary -PathType Leaf) 'installed packaged binary is missing before Playwright'
  Protect-InstalledProduct $Binary "Playwright $Action"
  $env:HERMES_LIFECYCLE_ACTION = $Action
  $env:HERMES_LIFECYCLE_EVIDENCE_ROOT = $EvidenceRoot
  $env:HERMES_LIFECYCLE_ISOLATION_MODE = $IsolationMechanism
  $env:HERMES_LIFECYCLE_HERMES_HOME = $HermesHome
  $env:HERMES_LIFECYCLE_USER_DATA = $UserData
  $env:HERMES_LIFECYCLE_SCREENSHOT = Join-Path $EvidenceRoot ("$Action.png")
  $env:HERMES_LIFECYCLE_REQUIRE_PROVENANCE = $(if ($RequireProvenance) { '1' } else { '0' })
  $env:HERMES_PACKAGED_BINARY_PATH = $Binary
  if (-not [string]::IsNullOrEmpty($ExpectedText)) { $env:HERMES_LIFECYCLE_EXPECT_TEXT = $ExpectedText }
  if (-not [string]::IsNullOrEmpty($SendText)) { $env:HERMES_LIFECYCLE_SEND_TEXT = $SendText }
  if ($RequireProvenance) {
    $env:HERMES_PAYLOAD_TAG = [string]$Manifest.candidate.tag
    $env:HERMES_PAYLOAD_GIT_REF = [string]$Manifest.candidate.commit
    $env:HERMES_RELEASE_CLASS = [string]$Manifest.releaseClass
    $env:HERMES_REQUIRE_PACKAGED_CANDIDATE = '1'
  }
  Push-Location (Join-Path $repo 'apps\desktop')
  try {
    [void](Invoke-NativeLogged $node @(
      $cli, 'test', 'e2e/v32-lifecycle-acceptance.spec.ts',
      "--config=$config", '--workers=1', '--reporter=list', "--output=$output"
    ) $LogName)
  } finally {
    Pop-Location
    Clear-LifecycleEnvironment
  }
  # GUI uninstall hands work to a detached resident-Python/cmd cleanup. Its
  # caller waits for registry, app-tree, and process quiescence separately;
  # treating that bounded handoff as a leak here would race the real product
  # path. Every other phase must be quiescent before it returns.
  if (-not $Action.StartsWith('uninstall-', [StringComparison]::Ordinal)) {
    Assert-NoHermesProcesses "Playwright phase $Action"
  }
  return @($LogName, "$Action.png", "playwright-$Action")
}

function Invoke-PackagedAcceptance {
  param([string]$Binary)
  Protect-InstalledProduct $Binary 'packaged v32 acceptance'
  $node = Join-Path ([string]$Manifest.paths.nodeRuntime) 'node.exe'
  $repo = [string]$Manifest.paths.repo
  $cli = Join-Path $repo 'node_modules\@playwright\test\cli.js'
  $config = Join-Path $repo 'apps\desktop\playwright.config.ts'
  $output = Join-Path $EvidenceRoot 'playwright-packaged-v32'
  $env:HERMES_PACKAGED_BINARY_PATH = $Binary
  $env:HERMES_PAYLOAD_TAG = [string]$Manifest.candidate.tag
  $env:HERMES_PAYLOAD_GIT_REF = [string]$Manifest.candidate.commit
  $env:HERMES_RELEASE_CLASS = [string]$Manifest.releaseClass
  $env:HERMES_REQUIRE_PACKAGED_CANDIDATE = '1'
  Push-Location (Join-Path $repo 'apps\desktop')
  try {
    [void](Invoke-NativeLogged $node @(
      $cli, 'test', 'e2e/v32-packaged-smoke.spec.ts',
      "--config=$config", '--workers=1', '--reporter=list', "--output=$output"
    ) 'packaged-v32.log')
  } finally {
    Pop-Location
    Clear-LifecycleEnvironment
  }
  Assert-NoHermesProcesses 'packaged v32 acceptance'
  return @('packaged-v32.log', 'playwright-packaged-v32')
}

function Write-Sentinels {
  param([string]$HermesHome, [string]$UserData, [string]$Prefix)
  New-Item -ItemType Directory -Path $HermesHome -Force | Out-Null
  New-Item -ItemType Directory -Path $UserData -Force | Out-Null
  $homeFile = Join-Path $HermesHome 'lifecycle-home-sentinel.txt'
  $uiFile = Join-Path $UserData 'lifecycle-ui-sentinel.txt'
  [System.IO.File]::WriteAllText($homeFile, "$Prefix-home`n", $Utf8NoBom)
  [System.IO.File]::WriteAllText($uiFile, "$Prefix-ui`n", $Utf8NoBom)
  return [ordered]@{
    HomeFile = $homeFile
    HomeHash = Get-Sha256 $homeFile
    UiFile = $uiFile
    UiHash = Get-Sha256 $uiFile
  }
}

function Assert-Sentinels {
  param([object]$Sentinels, [string]$Stage)
  Assert-True (Test-Path -LiteralPath $Sentinels.HomeFile -PathType Leaf) "$Stage removed the HERMES_HOME sentinel"
  Assert-True (Test-Path -LiteralPath $Sentinels.UiFile -PathType Leaf) "$Stage removed the userData sentinel"
  Assert-True ((Get-Sha256 $Sentinels.HomeFile) -eq $Sentinels.HomeHash) "$Stage changed the HERMES_HOME sentinel"
  Assert-True ((Get-Sha256 $Sentinels.UiFile) -eq $Sentinels.UiHash) "$Stage changed the userData sentinel"
}

function Damage-RepairFixture {
  param([object]$State)
  Assert-NoHermesProcesses 'before creating repair fixture'
  $component = Join-Path ([string]$State.InstallDir) 'resources\app.asar'
  Assert-True (Test-Path -LiteralPath $component -PathType Leaf) 'repair fixture requires packaged resources/app.asar'
  $original = Get-Item -LiteralPath $component
  # Capture immutable primitives before moving the file. FileInfo is a live
  # filesystem wrapper; reading .Length after Move-Item can refresh the now-
  # missing source path as zero and create a false repair mismatch even when
  # NSIS restored the exact component bytes.
  $originalSize = [Int64]$original.Length
  $originalHash = Get-Sha256 $component
  $quarantineDir = Join-Path $StateRoot 'repair-quarantine'
  $quarantine = Join-Path $quarantineDir 'app.asar'
  New-Item -ItemType Directory -Path $quarantineDir -Force | Out-Null
  Assert-True (-not (Test-Path -LiteralPath $quarantine)) 'repair quarantine is unexpectedly occupied'
  Move-Item -LiteralPath $component -Destination $quarantine
  Assert-True (-not (Test-Path -LiteralPath $component)) 'repair fixture remained healthy after critical component removal'
  Assert-True ((Get-Sha256 $quarantine) -eq $originalHash) 'quarantined repair component changed bytes'
  $proof = [ordered]@{
    component = 'resources/app.asar'
    originalSha256 = $originalHash
    originalSize = $originalSize
    preRepairHealthy = $false
    quarantineSha256 = Get-Sha256 $quarantine
    recoveryPath = 'rerun-exact-candidate-nsis'
  }
  Write-JsonAtomic (Join-Path $EvidenceRoot 'repair-damage.json') $proof
  Add-Event 'repair-fixture-damaged' @{ component = 'resources/app.asar'; preRepairHealthy = $false }
  return [ordered]@{
    Component = $component
    OriginalHash = $originalHash
    OriginalSize = $originalSize
  }
}

function Assert-RepairRestored {
  param([object]$Damage)
  Assert-True (Test-Path -LiteralPath $Damage.Component -PathType Leaf) 'repair did not restore resources/app.asar'
  $restored = Get-Item -LiteralPath $Damage.Component
  Assert-True ($restored.Length -eq $Damage.OriginalSize) 'repair restored resources/app.asar with the wrong size'
  Assert-True ((Get-Sha256 $Damage.Component) -eq $Damage.OriginalHash) 'repair restored resources/app.asar with the wrong bytes'
}

function Get-TreeFingerprint {
  param([string[]]$Roots)
  $lines = @()
  foreach ($root in $Roots) {
    if (-not (Test-Path -LiteralPath $root)) { $lines += "missing|$root"; continue }
    foreach ($file in @(Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($root.TrimEnd('\').Length).TrimStart('\')
      $lines += "$root|$relative|$($file.Length)|$(Get-Sha256 $file.FullName)"
    }
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
  finally { $hasher.Dispose() }
}

function Invoke-GuiUninstall {
  param([string]$Mode, [object]$State, [string]$HermesHome, [string]$UserData)
  [void](Invoke-PlaywrightPhase "uninstall-$Mode" ([string]$State.Binary) $HermesHome $UserData "uninstall-$Mode.log" $true)
  Wait-Uninstalled ([string]$State.InstallDir) "GUI uninstall $Mode"
}

function Get-EvidenceManifest {
  $ignored = @('expected-lifecycle.json', 'host-launch.json', 'host-validation.json', 'lifecycle-result.json')
  $entries = @()
  foreach ($file in @(Get-ChildItem -LiteralPath $EvidenceRoot -File -Recurse | Sort-Object FullName)) {
    $relative = $file.FullName.Substring($EvidenceRoot.TrimEnd('\').Length).TrimStart('\').Replace('\', '/')
    if ($ignored -contains $relative) { continue }
    $entries += [ordered]@{
      path = $relative
      sha256 = Get-Sha256 $file.FullName
      size = [Int64]$file.Length
    }
  }
  Assert-True ($entries.Count -gt 0) 'no lifecycle evidence files were produced'
  return @($entries)
}

function Write-Receipt {
  param([string]$Status, [string]$Failure = '')
  if ($null -eq $Manifest -or [string]::IsNullOrWhiteSpace($EvidenceRoot)) { return }
  $isolation = [ordered]@{
    guestUser = $ExpectedGuest
    hostRegistryReachable = $HostRegistryReachable
    mechanism = $IsolationMechanism
    networkMode = $(if ($IsolationMechanism -eq 'windows-sandbox') { 'disabled' } else { 'product-firewall' })
    productOutboundBlocked = $ProductOutboundBlocked
    registryProbe = $RegistryProbe
  }
  if ($IsolationMechanism -eq 'github-hosted-ephemeral-vm') {
    $isolation.ephemeralVm = $true
    $isolation.firewallRuleCount = $FirewallRuleCount
    $isolation.hypervisorBoundary = $HypervisorBoundary
  }
  $receipt = [ordered]@{
    artifacts = [ordered]@{
      candidate = Get-ArtifactRecord $Manifest.candidate
      previous = Get-ArtifactRecord $Manifest.previous
      rollback = Get-ArtifactRecord $Manifest.rollback
    }
    evidenceManifest = Get-EvidenceManifest
    events = @($Events)
    gates = $Gates
    harnessCommit = [string]$Manifest.harnessCommit
    isolation = $isolation
    runId = [string]$Manifest.runId
    schemaVersion = 1
    status = $Status
  }
  if (-not [string]::IsNullOrWhiteSpace($Failure)) { $receipt.failure = $Failure }
  Write-JsonAtomic (Join-Path $EvidenceRoot 'lifecycle-result.json') $receipt
}

try {
  Assert-True (Test-Path -LiteralPath $ManifestPath -PathType Leaf) 'guest manifest is missing'
  $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  Assert-True ($Manifest.schemaVersion -eq 1) 'unsupported guest manifest schema'
  Assert-True ($null -ne $Manifest.PSObject.Properties['harnessCommit']) 'manifest did not bind the validation harness commit'
  Assert-True ([string]$Manifest.harnessCommit -match '^[0-9a-f]{40}$') 'validation harness commit is malformed'
  $IsolationMechanism = [string]$Manifest.isolation.mechanism
  Assert-True ($IsolationMechanism -in @('windows-sandbox', 'github-hosted-ephemeral-vm')) 'unsupported lifecycle isolation mechanism'

  if ($IsolationMechanism -eq 'windows-sandbox') {
    $expectedMappedPaths = [ordered]@{
      candidate = 'C:\HermesHarness\Input\candidate.exe'
      previous = 'C:\HermesHarness\Input\previous.exe'
      rollback = 'C:\HermesHarness\Input\rollback.exe'
      repo = 'C:\HermesHarness\Repo'
      nodeRuntime = 'C:\HermesHarness\Node'
      evidence = 'C:\HermesHarness\Evidence'
    }
    foreach ($entry in $expectedMappedPaths.GetEnumerator()) {
      Assert-True ([string]$Manifest.paths.($entry.Key) -eq [string]$entry.Value) "manifest path $($entry.Key) is not the fixed Sandbox mapping"
    }
    $ExpectedGuest = 'WDAGUtilityAccount'
    $ExpectedProfile = 'C:\Users\WDAGUtilityAccount'
    $StateRoot = 'C:\HermesLifecycle'
  } else {
    Assert-True ($env:GITHUB_ACTIONS -eq 'true') 'hosted lifecycle is not running in GitHub Actions'
    Assert-True ($env:RUNNER_ENVIRONMENT -eq 'github-hosted') 'hosted lifecycle is not on a GitHub-hosted runner'
    Assert-True ($env:RUNNER_OS -eq 'Windows') 'hosted lifecycle is not on a Windows runner'
    Assert-True (-not [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) 'hosted lifecycle is missing RUNNER_TEMP'
    Assert-True (-not [string]::IsNullOrWhiteSpace($env:RUNNER_TOOL_CACHE)) 'hosted lifecycle is missing RUNNER_TOOL_CACHE'
    foreach ($key in @('candidate', 'previous', 'rollback', 'repo')) {
      Assert-GuestPath ([string]$Manifest.paths.$key) $env:RUNNER_TEMP "hosted $key path"
    }
    Assert-GuestPath ([string]$Manifest.paths.nodeRuntime) $env:RUNNER_TOOL_CACHE 'hosted Node runtime path'
    Assert-GuestPath ([string]$Manifest.paths.evidence) 'C:\HermesEvidence' 'hosted evidence path'
    $ExpectedGuest = [string]$env:USERNAME
    $ExpectedProfile = [System.IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')
    $StateRoot = "C:\HermesLifecycle\$($Manifest.runId)"
    $FirewallGroup = "HermesLifecycle-$($Manifest.runId)"
  }

  $EvidenceRoot = [string]$Manifest.paths.evidence
  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $EvidenceRoot 'lifecycle-result.json'))) 'evidence directory contains a stale lifecycle receipt'

  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $system = Get-CimInstance Win32_ComputerSystem
  $HypervisorBoundary = [bool]($system.Model -match 'Virtual|Sandbox' -or $system.HypervisorPresent)
  Assert-True ($env:USERNAME -eq $ExpectedGuest) 'lifecycle runner account changed during preflight'
  Assert-True ($identity.Name -match ("\\" + [regex]::Escape($ExpectedGuest) + '$')) 'Windows identity does not match the isolated runner account'
  Assert-True ([System.IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\') -eq $ExpectedProfile) 'runner profile does not match the current isolated account'
  Assert-True $HypervisorBoundary 'isolated runner did not prove a virtualized boundary'
  if ($IsolationMechanism -eq 'windows-sandbox') {
    Assert-True ($identity.User.Value -match '-504$') 'Sandbox guest SID does not have the WDAG utility-account RID'
  } else {
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    Assert-True ($principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) 'GitHub-hosted lifecycle runner is not elevated for product firewall isolation'
    Assert-True ($null -ne (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue)) 'GitHub-hosted lifecycle runner lacks Windows Firewall controls'
  }
  Assert-True (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey)) 'disposable guest was not clean before installation'
  Assert-NoHermesProcesses 'initial guest preflight'
  $loadedInteractiveHives = @(Get-ChildItem -LiteralPath Registry::HKEY_USERS | Where-Object {
    $_.PSChildName -match '^S-1-5-21-(?:\d+-){3}\d+$'
  } | ForEach-Object { $_.PSChildName })
  $foreignInteractiveHives = @($loadedInteractiveHives | Where-Object { $_ -ne $identity.User.Value })
  $volatileProfile = [string](Get-ItemProperty -LiteralPath 'HKCU:\Volatile Environment').USERPROFILE
  Assert-True (Test-Path -LiteralPath ("Registry::HKEY_USERS\" + $identity.User.Value)) 'current guest HKCU hive is not the loaded guest SID hive'
  Assert-True ($foreignInteractiveHives.Count -eq 0) 'a foreign interactive user registry hive is mounted in the isolated runner'
  Assert-True ([System.IO.Path]::GetFullPath($volatileProfile).TrimEnd('\') -eq $ExpectedProfile) 'HKCU volatile profile does not belong to the isolated runner'
  $HostRegistryReachable = $false
  if ($IsolationMechanism -eq 'windows-sandbox') {
    $RegistryProbe = [ordered]@{
      currentHiveMatchesGuestSid = $true
      foreignInteractiveUserHiveCount = 0
      kind = 'loaded-user-hives-and-volatile-profile'
      volatileProfileIsDisposableGuest = $true
    }
  } else {
    $RegistryProbe = [ordered]@{
      currentHiveMatchesGuestSid = $true
      foreignInteractiveUserHiveCount = 0
      kind = 'github-hosted-ephemeral-vm'
      volatileProfileIsCurrentRunner = $true
    }
  }
  Assert-True (-not (Test-Path -LiteralPath $StateRoot)) 'isolated lifecycle state root already exists'
  [void](New-Item -ItemType Directory -Path $StateRoot -Force)
  Add-Gate 'isolatedGuest' @('lifecycle-result.json') @{
    account = $ExpectedGuest
    foreignInteractiveUserHiveCount = 0
    mechanism = $IsolationMechanism
    profile = $(if ($IsolationMechanism -eq 'windows-sandbox') { 'disposable-wdag-profile' } else { 'github-hosted-ephemeral-runner-profile' })
    registryProbe = [string]$RegistryProbe.kind
  }

  if ($IsolationMechanism -eq 'windows-sandbox') {
    $upAdapters = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })
    Assert-True ($upAdapters.Count -eq 0) 'Windows Sandbox networking is not disabled'
    $ProductOutboundBlocked = $true
    Add-Gate 'networkIsolation' @('lifecycle-result.json') @{ mode = 'disabled'; upAdapterCount = 0 }
  }

  $credentialPattern = '(?i)(api[_-]?key|token|secret|password|credential|cookie|authorization)'
  $credentialVariables = @(Get-ChildItem Env: | Where-Object { $_.Name -match $credentialPattern })
  foreach ($variable in $credentialVariables) { Remove-Item -LiteralPath ("Env:" + $variable.Name) -Force }
  $remainingCredentialVariables = @(Get-ChildItem Env: | Where-Object { $_.Name -match $credentialPattern })
  Assert-True ($remainingCredentialVariables.Count -eq 0) 'credential-shaped environment variables remain in the guest'
  Add-Gate 'noCredentialInheritance' @('lifecycle-result.json') @{ scrubbedVariableCount = $credentialVariables.Count }

  Assert-ExactInput ([string]$Manifest.paths.candidate) $Manifest.candidate 'candidate'
  Assert-ExactInput ([string]$Manifest.paths.previous) $Manifest.previous 'previous'
  Assert-ExactInput ([string]$Manifest.paths.rollback) $Manifest.rollback 'rollback'
  Add-Gate 'exactInputs' @('lifecycle-result.json') @{
    candidateSha256 = [string]$Manifest.candidate.sha256
    previousSha256 = [string]$Manifest.previous.sha256
    rollbackSha256 = [string]$Manifest.rollback.sha256
  }
  if ($IsolationMechanism -eq 'github-hosted-ephemeral-vm') {
    Protect-OutboundPrograms @(
      [string]$Manifest.paths.candidate,
      [string]$Manifest.paths.previous,
      [string]$Manifest.paths.rollback
    ) 'exact installer inputs'
    Add-Gate 'networkIsolation' @('lifecycle-result.json') @{
      firewallRuleCount = $FirewallRuleCount
      mode = 'product-firewall'
      scopes = @('Internet', 'LocalSubnet')
    }
  }

  $candidatePath = [string]$Manifest.paths.candidate
  $previousPath = [string]$Manifest.paths.previous
  $rollbackPath = [string]$Manifest.paths.rollback

  # Fresh install and real first-run onboarding use empty, isolated profiles.
  $candidateState = Install-Exact $candidatePath 'fresh-install.log'
  Add-Gate 'freshInstall' @('fresh-install.log') @{ installer = 'candidate'; mechanism = 'exact-full-nsis' }
  $onboardingEvidence = Invoke-PlaywrightPhase 'onboarding' $candidateState.Binary "$StateRoot\onboarding\home" "$StateRoot\onboarding\user-data" 'onboarding.log' $true
  Add-Gate 'onboarding' $onboardingEvidence @{ configuration = 'empty'; providerConfigPreseeded = $false }

  $packagedEvidence = Invoke-PackagedAcceptance $candidateState.Binary
  Add-Gate 'packagedMockRuntime' $packagedEvidence @{ endpoint = 'guest-loopback-only'; runtime = 'installed-resident-payload' }
  Add-Gate 'packagedSessionRelaunch' $packagedEvidence @{ sameProfile = $true }
  $projectSafetyEvidence = Invoke-PlaywrightPhase `
    'project-session-safety' `
    $candidateState.Binary `
    "$StateRoot\project-safety\home" `
    "$StateRoot\project-safety\user-data" `
    'project-session-safety.log' `
    $true `
    'V321_PROJECT_SESSION_SAFETY_ANCHOR'
  Add-Gate 'projectSessionSafety' (@($projectSafetyEvidence) + @('project-session-safety.json')) @{
    activeScopeAfterRelaunch = 'all-projects'
    projectMetadataActions = @('archive', 'delete')
    sessionRowsPreserved = $true
    messageRowsPreserved = $true
  }
  Add-Gate 'uxMessagingBack' $packagedEvidence @{}
  Add-Gate 'uxNewSessionPointer' $packagedEvidence @{}
  Add-Gate 'uxContextMeter' $packagedEvidence @{}
  Add-Gate 'compaction' $packagedEvidence @{ command = '/compress' }
  $toolEvidence = Invoke-PlaywrightPhase 'safe-tool' $candidateState.Binary "$StateRoot\fresh-tool\home" "$StateRoot\fresh-tool\user-data" 'safe-tool.log' $true
  Add-Gate 'safeTool' $toolEvidence @{ tool = 'todo'; endpoint = 'guest-loopback-only' }
  Uninstall-NsisOnly $candidateState 'fresh-lane-cleanup.log'

  # v32 -> v32.1 is the supported offline product path: exact full NSIS in-place.
  # Community prerelease feeds are disabled, so this deliberately makes no
  # claim about an in-app/feed updater.
  $upgradeHome = "$StateRoot\upgrade\home"
  $upgradeUserData = "$StateRoot\upgrade\user-data"
  $v32State = Install-Exact $previousPath 'v32-install.log'
  [void](Invoke-PlaywrightPhase 'seed-v32' $v32State.Binary $upgradeHome $upgradeUserData 'v32-seed.log' $false '' 'V32_LIFECYCLE_ANCHOR')
  $upgradeSentinels = Write-Sentinels $upgradeHome $upgradeUserData 'v32-to-v321'
  $candidateState = Install-Exact $candidatePath 'v32-to-v321-nsis-update.log'
  Assert-InPlaceTransition $v32State $candidateState 'v32 to v32.1 update'
  Assert-Sentinels $upgradeSentinels 'v32 to v32.1 update'
  $updateEvidence = Invoke-PlaywrightPhase 'verify-update' $candidateState.Binary $upgradeHome $upgradeUserData 'v32-to-v321-verify.log' $true 'V32_LIFECYCLE_ANCHOR'
  Add-Gate 'v32ToV321Update' (@('v32-install.log', 'v32-seed.log', 'v32-to-v321-nsis-update.log') + $updateEvidence) @{
    from = [string]$Manifest.previous.tag
    mechanism = 'full-nsis-in-place'
    sameRegisteredInstallDir = $true
    to = [string]$Manifest.candidate.tag
    updateFeedClaimed = $false
  }

  $repairDamage = Damage-RepairFixture $candidateState
  $candidateState = Install-Exact $candidatePath 'candidate-repair.log'
  Assert-RepairRestored $repairDamage
  Assert-Sentinels $upgradeSentinels 'candidate repair'
  $repairEvidence = Invoke-PlaywrightPhase 'verify-repair' $candidateState.Binary $upgradeHome $upgradeUserData 'candidate-repair-verify.log' $true 'V32_LIFECYCLE_ANCHOR' 'V321_REPAIR_RECOVERED'
  Add-Gate 'repair' (@('repair-damage.json', 'candidate-repair.log') + $repairEvidence) @{
    component = 'resources/app.asar'
    mechanism = 'full-nsis-reinstall-repair'
    preRepairHealthy = $false
    preservedData = $true
    restoredExactBytes = $true
  }

  Invoke-GuiUninstall 'lite' $candidateState $upgradeHome $upgradeUserData
  Assert-Sentinels $upgradeSentinels 'keep-data uninstall'
  $candidateState = Install-Exact $candidatePath 'keep-data-reinstall.log'
  $liteEvidence = Invoke-PlaywrightPhase 'verify-lite-reinstall' $candidateState.Binary $upgradeHome $upgradeUserData 'keep-data-reinstall-verify.log' $true 'V32_LIFECYCLE_ANCHOR' 'V321_KEEP_DATA_REINSTALL'
  Add-Gate 'uninstallKeepData' (@('uninstall-lite.log', 'keep-data-reinstall.log') + $liteEvidence) @{
    control = 'installed-app-settings-about'
    mode = 'lite'
    reinstallVerified = $true
  }

  Invoke-GuiUninstall 'full' $candidateState $upgradeHome $upgradeUserData
  Assert-True (-not (Test-Path -LiteralPath $upgradeHome)) 'delete-data uninstall left HERMES_HOME'
  Assert-True (-not (Test-Path -LiteralPath $upgradeUserData)) 'delete-data uninstall left Electron userData'
  Add-Gate 'uninstallDeleteData' @('uninstall-full.log', 'uninstall-full.png', 'playwright-uninstall-full') @{
    control = 'installed-app-settings-about'
    mode = 'full'
  }

  # Roll back the installed product while protecting the v32.1 profile. The old
  # binary launches against a fresh rollback profile, never the newer schema.
  $v321Home = "$StateRoot\rollback\v321-home"
  $v321UserData = "$StateRoot\rollback\v321-user-data"
  $candidateState = Install-Exact $candidatePath 'rollback-v321-install.log'
  [void](Invoke-PlaywrightPhase 'seed-v321-rollback' $candidateState.Binary $v321Home $v321UserData 'rollback-v321-seed.log' $true '' 'V321_ROLLBACK_PROTECTED_ANCHOR')
  $v321Sentinels = Write-Sentinels $v321Home $v321UserData 'protected-v321'
  $beforeRollbackFingerprint = Get-TreeFingerprint @($v321Home, $v321UserData)
  $rollbackState = Install-Exact $rollbackPath 'rollback-vi39-install.log'
  Assert-InPlaceTransition $candidateState $rollbackState 'v32.1 to vi39 rollback'
  Assert-Sentinels $v321Sentinels 'vi39 rollback install'
  $rollbackEvidence = Invoke-PlaywrightPhase 'verify-rollback' $rollbackState.Binary "$StateRoot\rollback\vi39-home" "$StateRoot\rollback\vi39-user-data" 'rollback-vi39-verify.log' $false '' 'VI39_ROLLBACK_LAUNCH'
  $afterRollbackFingerprint = Get-TreeFingerprint @($v321Home, $v321UserData)
  Assert-True ($beforeRollbackFingerprint -eq $afterRollbackFingerprint) 'vi39 rollback changed the protected v32.1 profile'
  Add-Gate 'rollbackVi39' (@('rollback-v321-install.log', 'rollback-v321-seed.log', 'rollback-vi39-install.log') + $rollbackEvidence) @{
    from = [string]$Manifest.candidate.tag
    protectedV321Profile = $true
    rollbackProfile = 'fresh'
    sameRegisteredInstallDir = $true
    to = [string]$Manifest.rollback.tag
  }

  Uninstall-NsisOnly $rollbackState 'rollback-final-cleanup.log'
  Assert-NoHermesProcesses 'final lifecycle cleanup'
  foreach ($recordedDir in @($RecordedInstallDirs)) {
    Assert-True (-not (Test-Path -LiteralPath ([string]$recordedDir))) 'final cleanup left a recorded Hermes install directory'
  }
  Assert-True (-not (Test-Path -LiteralPath $ProductKey) -and -not (Test-Path -LiteralPath $UninstallKey)) 'final cleanup left Hermes product registration'
  Add-Gate 'noResidualProcesses' @('rollback-final-cleanup.log', 'lifecycle-result.json') @{
    guestProcessCount = 0
    productRegistryPresent = $false
  }
  Write-Receipt 'passed'
} catch {
  $failure = $_.Exception.Message
  try {
    Add-Event 'failed-closed' @{ message = $failure }
    if ($null -ne $Manifest -and -not [string]::IsNullOrWhiteSpace($EvidenceRoot)) {
      New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
      [System.IO.File]::WriteAllText(
        (Join-Path $EvidenceRoot 'lifecycle-failure.txt'),
        "$failure`n$($_ | Out-String)`n",
        $Utf8NoBom
      )
      Write-Receipt 'failed' $failure
    }
  } catch {
    # The host will still fail closed if a receipt cannot be written.
  }
  Write-Error "Windows lifecycle guest failed closed: $failure"
  exit 1
} finally {
  if ($IsolationMechanism -eq 'windows-sandbox') {
    Start-Process -FilePath "$env:WINDIR\System32\shutdown.exe" -ArgumentList @('/s', '/t', '0', '/f') -WindowStyle Hidden -ErrorAction SilentlyContinue
  }
}
