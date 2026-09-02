import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const CANDIDATE_PATTERN = /^d\d+e\d+-[0-9a-f]{8}-[0-9a-f]{8}$/
const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const VENV_LAYOUT = 'copied-scripts-pth-lib-v2'
const BOOTSTRAP_RECEIPT_FILE = 'bootstrap-python-inventory-receipt.json'
const SITE_PACKAGES_BRIDGE = '_hermes_legacy_site_packages.pth'

const EXPERIMENTAL_PRODUCT = Object.freeze({
  appId: 'com.nousresearch.hermes',
  executableName: 'Hermes',
  packageName: 'hermes',
  productName: 'Hermes',
  protocol: 'hermes'
})

type Environment = Record<string, string | undefined>

export interface ExperimentalPackagedPaths {
  enabled: boolean
  experimentRoot: string | null
  profileRoot: string | null
  stableHermesRoot: string | null
  userDataRoot: string | null
}

export interface RuntimeManifestFile {
  path: string
  sha256: string
  size: number
}

export interface ExperimentalRuntimeBundle {
  bundleRoot: string
  candidateId: string
  candidateReceipt: any
  expectedTargetRoot: string
  manifest: any
  manifestSha256: string
  payloadRoot: string
  syncScriptPath: string
  syncScriptSha256: string
}

export interface MaterializeResult {
  status: 'needs-bootstrap' | 'ready'
  candidateId: string
  targetRoot: string
}

interface DirectoryInventoryEntry {
  path: string
  type: 'directory'
}

interface FileInventoryEntry {
  path: string
  sha256: string
  size: number
  type: 'file'
}

type InventoryEntry = DirectoryInventoryEntry | FileInventoryEntry

interface InventorySummary {
  directoryCount: number
  fileCount: number
  sha256: string
}

interface BootstrapSnapshot {
  copiedEntries: InventoryEntry[]
  dependencyEntries: InventoryEntry[]
  entries: InventoryEntry[]
  interpreter: FileInventoryEntry
  sitePackagesRoot: string
  venvRoot: string
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[experimental-runtime] ${message}`)
  }
}

function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sha256Bytes(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function sameNativePath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left)
  const resolvedRight = path.resolve(right)

  return process.platform === 'win32'
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight
}

function nativeRealpath(file: string): string {
  return fs.realpathSync.native ? fs.realpathSync.native(file) : fs.realpathSync(file)
}

function assertPlainFile(file: string, label: string): fs.Stats {
  invariant(fs.existsSync(file), `missing ${label}: ${file}`)
  const stat = fs.lstatSync(file)

  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a plain file, not a reparse point`)

  return stat
}

function assertNoReparsePath(root: string, candidate: string, label: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)

  invariant(sameOrDescendant(resolvedCandidate, resolvedRoot), `${label} escaped its trusted root`)

  const segments = path.relative(resolvedRoot, resolvedCandidate).split(path.sep).filter(Boolean)
  let current = resolvedRoot

  for (const segment of ['', ...segments]) {
    if (segment) {
      current = path.join(current, segment)
    }

    invariant(fs.existsSync(current), `missing ${label}: ${current}`)
    const stat = fs.lstatSync(current)

    invariant(!stat.isSymbolicLink(), `${label} contains a symbolic link/reparse point: ${current}`)
  }
}

function inventoryBytes(entries: InventoryEntry[]): string {
  return entries
    .map(entry =>
      entry.type === 'directory' ? `D\t${entry.path}` : `F\t${entry.path}\t${entry.size}\t${entry.sha256}`
    )
    .join('\n')
}

function summarizeInventory(entries: InventoryEntry[]): InventorySummary {
  return {
    directoryCount: entries.filter(entry => entry.type === 'directory').length,
    fileCount: entries.filter(entry => entry.type === 'file').length,
    sha256: sha256Bytes(inventoryBytes(entries))
  }
}

