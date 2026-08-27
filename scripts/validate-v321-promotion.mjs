import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  REQUIRED_LIFECYCLE_GATES,
  ROLLBACK_COMMIT,
  ROLLBACK_SHA256,
  ROLLBACK_SIZE,
  ROLLBACK_TAG,
  V32_SOURCE_COMMIT,
  V32_SOURCE_SHA256,
  V32_SOURCE_SIZE,
  V32_SOURCE_TAG,
  V321_CANDIDATE_TAG,
  validateLifecycleReceipt
} from './windows-lifecycle-acceptance/policy.mjs'

export const V321_IDENTITY = Object.freeze({
  tag: V321_CANDIDATE_TAG,
  releaseClass: 'community-prerelease',
  version: '0.32.1-vi.17',
  artifact: 'Hermes-Vietnamese-Windows-x64-Setup.exe'
})

export const V321_RELEASE_ASSETS = Object.freeze([
  V321_IDENTITY.artifact,
  'SHA256SUMS-win32-x64.txt',
  'signing-windows-x64.txt',
  'candidate-provenance.json',
  'SHA256SUMS.txt'
])

const SHA256_RE = /^[0-9a-f]{64}$/u
const COMMIT_RE = /^[0-9a-f]{40}$/u

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

function requireArtifact(record, expected, label) {
  for (const key of ['tag', 'commit', 'size', 'sha256']) {
    if (record?.[key] !== expected[key]) throw new Error(`${label} ${key} mismatch`)
  }
}

function validateLifecycle({ artifacts, candidate, lifecycleDir, lifecycleRunId, run }) {
  const receiptPath = findOne(lifecycleDir, 'lifecycle-result.json')
  const hostPath = findOne(lifecycleDir, 'host-validation.json')
  const projectSafetyPath = findOne(lifecycleDir, 'project-session-safety.json')
  const receipt = readJson(receiptPath)
  const host = readJson(hostPath)
  const projectSafety = readJson(projectSafetyPath)
  const receiptRoot = path.dirname(receiptPath)
  const harnessCommit = String(run.head_sha ?? '')

  if (!COMMIT_RE.test(harnessCommit)) throw new Error('v32.1 lifecycle harness commit must be a full Git SHA')

  validateLifecycleReceipt(receipt, {
    candidate: {
      commit: candidate.commit,
      fileName: V321_IDENTITY.artifact,
      sha256: candidate.sha256,
      size: candidate.size,
      tag: V321_IDENTITY.tag
    },
    harnessCommit,
    previous: {
      commit: V32_SOURCE_COMMIT,
      fileName: V321_IDENTITY.artifact,
      sha256: V32_SOURCE_SHA256,
      size: V32_SOURCE_SIZE,
      tag: V32_SOURCE_TAG
    },
    releaseClass: V321_IDENTITY.releaseClass,
    rollback: {
      commit: ROLLBACK_COMMIT,
      fileName: V321_IDENTITY.artifact,
      sha256: ROLLBACK_SHA256,
      size: ROLLBACK_SIZE,
      tag: ROLLBACK_TAG
    },
    runId: receipt.runId,
    schemaVersion: 1
  })

  if (receipt.status !== 'passed' || host.status !== 'passed') throw new Error('v32.1 lifecycle is not passed')
  if (receipt.harnessCommit !== harnessCommit) throw new Error('v32.1 lifecycle harness commit mismatch')
  requireArtifact(receipt.artifacts?.candidate, { ...candidate, tag: V321_IDENTITY.tag }, 'candidate')
  requireArtifact(
    receipt.artifacts?.previous,
    { commit: V32_SOURCE_COMMIT, sha256: V32_SOURCE_SHA256, size: V32_SOURCE_SIZE, tag: V32_SOURCE_TAG },
    'previous'
  )
  requireArtifact(
    receipt.artifacts?.rollback,
    { commit: ROLLBACK_COMMIT, sha256: ROLLBACK_SHA256, size: ROLLBACK_SIZE, tag: ROLLBACK_TAG },
    'rollback'
  )

  sameMembers(Object.keys(receipt.gates ?? {}), REQUIRED_LIFECYCLE_GATES, 'v32.1 lifecycle gates')
  sameMembers(host.requiredGates ?? [], REQUIRED_LIFECYCLE_GATES, 'host lifecycle gates')
  for (const gate of REQUIRED_LIFECYCLE_GATES) {
    if (receipt.gates[gate]?.status !== 'passed') throw new Error(`v32.1 lifecycle gate not passed: ${gate}`)
  }

  const manifest = receipt.evidenceManifest ?? []
  if (manifest.length !== host.evidenceFileCount) throw new Error('v32.1 evidence count mismatch')
  for (const entry of manifest) {
    const file = path.join(receiptRoot, entry.path)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`missing v32.1 lifecycle evidence: ${entry.path}`)
    }
    if (fs.statSync(file).size !== entry.size) throw new Error(`v32.1 evidence size mismatch: ${entry.path}`)
    if (sha256File(file) !== entry.sha256) throw new Error(`v32.1 evidence hash mismatch: ${entry.path}`)
  }
  if (sha256File(receiptPath) !== host.receiptSha256) throw new Error('v32.1 host receipt seal mismatch')
  if (
    projectSafety.projectDeleteRemoved !== true ||
    projectSafety.projectHideArchived !== true ||
    projectSafety.relaunchScope !== 'all-projects' ||
    projectSafety.sessionArchived !== 0 ||
    projectSafety.sessionHidden !== 0 ||
    !SHA256_RE.test(String(projectSafety.messageDigest ?? '')) ||
    Number(projectSafety.messageCount) < 2
  ) {
    throw new Error('project/session safety evidence is incomplete')
  }

  if (String(run.id) !== String(lifecycleRunId)) throw new Error('v32.1 lifecycle run ID mismatch')
  if (run.name !== 'Kiểm thử runtime artifact Hermes Vietnamese' || run.conclusion !== 'success') {
    throw new Error('v32.1 lifecycle workflow identity is not successful')
  }
  const expectedArtifactName = `v321-windows-lifecycle-${lifecycleRunId}-${run.run_attempt}`
  const matches = (artifacts.artifacts ?? []).filter(item => item.name === expectedArtifactName)
  if (matches.length !== 1 || matches[0].expired || !/^sha256:[0-9a-f]{64}$/u.test(String(matches[0].digest ?? ''))) {
    throw new Error('v32.1 lifecycle action artifact is missing, expired, duplicated, or unsealed')
  }
}

