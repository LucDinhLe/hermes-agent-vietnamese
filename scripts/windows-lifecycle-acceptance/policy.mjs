const SHA256_RE = /^[0-9a-f]{64}$/
const COMMIT_RE = /^[0-9a-f]{40}$/

export const V321_CANDIDATE_TAG = 'vi-v0.32.1-13'
export const V32_SOURCE_TAG = 'vi-v0.32.0-1'
export const ROLLBACK_TAG = 'vi-v0.20.4-39'
export const V32_SOURCE_COMMIT = '81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f'
export const V32_SOURCE_SHA256 = 'efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac'
export const V32_SOURCE_SIZE = 341_176_379
export const ROLLBACK_COMMIT = 'd270974d2651e72f169fffe34c955eeae7977458'
export const ROLLBACK_SHA256 = 'e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31'
export const ROLLBACK_SIZE = 340_105_286
// Official Node.js v26.5.1 signed SHASUMS256.txt entry for win-x64/node.exe.
// The lifecycle guest executes this host-mapped binary, so version/arch alone
// are not a sufficient provenance boundary.
export const WINDOWS_LIFECYCLE_NODE_VERSION = 'v26.5.1'
export const WINDOWS_LIFECYCLE_NODE_SHA256 = 'b48b0224081224cda1f49374e2fc63d143041ade51754f0cc6608fe8510ba29e'

export const REQUIRED_LIFECYCLE_GATES = Object.freeze([
  'isolatedGuest',
  'networkIsolation',
  'exactInputs',
  'noCredentialInheritance',
  'freshInstall',
  'onboarding',
  'packagedMockRuntime',
  'packagedSessionRelaunch',
  'projectSessionSafety',
  'uxMessagingBack',
  'uxNewSessionPointer',
  'uxContextMeter',
  'compaction',
  'safeTool',
  'v32ToV321Update',
  'repair',
  'uninstallKeepData',
  'uninstallDeleteData',
  'rollbackVi39',
  'noResidualProcesses'
])

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

function validateArtifact(
  artifact,
  label,
  expectedTag,
  {
    expectedCommit = null,
    expectedSha256 = null,
    expectedSize = null,
    identitySource = null,
    requireCommit = false
  } = {}
) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error(`${label} artifact descriptor is required`)
  }

  const tag = requireString(artifact.tag, `${label}.tag`)
  const fileName = requireString(artifact.fileName, `${label}.fileName`)
  const sha256 = requireString(artifact.sha256, `${label}.sha256`).toLowerCase()
  const size = Number(artifact.size)

  if (tag !== expectedTag) {
    throw new Error(`${label}.tag must be ${expectedTag}, got ${tag}`)
  }
  if (!SHA256_RE.test(sha256)) {
    throw new Error(`${label}.sha256 must be a lowercase 64-character SHA-256`)
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error(`${label}.size must be a positive integer`)
  }
  if (!fileName.toLowerCase().endsWith('.exe') || /[\\/]/.test(fileName)) {
    throw new Error(`${label}.fileName must be one Windows installer basename`)
  }
  if (expectedSha256 && sha256 !== expectedSha256) {
    throw new Error(`${label}.sha256 does not match the pinned ${expectedTag} Windows x64 installer`)
  }
  if (expectedSize && size !== expectedSize) {
    throw new Error(`${label}.size does not match the pinned ${expectedTag} Windows x64 installer`)
  }

  const normalized = { fileName, sha256, size, tag }
  if (requireCommit || expectedCommit) {
    const commit = requireString(artifact.commit, `${label}.commit`)
    if (!COMMIT_RE.test(commit)) {
      throw new Error(`${label}.commit must be a full lowercase 40-character commit SHA`)
    }
    if (expectedCommit && commit !== expectedCommit) {
      throw new Error(`${label}.commit does not match the pinned ${expectedTag} source commit`)
    }
    normalized.commit = commit
  }
  if (identitySource) normalized.identitySource = identitySource

  return Object.freeze(normalized)
}

