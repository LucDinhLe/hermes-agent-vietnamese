import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, copyFile, lstat, mkdir, open, readdir, readFile, rename, rm, stat, statfs } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'

export const VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION = 1 as const

export type VietnameseIdentityRootId = 'hermes-home' | 'electron-user-data'

export type VietnameseIdentityMigrationRoot = {
  id: VietnameseIdentityRootId
  source: string
  destination: string
}

export type VietnameseIdentityMigrationPlan = {
  schemaVersion: typeof VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION
  stateDirectory: string
  roots: VietnameseIdentityMigrationRoot[]
}

export type MigrationManifestFile = {
  path: string
  size: number
  sha256: string
  sqlite: boolean
  sqliteKind: 'database' | 'wal' | 'shm' | null
}

export type MigrationManifest = {
  directories: string[]
  files: MigrationManifestFile[]
  totalBytes: number
}

export type ExclusiveIdentityMigrationScope = {
  planFingerprint: string
  stateDirectory: string
  roots: ReadonlyArray<VietnameseIdentityMigrationRoot>
}

export type ExclusiveIdentityMigrationLease = {
  /** Must cover stateDirectory and every writer of both identity roots. */
  coverage: 'state-directory-and-both-identity-roots'
  implementation: 'os-backed-cross-process'
  /** A TTL, heartbeat, transferable token, or stale-lock takeover is not a valid fence. */
  lifetime: 'non-expiring-until-explicit-release-or-process-exit'
  transferability: 'non-transferable'
  ownerToken: string
  planFingerprint: string
  /** Diagnostic only; safety comes from the non-expiring OS lease contract above. */
  assertHeld: () => Promise<boolean>
  release: () => Promise<void>
}

export type PathSafetyContext = {
  exists: boolean
  purpose: 'destination' | 'source' | 'state' | 'tree-entry' | 'work'
}

export type SqliteVerificationContext = {
  kind: Exclude<MigrationManifestFile['sqliteKind'], null>
  rootId: VietnameseIdentityRootId
  relativePath: string
  phase: 'snapshot' | 'staging' | 'destination'
}

export type MigrationCheckpoint =
  | { phase: 'capacity-checked' }
  | { phase: 'journal-created' }
  | { phase: 'snapshot-ready'; rootId: VietnameseIdentityRootId }
  | { phase: 'sentinel-temporary-written'; rootId: VietnameseIdentityRootId }
  | { phase: 'staging-ready'; rootId: VietnameseIdentityRootId }
  | { phase: 'before-root-promote'; rootId: VietnameseIdentityRootId }
  | { phase: 'after-root-promote'; rootId: VietnameseIdentityRootId }
  | { phase: 'after-all-promotes' }
  | { phase: 'completion-marker-published' }

export type StorageCapacity = {
  device: string
  availableBytes: bigint
}

export type VietnameseIdentityMigrationOptions = {
  /**
   * The desktop owner must acquire one OS-backed lease that excludes every
   * writer of stateDirectory and both roots, source and destination. A
   * point-in-time process check is intentionally rejected. The lease must be
   * non-expiring and non-transferable until explicit release or process exit;
   * assertHeld is a diagnostic, not a substitute for that OS-level guarantee.
   */
  acquireExclusiveMigrationLease: (scope: ExclusiveIdentityMigrationScope) => Promise<ExclusiveIdentityMigrationLease>
  /** The verifier is a read-only contract. The library re-hashes the tree after every call. */
  verifySqliteIntegrity?: (filePath: string, context: SqliteVerificationContext) => Promise<void>
  getStorageCapacity?: (path: string) => Promise<StorageCapacity>
  capacitySafetyMarginBytes?: bigint
  checkpoint?: (checkpoint: MigrationCheckpoint) => Promise<void>
  createRunId?: () => string
  now?: () => Date
  verifyPathSafety?: (path: string, context: PathSafetyContext) => Promise<boolean>
}

export type VietnameseIdentityMigrationResult = {
  status: 'completed' | 'already-complete' | 'recovered-complete'
  planFingerprint: string
  journalPath: string
  completionMarkerPath: string
  manifests: Record<VietnameseIdentityRootId, MigrationManifest>
  warnings?: Array<'LEASE_RELEASE_FAILED_AFTER_COMMIT'>
}

export type VietnameseIdentityMigrationErrorCode =
  | 'CAPACITY_INSUFFICIENT'
  | 'DESTINATION_COLLISION'
  | 'INVALID_JOURNAL'
  | 'INVALID_PLAN'
  | 'LOCK_OWNERSHIP_LOST'
  | 'MIGRATION_FAILED'
  | 'MIGRATION_LOCKED'
  | 'PLAN_MISMATCH'
  | 'QUIESCENCE_LEASE_LOST'
  | 'REPARSE_POINT_REJECTED'
  | 'REPARSE_VERIFIER_REQUIRED'
  | 'ROLLBACK_FAILED'
  | 'SAME_VOLUME_REQUIRED'
  | 'SOURCE_CHANGED'
  | 'SQLITE_HEADER_INVALID'
  | 'SQLITE_VERIFIER_REQUIRED'
  | 'SYMLINK_REJECTED'
  | 'TREE_MISMATCH'
  | 'UNSUPPORTED_FILE_TYPE'

export class VietnameseIdentityMigrationError extends Error {
  readonly code: VietnameseIdentityMigrationErrorCode
  readonly cause?: unknown

  constructor(code: VietnameseIdentityMigrationErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'VietnameseIdentityMigrationError'
    this.code = code
    this.cause = cause
  }
}

/** Test/fault-injection signal that models the process disappearing instantly. */
export class VietnameseIdentityMigrationInterruption extends Error {
  constructor(message = 'Simulated migration interruption') {
    super(message)
    this.name = 'VietnameseIdentityMigrationInterruption'
  }
}

type RootState = 'planned' | 'snapshotted' | 'staged' | 'promoting' | 'promoted'
type JournalState = 'preparing' | 'snapshotted' | 'staged' | 'promoting' | 'promoted' | 'failed' | 'complete'

type JournalRoot = VietnameseIdentityMigrationRoot & {
  snapshotPath: string
  stagingPath: string
  manifest: MigrationManifest
  sentinelSha256: string
  state: RootState
}

type MigrationJournal = {
  schemaVersion: typeof VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION
  runId: string
  leaseOwnerToken: string
  planFingerprint: string
  state: JournalState
  createdAt: string
  updatedAt: string
  roots: JournalRoot[]
  lastError?: string
}

type CompletionMarker = {
  schemaVersion: typeof VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION
  planFingerprint: string
  completedAt: string
  roots: Array<{
    id: VietnameseIdentityRootId
    source: string
    destination: string
    manifest: MigrationManifest
    migrationRunId: string
    sentinelSha256: string
  }>
}

type NormalizedPlan = VietnameseIdentityMigrationPlan & {
  stateDirectory: string
  roots: [VietnameseIdentityMigrationRoot, VietnameseIdentityMigrationRoot]
}

const EXPECTED_ROOT_IDS: VietnameseIdentityRootId[] = ['hermes-home', 'electron-user-data']
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8')
const ROOT_SENTINEL_NAME = '.hermes-vietnamese-migration-owner.v1.json'
const DEFAULT_CAPACITY_MARGIN = 16n * 1024n * 1024n