function validatePublicDescriptor(publicRelease, candidate) {
  if (
    publicRelease.tag !== V321_IDENTITY.tag ||
    publicRelease.rollbackTag !== ROLLBACK_TAG ||
    publicRelease.previousTag !== V32_SOURCE_TAG ||
    publicRelease.releaseClass !== 'community-pilot' ||
    publicRelease.artifactProvenanceClass !== V321_IDENTITY.releaseClass ||
    publicRelease.windowsX64?.filename !== V321_IDENTITY.artifact ||
    publicRelease.windowsX64?.authenticode !== 'NotSigned' ||
    publicRelease.windowsX64?.size !== candidate.size ||
    publicRelease.windowsX64?.sha256 !== candidate.sha256
  ) {
    throw new Error('public v32.1 descriptor mismatch')
  }
  sameMembers(publicRelease.downloadFiles ?? [], [V321_IDENTITY.artifact], 'public v32.1 downloads')
}

export function validateV321PromotionBundle({
  artifacts,
  candidate,
  candidateDir,
  expectedManifestSha,
  expectedState,
  lifecycleDir,
  lifecycleRunId,
  release,
  run,
  notesPath = '.github/release-notes-vietnamese.md',
  publicReleasePath = '.github/public-release.json',
  stagingRunId
}) {
  if (!COMMIT_RE.test(candidate.commit)) throw new Error('v32.1 candidate commit must be a full Git SHA')
  if (!SHA256_RE.test(candidate.sha256)) throw new Error('v32.1 candidate digest must be SHA-256')
  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) throw new Error('v32.1 candidate size is invalid')
  if (!SHA256_RE.test(expectedManifestSha)) throw new Error('v32.1 manifest digest must be SHA-256')

  const local = fs.readdirSync(candidateDir, { withFileTypes: true })
  if (local.some(entry => !entry.isFile())) throw new Error('v32.1 draft inventory must contain files only')
  sameMembers(
    local.map(entry => entry.name),
    V321_RELEASE_ASSETS,
    'v32.1 draft inventory'
  )

  const manifestPath = path.join(candidateDir, 'SHA256SUMS.txt')
  if (sha256File(manifestPath) !== expectedManifestSha) throw new Error('v32.1 manifest SHA mismatch')
  const checksums = parseManifest(fs.readFileSync(manifestPath, 'utf8'))
  sameMembers(
    checksums.keys(),
    V321_RELEASE_ASSETS.filter(name => name !== 'SHA256SUMS.txt'),
    'manifest inventory'
  )
  for (const [filename, digest] of checksums) {
    if (sha256File(path.join(candidateDir, filename)) !== digest)
      throw new Error(`v32.1 draft hash mismatch: ${filename}`)
  }
  const installer = fs.statSync(path.join(candidateDir, V321_IDENTITY.artifact))
  if (installer.size !== candidate.size || checksums.get(V321_IDENTITY.artifact) !== candidate.sha256) {
    throw new Error('v32.1 exact candidate byte mismatch')
  }
  const signingEvidence = fs.readFileSync(path.join(candidateDir, 'signing-windows-x64.txt'), 'utf8')
  if (!/^authenticode_status=NotSigned$/mu.test(signingEvidence)) {
    throw new Error('v32.1 signing evidence must explicitly record Authenticode NotSigned')
  }
  if (!/^signer_present=false$/mu.test(signingEvidence)) {
    throw new Error('v32.1 signing evidence must prove no signer certificate is present')
  }

  const provenance = readJson(path.join(candidateDir, 'candidate-provenance.json'))
  if (
    provenance.tag !== V321_IDENTITY.tag ||
    provenance.commit !== candidate.commit ||
    provenance.releaseClass !== V321_IDENTITY.releaseClass ||
    String(provenance.runId) !== String(stagingRunId)
  ) {
    throw new Error('v32.1 candidate provenance mismatch')
  }

  const expectedReleaseState =
    expectedState === 'draft'
      ? { draft: true, prerelease: true }
      : expectedState === 'latest'
        ? { draft: false, prerelease: false }
        : null
  if (
    !expectedReleaseState ||
    release.tag_name !== V321_IDENTITY.tag ||
    release.name !== 'Hermes Vietnamese v32.1' ||
    release.draft !== expectedReleaseState.draft ||
    release.prerelease !== expectedReleaseState.prerelease
  ) {
    throw new Error(`GitHub v32.1 release identity/state mismatch: ${expectedState}`)
  }
  const expectedBody = fs.readFileSync(notesPath, 'utf8').replace(/\r\n?/gu, '\n').replace(/\n+$/gu, '')
  const actualBody = String(release.body ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/\n+$/gu, '')
  if (actualBody !== expectedBody) throw new Error('GitHub v32.1 release notes mismatch')

  sameMembers(
    (release.assets ?? []).map(asset => asset.name),
    V321_RELEASE_ASSETS,
    'GitHub v32.1 assets'
  )
  for (const asset of release.assets) {
    const file = path.join(candidateDir, asset.name)
    if (asset.size !== fs.statSync(file).size || asset.digest !== `sha256:${sha256File(file)}`) {
      throw new Error(`GitHub v32.1 asset mismatch: ${asset.name}`)
    }
  }

  validatePublicDescriptor(readJson(publicReleasePath), candidate)
  validateLifecycle({ artifacts, candidate, lifecycleDir, lifecycleRunId, run })
  return { lifecycleRunId: String(lifecycleRunId), manifestSha: expectedManifestSha, status: 'passed' }
}