export function validateLifecycleDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new Error('lifecycle descriptor is required')
  }
  if (descriptor.schemaVersion !== 1) {
    throw new Error('lifecycle descriptor schemaVersion must be 1')
  }
  if (descriptor.releaseClass !== 'community-prerelease') {
    throw new Error('v32.1 lifecycle acceptance requires releaseClass=community-prerelease')
  }

  const runId = requireString(descriptor.runId, 'runId')
  if (!/^[0-9a-f-]{20,64}$/.test(runId)) {
    throw new Error('runId must be a generated lowercase identifier')
  }

  const harnessCommit = requireString(descriptor.harnessCommit, 'harnessCommit')
  if (!COMMIT_RE.test(harnessCommit)) {
    throw new Error('harnessCommit must be a full lowercase 40-character commit SHA')
  }

  // The candidate commit is supplied by the exact tag binding at runtime. It
  // cannot be hard-coded in the same source commit that contains this harness
  // without creating a circular self-hash. Requiring a full commit here and
  // checking tag -> checkout -> descriptor equality in the workflow preserves
  // the immutable provenance boundary.
  const candidate = validateArtifact(descriptor.candidate, 'candidate', V321_CANDIDATE_TAG, {
    requireCommit: true
  })
  const previous = validateArtifact(descriptor.previous, 'previous', V32_SOURCE_TAG, {
    expectedCommit: V32_SOURCE_COMMIT,
    expectedSha256: V32_SOURCE_SHA256,
    expectedSize: V32_SOURCE_SIZE,
    identitySource: 'immutable-public-v32'
  })
  const rollback = validateArtifact(descriptor.rollback, 'rollback', ROLLBACK_TAG, {
    expectedCommit: ROLLBACK_COMMIT,
    expectedSha256: ROLLBACK_SHA256,
    expectedSize: ROLLBACK_SIZE,
    identitySource: 'verified-v31-release-audit'
  })
  if (new Set([candidate.sha256, previous.sha256, rollback.sha256]).size !== 3) {
    throw new Error('candidate, previous and rollback installers must be three distinct byte streams')
  }

  return Object.freeze({
    candidate,
    harnessCommit,
    previous,
    releaseClass: descriptor.releaseClass,
    rollback,
    runId,
    schemaVersion: 1
  })
}

export function assertSupportedWindowsSandboxHost({ arch, nodeVersion, platform, sandboxExecutableExists }) {
  if (platform !== 'win32' || arch !== 'x64') {
    throw new Error(`Windows x64 lifecycle acceptance requires win32/x64, got ${platform}/${arch}`)
  }
  const major = Number(
    String(nodeVersion || '')
      .replace(/^v/, '')
      .split('.')[0]
  )
  if (!Number.isInteger(major) || major < 26) {
    throw new Error(`Windows lifecycle acceptance requires Node 26+, got ${nodeVersion || '(missing)'}`)
  }
  if (!sandboxExecutableExists) {
    throw new Error('Windows Sandbox is unavailable; lifecycle acceptance cannot run safely on this host')
  }
  return true
}

