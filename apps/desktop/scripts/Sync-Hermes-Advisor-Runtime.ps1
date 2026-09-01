[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ExperimentRoot,
  [Parameter(Mandatory = $true)][string]$ProfileRoot,
  [string]$BundleRoot
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($BundleRoot)) {
  $BundleRoot = $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($BundleRoot)) {
  throw 'Không xác định được thư mục bundle runtime của Advisor.'
}
$manifestPath = Join-Path $BundleRoot 'runtime-manifest.json'
$payloadRoot = Join-Path $BundleRoot 'payload'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Thiếu runtime-manifest.json của Advisor.' }
if (-not (Test-Path -LiteralPath $payloadRoot -PathType Container)) { throw 'Thiếu payload runtime của Advisor.' }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.candidateId -or -not $manifest.sourceCommit) { throw 'Runtime manifest không hợp lệ.' }
$runtimesRoot = Join-Path $ExperimentRoot 'runtimes'
$targetRoot = Join-Path $runtimesRoot ([string]$manifest.candidateId)
$receiptPath = Join-Path $targetRoot 'advisor-runtime-receipt.json'
$venvLayout = 'copied-scripts-pth-lib-v2'

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
  } finally { $stream.Dispose() }
}

function Test-RuntimeFiles([string]$Root) {
  foreach ($entry in $manifest.files) {
    $path = Join-Path $Root ([string]$entry.path)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
    if ((Get-Sha256 $path) -ne ([string]$entry.sha256).ToLowerInvariant()) { return $false }
  }
  return $true
}

function Test-VenvLayout([string]$Root) {
  $candidateReceiptPath = Join-Path $Root 'advisor-runtime-receipt.json'
  if (-not (Test-Path -LiteralPath $candidateReceiptPath -PathType Leaf)) { return $false }
  try { $candidateReceipt = Get-Content -LiteralPath $candidateReceiptPath -Raw | ConvertFrom-Json }
  catch { return $false }
  if ([int]$candidateReceipt.schemaVersion -ne 2) { return $false }
  if ([string]$candidateReceipt.venvLayout -ne $venvLayout) { return $false }
  if (-not (Test-Path -LiteralPath (Join-Path $Root '.venv\Scripts\python.exe') -PathType Leaf)) { return $false }
  $bridgePath = Join-Path $Root '.venv\Lib\site-packages\_hermes_legacy_site_packages.pth'
  if (-not (Test-Path -LiteralPath $bridgePath -PathType Leaf)) { return $false }
  return $true
}

function Test-RuntimeCandidate([string]$Root) {
  return (Test-RuntimeFiles $Root) -and (Test-VenvLayout $Root)
}

if (-not (Test-RuntimeCandidate $targetRoot)) {
  if (-not (Test-RuntimeFiles $payloadRoot)) { throw 'Payload Advisor bị sai hash; giữ nguyên runtime cũ.' }
  New-Item -ItemType Directory -Path $runtimesRoot -Force | Out-Null
  $stagingRoot = Join-Path $runtimesRoot ('.s-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
  try {
    Copy-Item -Path (Join-Path $payloadRoot '*') -Destination $stagingRoot -Recurse -Force

    $legacyRoot = Join-Path $ProfileRoot 'hermes-agent'
    $venvSource = @((Join-Path $legacyRoot '.venv'), (Join-Path $legacyRoot 'venv')) |
      Where-Object { Test-Path -LiteralPath $_ -PathType Container } |
      Select-Object -First 1
    if (-not $venvSource) { throw 'Không tìm thấy môi trường Python của Experimental cũ; không đổi runtime.' }
    $venvScripts = Join-Path $venvSource 'Scripts'
    $venvLib = Join-Path $venvSource 'Lib'
    $venvSitePackages = Join-Path $venvLib 'site-packages'
    $venvPython = Join-Path $venvScripts 'python.exe'
    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) { throw 'Môi trường Python Experimental thiếu python.exe.' }
    if (-not (Test-Path -LiteralPath $venvLib -PathType Container)) { throw 'Môi trường Python Experimental thiếu thư viện Lib.' }
    if (-not (Test-Path -LiteralPath $venvSitePackages -PathType Container)) { throw 'Môi trường Python Experimental thiếu site-packages.' }

    $targetVenv = Join-Path $stagingRoot '.venv'
    New-Item -ItemType Directory -Path $targetVenv | Out-Null
    Get-ChildItem -LiteralPath $venvSource -File | Copy-Item -Destination $targetVenv -Force
    Copy-Item -LiteralPath $venvScripts -Destination $targetVenv -Recurse -Force
    $targetSitePackages = Join-Path $targetVenv 'Lib\site-packages'
    New-Item -ItemType Directory -Path $targetSitePackages -Force | Out-Null
    $sitePackagesJson = $venvSitePackages | ConvertTo-Json -Compress
    $bridgeLine = "import site; site.addsitedir($sitePackagesJson)"
    [System.IO.File]::WriteAllText(
      (Join-Path $targetSitePackages '_hermes_legacy_site_packages.pth'),
      "$bridgeLine`n",
      [System.Text.UTF8Encoding]::new($false)
    )

    $receipt = [ordered]@{
      schemaVersion = 2
      candidateId = [string]$manifest.candidateId
      productVersion = [string]$manifest.productVersion
      sourceCommit = [string]$manifest.sourceCommit
      installedAt = (Get-Date).ToUniversalTime().ToString('o')
      manifestSha256 = Get-Sha256 $manifestPath
      venvSource = [string]$venvSource
      venvLayout = $venvLayout
    }
    $receiptJson = $receipt | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText(
      (Join-Path $stagingRoot 'advisor-runtime-receipt.json'),
      $receiptJson,
      [System.Text.UTF8Encoding]::new($false)
    )
    if (-not (Test-RuntimeCandidate $stagingRoot)) { throw 'Runtime Advisor sau khi chép không vượt xác minh.' }
    if (Test-Path -LiteralPath $targetRoot) { throw 'Runtime candidate tồn tại nhưng không hợp lệ; từ chối ghi đè.' }
    Move-Item -LiteralPath $stagingRoot -Destination $targetRoot
  } catch {
    if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
    throw
  }
}

if (-not (Test-RuntimeCandidate $targetRoot)) { throw 'Runtime Advisor hiện hành không vượt xác minh.' }
New-Item -ItemType Directory -Path $ExperimentRoot -Force | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $ExperimentRoot 'runtime-current.txt'), "$targetRoot`n", $utf8NoBom)
Write-Output $targetRoot