function migrationError(
  code: VietnameseIdentityMigrationErrorCode,
  message: string,
  cause?: unknown
): VietnameseIdentityMigrationError {
  return new VietnameseIdentityMigrationError(code, `${code}: ${message}`, cause)
}

function systemErrorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' ? (error as NodeJS.ErrnoException).code : undefined
}

async function lstatIfExists(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    if (systemErrorCode(error) === 'ENOENT') {
      return undefined
    }

    throw error
  }
}

function pathKey(path: string): string {
  const normalized = resolve(path)

  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized
}

function pathContains(parentPath: string, childPath: string): boolean {
  const parent = pathKey(parentPath)
  const child = pathKey(childPath)
  const difference = relative(parent, child)

  return difference === '' || (!difference.startsWith(`..${sep}`) && difference !== '..' && !isAbsolute(difference))
}

function normalizeRoot(root: VietnameseIdentityMigrationRoot): VietnameseIdentityMigrationRoot {
  if (!EXPECTED_ROOT_IDS.includes(root?.id)) {
    throw migrationError('INVALID_PLAN', `unknown migration root id: ${String(root?.id)}`)
  }

  if (!isAbsolute(root.source) || !isAbsolute(root.destination)) {
    throw migrationError('INVALID_PLAN', `${root.id} source and destination must be absolute paths`)
  }

  return {
    id: root.id,
    source: resolve(root.source),
    destination: resolve(root.destination)
  }
}

function normalizePlan(plan: VietnameseIdentityMigrationPlan): NormalizedPlan {
  if (plan?.schemaVersion !== VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION) {
    throw migrationError('INVALID_PLAN', 'unsupported migration plan schema')
  }

  if (!isAbsolute(plan.stateDirectory)) {
    throw migrationError('INVALID_PLAN', 'stateDirectory must be an absolute path')
  }

  if (!Array.isArray(plan.roots) || plan.roots.length !== EXPECTED_ROOT_IDS.length) {
    throw migrationError('INVALID_PLAN', 'the plan must contain exactly HERMES_HOME and Electron userData roots')
  }

  const rootsById = new Map(plan.roots.map(root => [root.id, normalizeRoot(root)]))

  if (rootsById.size !== EXPECTED_ROOT_IDS.length || EXPECTED_ROOT_IDS.some(id => !rootsById.has(id))) {
    throw migrationError('INVALID_PLAN', 'the plan must contain each required root exactly once')
  }

  const roots = EXPECTED_ROOT_IDS.map(id => rootsById.get(id)!) as NormalizedPlan['roots']
  const allRootPaths = roots.flatMap(root => [root.source, root.destination])

  for (let left = 0; left < allRootPaths.length; left += 1) {
    for (let right = left + 1; right < allRootPaths.length; right += 1) {
      if (
        pathContains(allRootPaths[left], allRootPaths[right]) ||
        pathContains(allRootPaths[right], allRootPaths[left])
      ) {
        throw migrationError('INVALID_PLAN', 'source and destination roots must be distinct and non-overlapping')
      }
    }
  }

  const stateDirectory = resolve(plan.stateDirectory)

  if (allRootPaths.some(path => pathContains(path, stateDirectory) || pathContains(stateDirectory, path))) {
    throw migrationError('INVALID_PLAN', 'stateDirectory must not overlap a source or destination root')
  }

  return {
    schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
    stateDirectory,
    roots
  }
}

export function createVietnameseIdentityMigrationPlan(input: {
  legacyHermesHome: string
  vietnameseHermesHome: string
  legacyElectronUserData: string
  vietnameseElectronUserData: string
  stateDirectory: string
}): VietnameseIdentityMigrationPlan {
  return {
    schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
    stateDirectory: input.stateDirectory,
    roots: [
      {
        id: 'hermes-home',
        source: input.legacyHermesHome,
        destination: input.vietnameseHermesHome
      },
      {
        id: 'electron-user-data',
        source: input.legacyElectronUserData,
        destination: input.vietnameseElectronUserData
      }
    ]
  }
}

export function vietnameseIdentityMigrationStatePaths(plan: VietnameseIdentityMigrationPlan): {
  journalPath: string
  completionMarkerPath: string
} {
  const normalized = normalizePlan(plan)

  return {
    journalPath: join(normalized.stateDirectory, 'migration-journal.v1.json'),
    completionMarkerPath: join(normalized.stateDirectory, 'migration-complete.v1.json')
  }
}

function fingerprintPlan(plan: NormalizedPlan): string {
  const canonical = {
    schemaVersion: plan.schemaVersion,
    stateDirectory: plan.stateDirectory,
    roots: plan.roots.map(root => ({
      id: root.id,
      source: root.source,
      destination: root.destination
    }))
  }

  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex')
}

type RootSentinel = {
  schemaVersion: typeof VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION
  kind: 'hermes-vietnamese-identity-migration-root'
  planFingerprint: string
  migrationRunId: string
  rootId: VietnameseIdentityRootId
  source: string
  destination: string
}

function jsonDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function rootSentinel(
  planFingerprint: string,
  migrationRunId: string,
  root: VietnameseIdentityMigrationRoot
): RootSentinel {
  return {
    schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
    kind: 'hermes-vietnamese-identity-migration-root',
    planFingerprint,
    migrationRunId,
    rootId: root.id,
    source: root.source,
    destination: root.destination
  }
}

function rootSentinelSha256(value: RootSentinel): string {
  return createHash('sha256').update(jsonDocument(value), 'utf8').digest('hex')
}

function safeRelativePath(path: string): boolean {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes('\\') &&
    path.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..')
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

async function hashRegularFile(filePath: string): Promise<{ size: number; sha256: string; hasSqliteHeader: boolean }> {
  const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : (constants.O_NOFOLLOW ?? 0))
  const handle = await open(filePath, flags)

  try {
    const before = await handle.stat()

    if (!before.isFile()) {
      throw migrationError('UNSUPPORTED_FILE_TYPE', `not a regular file: ${filePath}`)
    }

    const header = Buffer.alloc(SQLITE_HEADER.length)
    const headerRead = await handle.read(header, 0, header.length, 0)
    const hash = createHash('sha256')

    for await (const chunk of handle.createReadStream({
      autoClose: false,
      start: 0
    })) {
      hash.update(chunk)
    }

    const after = await handle.stat()

    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw migrationError('SOURCE_CHANGED', `file changed while it was hashed: ${filePath}`)
    }

    return {
      size: after.size,
      sha256: hash.digest('hex'),
      hasSqliteHeader: headerRead.bytesRead === SQLITE_HEADER.length && header.equals(SQLITE_HEADER)
    }
  } finally {
    await handle.close()
  }
}

function sqliteKindForPath(relativePath: string, hasSqliteHeader: boolean): MigrationManifestFile['sqliteKind'] {
  const lowerPath = relativePath.toLocaleLowerCase('en-US')

  if (lowerPath.endsWith('-wal')) {
    return 'wal'
  }

  if (lowerPath.endsWith('-shm')) {
    return 'shm'
  }

  if (hasSqliteHeader || /\.(?:db|sqlite|sqlite3)$/.test(lowerPath)) {
    return 'database'
  }

  return null
}