function listSafeTree(root: string, label: string): InventoryEntry[] {
  invariant(fs.existsSync(root), `missing ${label}: ${root}`)
  const rootStat = fs.lstatSync(root)

  invariant(rootStat.isDirectory() && !rootStat.isSymbolicLink(), `${label} root must not be a reparse point`)
  const realRoot = nativeRealpath(root)
  const entries: InventoryEntry[] = []

  function visit(directory: string, prefix: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)
      const stat = fs.lstatSync(absolute)

      invariant(
        !entry.isSymbolicLink() && !stat.isSymbolicLink(),
        `${label} contains a symbolic link/reparse point: ${relative}`
      )
      invariant(
        sameNativePath(nativeRealpath(absolute), path.join(realRoot, ...relative.split('/'))),
        `${label} contains a redirected reparse entry: ${relative}`
      )

      if (stat.isDirectory()) {
        entries.push({ path: relative, type: 'directory' })
        visit(absolute, relative)
      } else {
        invariant(stat.isFile(), `${label} contains a non-file entry: ${relative}`)
        const digest = sha256(absolute)
        const after = fs.lstatSync(absolute)

        invariant(
          after.isFile() && !after.isSymbolicLink() && after.size === stat.size,
          `${label} changed while it was inventoried: ${relative}`
        )
        entries.push({ path: relative, sha256: digest, size: stat.size, type: 'file' })
      }
    }
  }

  visit(root, '')

  return entries.sort((left, right) => left.path.localeCompare(right.path))
}

function readJson(file: string, label: string): any {
  invariant(fs.existsSync(file), `missing ${label}: ${file}`)

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`[experimental-runtime] invalid ${label}: ${error instanceof Error ? error.message : error}`)
  }
}

function exactCommit(value: unknown, label: string): string {
  invariant(typeof value === 'string' && COMMIT_PATTERN.test(value), `${label} must be an exact commit`)
  invariant(!/^0+$/.test(value), `${label} must not be the fallback commit`)

  return value
}

function exactSha256(value: unknown, label: string): string {
  invariant(typeof value === 'string' && SHA256_PATTERN.test(value), `${label} must be an exact SHA-256`)

  return value
}

function expectedCandidateId(version: string, sourceCommit: string, buildCommit: string): string {
  const match = version.match(/-dev\.(\d+)-advisor-exp\.(\d+)$/)

  invariant(match, `unsupported Experimental product version: ${version}`)

  return `d${match[1]}e${match[2]}-${sourceCommit.slice(0, 8)}-${buildCommit.slice(0, 8)}`
}

function findBootstrapVenvRoot(profileRoot: string): string | null {
  const legacyRoot = path.join(profileRoot, 'hermes-agent')

  for (const name of ['.venv', 'venv']) {
    const candidate = path.join(legacyRoot, name)

    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate
    }
  }

  return null
}

function createBootstrapSnapshot(profileRoot: string, venvRoot: string): BootstrapSnapshot {
  assertNoReparsePath(profileRoot, venvRoot, 'bootstrap Python environment')
  const entries = listSafeTree(venvRoot, 'bootstrap Python environment')
  const interpreterPath = 'Scripts/python.exe'

  const interpreter = entries.find(
    (entry): entry is FileInventoryEntry => entry.type === 'file' && entry.path === interpreterPath
  )

  invariant(interpreter, 'bootstrap Python environment is missing Scripts/python.exe')
  const sitePackagesPath = 'Lib/site-packages'
  const sitePackagesDirectory = entries.find(entry => entry.type === 'directory' && entry.path === sitePackagesPath)

  invariant(sitePackagesDirectory, 'bootstrap Python environment is missing Lib/site-packages')

  const copiedEntries = entries.filter(entry => {
    const topLevelFile = entry.type === 'file' && !entry.path.includes('/')

    return topLevelFile || entry.path === 'Scripts' || entry.path.startsWith('Scripts/')
  })

  const dependencyEntries = entries.filter(
    entry => entry.path === sitePackagesPath || entry.path.startsWith(`${sitePackagesPath}/`)
  )

  return {
    copiedEntries,
    dependencyEntries,
    entries,
    interpreter,
    sitePackagesRoot: path.join(venvRoot, 'Lib', 'site-packages'),
    venvRoot
  }
}

function bootstrapInventory(snapshot: BootstrapSnapshot) {
  return {
    venvSource: snapshot.venvRoot,
    inventory: {
      full: summarizeInventory(snapshot.entries),
      copiedLauncher: summarizeInventory(snapshot.copiedEntries),
      dependencies: summarizeInventory(snapshot.dependencyEntries),
      interpreter: {
        path: snapshot.interpreter.path,
        sha256: snapshot.interpreter.sha256,
        size: snapshot.interpreter.size
      }
    }
  }
}

