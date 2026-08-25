import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const V32_IDENTITY = Object.freeze({
  tag: 'vi-v0.32.0-1',
  commit: '81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f',
  releaseClass: 'community-prerelease',
  version: '0.32.0-vi.1',
  artifact: 'Hermes-Vietnamese-Windows-x64-Setup.exe',
  size: 341176379,
  sha256: 'efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac'
})

export const V32_LIFECYCLE_GATES = Object.freeze([
  'isolatedGuest',
  'noCredentialInheritance',
  'exactInputs',
  'networkIsolation',
  'freshInstall',
  'onboarding',
  'packagedMockRuntime',
  'packagedSessionRelaunch',
  'uxMessagingBack',
  'uxNewSessionPointer',
  'uxContextMeter',
  'compaction',
  'safeTool',
  'v31ToV32Update',
  'repair',
  'uninstallKeepData',
  'uninstallDeleteData',
  'rollbackVi39',
  'noResidualProcesses'
])

const REQUIRED_ASSETS = Object.freeze([
  V32_IDENTITY.artifact,
  'SHA256SUMS.txt',
  'candidate-provenance.json',
  'pilot-release-evidence.json'
])

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sameMembers(actual, expected, label) {
  const left = [...actual].sort()
  const right = [...expected].sort()
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label} mismatch: ${JSON.stringify(left)}`)
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function parseManifest(bytes) {
  const records = new Map()
  for (const line of String(bytes).trim().split(/\r?\n/u)) {
    const match = /^([0-9a-f]{64})  ([^/\\]+)$/u.exec(line)
    if (!match || records.has(match[2])) throw new Error(`invalid SHA256SUMS line: ${line}`)
    records.set(match[2], match[1])
  }
  return records
}

function findOne(root, filename) {
  const found = []
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      const stat = fs.lstatSync(full)
      if (stat.isSymbolicLink()) throw new Error(`symlink is forbidden in promotion input: ${full}`)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile() && entry.name === filename) found.push(full)
      else if (!entry.isFile()) throw new Error(`unsupported promotion input: ${full}`)
    }
  }
  visit(root)
  if (found.length !== 1) throw new Error(`expected one ${filename}, found ${found.length}`)
  return found[0]
}

function requireIdentity(record, label) {
  for (const field of ['tag', 'commit', 'releaseClass']) {
    if (record?.[field] !== V32_IDENTITY[field]) throw new Error(`${label} ${field} mismatch`)
  }
}

function validateReceipt(lifecycleDir, evidence, run, artifacts) {
  const receiptPath = findOne(lifecycleDir, 'lifecycle-result.json')
  const hostPath = findOne(lifecycleDir, 'host-validation.json')
  const receipt = readJson(receiptPath)
  const host = readJson(hostPath)
  const receiptRoot = path.dirname(receiptPath)

  if (receipt.status !== 'passed' || host.status !== 'passed') throw new Error('lifecycle receipt is not passed')
  if (receipt.harnessCommit !== evidence.lifecycle.harnessCommit) throw new Error('harness commit mismatch')
  if (
    receipt.artifacts?.candidate?.tag !== V32_IDENTITY.tag ||
    receipt.artifacts?.candidate?.commit !== V32_IDENTITY.commit
  ) {
    throw new Error('lifecycle candidate identity mismatch')
  }
  if (receipt.artifacts.candidate.size !== V32_IDENTITY.size) throw new Error('lifecycle candidate size mismatch')
  if (receipt.artifacts.candidate.sha256 !== V32_IDENTITY.sha256) throw new Error('lifecycle candidate SHA mismatch')

  const gateNames = Object.keys(receipt.gates ?? {})
  sameMembers(gateNames, V32_LIFECYCLE_GATES, 'lifecycle gates')
  sameMembers(host.requiredGates ?? [], V32_LIFECYCLE_GATES, 'host lifecycle gates')
  for (const gate of V32_LIFECYCLE_GATES) {
    if (receipt.gates[gate]?.status !== 'passed') throw new Error(`lifecycle gate not passed: ${gate}`)
  }

  const manifest = receipt.evidenceManifest ?? []
  if (manifest.length !== host.evidenceFileCount) throw new Error('lifecycle evidence count mismatch')
  for (const entry of manifest) {
    const file = path.join(receiptRoot, entry.path)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
      throw new Error(`missing lifecycle evidence: ${entry.path}`)
    if (fs.statSync(file).size !== entry.size) throw new Error(`lifecycle evidence size mismatch: ${entry.path}`)
    if (sha256File(file) !== entry.sha256) throw new Error(`lifecycle evidence hash mismatch: ${entry.path}`)
  }
  if (sha256File(receiptPath) !== host.receiptSha256) throw new Error('lifecycle host seal mismatch')
  if (sha256File(hostPath) !== evidence.lifecycle.hostValidationSha256) {
    throw new Error('host validation SHA mismatch')
  }

  if (String(run.id) !== String(evidence.lifecycle.runId)) throw new Error('lifecycle run ID mismatch')
  if (run.name !== 'Kiểm thử runtime artifact Hermes Vietnamese' || run.conclusion !== 'success') {
    throw new Error('lifecycle workflow is not successful')
  }
  if (run.head_sha !== evidence.lifecycle.harnessCommit) throw new Error('lifecycle run head mismatch')

  const actionArtifact = (artifacts.artifacts ?? []).find(item => item.id === evidence.lifecycle.artifactId)
  if (!actionArtifact || actionArtifact.expired) throw new Error('lifecycle action artifact is missing or expired')
  if (
    actionArtifact.name !== evidence.lifecycle.artifactName ||
    actionArtifact.digest !== evidence.lifecycle.artifactDigest
  ) {
    throw new Error('lifecycle action artifact identity mismatch')
  }
}

export function validateV32PromotionBundle({
  candidateDir,
  lifecycleDir,
  release,
  run,
  artifacts,
  expectedManifestSha,
  expectedRunId,
  expectedState,
  notesPath = '.github/release-notes-vietnamese.md',
  publicReleasePath = '.github/public-release.json'
}) {
  const localNames = fs.readdirSync(candidateDir, { withFileTypes: true })
  if (localNames.some(entry => !entry.isFile())) throw new Error('draft candidate inventory must contain files only')
  sameMembers(
    localNames.map(entry => entry.name),
    REQUIRED_ASSETS,
    'draft candidate inventory'
  )

  const manifestPath = path.join(candidateDir, 'SHA256SUMS.txt')
  const manifestSha = sha256File(manifestPath)
  if (manifestSha !== expectedManifestSha) throw new Error('promotion manifest SHA mismatch')
  const checksums = parseManifest(fs.readFileSync(manifestPath, 'utf8'))
  sameMembers(checksums.keys(), [V32_IDENTITY.artifact, 'candidate-provenance.json'], 'manifest inventory')
  for (const [filename, expectedHash] of checksums) {
    if (sha256File(path.join(candidateDir, filename)) !== expectedHash)
      throw new Error(`draft hash mismatch: ${filename}`)
  }
  const installer = fs.statSync(path.join(candidateDir, V32_IDENTITY.artifact))
  if (installer.size !== V32_IDENTITY.size || checksums.get(V32_IDENTITY.artifact) !== V32_IDENTITY.sha256) {
    throw new Error('exact candidate byte mismatch')
  }

  const provenance = readJson(path.join(candidateDir, 'candidate-provenance.json'))
  const evidence = readJson(path.join(candidateDir, 'pilot-release-evidence.json'))
  requireIdentity(provenance, 'candidate provenance')
  requireIdentity(evidence, 'pilot evidence')
  if (provenance.version !== V32_IDENTITY.version || evidence.policy !== 'v32-technical-go') {
    throw new Error('v32 provenance policy mismatch')
  }
  if (
    String(provenance.runId) !== String(expectedRunId) ||
    String(evidence.lifecycle?.runId) !== String(expectedRunId)
  ) {
    throw new Error('v32 lifecycle run mismatch')
  }
  if (evidence.sha256sumsSha256 !== expectedManifestSha) throw new Error('pilot evidence manifest mismatch')
  if (evidence.candidate?.size !== V32_IDENTITY.size || evidence.candidate?.sha256 !== V32_IDENTITY.sha256) {
    throw new Error('pilot evidence candidate mismatch')
  }
  sameMembers(evidence.lifecycle?.requiredGates ?? [], V32_LIFECYCLE_GATES, 'pilot lifecycle gates')

  if (release.id !== 376211316 || release.tag_name !== V32_IDENTITY.tag || release.name !== 'Hermes Vietnamese v32.0') {
    throw new Error('GitHub release identity mismatch')
  }
  const expectedReleaseState =
    expectedState === 'draft'
      ? { draft: true, prerelease: true }
      : expectedState === 'latest'
        ? { draft: false, prerelease: false }
        : null
  if (
    !expectedReleaseState ||
    release.draft !== expectedReleaseState.draft ||
    release.prerelease !== expectedReleaseState.prerelease
  ) {
    throw new Error(`GitHub release state mismatch: ${expectedState}`)
  }
  const expectedBody = fs.readFileSync(notesPath, 'utf8').replace(/\r\n?/gu, '\n').replace(/\n+$/gu, '')
  const actualBody = String(release.body ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/\n+$/gu, '')
  if (actualBody !== expectedBody) throw new Error('GitHub release notes mismatch')
  for (const disclosure of [
    'Windows x64: exact-artifact smoke đạt',
    'Chưa có smoke trên máy người dùng',
    'SignPath',
    'chưa tham gia Apple Developer Program'
  ]) {
    if (!actualBody.includes(disclosure)) throw new Error(`missing v32 disclosure: ${disclosure}`)
  }

  sameMembers(
    (release.assets ?? []).map(asset => asset.name),
    REQUIRED_ASSETS,
    'GitHub release assets'
  )
  for (const asset of release.assets) {
    const file = path.join(candidateDir, asset.name)
    if (asset.size !== fs.statSync(file).size || asset.digest !== `sha256:${sha256File(file)}`) {
      throw new Error(`GitHub release asset mismatch: ${asset.name}`)
    }
  }

  const publicRelease = readJson(publicReleasePath)
  if (
    publicRelease.tag !== V32_IDENTITY.tag ||
    publicRelease.releaseClass !== 'community-pilot' ||
    publicRelease.artifactProvenanceClass !== V32_IDENTITY.releaseClass
  ) {
    throw new Error('public v32 release identity mismatch')
  }
  if (
    publicRelease.windowsX64?.filename !== V32_IDENTITY.artifact ||
    publicRelease.windowsX64?.size !== V32_IDENTITY.size ||
    publicRelease.windowsX64?.sha256 !== V32_IDENTITY.sha256
  ) {
    throw new Error('public v32 Windows identity mismatch')
  }
  sameMembers(publicRelease.downloadFiles ?? [], [V32_IDENTITY.artifact], 'public v32 downloads')

  validateReceipt(lifecycleDir, evidence, run, artifacts)
  return { status: 'passed', releaseId: release.id, manifestSha, lifecycleRunId: String(expectedRunId) }
}

function main() {
  const [candidateDir, lifecycleDir, releasePath, runPath, artifactsPath, manifestSha, runId, state] =
    process.argv.slice(2)
  if (
    !candidateDir ||
    !lifecycleDir ||
    !releasePath ||
    !runPath ||
    !artifactsPath ||
    !manifestSha ||
    !runId ||
    !state
  ) {
    throw new Error(
      'usage: validate-v32-promotion.mjs <candidate-dir> <lifecycle-dir> <release.json> <run.json> <artifacts.json> <manifest-sha> <run-id> <draft|latest>'
    )
  }
  const result = validateV32PromotionBundle({
    candidateDir: path.resolve(candidateDir),
    lifecycleDir: path.resolve(lifecycleDir),
    release: readJson(releasePath),
    run: readJson(runPath),
    artifacts: readJson(artifactsPath),
    expectedManifestSha: manifestSha,
    expectedRunId: runId,
    expectedState: state
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