async function manifestTree(
  root: string,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<MigrationManifest> {
  await assertPathSafety(root, options, 'tree-entry')
  const rootStat = await lstatIfExists(root)

  if (rootStat?.isSymbolicLink()) {
    throw migrationError('SYMLINK_REJECTED', `symlink root rejected: ${root}`)
  }

  if (!rootStat?.isDirectory()) {
    throw migrationError('INVALID_PLAN', `source root is missing or is not a directory: ${root}`)
  }

  const directories: string[] = []
  const files: MigrationManifestFile[] = []

  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => compareStrings(left.name, right.name))

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name

      if (entry.isSymbolicLink()) {
        throw migrationError('SYMLINK_REJECTED', `symlink/reparse entry rejected: ${absolutePath}`)
      }

      if (options.verifyPathSafety) {
        await assertInjectedPathSafety(absolutePath, options.verifyPathSafety, {
          exists: true,
          purpose: 'tree-entry'
        })
      }

      const entryStat = await lstat(absolutePath)

      if (entryStat.isSymbolicLink()) {
        throw migrationError('SYMLINK_REJECTED', `symlink rejected: ${absolutePath}`)
      }

      if (entryStat.isDirectory()) {
        directories.push(relativePath)
        await walk(absolutePath, relativePath)

        continue
      }

      if (!entryStat.isFile()) {
        throw migrationError('UNSUPPORTED_FILE_TYPE', `special filesystem entry rejected: ${absolutePath}`)
      }

      const digest = await hashRegularFile(absolutePath)
      const sqliteKind = sqliteKindForPath(relativePath, digest.hasSqliteHeader)

      if (sqliteKind === 'database' && !digest.hasSqliteHeader) {
        throw migrationError(
          'SQLITE_HEADER_INVALID',
          `SQLite candidate is missing the required database header: ${absolutePath}`
        )
      }

      files.push({
        path: relativePath,
        size: digest.size,
        sha256: digest.sha256,
        sqlite: sqliteKind !== null,
        sqliteKind
      })
    }
  }

  await walk(root, '')
  directories.sort(compareStrings)
  files.sort((left, right) => compareStrings(left.path, right.path))

  return {
    directories,
    files,
    totalBytes: files.reduce((total, file) => total + file.size, 0)
  }
}