function bootstrapReceipt(bundle: ExperimentalRuntimeBundle, snapshot: BootstrapSnapshot) {
  return {
    schemaVersion: 1,
    createdByCandidateId: bundle.candidateId,
    createdByManifestSha256: bundle.manifestSha256,
    ...bootstrapInventory(snapshot)
  }
}

function bootstrapReceiptPath(experimentRoot: string): string {
  return path.join(experimentRoot, BOOTSTRAP_RECEIPT_FILE)
}

function verifyBootstrapReceipt(experimentRoot: string, snapshot: BootstrapSnapshot) {
  const receiptPath = bootstrapReceiptPath(experimentRoot)

  assertNoReparsePath(experimentRoot, receiptPath, 'bootstrap inventory receipt')
  assertPlainFile(receiptPath, 'materialized bootstrap inventory receipt')
  const actual = readJson(receiptPath, 'materialized bootstrap inventory receipt')
  invariant(
    typeof actual.createdByCandidateId === 'string' && CANDIDATE_PATTERN.test(actual.createdByCandidateId),
    'bootstrap inventory receipt has an invalid creating candidate'
  )
  exactSha256(actual.createdByManifestSha256, 'bootstrap inventory receipt creating manifest digest')

  const expected = {
    schemaVersion: 1,
    createdByCandidateId: actual.createdByCandidateId,
    createdByManifestSha256: actual.createdByManifestSha256,
    ...bootstrapInventory(snapshot)
  }

  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    'bootstrap interpreter or dependency inventory changed after materialization'
  )
}

function writeBootstrapReceipt(bundle: ExperimentalRuntimeBundle, experimentRoot: string, snapshot: BootstrapSnapshot) {
  const receiptPath = bootstrapReceiptPath(experimentRoot)
  const bytes = `${JSON.stringify(bootstrapReceipt(bundle, snapshot), null, 2)}\n`

  fs.writeFileSync(receiptPath, bytes, { encoding: 'utf8', flag: 'wx' })
  verifyBootstrapReceipt(experimentRoot, snapshot)
}

function sameOrDescendant(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root).toLowerCase(), path.resolve(candidate).toLowerCase())

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function pathsOverlap(left: string, right: string): boolean {
  return sameOrDescendant(left, right) || sameOrDescendant(right, left)
}

function safeManifestPath(value: unknown): string {
  invariant(typeof value === 'string' && value.length > 0, 'runtime manifest contains an empty path')
  invariant(!value.includes('\\'), `runtime manifest path must use forward slashes: ${value}`)
  invariant(!path.posix.isAbsolute(value), `runtime manifest path must be relative: ${value}`)
  invariant(
    !value.split('/').some(part => part === '' || part === '.' || part === '..'),
    `unsafe runtime path: ${value}`
  )
  invariant(path.posix.normalize(value) === value, `non-canonical runtime path: ${value}`)

  return value
}

function listPayloadFiles(root: string): string[] {
  const files: string[] = []

  function visit(directory: string, prefix: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)

      invariant(!entry.isSymbolicLink(), `runtime payload contains a symbolic link: ${relative}`)

      if (entry.isDirectory()) {
        visit(absolute, relative)
      } else {
        invariant(entry.isFile(), `runtime payload contains a non-file entry: ${relative}`)
        files.push(relative)
      }
    }
  }

  invariant(fs.existsSync(root) && fs.statSync(root).isDirectory(), `missing runtime payload: ${root}`)
  visit(root, '')

  return files.sort()
}

function listMaterializedSourceFiles(root: string): string[] {
  const files: string[] = []

  function visit(directory: string, prefix: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)

      if (relative === '.venv' && entry.isDirectory()) {
        continue
      }

      if (relative === 'advisor-runtime-receipt.json' && entry.isFile()) {
        continue
      }

      invariant(!entry.isSymbolicLink(), `materialized runtime contains a symbolic link: ${relative}`)

      if (entry.isDirectory()) {
        visit(absolute, relative)
      } else {
        invariant(entry.isFile(), `materialized runtime contains a non-file entry: ${relative}`)
        files.push(relative)
      }
    }
  }

  invariant(fs.existsSync(root) && fs.statSync(root).isDirectory(), `missing materialized runtime: ${root}`)
  visit(root, '')

  return files.sort()
}

