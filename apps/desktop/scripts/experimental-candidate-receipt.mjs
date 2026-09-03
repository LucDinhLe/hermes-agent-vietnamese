import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedRuntimeCandidateId as expectedCandidateId } from '../electron/runtime-candidate-id.ts'
import { assertNativeReleaseProvenance } from '../electron/native-release-provenance.ts'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DESKTOP_ROOT = path.resolve(SCRIPT_DIR, '..')
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const ZERO_COMMIT_PATTERN = /^0{40}$/

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function exactCommit(value, label) {
  invariant(
    typeof value === 'string' && COMMIT_PATTERN.test(value),
    `${label} must be an exact 40-character lowercase commit`
  )
  invariant(!ZERO_COMMIT_PATTERN.test(value), `${label} must not be the fallback zero commit`)
  return value
}

function exactSha256(value, label) {
  invariant(typeof value === 'string' && SHA256_PATTERN.test(value), `${label} must be an exact lowercase SHA-256`)
  return value
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function readJsonWithBytes(file) {
  const bytes = readFileSync(file)
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

function defaultPaths(desktopRoot = DEFAULT_DESKTOP_ROOT) {
  const root = path.resolve(desktopRoot)
  const buildRoot = path.join(root, 'build')
  return {
    packageJsonPath: path.join(root, 'package.json'),
    editionReceiptPath: path.join(buildRoot, 'edition-receipt.json'),
    installStampPath: path.join(buildRoot, 'install-stamp.json'),
    compositionPath: path.join(buildRoot, 'experimental-composition.json'),
    runtimeManifestPath: path.join(buildRoot, 'advisor-runtime', 'runtime-manifest.json'),
    runtimeSyncScriptPath: path.join(buildRoot, 'advisor-runtime', 'Sync-Hermes-Advisor-Runtime.ps1'),
    outputPath: path.join(buildRoot, 'experimental-candidate-receipt.json')
  }
}

function resolvePaths(options = {}) {
  return {
    ...defaultPaths(options.desktopRoot),
    ...options.paths,
    ...(options.outputPath ? { outputPath: options.outputPath } : {})
  }
}

function loadInputs(paths) {
  const pkg = readJsonWithBytes(paths.packageJsonPath)
  const edition = readJsonWithBytes(paths.editionReceiptPath)
  const stamp = readJsonWithBytes(paths.installStampPath)
  const composition = readJsonWithBytes(paths.compositionPath)
  const runtime = readJsonWithBytes(paths.runtimeManifestPath)
  const runtimeSyncScript = readFileSync(paths.runtimeSyncScriptPath)

  return {
    packageJson: pkg.value,
    editionReceipt: edition.value,
    installStamp: stamp.value,
    composition: composition.value,
    runtimeManifest: runtime.value,
    componentSha256: {
      editionReceipt: sha256(edition.bytes),
      installStamp: sha256(stamp.bytes),
      experimentalComposition: sha256(composition.bytes),
      advisorRuntimeManifest: sha256(runtime.bytes),
      advisorRuntimeSyncScript: sha256(runtimeSyncScript)
    }
  }
}

function productProtocol(packageJson, composition) {
  const expected = composition.identity?.protocol
  const schemes = (packageJson.build?.protocols ?? []).flatMap(entry => entry.schemes ?? [])
  invariant(typeof expected === 'string' && expected.length > 0, 'Experimental composition protocol is missing')
  invariant(schemes.includes(expected), 'Package protocol does not match Experimental composition')
  return expected
}

function validateSourceGraph({
  packageJson,
  editionReceipt,
  installStamp,
  composition,
  runtimeManifest,
  componentSha256
}) {
  invariant(packageJson && typeof packageJson === 'object', 'Package metadata is missing')
  invariant(editionReceipt?.schemaVersion === 1, 'Edition receipt schema must be 1')
  invariant(installStamp?.schemaVersion === 1, 'Install stamp schema must be 1')
  invariant(composition?.schemaVersion === 1, 'Experimental composition schema must be 1')
  invariant(runtimeManifest?.schemaVersion === 1, 'Advisor runtime manifest schema must be 1')

  const officialEngineBase = exactCommit(editionReceipt.engine?.commit, 'Official engine base')
  const baseEditionShellCommit = exactCommit(editionReceipt.edition?.shellCommit, 'Base edition shell commit')
  const recipeShellCommit = exactCommit(composition.shellRecipeCommit, 'Experimental recipe shell commit')
  const experimentalEngineSource = exactCommit(composition.experimentalEngineHead, 'Experimental engine source')
  const materializedBuildCommit = exactCommit(runtimeManifest.buildCommit, 'Materialized build commit')
  const stampCommit = exactCommit(installStamp.commit, 'Install stamp commit')

  invariant(editionReceipt.edition?.shellDirty === false, 'Base edition receipt must come from a clean shell')
  invariant(installStamp.dirty === false, 'Install stamp must come from a clean materialized tree')
  invariant(
    installStamp.source === 'local' || installStamp.source === 'ci',
    'Install stamp source must be local or ci, never fallback'
  )
  invariant(
    composition.officialEngineBase === officialEngineBase,
    'Experimental composition official engine base mismatch'
  )
  invariant(runtimeManifest.sourceCommit === experimentalEngineSource, 'Advisor runtime source commit mismatch')
  invariant(
    stampCommit === materializedBuildCommit,
    'Install stamp commit must equal the materialized runtime build commit'
  )
  invariant(
    packageJson.version === composition.productVersion,
    'Package and Experimental composition versions do not match'
  )
  invariant(packageJson.version === runtimeManifest.productVersion, 'Package and Advisor runtime versions do not match')
  invariant(
    packageJson.build?.appId === composition.identity?.appId,
    'Package appId does not match Experimental composition'
  )
  invariant(
    packageJson.build?.executableName === composition.identity?.executableName,
    'Package executable name does not match Experimental composition'
  )

  const protocol = productProtocol(packageJson, composition)
  const candidateId = expectedCandidateId(packageJson.version, experimentalEngineSource, materializedBuildCommit)
  invariant(runtimeManifest.candidateId === candidateId, 'Advisor runtime candidate id mismatch')
  invariant(
    Number.isInteger(runtimeManifest.fileCount) && runtimeManifest.fileCount >= 0,
    'Advisor runtime file count must be a non-negative integer'
  )

  const releaseCandidate = composition.releaseCandidate === true
  const publicDistributionAllowed = composition.publicDistributionAllowed === true
  invariant(
    !publicDistributionAllowed || releaseCandidate,
    'Public distribution cannot be allowed for a non-release candidate'
  )

  if (releaseCandidate) {
    invariant(composition.status === 'release-candidate', 'Release candidate composition status mismatch')
    if (composition.distribution?.kind === 'community-pilot') {
      assertNativeReleaseProvenance(installStamp, composition, runtimeManifest)
    } else {
      invariant(editionReceipt.releaseMode === true, 'Release candidate requires a release-mode base edition receipt')
      invariant(
        Array.isArray(editionReceipt.edition?.shellLiveRemoteRefs) &&
          editionReceipt.edition.shellLiveRemoteRefs.length > 0,
        'Release candidate requires live base edition remote evidence'
      )
      invariant(installStamp.source === 'ci', 'Release candidate install stamp must come from ci')
    }
  } else {
    invariant(composition.status === 'local-experimental-only', 'Local Experimental composition status mismatch')
    invariant(publicDistributionAllowed === false, 'Local Experimental candidate cannot allow public distribution')
  }

  for (const [name, digest] of Object.entries(componentSha256 ?? {})) exactSha256(digest, `${name} digest`)
  for (const name of [
    'editionReceipt',
    'installStamp',
    'experimentalComposition',
    'advisorRuntimeManifest',
    'advisorRuntimeSyncScript'
  ]) {
    exactSha256(componentSha256?.[name], `${name} digest`)
  }

  return {
    officialEngineBase,
    baseEditionShellCommit,
    recipeShellCommit,
    experimentalEngineSource,
    materializedBuildCommit,
    protocol,
    candidateId,
    releaseCandidate,
    publicDistributionAllowed
  }
}

export function composeExperimentalCandidateReceipt(inputs, { generatedAt = new Date().toISOString() } = {}) {
  const graph = validateSourceGraph(inputs)
  invariant(!Number.isNaN(Date.parse(generatedAt)), 'Candidate receipt generatedAt must be an ISO-compatible timestamp')

  return {
    schemaVersion: 1,
    generatedAt,
    status: inputs.composition.status,
    releaseCandidate: graph.releaseCandidate,
    publicDistributionAllowed: graph.publicDistributionAllowed,
    product: {
      packageName: inputs.packageJson.name,
      productName: inputs.packageJson.productName,
      version: inputs.packageJson.version,
      appId: inputs.packageJson.build.appId,
      executableName: inputs.packageJson.build.executableName,
      protocol: graph.protocol
    },
    sources: {
      officialEngineBase: graph.officialEngineBase,
      baseEditionShellCommit: graph.baseEditionShellCommit,
      baseEditionReleaseMode: inputs.editionReceipt.releaseMode === true,
      recipeShellCommit: graph.recipeShellCommit,
      experimentalEngineSource: graph.experimentalEngineSource,
      materializedBuildCommit: graph.materializedBuildCommit,
      installStampSource: inputs.installStamp.source,
      installStampBranch: inputs.installStamp.branch ?? null
    },
    runtime: {
      candidateId: graph.candidateId,
      sourceCommit: graph.experimentalEngineSource,
      buildCommit: graph.materializedBuildCommit,
      fileCount: inputs.runtimeManifest.fileCount
    },
    components: {
      editionReceipt: { file: 'edition-receipt.json', sha256: inputs.componentSha256.editionReceipt },
      installStamp: { file: 'install-stamp.json', sha256: inputs.componentSha256.installStamp },
      experimentalComposition: {
        file: 'experimental-composition.json',
        sha256: inputs.componentSha256.experimentalComposition
      },
      advisorRuntimeManifest: {
        file: 'advisor-runtime/runtime-manifest.json',
        sha256: inputs.componentSha256.advisorRuntimeManifest
      },
      advisorRuntimeSyncScript: {
        file: 'advisor-runtime/Sync-Hermes-Advisor-Runtime.ps1',
        sha256: inputs.componentSha256.advisorRuntimeSyncScript
      }
    }
  }
}

export function validateExperimentalCandidateReceipt(receipt, inputs) {
  invariant(receipt?.schemaVersion === 1, 'Experimental candidate receipt schema must be 1')
  const expected = composeExperimentalCandidateReceipt(inputs, { generatedAt: receipt.generatedAt })

  for (const name of Object.keys(expected.components)) {
    invariant(receipt.components?.[name]?.sha256 === expected.components[name].sha256, `${name} SHA-256 mismatch`)
  }

  try {
    assert.deepStrictEqual(receipt, expected)
  } catch (error) {
    throw new Error(`Experimental candidate receipt does not match its source graph: ${error.message}`)
  }

  return receipt
}

export function writeExperimentalCandidateReceipt(options = {}) {
  const paths = resolvePaths(options)
  const inputs = loadInputs(paths)
  const receipt = composeExperimentalCandidateReceipt(inputs, { generatedAt: options.generatedAt })
  const bytes = jsonBytes(receipt)
  mkdirSync(path.dirname(paths.outputPath), { recursive: true })
  writeFileSync(paths.outputPath, bytes)
  return { outputPath: paths.outputPath, receipt, sha256: sha256(bytes) }
}

export function validateExperimentalCandidateReceiptFile(options = {}) {
  const paths = resolvePaths(options)
  const inputs = loadInputs(paths)
  const receipt = JSON.parse(readFileSync(paths.outputPath, 'utf8'))
  validateExperimentalCandidateReceipt(receipt, inputs)
  return { outputPath: paths.outputPath, receipt, sha256: sha256(readFileSync(paths.outputPath)) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = writeExperimentalCandidateReceipt()
  console.log(`[experimental-candidate-receipt] wrote ${result.outputPath} (${result.sha256})`)
}