function manifestEquals(left: MigrationManifest, right: MigrationManifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateManifest(manifest: MigrationManifest): void {
  if (!manifest || !Array.isArray(manifest.directories) || !Array.isArray(manifest.files)) {
    throw migrationError('INVALID_JOURNAL', 'journal contains an invalid manifest')
  }

  let totalBytes = 0
  const directoryPaths = new Set<string>()
  const filePaths = new Set<string>()

  for (const directory of manifest.directories) {
    if (!safeRelativePath(directory) || directoryPaths.has(directory)) {
      throw migrationError('INVALID_JOURNAL', 'journal contains an unsafe or duplicate directory path')
    }

    directoryPaths.add(directory)
  }

  for (const file of manifest.files) {
    if (
      !file ||
      !safeRelativePath(file.path) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !/^[0-9a-f]{64}$/.test(file.sha256) ||
      typeof file.sqlite !== 'boolean' ||
      ![null, 'database', 'wal', 'shm'].includes(file.sqliteKind) ||
      file.sqlite !== (file.sqliteKind !== null) ||
      filePaths.has(file.path) ||
      directoryPaths.has(file.path)
    ) {
      throw migrationError('INVALID_JOURNAL', 'journal contains an invalid file manifest entry')
    }

    filePaths.add(file.path)
    totalBytes += file.size

    if (!Number.isSafeInteger(totalBytes)) {
      throw migrationError('INVALID_JOURNAL', 'journal manifest byte total exceeds the safe integer range')
    }
  }

  for (const path of [...directoryPaths, ...filePaths]) {
    const segments = path.split('/')

    for (let index = 1; index < segments.length; index += 1) {
      if (filePaths.has(segments.slice(0, index).join('/'))) {
        throw migrationError('INVALID_JOURNAL', 'journal manifest nests an entry below a file path')
      }
    }
  }

  if (!Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes !== totalBytes) {
    throw migrationError('INVALID_JOURNAL', 'journal manifest byte total is invalid')
  }
}

async function verifyTree(
  root: string,
  expected: MigrationManifest,
  code: 'SOURCE_CHANGED' | 'TREE_MISMATCH',
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<void> {
  const actual = await manifestTree(root, options)

  if (!manifestEquals(actual, expected)) {
    throw migrationError(code, `tree does not match its size/SHA-256 manifest: ${root}`)
  }
}

function nativeRelative(root: string, manifestPath: string): string {
  return join(root, ...manifestPath.split('/'))
}

async function copyTreeFromManifest(
  source: string,
  destination: string,
  manifest: MigrationManifest,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>,
  lease: ExclusiveIdentityMigrationLease
): Promise<void> {
  if (await lstatIfExists(destination)) {
    throw migrationError('DESTINATION_COLLISION', `copy target already exists: ${destination}`)
  }

  await assertExclusiveLeaseHeld(lease)
  await mkdir(destination)
  await assertExclusiveLeaseHeld(lease)

  const directories = [...manifest.directories].sort((left, right) => {
    const depthDifference = left.split('/').length - right.split('/').length

    return depthDifference || compareStrings(left, right)
  })

  for (const directory of directories) {
    await assertExclusiveLeaseHeld(lease)
    await mkdir(nativeRelative(destination, directory))
    await assertExclusiveLeaseHeld(lease)
  }

  for (const file of manifest.files) {
    await assertExclusiveLeaseHeld(lease)
    await copyFile(nativeRelative(source, file.path), nativeRelative(destination, file.path), constants.COPYFILE_EXCL)
    await assertExclusiveLeaseHeld(lease)
  }

  await verifyTree(destination, manifest, 'TREE_MISMATCH', options)
  await verifyTree(source, manifest, 'SOURCE_CHANGED', options)
}

async function assertNoSymlinkPathSegments(path: string): Promise<void> {
  const absolutePath = resolve(path)
  const parsedPath = parse(absolutePath)
  let currentPath = parsedPath.root
  const segments = absolutePath.slice(parsedPath.root.length).split(sep).filter(Boolean)

  for (const segment of segments) {
    currentPath = join(currentPath, segment)
    const entry = await lstatIfExists(currentPath)

    if (!entry) {
      return
    }

    if (entry.isSymbolicLink()) {
      throw migrationError('SYMLINK_REJECTED', `symlink path segment rejected: ${currentPath}`)
    }
  }
}

async function assertPathSafety(
  path: string,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>,
  purpose: PathSafetyContext['purpose']
): Promise<void> {
  await assertNoSymlinkPathSegments(path)
  const verifier = options.verifyPathSafety

  if (!verifier) {
    if (process.platform === 'win32') {
      throw migrationError(
        'REPARSE_VERIFIER_REQUIRED',
        'Windows identity migration requires an injected reparse-point verifier'
      )
    }

    return
  }

  const absolutePath = resolve(path)
  const parsedPath = parse(absolutePath)
  let currentPath = parsedPath.root
  const paths = [currentPath]

  for (const segment of absolutePath.slice(parsedPath.root.length).split(sep).filter(Boolean)) {
    currentPath = join(currentPath, segment)
    paths.push(currentPath)
  }

  for (const segmentPath of paths) {
    const exists = Boolean(await lstatIfExists(segmentPath))
    await assertInjectedPathSafety(segmentPath, verifier, { exists, purpose })
  }
}

async function assertInjectedPathSafety(
  path: string,
  verifier: NonNullable<VietnameseIdentityMigrationOptions['verifyPathSafety']>,
  context: PathSafetyContext
): Promise<void> {
  let safe = false

  try {
    safe = (await verifier(path, context)) === true
  } catch (error) {
    throw migrationError('REPARSE_POINT_REJECTED', `path-safety verifier failed: ${path}`, error)
  }

  if (!safe) {
    throw migrationError('REPARSE_POINT_REJECTED', `path-safety verifier rejected: ${path}`)
  }
}

async function nearestExistingPath(path: string): Promise<string> {
  let candidate = resolve(path)

  while (!(await lstatIfExists(candidate))) {
    const parent = dirname(candidate)

    if (parent === candidate) {
      throw migrationError('INVALID_PLAN', `no existing ancestor for path: ${path}`)
    }

    candidate = parent
  }

  return candidate
}

async function defaultStorageCapacity(path: string): Promise<StorageCapacity> {
  const existingPath = await nearestExistingPath(path)
  const [pathStat, fileSystem] = await Promise.all([stat(existingPath), statfs(existingPath, { bigint: true })])

  return {
    device: String(pathStat.dev),
    availableBytes: fileSystem.bavail * fileSystem.bsize
  }
}

type CapacityProbe = {
  path: string
  requiredBytes: bigint
}

async function assertCapacityProbes(
  probes: CapacityProbe[],
  options: VietnameseIdentityMigrationOptions
): Promise<void> {
  if (probes.length === 0) {
    return
  }

  const capacity = options.getStorageCapacity ?? defaultStorageCapacity
  const devices = new Map<string, { availableBytes: bigint; requiredBytes: bigint }>()

  for (const probe of probes) {
    const result = await capacity(probe.path)

    if (!result?.device || typeof result.availableBytes !== 'bigint' || result.availableBytes < 0n) {
      throw migrationError('INVALID_PLAN', `capacity provider returned invalid data for ${probe.path}`)
    }

    const existing = devices.get(result.device)

    if (existing) {
      existing.availableBytes =
        existing.availableBytes < result.availableBytes ? existing.availableBytes : result.availableBytes
      existing.requiredBytes += probe.requiredBytes
    } else {
      devices.set(result.device, {
        availableBytes: result.availableBytes,
        requiredBytes: probe.requiredBytes
      })
    }
  }

  const margin = options.capacitySafetyMarginBytes ?? DEFAULT_CAPACITY_MARGIN

  if (margin < 0n) {
    throw migrationError('INVALID_PLAN', 'capacitySafetyMarginBytes cannot be negative')
  }

  for (const [device, requirement] of devices) {
    if (requirement.availableBytes < requirement.requiredBytes + margin) {
      throw migrationError(
        'CAPACITY_INSUFFICIENT',
        `device ${device} has ${requirement.availableBytes} bytes available; ` +
          `${requirement.requiredBytes + margin} bytes are required before copying`
      )
    }
  }
}

async function assertInitialCapacity(
  plan: NormalizedPlan,
  manifests: Map<VietnameseIdentityRootId, MigrationManifest>,
  options: VietnameseIdentityMigrationOptions
): Promise<void> {
  await assertCapacityProbes(
    [
      {
        path: plan.stateDirectory,
        requiredBytes: plan.roots.reduce((total, root) => total + BigInt(manifests.get(root.id)!.totalBytes), 0n)
      },
      ...plan.roots.map(root => ({
        path: dirname(root.destination),
        requiredBytes: BigInt(manifests.get(root.id)!.totalBytes)
      }))
    ],
    options
  )
}

async function assertResumeCapacity(
  journal: MigrationJournal,
  options: VietnameseIdentityMigrationOptions
): Promise<boolean> {
  let snapshotBytes = 0n
  const probes: CapacityProbe[] = []

  for (const root of journal.roots) {
    if (!(await lstatIfExists(root.snapshotPath))) {
      snapshotBytes += BigInt(root.manifest.totalBytes)
    }

    if (!(await lstatIfExists(root.stagingPath))) {
      probes.push({
        path: dirname(root.destination),
        requiredBytes: BigInt(root.manifest.totalBytes)
      })
    }
  }

  if (snapshotBytes > 0n) {
    probes.unshift({ path: dirname(journal.roots[0].snapshotPath), requiredBytes: snapshotBytes })
  }

  await assertCapacityProbes(probes, options)

  return probes.length > 0
}

async function syncDirectory(directory: string): Promise<void> {
  let handle

  try {
    handle = await open(directory, constants.O_RDONLY)
    await handle.sync()
  } catch (error) {
    if (process.platform !== 'win32' || !['EACCES', 'EINVAL', 'EPERM'].includes(systemErrorCode(error) ?? '')) {
      throw error
    }
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
  afterPublish?: () => Promise<void>,
  mutationGuard?: () => Promise<void>,
  beforePublish?: () => Promise<void>
): Promise<void> {
  const directory = dirname(filePath)
  await assertNoSymlinkPathSegments(directory)
  await mutationGuard?.()
  await mkdir(directory, { recursive: true })
  await mutationGuard?.()
  await assertNoSymlinkPathSegments(directory)
  const temporaryPath = join(directory, `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`)
  let handle

  try {
    await mutationGuard?.()
    handle = await open(temporaryPath, 'wx', 0o600)
    await mutationGuard?.()
    await handle.writeFile(jsonDocument(value), 'utf8')
    await mutationGuard?.()
    await handle.sync()
    await mutationGuard?.()
    await handle.close()
    handle = undefined
    await mutationGuard?.()
    await beforePublish?.()
    await mutationGuard?.()
    await rename(temporaryPath, filePath)
    await mutationGuard?.()
    await afterPublish?.()
    await mutationGuard?.()
    await chmod(filePath, 0o600).catch(() => undefined)
    await mutationGuard?.()
    await syncDirectory(directory)
    await mutationGuard?.()
  } catch (error) {
    await handle?.close().catch(() => undefined)

    if (!(error instanceof VietnameseIdentityMigrationInterruption)) {
      try {
        await mutationGuard?.()
        await rm(temporaryPath, { force: true })
        await mutationGuard?.()
      } catch {
        // Never mutate covered state after lease ownership is lost.
      }
    }

    throw error
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  const fileStat = await lstatIfExists(filePath)

  if (!fileStat) {
    return undefined
  }

  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw migrationError('SYMLINK_REJECTED', `state file is not a regular non-symlink file: ${filePath}`)
  }

  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch (error) {
    throw migrationError('INVALID_JOURNAL', `cannot parse migration state: ${filePath}`, error)
  }
}

function validateRunId(runId: string): void {
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(runId)) {
    throw migrationError('INVALID_JOURNAL', 'migration run id is unsafe')
  }
}

function expectedSnapshotPath(plan: NormalizedPlan, runId: string, id: VietnameseIdentityRootId): string {
  return join(plan.stateDirectory, 'snapshots', runId, id)
}

function expectedStagingPath(destination: string, runId: string): string {
  return `${destination}.v33-migration-staging-${runId}`
}

function validateJournal(journal: MigrationJournal, plan: NormalizedPlan, planFingerprint: string): void {
  if (
    !journal ||
    journal.schemaVersion !== VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION ||
    journal.planFingerprint !== planFingerprint ||
    !Array.isArray(journal.roots) ||
    journal.roots.length !== plan.roots.length
  ) {
    throw migrationError('PLAN_MISMATCH', 'migration journal does not match the requested plan')
  }

  validateRunId(journal.runId)

  if (!/^[a-f0-9-]{36}$/.test(journal.leaseOwnerToken)) {
    throw migrationError('INVALID_JOURNAL', 'migration journal lease owner token is invalid')
  }

  for (const planRoot of plan.roots) {
    const root = journal.roots.find(candidate => candidate.id === planRoot.id)

    if (
      !root ||
      root.source !== planRoot.source ||
      root.destination !== planRoot.destination ||
      root.snapshotPath !== expectedSnapshotPath(plan, journal.runId, root.id) ||
      root.stagingPath !== expectedStagingPath(root.destination, journal.runId) ||
      root.sentinelSha256 !== rootSentinelSha256(rootSentinel(journal.planFingerprint, journal.runId, root)) ||
      !['planned', 'snapshotted', 'staged', 'promoting', 'promoted'].includes(root.state)
    ) {
      throw migrationError('INVALID_JOURNAL', `journal root is invalid: ${planRoot.id}`)
    }

    validateManifest(root.manifest)
  }
}

function validateCompletionMarker(marker: CompletionMarker, plan: NormalizedPlan, planFingerprint: string): void {
  if (
    !marker ||
    marker.schemaVersion !== VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION ||
    marker.planFingerprint !== planFingerprint ||
    !Array.isArray(marker.roots) ||
    marker.roots.length !== plan.roots.length
  ) {
    throw migrationError('PLAN_MISMATCH', 'completion marker does not match the requested plan')
  }

  for (const planRoot of plan.roots) {
    const root = marker.roots.find(candidate => candidate.id === planRoot.id)

    if (
      !root ||
      root.source !== planRoot.source ||
      root.destination !== planRoot.destination ||
      typeof root.migrationRunId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(root.migrationRunId) ||
      root.sentinelSha256 !== rootSentinelSha256(rootSentinel(marker.planFingerprint, root.migrationRunId, root))
    ) {
      throw migrationError('INVALID_JOURNAL', `completion marker root is invalid: ${planRoot.id}`)
    }

    validateManifest(root.manifest)
  }
}

function manifestsRecord(
  roots: Array<{ id: VietnameseIdentityRootId; manifest: MigrationManifest }>
): Record<VietnameseIdentityRootId, MigrationManifest> {
  return Object.fromEntries(roots.map(root => [root.id, root.manifest])) as Record<
    VietnameseIdentityRootId,
    MigrationManifest
  >
}

async function assertExclusiveLeaseHeld(lease: ExclusiveIdentityMigrationLease): Promise<void> {
  let held = false

  try {
    held = (await lease.assertHeld()) === true
  } catch (error) {
    throw migrationError('QUIESCENCE_LEASE_LOST', 'identity-data quiescence lease check failed', error)
  }

  if (!held) {
    throw migrationError('QUIESCENCE_LEASE_LOST', 'identity-data quiescence lease is no longer held')
  }
}

async function acquireExclusiveMigrationLease(
  plan: NormalizedPlan,
  options: VietnameseIdentityMigrationOptions
): Promise<ExclusiveIdentityMigrationLease> {
  let lease: ExclusiveIdentityMigrationLease

  const scope: ExclusiveIdentityMigrationScope = Object.freeze({
    planFingerprint: fingerprintPlan(plan),
    stateDirectory: plan.stateDirectory,
    roots: Object.freeze(plan.roots.map(root => Object.freeze({ ...root })))
  })

  try {
    lease = await options.acquireExclusiveMigrationLease(scope)
  } catch (error) {
    if (error instanceof VietnameseIdentityMigrationError) {
      throw error
    }

    throw migrationError('MIGRATION_LOCKED', 'could not acquire the exclusive identity migration lease', error)
  }

  if (
    lease?.coverage !== 'state-directory-and-both-identity-roots' ||
    lease?.implementation !== 'os-backed-cross-process' ||
    lease?.lifetime !== 'non-expiring-until-explicit-release-or-process-exit' ||
    lease?.transferability !== 'non-transferable' ||
    lease?.planFingerprint !== scope.planFingerprint ||
    typeof lease.ownerToken !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(lease.ownerToken) ||
    typeof lease.assertHeld !== 'function' ||
    typeof lease.release !== 'function'
  ) {
    await lease?.release?.().catch(() => undefined)
    throw migrationError('INVALID_PLAN', 'acquireExclusiveMigrationLease returned an invalid or incomplete lease')
  }

  try {
    await assertExclusiveLeaseHeld(lease)
  } catch (error) {
    await lease.release().catch(() => undefined)
    throw error
  }

  return lease
}

async function verifySqliteFiles(
  root: JournalRoot | CompletionMarker['roots'][number],
  basePath: string,
  phase: SqliteVerificationContext['phase'],
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety' | 'verifySqliteIntegrity'>,
  ownedDestination?: { planFingerprint: string; migrationRunId: string }
): Promise<void> {
  const sqliteFiles = root.manifest.files.filter(file => file.sqlite)
  const verifier = options.verifySqliteIntegrity

  if (sqliteFiles.length > 0 && !verifier) {
    throw migrationError('SQLITE_VERIFIER_REQUIRED', `${root.id} contains SQLite data but no verifier was provided`)
  }

  for (const file of sqliteFiles) {
    await verifier!(nativeRelative(basePath, file.path), {
      kind: file.sqliteKind!,
      rootId: root.id,
      relativePath: file.path,
      phase
    })
  }

  if (ownedDestination) {
    await verifyTreeWithSentinel(
      basePath,
      root,
      ownedDestination.planFingerprint,
      ownedDestination.migrationRunId,
      options
    )
  } else {
    await verifyTree(basePath, root.manifest, 'TREE_MISMATCH', options)
  }
}

async function quarantinePartialCopy(path: string, lease: ExclusiveIdentityMigrationLease): Promise<void> {
  const entry = await lstatIfExists(path)

  if (!entry) {
    return
  }

  if (entry.isSymbolicLink()) {
    throw migrationError('SYMLINK_REJECTED', `partial copy symlink rejected: ${path}`)
  }

  await assertExclusiveLeaseHeld(lease)
  await rename(path, `${path}.abandoned-${randomUUID()}`)
  await assertExclusiveLeaseHeld(lease)
}

async function createVerifiedCopy(
  source: string,
  finalPath: string,
  manifest: MigrationManifest,
  checkpoint: () => Promise<void>,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>,
  lease: ExclusiveIdentityMigrationLease,
  ownedRoot?: {
    root: JournalRoot
    journal: MigrationJournal
    beforeSentinelPublish: () => Promise<void>
  }
): Promise<void> {
  const existing = await lstatIfExists(finalPath)

  if (existing) {
    if (existing.isSymbolicLink()) {
      throw migrationError('SYMLINK_REJECTED', `copy target symlink rejected: ${finalPath}`)
    }

    if (ownedRoot && (await lstatIfExists(join(finalPath, ROOT_SENTINEL_NAME)))) {
      await verifyTreeWithSentinel(
        finalPath,
        ownedRoot.root,
        ownedRoot.journal.planFingerprint,
        ownedRoot.journal.runId,
        options
      )
    } else {
      await verifyTree(finalPath, manifest, 'TREE_MISMATCH', options)
    }

    await assertExclusiveLeaseHeld(lease)

    return
  }

  const copyingPath = `${finalPath}.copying`
  await quarantinePartialCopy(copyingPath, lease)
  await assertExclusiveLeaseHeld(lease)
  await mkdir(dirname(finalPath), { recursive: true })
  await assertExclusiveLeaseHeld(lease)
  await copyTreeFromManifest(source, copyingPath, manifest, options, lease)

  if (ownedRoot) {
    await ensureRootSentinel(
      copyingPath,
      ownedRoot.root,
      ownedRoot.journal,
      options,
      lease,
      ownedRoot.beforeSentinelPublish
    )
    await verifyTreeWithSentinel(
      copyingPath,
      ownedRoot.root,
      ownedRoot.journal.planFingerprint,
      ownedRoot.journal.runId,
      options
    )
  }

  await assertExclusiveLeaseHeld(lease)
  await rename(copyingPath, finalPath)
  await assertExclusiveLeaseHeld(lease)
  await checkpoint()
  await assertExclusiveLeaseHeld(lease)
}

async function assertRootSentinel(
  rootPath: string,
  root: VietnameseIdentityMigrationRoot & { sentinelSha256: string },
  planFingerprint: string,
  migrationRunId: string,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<void> {
  const sentinelPath = join(rootPath, ROOT_SENTINEL_NAME)
  await assertPathSafety(sentinelPath, options, 'work')
  const sentinelStat = await lstatIfExists(sentinelPath)

  if (sentinelStat?.isSymbolicLink() || !sentinelStat?.isFile()) {
    throw migrationError('TREE_MISMATCH', `owned destination sentinel is missing or unsafe: ${sentinelPath}`)
  }

  const expected = rootSentinel(planFingerprint, migrationRunId, root)
  const expectedDocument = jsonDocument(expected)

  if (root.sentinelSha256 !== rootSentinelSha256(expected)) {
    throw migrationError('INVALID_JOURNAL', `sentinel ledger mismatch for ${root.id}`)
  }

  const actualDocument = await readFile(sentinelPath, 'utf8')
  const actualSha256 = createHash('sha256').update(actualDocument, 'utf8').digest('hex')

  if (actualSha256 !== root.sentinelSha256 || actualDocument !== expectedDocument) {
    throw migrationError('TREE_MISMATCH', `owned destination sentinel does not match: ${sentinelPath}`)
  }
}

async function ensureRootSentinel(
  rootPath: string,
  root: JournalRoot,
  journal: MigrationJournal,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>,
  lease: ExclusiveIdentityMigrationLease,
  beforePublish?: () => Promise<void>
): Promise<void> {
  const sentinelPath = join(rootPath, ROOT_SENTINEL_NAME)
  const existing = await lstatIfExists(sentinelPath)

  if (!existing) {
    await assertPathSafety(sentinelPath, options, 'work')
    await writeJsonAtomic(
      sentinelPath,
      rootSentinel(journal.planFingerprint, journal.runId, root),
      undefined,
      () => assertExclusiveLeaseHeld(lease),
      beforePublish
    )
  }

  await assertExclusiveLeaseHeld(lease)
  await assertRootSentinel(rootPath, root, journal.planFingerprint, journal.runId, options)
}

async function verifyTreeWithSentinel(
  rootPath: string,
  root: JournalRoot | CompletionMarker['roots'][number],
  planFingerprint: string,
  migrationRunId: string,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<void> {
  await assertRootSentinel(rootPath, root, planFingerprint, migrationRunId, options)
  const actual = await manifestTree(rootPath, options)
  const sentinel = actual.files.find(file => file.path === ROOT_SENTINEL_NAME)

  if (!sentinel || actual.files.filter(file => file.path === ROOT_SENTINEL_NAME).length !== 1) {
    throw migrationError('TREE_MISMATCH', `owned destination sentinel inventory is invalid: ${rootPath}`)
  }

  const withoutSentinel: MigrationManifest = {
    directories: actual.directories,
    files: actual.files.filter(file => file.path !== ROOT_SENTINEL_NAME),
    totalBytes: actual.totalBytes - sentinel.size
  }

  if (!manifestEquals(withoutSentinel, root.manifest)) {
    throw migrationError('TREE_MISMATCH', `tree does not match its manifest plus owned sentinel: ${rootPath}`)
  }
}

async function assertDestinationFree(
  root: VietnameseIdentityMigrationRoot,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<void> {
  await assertPathSafety(root.destination, options, 'destination')

  if (await lstatIfExists(root.destination)) {
    throw migrationError('DESTINATION_COLLISION', `destination already exists: ${root.destination}`)
  }
}

async function assertStageAndDestinationSameVolume(root: JournalRoot): Promise<void> {
  const [stagingStat, destinationParentStat] = await Promise.all([
    stat(root.stagingPath),
    stat(dirname(root.destination))
  ])

  if (stagingStat.dev !== destinationParentStat.dev) {
    throw migrationError('SAME_VOLUME_REQUIRED', `staging and destination are on different devices for ${root.id}`)
  }
}

async function writeOwnedJournal(
  path: string,
  journal: MigrationJournal,
  now: () => Date,
  lease: ExclusiveIdentityMigrationLease
): Promise<void> {
  if (journal.leaseOwnerToken !== lease.ownerToken) {
    throw migrationError('LOCK_OWNERSHIP_LOST', 'refusing to write a journal owned by another migration lease')
  }

  await assertExclusiveLeaseHeld(lease)
  journal.updatedAt = now().toISOString()
  await writeJsonAtomic(path, journal, undefined, () => assertExclusiveLeaseHeld(lease))
  await assertExclusiveLeaseHeld(lease)
}

async function rollbackPromotedRoots(
  journal: MigrationJournal,
  lease: ExclusiveIdentityMigrationLease,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<void> {
  if (journal.leaseOwnerToken !== lease.ownerToken) {
    throw migrationError('LOCK_OWNERSHIP_LOST', 'refusing rollback for a journal not owned by this migration writer')
  }

  await assertExclusiveLeaseHeld(lease)
  const rollbackErrors: unknown[] = []

  for (const root of [...journal.roots].reverse()) {
    const destination = await lstatIfExists(root.destination)

    if (!destination || !['promoting', 'promoted'].includes(root.state)) {
      continue
    }

    try {
      if (destination.isSymbolicLink()) {
        throw migrationError('SYMLINK_REJECTED', `promoted destination became a symlink: ${root.destination}`)
      }

      await verifyTreeWithSentinel(root.destination, root, journal.planFingerprint, journal.runId, options)

      if (await lstatIfExists(root.stagingPath)) {
        throw migrationError('DESTINATION_COLLISION', `rollback staging path is occupied: ${root.stagingPath}`)
      }

      await assertExclusiveLeaseHeld(lease)
      await rename(root.destination, root.stagingPath)
      await assertExclusiveLeaseHeld(lease)
      root.state = 'staged'
    } catch (error) {
      if (error instanceof VietnameseIdentityMigrationError && error.code === 'QUIESCENCE_LEASE_LOST') {
        throw error
      }

      rollbackErrors.push(error)
    }
  }

  if (rollbackErrors.length > 0) {
    throw migrationError(
      'ROLLBACK_FAILED',
      `could not roll back ${rollbackErrors.length} promoted root(s)`,
      rollbackErrors
    )
  }
}

async function reconcileInterruptedPromotion(
  journal: MigrationJournal,
  markerPath: string,
  options: VietnameseIdentityMigrationOptions,
  now: () => Date,
  lease: ExclusiveIdentityMigrationLease,
  checkpoint: (checkpoint: MigrationCheckpoint) => Promise<void>
): Promise<'resume' | 'complete'> {
  if (journal.leaseOwnerToken !== lease.ownerToken) {
    throw migrationError('LOCK_OWNERSHIP_LOST', 'refusing recovery for a journal not owned by this migration writer')
  }

  const destinationStates = await Promise.all(
    journal.roots.map(async root => ({
      root,
      destination: await lstatIfExists(root.destination),
      staging: await lstatIfExists(root.stagingPath)
    }))
  )

  const existingDestinations = destinationStates.filter(state => state.destination)

  if (existingDestinations.length === journal.roots.length) {
    if (existingDestinations.some(state => !['promoting', 'promoted'].includes(state.root.state) || state.staging)) {
      throw migrationError(
        'DESTINATION_COLLISION',
        'destinations exist but are not all owned by the interrupted promotion'
      )
    }

    for (const { root, destination } of existingDestinations) {
      if (destination!.isSymbolicLink()) {
        throw migrationError('SYMLINK_REJECTED', `promoted destination is a symlink: ${root.destination}`)
      }

      await verifySqliteFiles(root, root.destination, 'destination', options, {
        planFingerprint: journal.planFingerprint,
        migrationRunId: journal.runId
      })
      root.state = 'promoted'
    }

    journal.state = 'promoted'

    const marker: CompletionMarker = {
      schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
      planFingerprint: journal.planFingerprint,
      completedAt: now().toISOString(),
      roots: journal.roots.map(root => ({
        id: root.id,
        source: root.source,
        destination: root.destination,
        manifest: root.manifest,
        migrationRunId: journal.runId,
        sentinelSha256: root.sentinelSha256
      }))
    }

    await assertExclusiveLeaseHeld(lease)
    await writeJsonAtomic(
      markerPath,
      marker,
      () => checkpoint({ phase: 'completion-marker-published' }),
      () => assertExclusiveLeaseHeld(lease)
    )
    journal.state = 'complete'

    return 'complete'
  }

  for (const state of existingDestinations) {
    if (!['promoting', 'promoted'].includes(state.root.state)) {
      throw migrationError('DESTINATION_COLLISION', `unowned destination appeared: ${state.root.destination}`)
    }
  }

  await rollbackPromotedRoots(journal, lease, options)
  journal.state = journal.roots.every(root => root.state === 'staged') ? 'staged' : 'failed'

  return 'resume'
}

async function loadCompletedResult(
  marker: CompletionMarker,
  plan: NormalizedPlan,
  planFingerprint: string,
  paths: ReturnType<typeof vietnameseIdentityMigrationStatePaths>,
  options: Pick<VietnameseIdentityMigrationOptions, 'verifyPathSafety'>
): Promise<VietnameseIdentityMigrationResult> {
  validateCompletionMarker(marker, plan, planFingerprint)

  for (const root of marker.roots) {
    await assertPathSafety(root.destination, options, 'destination')
    const destination = await lstatIfExists(root.destination)

    if (destination?.isSymbolicLink()) {
      throw migrationError('SYMLINK_REJECTED', `completed destination is a symlink/reparse point: ${root.destination}`)
    }

    if (!destination?.isDirectory()) {
      throw migrationError(
        'TREE_MISMATCH',
        `completed destination root is missing or is not a directory: ${root.destination}`
      )
    }

    await assertRootSentinel(root.destination, root, planFingerprint, root.migrationRunId, options)
  }

  return {
    status: 'already-complete',
    planFingerprint,
    journalPath: paths.journalPath,
    completionMarkerPath: paths.completionMarkerPath,
    manifests: manifestsRecord(marker.roots)
  }
}

async function migrateWithExclusiveLease(
  plan: NormalizedPlan,
  options: VietnameseIdentityMigrationOptions,
  lease: ExclusiveIdentityMigrationLease
): Promise<VietnameseIdentityMigrationResult> {
  const planFingerprint = fingerprintPlan(plan)
  const paths = vietnameseIdentityMigrationStatePaths(plan)
  const now = options.now ?? (() => new Date())
  const checkpoint = options.checkpoint ?? (async () => undefined)
  let journal: MigrationJournal | undefined

  await assertExclusiveLeaseHeld(lease)
  await assertPathSafety(paths.journalPath, options, 'state')
  await assertPathSafety(paths.completionMarkerPath, options, 'state')
  await assertExclusiveLeaseHeld(lease)
  const existingMarker = await readJsonIfExists<CompletionMarker>(paths.completionMarkerPath)

  if (existingMarker) {
    return loadCompletedResult(existingMarker, plan, planFingerprint, paths, options)
  }

  try {
    journal = await readJsonIfExists<MigrationJournal>(paths.journalPath)

    if (journal) {
      validateJournal(journal, plan, planFingerprint)
      journal.leaseOwnerToken = lease.ownerToken
      await writeOwnedJournal(paths.journalPath, journal, now, lease)

      const reconciliation = await reconcileInterruptedPromotion(
        journal,
        paths.completionMarkerPath,
        options,
        now,
        lease,
        checkpoint
      )

      if (reconciliation === 'complete') {
        await writeOwnedJournal(paths.journalPath, journal, now, lease).catch(() => undefined)

        return {
          status: 'recovered-complete',
          planFingerprint,
          journalPath: paths.journalPath,
          completionMarkerPath: paths.completionMarkerPath,
          manifests: manifestsRecord(journal.roots)
        }
      }

      await writeOwnedJournal(paths.journalPath, journal, now, lease)

      if (await assertResumeCapacity(journal, options)) {
        await checkpoint({ phase: 'capacity-checked' })
      }
    } else {
      for (const root of plan.roots) {
        await assertDestinationFree(root, options)
        await assertPathSafety(root.source, options, 'source')
      }

      const manifests = new Map<VietnameseIdentityRootId, MigrationManifest>()

      for (const root of plan.roots) {
        const manifest = await manifestTree(root.source, options)

        if (manifest.files.some(file => file.path === ROOT_SENTINEL_NAME)) {
          throw migrationError(
            'INVALID_PLAN',
            `legacy source already contains the V33 ownership sentinel: ${root.source}`
          )
        }

        manifests.set(root.id, manifest)
      }

      await assertInitialCapacity(plan, manifests, options)
      await checkpoint({ phase: 'capacity-checked' })
      const runId = (options.createRunId ?? randomUUID)()
      validateRunId(runId)
      const timestamp = now().toISOString()
      journal = {
        schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
        runId,
        leaseOwnerToken: lease.ownerToken,
        planFingerprint,
        state: 'preparing',
        createdAt: timestamp,
        updatedAt: timestamp,
        roots: plan.roots.map(root => ({
          ...root,
          snapshotPath: expectedSnapshotPath(plan, runId, root.id),
          stagingPath: expectedStagingPath(root.destination, runId),
          manifest: manifests.get(root.id)!,
          sentinelSha256: rootSentinelSha256(rootSentinel(planFingerprint, runId, root)),
          state: 'planned'
        }))
      }
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
      await checkpoint({ phase: 'journal-created' })
    }

    for (const root of journal.roots) {
      await assertExclusiveLeaseHeld(lease)
      await assertPathSafety(root.snapshotPath, options, 'work')
      await verifyTree(root.source, root.manifest, 'SOURCE_CHANGED', options)
      await createVerifiedCopy(
        root.source,
        root.snapshotPath,
        root.manifest,
        () => checkpoint({ phase: 'snapshot-ready', rootId: root.id }),
        options,
        lease
      )
      await verifySqliteFiles(root, root.snapshotPath, 'snapshot', options)
      root.state = 'snapshotted'
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
    }

    journal.state = 'snapshotted'
    await writeOwnedJournal(paths.journalPath, journal, now, lease)

    for (const root of journal.roots) {
      await assertExclusiveLeaseHeld(lease)
      await assertPathSafety(root.stagingPath, options, 'work')
      await assertExclusiveLeaseHeld(lease)
      await mkdir(dirname(root.destination), { recursive: true })
      await assertExclusiveLeaseHeld(lease)
      await assertPathSafety(root.destination, options, 'destination')

      if (await lstatIfExists(root.destination)) {
        throw migrationError('DESTINATION_COLLISION', `destination appeared before promotion: ${root.destination}`)
      }

      await createVerifiedCopy(
        root.snapshotPath,
        root.stagingPath,
        root.manifest,
        () => checkpoint({ phase: 'staging-ready', rootId: root.id }),
        options,
        lease,
        {
          root,
          journal,
          beforeSentinelPublish: () => checkpoint({ phase: 'sentinel-temporary-written', rootId: root.id })
        }
      )
      await assertStageAndDestinationSameVolume(root)
      await ensureRootSentinel(root.stagingPath, root, journal, options, lease)
      await verifySqliteFiles(root, root.stagingPath, 'staging', options, {
        planFingerprint: journal.planFingerprint,
        migrationRunId: journal.runId
      })
      root.state = 'staged'
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
    }

    journal.state = 'staged'
    await writeOwnedJournal(paths.journalPath, journal, now, lease)
    await assertExclusiveLeaseHeld(lease)
    journal.state = 'promoting'
    await writeOwnedJournal(paths.journalPath, journal, now, lease)

    for (const root of journal.roots) {
      await assertExclusiveLeaseHeld(lease)
      root.state = 'promoting'
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
      await checkpoint({ phase: 'before-root-promote', rootId: root.id })
      await assertPathSafety(root.destination, options, 'destination')

      if (await lstatIfExists(root.destination)) {
        throw migrationError('DESTINATION_COLLISION', `destination appeared during promotion: ${root.destination}`)
      }

      await assertExclusiveLeaseHeld(lease)
      await rename(root.stagingPath, root.destination)
      await assertExclusiveLeaseHeld(lease)
      await checkpoint({ phase: 'after-root-promote', rootId: root.id })
      root.state = 'promoted'
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
    }

    journal.state = 'promoted'
    await writeOwnedJournal(paths.journalPath, journal, now, lease)

    for (const root of journal.roots) {
      await assertExclusiveLeaseHeld(lease)
      await verifySqliteFiles(root, root.destination, 'destination', options, {
        planFingerprint: journal.planFingerprint,
        migrationRunId: journal.runId
      })
    }

    await checkpoint({ phase: 'after-all-promotes' })
    await assertExclusiveLeaseHeld(lease)
    const migrationRunId = journal.runId

    const marker: CompletionMarker = {
      schemaVersion: VIETNAMESE_IDENTITY_MIGRATION_SCHEMA_VERSION,
      planFingerprint,
      completedAt: now().toISOString(),
      roots: journal.roots.map(root => ({
        id: root.id,
        source: root.source,
        destination: root.destination,
        manifest: root.manifest,
        migrationRunId,
        sentinelSha256: root.sentinelSha256
      }))
    }

    await writeJsonAtomic(
      paths.completionMarkerPath,
      marker,
      () => checkpoint({ phase: 'completion-marker-published' }),
      () => assertExclusiveLeaseHeld(lease)
    )
    journal.state = 'complete'
    delete journal.lastError
    await writeOwnedJournal(paths.journalPath, journal, now, lease).catch(() => undefined)

    return {
      status: 'completed',
      planFingerprint,
      journalPath: paths.journalPath,
      completionMarkerPath: paths.completionMarkerPath,
      manifests: manifestsRecord(journal.roots)
    }
  } catch (error) {
    const markerEntry = await lstatIfExists(paths.completionMarkerPath)

    if (markerEntry) {
      const publishedMarker = await readJsonIfExists<CompletionMarker>(paths.completionMarkerPath)

      if (!publishedMarker) {
        throw migrationError('INVALID_JOURNAL', 'published completion marker disappeared during recovery')
      }

      const completed = await loadCompletedResult(publishedMarker, plan, planFingerprint, paths, options)

      if (journal) {
        journal.state = 'complete'
        delete journal.lastError
        await writeOwnedJournal(paths.journalPath, journal, now, lease).catch(() => undefined)
      }

      return { ...completed, status: 'recovered-complete' }
    }

    if (!journal || error instanceof VietnameseIdentityMigrationInterruption) {
      throw error
    }

    await assertExclusiveLeaseHeld(lease)

    try {
      await rollbackPromotedRoots(journal, lease, options)
      journal.state = 'failed'
      journal.lastError = error instanceof Error ? error.message : String(error)
      await writeOwnedJournal(paths.journalPath, journal, now, lease)
    } catch (rollbackError) {
      if (rollbackError instanceof VietnameseIdentityMigrationError && rollbackError.code === 'QUIESCENCE_LEASE_LOST') {
        throw rollbackError
      }

      journal.state = 'failed'
      journal.lastError = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      await writeOwnedJournal(paths.journalPath, journal, now, lease).catch(() => undefined)
      throw migrationError(
        'ROLLBACK_FAILED',
        'migration failed and its promoted roots could not be rolled back',
        rollbackError
      )
    }

    if (error instanceof VietnameseIdentityMigrationError) {
      throw error
    }

    throw migrationError('MIGRATION_FAILED', 'identity migration failed', error)
  }
}

export async function migrateVietnameseIdentity(
  requestedPlan: VietnameseIdentityMigrationPlan,
  options: VietnameseIdentityMigrationOptions
): Promise<VietnameseIdentityMigrationResult> {
  if (!options || typeof options.acquireExclusiveMigrationLease !== 'function') {
    throw migrationError('INVALID_PLAN', 'acquireExclusiveMigrationLease callback is required')
  }

  const plan = normalizePlan(requestedPlan)
  await assertPathSafety(plan.stateDirectory, options, 'state')

  for (const root of plan.roots) {
    await assertPathSafety(root.source, options, 'source')
    await assertPathSafety(root.destination, options, 'destination')
  }

  const lease = await acquireExclusiveMigrationLease(plan, options)
  let operationFailed = false
  let operationError: unknown
  let result: VietnameseIdentityMigrationResult | undefined

  try {
    result = await migrateWithExclusiveLease(plan, options, lease)
  } catch (error) {
    operationFailed = true
    operationError = error
  }

  let releaseFailed = false

  try {
    await lease.release()
  } catch {
    releaseFailed = true
  }

  if (operationFailed) {
    throw operationError
  }

  if (!result) {
    throw migrationError('MIGRATION_FAILED', 'identity migration returned without a result')
  }

  if (releaseFailed) {
    return {
      ...result,
      warnings: [...(result.warnings ?? []), 'LEASE_RELEASE_FAILED_AFTER_COMMIT']
    }
  }

  return result
}