function verifyManifestFiles(root: string, files: RuntimeManifestFile[]) {
  for (const entry of files) {
    const file = path.join(root, ...entry.path.split('/'))
    invariant(fs.existsSync(file) && fs.statSync(file).isFile(), `missing runtime file: ${entry.path}`)
    invariant(fs.statSync(file).size === entry.size, `runtime file size mismatch: ${entry.path}`)
    invariant(sha256(file) === entry.sha256, `runtime file SHA-256 mismatch: ${entry.path}`)
  }
}

export function configureExperimentalPackagedEnvironment({
  env = process.env,
  isPackaged,
  isWindows,
  localAppData = env.LOCALAPPDATA
}: {
  env?: Environment
  isPackaged: boolean
  isWindows: boolean
  localAppData?: string
}): ExperimentalPackagedPaths {
  if (!isPackaged || !isWindows) {
    return { enabled: false, experimentRoot: null, profileRoot: null, stableHermesRoot: null, userDataRoot: null }
  }

  invariant(localAppData, 'LOCALAPPDATA is required for the packaged local Stable app')
  const stableHermesRoot = path.resolve(localAppData, 'hermes')
  const roamingRoot = env.APPDATA?.trim() || path.resolve(localAppData, '..', 'Roaming')
  const userDataRoot = path.resolve(roamingRoot, 'Hermes')

  env.HERMES_HOME = stableHermesRoot
  delete env.HERMES_ADVISOR_EXPERIMENT_ROOT
  delete env.HERMES_DESKTOP_USER_DATA_DIR
  delete env.HERMES_DESKTOP_IGNORE_EXISTING
  delete env.HERMES_DESKTOP_HERMES_ROOT

  return {
    enabled: true,
    experimentRoot: stableHermesRoot,
    profileRoot: stableHermesRoot,
    stableHermesRoot,
    userDataRoot
  }
}