function main() {
  const [
    candidateDir,
    lifecycleDir,
    releasePath,
    runPath,
    artifactsPath,
    manifestSha,
    lifecycleRunId,
    stagingRunId,
    candidateCommit,
    candidateSize,
    candidateSha,
    state
  ] = process.argv.slice(2)
  if (
    !candidateDir ||
    !lifecycleDir ||
    !releasePath ||
    !runPath ||
    !artifactsPath ||
    !manifestSha ||
    !lifecycleRunId ||
    !stagingRunId ||
    !candidateCommit ||
    !candidateSize ||
    !candidateSha ||
    !state
  ) {
    throw new Error(
      'usage: validate-v321-promotion.mjs <candidate-dir> <lifecycle-dir> <release.json> <run.json> <artifacts.json> <manifest-sha> <lifecycle-run-id> <staging-run-id> <candidate-commit> <candidate-size> <candidate-sha> <draft|latest>'
    )
  }
  const result = validateV321PromotionBundle({
    artifacts: readJson(artifactsPath),
    candidate: { commit: candidateCommit, sha256: candidateSha, size: Number(candidateSize) },
    candidateDir: path.resolve(candidateDir),
    expectedManifestSha: manifestSha,
    expectedState: state,
    lifecycleDir: path.resolve(lifecycleDir),
    lifecycleRunId,
    release: readJson(releasePath),
    run: readJson(runPath),
    stagingRunId
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