export function assertSupportedGithubHostedWindowsRunner({
  arch,
  githubActions,
  hypervisorPresent,
  model,
  nodeVersion,
  platform,
  runnerEnvironment,
  runnerOs
}) {
  if (platform !== 'win32' || arch !== 'x64') {
    throw new Error(`GitHub hosted lifecycle acceptance requires win32/x64, got ${platform}/${arch}`)
  }
  const major = Number(
    String(nodeVersion || '')
      .replace(/^v/, '')
      .split('.')[0]
  )
  if (!Number.isInteger(major) || major < 26) {
    throw new Error(`GitHub hosted lifecycle acceptance requires Node 26+, got ${nodeVersion || '(missing)'}`)
  }
  if (githubActions !== 'true' || runnerEnvironment !== 'github-hosted' || runnerOs !== 'Windows') {
    throw new Error('lifecycle runner did not prove the GitHub-hosted Windows environment contract')
  }
  if (hypervisorPresent !== true && !/virtual/i.test(String(model || ''))) {
    throw new Error('GitHub-hosted lifecycle runner did not prove a virtual-machine boundary')
  }
  return true
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function mappedFolder(hostFolder, sandboxFolder, readOnly) {
  return `    <MappedFolder>
      <HostFolder>${xmlEscape(hostFolder)}</HostFolder>
      <SandboxFolder>${xmlEscape(sandboxFolder)}</SandboxFolder>
      <ReadOnly>${readOnly ? 'true' : 'false'}</ReadOnly>
    </MappedFolder>`
}

export function buildWindowsSandboxConfig({ evidenceDir, inputDir, nodeRuntimeDir, repoSnapshotDir }) {
  for (const [label, value] of Object.entries({
    evidenceDir,
    inputDir,
    nodeRuntimeDir,
    repoSnapshotDir
  })) {
    requireString(value, label)
  }

  const folders = [
    mappedFolder(inputDir, 'C:\\HermesHarness\\Input', true),
    mappedFolder(repoSnapshotDir, 'C:\\HermesHarness\\Repo', true),
    mappedFolder(nodeRuntimeDir, 'C:\\HermesHarness\\Node', true),
    mappedFolder(evidenceDir, 'C:\\HermesHarness\\Evidence', false)
  ].join('\n')

  const command =
    'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass ' +
    '-File "C:\\HermesHarness\\Input\\guest.ps1" ' +
    '-ManifestPath "C:\\HermesHarness\\Input\\manifest.json"'

  return `<?xml version="1.0" encoding="utf-8"?>
<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>Disable</Networking>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <ProtectedClient>Enable</ProtectedClient>
  <MemoryInMB>8192</MemoryInMB>
  <MappedFolders>
${folders}
  </MappedFolders>
  <LogonCommand>
    <Command>${xmlEscape(command)}</Command>
  </LogonCommand>
</Configuration>
`
}

function assertSameArtifact(actual, expected, label) {
  for (const field of ['tag', 'fileName', 'sha256', 'size', 'identitySource']) {
    if (actual?.[field] !== expected[field]) {
      throw new Error(`${label}.${field} mismatch; expected ${expected[field]}, got ${actual?.[field]}`)
    }
  }
  if (expected.commit && actual?.commit !== expected.commit) {
    throw new Error(`${label}.commit mismatch; expected ${expected.commit}, got ${actual?.commit}`)
  }
}

function normalizeRelativeEvidencePath(value, label) {
  const relativePath = requireString(value, label).replaceAll('\\', '/')
  if (
    pathLooksAbsolute(relativePath) ||
    relativePath.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} must be a normalized relative evidence path`)
  }
  return relativePath
}

function validateEvidenceManifest(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('lifecycle receipt must contain a non-empty evidence manifest')
  }

  const paths = new Set()
  for (const [index, entry] of manifest.entries()) {
    const label = `evidenceManifest[${index}]`
    const relativePath = normalizeRelativeEvidencePath(entry?.path, `${label}.path`)
    const sha256 = requireString(entry?.sha256, `${label}.sha256`).toLowerCase()
    const size = Number(entry?.size)
    if (!SHA256_RE.test(sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256`)
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`${label}.size must be a non-negative integer`)
    if (paths.has(relativePath)) throw new Error(`duplicate evidence manifest path: ${relativePath}`)
    paths.add(relativePath)
  }

  return manifest
}

function pathLooksAbsolute(value) {
  return value.startsWith('/') || /^[a-zA-Z]:/.test(value)
}