export function verifyExperimentalRuntimeBundle({
  appVersion,
  experimentRoot,
  resourcesPath
}: {
  appVersion: string
  experimentRoot: string
  resourcesPath: string
}): ExperimentalRuntimeBundle {
  const bundleRoot = path.join(resourcesPath, 'advisor-runtime')
  const payloadRoot = path.join(bundleRoot, 'payload')
  const manifestPath = path.join(bundleRoot, 'runtime-manifest.json')
  const syncScriptPath = path.join(bundleRoot, 'Sync-Hermes-Advisor-Runtime.ps1')
  const candidateReceiptPath = path.join(resourcesPath, 'experimental-candidate-receipt.json')
  const manifest = readJson(manifestPath, 'advisor runtime manifest')
  const candidateReceipt = readJson(candidateReceiptPath, 'Experimental candidate receipt')
  const manifestSha256 = sha256(manifestPath)

  invariant(manifest.schemaVersion === 1, 'advisor runtime manifest schema must be 1')
  invariant(candidateReceipt.schemaVersion === 1, 'candidate receipt schema must be 1')
  invariant(typeof candidateReceipt.releaseCandidate === 'boolean', 'candidate releaseCandidate must be boolean')
  invariant(
    typeof candidateReceipt.publicDistributionAllowed === 'boolean',
    'candidate publicDistributionAllowed must be boolean'
  )
  invariant(
    typeof manifest.candidateId === 'string' && CANDIDATE_PATTERN.test(manifest.candidateId),
    'invalid candidate id'
  )
  invariant(manifest.productVersion === appVersion, 'runtime product version does not match the packaged app')
  const sourceCommit = exactCommit(manifest.sourceCommit, 'runtime source commit')
  const buildCommit = exactCommit(manifest.buildCommit, 'runtime build commit')

  invariant(
    manifest.candidateId === expectedCandidateId(appVersion, sourceCommit, buildCommit),
    'runtime candidate id does not match the packaged version and commits'
  )
  invariant(
    candidateReceipt.product?.version === appVersion,
    'candidate receipt version does not match the packaged app'
  )
  const releaseCandidate = candidateReceipt.releaseCandidate === true
  const publicDistributionAllowed = candidateReceipt.publicDistributionAllowed === true

  invariant(!publicDistributionAllowed || releaseCandidate, 'public distribution requires a release candidate')

  if (releaseCandidate) {
    invariant(candidateReceipt.status === 'release-candidate', 'release candidate status mismatch')
  } else {
    invariant(candidateReceipt.status === 'local-experimental-only', 'local Experimental status mismatch')
    invariant(!publicDistributionAllowed, 'local Experimental package cannot allow public distribution')
  }

  invariant(
    candidateReceipt.runtime?.candidateId === manifest.candidateId,
    'candidate receipt pins a different runtime'
  )
  invariant(
    candidateReceipt.runtime?.sourceCommit === manifest.sourceCommit,
    'candidate receipt source commit mismatch'
  )
  invariant(candidateReceipt.runtime?.buildCommit === manifest.buildCommit, 'candidate receipt build commit mismatch')
  invariant(
    exactSha256(candidateReceipt.components?.advisorRuntimeManifest?.sha256, 'candidate runtime manifest digest') ===
      manifestSha256,
    'candidate receipt runtime manifest SHA-256 mismatch'
  )
  invariant(Array.isArray(manifest.files), 'runtime manifest files must be an array')
  invariant(
    Number.isInteger(manifest.fileCount) && manifest.fileCount === manifest.files.length,
    'runtime fileCount mismatch'
  )

  const seen = new Set<string>()

  const files: RuntimeManifestFile[] = manifest.files.map((entry: any) => {
    const relative = safeManifestPath(entry?.path)
    invariant(!seen.has(relative), `duplicate runtime path: ${relative}`)
    seen.add(relative)
    exactSha256(entry?.sha256, `runtime file digest for ${relative}`)
    invariant(Number.isInteger(entry?.size) && entry.size >= 0, `invalid runtime file size: ${relative}`)

    return { path: relative, sha256: entry.sha256, size: entry.size }
  })

  const payloadFiles = listPayloadFiles(payloadRoot)
  const expectedPayloadFiles = [...seen].sort()

  const expectedComponentFiles = {
    advisorRuntimeManifest: 'advisor-runtime/runtime-manifest.json',
    advisorRuntimeSyncScript: 'advisor-runtime/Sync-Hermes-Advisor-Runtime.ps1',
    editionReceipt: 'edition-receipt.json',
    experimentalComposition: 'experimental-composition.json',
    installStamp: 'install-stamp.json'
  }

  for (const [name, relative] of Object.entries(expectedComponentFiles)) {
    const component = candidateReceipt.components?.[name]
    invariant(component?.file === relative, `candidate receipt ${name} path mismatch`)
    const componentPath = path.join(resourcesPath, ...relative.split('/'))
    assertPlainFile(componentPath, `packaged ${name}`)
    invariant(
      sha256(componentPath) === exactSha256(component.sha256, `candidate ${name} digest`),
      `packaged ${name} SHA-256 mismatch`
    )
  }

  const composition = readJson(path.join(resourcesPath, 'experimental-composition.json'), 'Experimental composition')
  const editionReceipt = readJson(path.join(resourcesPath, 'edition-receipt.json'), 'edition receipt')
  const installStamp = readJson(path.join(resourcesPath, 'install-stamp.json'), 'install stamp')

  invariant(editionReceipt.schemaVersion === 1, 'edition receipt schema must be 1')
  invariant(installStamp.schemaVersion === 1, 'install stamp schema must be 1')
  invariant(composition.schemaVersion === 1, 'Experimental composition schema must be 1')
  invariant(typeof editionReceipt.releaseMode === 'boolean', 'edition releaseMode must be boolean')
  invariant(typeof composition.releaseCandidate === 'boolean', 'composition releaseCandidate must be boolean')
  invariant(
    typeof composition.publicDistributionAllowed === 'boolean',
    'composition publicDistributionAllowed must be boolean'
  )

  const officialEngineBase = exactCommit(candidateReceipt.sources?.officialEngineBase, 'candidate official engine base')

  const baseEditionShellCommit = exactCommit(
    candidateReceipt.sources?.baseEditionShellCommit,
    'candidate base edition shell commit'
  )

  const recipeShellCommit = exactCommit(candidateReceipt.sources?.recipeShellCommit, 'candidate recipe shell commit')

  const experimentalEngineSource = exactCommit(
    candidateReceipt.sources?.experimentalEngineSource,
    'candidate experimental engine source'
  )

  const materializedBuildCommit = exactCommit(
    candidateReceipt.sources?.materializedBuildCommit,
    'candidate materialized build commit'
  )

  invariant(
    exactCommit(editionReceipt.engine?.commit, 'edition engine commit') === officialEngineBase,
    'edition engine commit does not match the candidate receipt'
  )
  invariant(
    exactCommit(composition.officialEngineBase, 'composition official engine base') === officialEngineBase,
    'composition official engine base does not match the candidate receipt'
  )
  invariant(editionReceipt.edition?.shellDirty === false, 'edition shell must be clean')
  invariant(
    exactCommit(editionReceipt.edition?.shellCommit, 'edition shell commit') === baseEditionShellCommit,
    'edition shell commit does not match the candidate receipt'
  )
  invariant(
    candidateReceipt.sources?.baseEditionReleaseMode === editionReceipt.releaseMode,
    'edition release mode does not match the candidate receipt'
  )
  invariant(
    exactCommit(composition.shellRecipeCommit, 'composition shell recipe commit') === recipeShellCommit,
    'composition shell recipe commit does not match the candidate receipt'
  )
  invariant(
    exactCommit(composition.experimentalEngineHead, 'composition experimental engine head') ===
      experimentalEngineSource,
    'composition experimental engine head does not match the candidate receipt'
  )
  invariant(manifest.sourceCommit === experimentalEngineSource, 'runtime source does not match the candidate graph')

  const stampCommit = exactCommit(installStamp.commit, 'install stamp commit')

  invariant(installStamp.dirty === false, 'install stamp must come from a clean materialized tree')
  invariant(installStamp.source === 'local' || installStamp.source === 'ci', 'install stamp source must be local or ci')
  invariant(stampCommit === materializedBuildCommit, 'install stamp commit does not match the candidate receipt')
  invariant(manifest.buildCommit === materializedBuildCommit, 'runtime build does not match the candidate graph')
  invariant(
    candidateReceipt.sources?.installStampSource === installStamp.source,
    'install stamp source does not match the candidate receipt'
  )
  invariant(
    candidateReceipt.sources?.installStampBranch === (installStamp.branch ?? null),
    'install stamp branch does not match the candidate receipt'
  )
  invariant(candidateReceipt.runtime?.fileCount === manifest.fileCount, 'candidate runtime fileCount mismatch')

  invariant(composition.productVersion === appVersion, 'composition version does not match the packaged app')
  invariant(
    candidateReceipt.product?.packageName === EXPERIMENTAL_PRODUCT.packageName,
    'candidate package name mismatch'
  )
  invariant(
    candidateReceipt.product?.productName === EXPERIMENTAL_PRODUCT.productName,
    'candidate product name mismatch'
  )
  invariant(candidateReceipt.product?.appId === EXPERIMENTAL_PRODUCT.appId, 'candidate appId mismatch')
  invariant(
    candidateReceipt.product?.executableName === EXPERIMENTAL_PRODUCT.executableName,
    'candidate executable name mismatch'
  )
  invariant(candidateReceipt.product?.protocol === EXPERIMENTAL_PRODUCT.protocol, 'candidate protocol mismatch')
  invariant(composition.identity?.appId === candidateReceipt.product.appId, 'composition appId mismatch')
  invariant(
    composition.identity?.executableName === candidateReceipt.product.executableName,
    'composition executable name mismatch'
  )
  invariant(composition.identity?.protocol === candidateReceipt.product.protocol, 'composition protocol mismatch')

  invariant(composition.status === candidateReceipt.status, 'composition status does not match the candidate receipt')
  invariant(
    (composition.releaseCandidate === true) === releaseCandidate,
    'composition releaseCandidate does not match the candidate receipt'
  )
  invariant(
    (composition.publicDistributionAllowed === true) === publicDistributionAllowed,
    'composition publicDistributionAllowed does not match the candidate receipt'
  )

  if (releaseCandidate) {
    invariant(editionReceipt.releaseMode === true, 'release candidate requires a release-mode edition receipt')
    invariant(
      Array.isArray(editionReceipt.edition?.shellLiveRemoteRefs) &&
        editionReceipt.edition.shellLiveRemoteRefs.length > 0,
      'release candidate requires live edition remote evidence'
    )
    invariant(installStamp.source === 'ci', 'release candidate install stamp must come from ci')
  }

  invariant(
    payloadFiles.length === expectedPayloadFiles.length &&
      payloadFiles.every((file, index) => file === expectedPayloadFiles[index]),
    'runtime payload file inventory does not exactly match the manifest'
  )
  verifyManifestFiles(payloadRoot, files)

  return {
    bundleRoot,
    candidateId: manifest.candidateId,
    candidateReceipt,
    expectedTargetRoot: path.join(experimentRoot, 'runtimes', manifest.candidateId),
    manifest,
    manifestSha256,
    payloadRoot,
    syncScriptPath,
    syncScriptSha256: exactSha256(
      candidateReceipt.components.advisorRuntimeSyncScript.sha256,
      'candidate advisorRuntimeSyncScript digest'
    )
  }
}

function verifyBridgePath(bridgePath: string, sitePackagesRoot: string) {
  const contents = fs.readFileSync(bridgePath, 'utf8')
  const match = contents.match(/^import site; site\.addsitedir\(("(?:\\.|[^"\\])*")\)\r?\n$/)

  invariant(match, 'materialized site-packages bridge has an unsafe shape')

  let bridgedPath: unknown

  try {
    bridgedPath = JSON.parse(match[1])
  } catch {
    invariant(false, 'materialized site-packages bridge contains an invalid path')
  }

  invariant(
    typeof bridgedPath === 'string' && sameNativePath(bridgedPath, sitePackagesRoot),
    'materialized site-packages bridge points outside the verified bootstrap dependencies'
  )
}

function verifyMaterializedVenv(targetRoot: string, snapshot: BootstrapSnapshot) {
  const targetVenv = path.join(targetRoot, '.venv')

  assertNoReparsePath(targetRoot, targetVenv, 'materialized Python environment')
  const actualEntries = listSafeTree(targetVenv, 'materialized Python environment')
  const bridgeRelative = `Lib/site-packages/${SITE_PACKAGES_BRIDGE}`

  const bridgeEntry = actualEntries.find(
    (entry): entry is FileInventoryEntry => entry.type === 'file' && entry.path === bridgeRelative
  )

  invariant(bridgeEntry, 'materialized runtime is missing the site-packages bridge')
  verifyBridgePath(path.join(targetVenv, ...bridgeRelative.split('/')), snapshot.sitePackagesRoot)

  const expectedEntries: InventoryEntry[] = [
    ...snapshot.copiedEntries,
    { path: 'Lib', type: 'directory' },
    { path: 'Lib/site-packages', type: 'directory' },
    bridgeEntry
  ]

  expectedEntries.sort((left, right) => left.path.localeCompare(right.path))

  invariant(
    inventoryBytes(actualEntries) === inventoryBytes(expectedEntries),
    'materialized Python environment inventory does not exactly match the verified bootstrap launcher'
  )
}

function verifyMaterializedCandidate(
  bundle: ExperimentalRuntimeBundle,
  targetRoot: string,
  snapshot: BootstrapSnapshot
) {
  assertNoReparsePath(path.dirname(path.dirname(targetRoot)), targetRoot, 'materialized runtime')
  const files: RuntimeManifestFile[] = bundle.manifest.files
  const sourceFiles = listMaterializedSourceFiles(targetRoot)
  const expectedFiles = files.map(entry => entry.path).sort()

  invariant(
    sourceFiles.length === expectedFiles.length && sourceFiles.every((file, index) => file === expectedFiles[index]),
    'materialized runtime source inventory does not exactly match the manifest'
  )
  verifyManifestFiles(targetRoot, files)

  const receipt = readJson(path.join(targetRoot, 'advisor-runtime-receipt.json'), 'materialized runtime receipt')
  invariant(receipt.schemaVersion === 2, 'materialized runtime receipt schema must be 2')
  invariant(receipt.candidateId === bundle.candidateId, 'materialized runtime receipt candidate mismatch')
  invariant(receipt.productVersion === bundle.manifest.productVersion, 'materialized runtime receipt version mismatch')
  invariant(receipt.sourceCommit === bundle.manifest.sourceCommit, 'materialized runtime receipt source mismatch')
  invariant(receipt.manifestSha256 === bundle.manifestSha256, 'materialized runtime receipt manifest digest mismatch')
  invariant(receipt.venvLayout === VENV_LAYOUT, 'materialized runtime venv layout mismatch')
  invariant(
    typeof receipt.venvSource === 'string' && sameNativePath(receipt.venvSource, snapshot.venvRoot),
    'materialized runtime receipt bootstrap source mismatch'
  )
  verifyMaterializedVenv(targetRoot, snapshot)
}

function sameWindowsPath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function verifyPackagedSyncScript(bundle: ExperimentalRuntimeBundle) {
  assertPlainFile(bundle.syncScriptPath, 'packaged Advisor runtime sync script')
  invariant(
    sha256(bundle.syncScriptPath) === bundle.syncScriptSha256,
    'packaged Advisor runtime sync script SHA-256 mismatch'
  )
}

export function materializeExperimentalPackagedRuntime({
  bundle,
  env = process.env,
  experimentRoot,
  profileRoot,
  runSync = ({ bundleRoot, experimentRoot, profileRoot }) => {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(bundleRoot, 'Sync-Hermes-Advisor-Runtime.ps1'),
        '-ExperimentRoot',
        experimentRoot,
        '-ProfileRoot',
        profileRoot,
        '-BundleRoot',
        bundleRoot
      ],
      { encoding: 'utf8', env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    )
  }
}: {
  bundle: ExperimentalRuntimeBundle
  env?: Environment
  experimentRoot: string
  profileRoot: string
  runSync?: (paths: { bundleRoot: string; experimentRoot: string; profileRoot: string }) => void
}): MaterializeResult {
  const targetRoot = bundle.expectedTargetRoot
  const runtimesRoot = path.join(experimentRoot, 'runtimes')

  invariant(sameOrDescendant(targetRoot, runtimesRoot), 'candidate target escaped the experiment runtimes root')
  invariant(
    path.dirname(targetRoot).toLowerCase() === path.resolve(runtimesRoot).toLowerCase(),
    'candidate target is not direct'
  )
  const existingReceipt = path.join(targetRoot, 'advisor-runtime-receipt.json')
  const hadMaterializedReceipt = fs.existsSync(existingReceipt)
  const hadBootstrapReceipt = fs.existsSync(bootstrapReceiptPath(experimentRoot))
  const bootstrapVenvRoot = findBootstrapVenvRoot(profileRoot)

  if (!hadMaterializedReceipt && !bootstrapVenvRoot) {
    return { status: 'needs-bootstrap', candidateId: bundle.candidateId, targetRoot }
  }

  invariant(bootstrapVenvRoot, 'the materialized candidate has no bootstrap Python environment to verify')
  const beforeSync = createBootstrapSnapshot(profileRoot, bootstrapVenvRoot)

  if (hadBootstrapReceipt) {
    verifyBootstrapReceipt(experimentRoot, beforeSync)
  }

  if (hadMaterializedReceipt) {
    // The external Experimental launcher may materialize the packaged
    // candidate before Electron starts. Adopt that runtime only after the
    // complete candidate and bootstrap snapshot pass the same verification
    // used for an Electron-created candidate. The receipt is written below,
    // after the sync rerun proves the bootstrap environment stayed unchanged.
    verifyMaterializedCandidate(bundle, targetRoot, beforeSync)
  }

  verifyPackagedSyncScript(bundle)
  runSync({ bundleRoot: bundle.bundleRoot, experimentRoot, profileRoot })

  const afterSync = createBootstrapSnapshot(profileRoot, bootstrapVenvRoot)

  invariant(
    inventoryBytes(afterSync.entries) === inventoryBytes(beforeSync.entries),
    'bootstrap Python environment changed while the packaged candidate was materialized'
  )

  const pointerPath = path.join(experimentRoot, 'runtime-current.txt')
  assertPlainFile(pointerPath, 'runtime-current.txt')
  const pointer = fs.readFileSync(pointerPath, 'utf8').trim()
  invariant(sameWindowsPath(pointer, targetRoot), 'runtime-current.txt does not pin the packaged candidate')
  verifyMaterializedCandidate(bundle, targetRoot, afterSync)

  if (hadBootstrapReceipt) {
    verifyBootstrapReceipt(experimentRoot, afterSync)
  } else {
    invariant(
      !fs.existsSync(bootstrapReceiptPath(experimentRoot)),
      'new bootstrap inventory receipt appeared during materialization'
    )
    writeBootstrapReceipt(bundle, experimentRoot, afterSync)
  }

  env.HERMES_DESKTOP_HERMES_ROOT = targetRoot
  env.PYTHONDONTWRITEBYTECODE = '1'

  return { status: 'ready', candidateId: bundle.candidateId, targetRoot }
}