export function validateLifecycleReceipt(receipt, descriptor) {
  const expected = validateLifecycleDescriptor(descriptor)
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('lifecycle result receipt is required')
  }
  if (receipt.schemaVersion !== 1 || receipt.runId !== expected.runId) {
    throw new Error('lifecycle result does not belong to this run')
  }
  if (receipt.status !== 'passed') {
    throw new Error(`lifecycle result is not passed: ${receipt.status || '(missing)'}`)
  }
  if (receipt.harnessCommit !== expected.harnessCommit) {
    throw new Error('lifecycle result does not match the expected validation harness commit')
  }

  const isolation = receipt.isolation
  if (isolation?.mechanism === 'windows-sandbox') {
    if (isolation.guestUser !== 'WDAGUtilityAccount') {
      throw new Error('lifecycle result did not run as the Windows Sandbox guest account')
    }
    if (
      isolation.networkMode !== 'disabled' ||
      isolation.productOutboundBlocked !== true ||
      isolation.hostRegistryReachable !== false ||
      receipt.gates?.networkIsolation?.detail?.mode !== 'disabled'
    ) {
      throw new Error('lifecycle result did not prove the Windows Sandbox network/registry boundary')
    }
    if (
      isolation.registryProbe?.kind !== 'loaded-user-hives-and-volatile-profile' ||
      isolation.registryProbe?.currentHiveMatchesGuestSid !== true ||
      isolation.registryProbe?.foreignInteractiveUserHiveCount !== 0 ||
      isolation.registryProbe?.volatileProfileIsDisposableGuest !== true
    ) {
      throw new Error('lifecycle result did not include the active Sandbox registry-isolation probe')
    }
  } else if (isolation?.mechanism === 'github-hosted-ephemeral-vm') {
    if (
      isolation.ephemeralVm !== true ||
      isolation.hypervisorBoundary !== true ||
      isolation.networkMode !== 'product-firewall' ||
      isolation.productOutboundBlocked !== true ||
      isolation.hostRegistryReachable !== false ||
      !Number.isSafeInteger(isolation.firewallRuleCount) ||
      isolation.firewallRuleCount < 8 ||
      receipt.gates?.networkIsolation?.detail?.mode !== 'product-firewall' ||
      receipt.gates?.networkIsolation?.detail?.firewallRuleCount !== 6 ||
      JSON.stringify(receipt.gates?.networkIsolation?.detail?.scopes) !== JSON.stringify(['Internet', 'LocalSubnet'])
    ) {
      throw new Error('lifecycle result did not prove the GitHub-hosted VM and product-firewall boundary')
    }
    if (
      isolation.registryProbe?.kind !== 'github-hosted-ephemeral-vm' ||
      isolation.registryProbe?.currentHiveMatchesGuestSid !== true ||
      isolation.registryProbe?.foreignInteractiveUserHiveCount !== 0 ||
      isolation.registryProbe?.volatileProfileIsCurrentRunner !== true
    ) {
      throw new Error('lifecycle result did not include the hosted-VM registry-isolation probe')
    }
  } else {
    throw new Error('lifecycle result did not prove a supported disposable Windows isolation mechanism')
  }

  assertSameArtifact(receipt.artifacts?.candidate, expected.candidate, 'candidate')
  assertSameArtifact(receipt.artifacts?.previous, expected.previous, 'previous')
  assertSameArtifact(receipt.artifacts?.rollback, expected.rollback, 'rollback')
  const evidenceManifest = validateEvidenceManifest(receipt.evidenceManifest)
  const evidencePaths = evidenceManifest.map(entry => entry.path.replaceAll('\\', '/'))

  for (const gateName of REQUIRED_LIFECYCLE_GATES) {
    const gate = receipt.gates?.[gateName]
    if (!gate || gate.status !== 'passed') {
      throw new Error(`required lifecycle gate ${gateName} is not passed`)
    }
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
      throw new Error(`required lifecycle gate ${gateName} has no evidence`)
    }
    if (
      (gateName === 'v32ToV321Update' || gateName === 'rollbackVi39') &&
      gate.detail?.sameRegisteredInstallDir !== true
    ) {
      throw new Error(`required lifecycle gate ${gateName} did not prove an in-place registered install transition`)
    }
    for (const [index, rawPath] of gate.evidence.entries()) {
      const evidencePath = normalizeRelativeEvidencePath(rawPath, `${gateName}.evidence[${index}]`)
      const isReceipt = evidencePath === 'lifecycle-result.json'
      const isManifestFileOrDirectory = evidencePaths.some(
        candidate => candidate === evidencePath || candidate.startsWith(`${evidencePath}/`)
      )
      if (!isReceipt && !isManifestFileOrDirectory) {
        throw new Error(`required lifecycle gate ${gateName} references unsealed evidence ${evidencePath}`)
      }
    }
  }
  const nonPassed = Object.entries(receipt.gates || {}).find(([, gate]) => gate?.status !== 'passed')
  if (nonPassed) {
    throw new Error(`lifecycle receipt contains non-passed gate ${nonPassed[0]}`)
  }

  return Object.freeze({ descriptor: expected, receipt })
}
