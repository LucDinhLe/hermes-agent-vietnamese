import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import {
  createVietnameseIdentityMigrationPlan,
  type ExclusiveIdentityMigrationLease,
  type ExclusiveIdentityMigrationScope,
  migrateVietnameseIdentity,
  type MigrationCheckpoint,
  VietnameseIdentityMigrationError,
  VietnameseIdentityMigrationInterruption,
  type VietnameseIdentityMigrationOptions,
  type VietnameseIdentityMigrationPlan,
  vietnameseIdentityMigrationStatePaths
} from './vietnamese-identity-migration'

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8')
const MIGRATION_TEST_TIMEOUT = 15_000
const temporaryDirectories: string[] = []
let leaseSequence = 0

type Fixture = {
  root: string
  plan: VietnameseIdentityMigrationPlan
  legacyHermesHome: string
  vietnameseHermesHome: string
  legacyElectronUserData: string
  vietnameseElectronUserData: string
  stateDirectory: string
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function nextOwnerToken(): string {
  leaseSequence += 1

  return `00000000-0000-4000-8000-${leaseSequence.toString(16).padStart(12, '0')}`
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'hermes-v33-identity-migration-'))
  temporaryDirectories.push(root)
  const legacyHermesHome = join(root, 'legacy-hermes-home')
  const vietnameseHermesHome = join(root, 'vietnamese-hermes-home')
  const legacyElectronUserData = join(root, 'legacy-electron-user-data')
  const vietnameseElectronUserData = join(root, 'vietnamese-electron-user-data')
  const stateDirectory = join(root, 'migration-state')

  await mkdir(join(legacyHermesHome, 'nested'), { recursive: true })
  await mkdir(join(legacyHermesHome, 'empty-directory'), { recursive: true })
  await mkdir(join(legacyElectronUserData, 'databases'), { recursive: true })
  await writeFile(join(legacyHermesHome, 'config.yaml'), 'model: test\n', 'utf8')
  await writeFile(join(legacyHermesHome, 'nested', 'memory.txt'), 'nguon du lieu goc\n', 'utf8')
  await writeFile(
    join(legacyElectronUserData, 'databases', 'state.db'),
    Buffer.concat([SQLITE_HEADER, Buffer.from('fixture database payload')])
  )
  await writeFile(join(legacyElectronUserData, 'databases', 'state.db-wal'), Buffer.from('wal fixture payload'))
  await writeFile(join(legacyElectronUserData, 'databases', 'state.db-shm'), Buffer.from('shm fixture payload'))
  await writeFile(join(legacyElectronUserData, 'Preferences'), '{"theme":"dark"}\n', 'utf8')

  return {
    root,
    plan: createVietnameseIdentityMigrationPlan({
      legacyHermesHome,
      vietnameseHermesHome,
      legacyElectronUserData,
      vietnameseElectronUserData,
      stateDirectory
    }),
    legacyHermesHome,
    vietnameseHermesHome,
    legacyElectronUserData,
    vietnameseElectronUserData,
    stateDirectory
  }
}

function successfulOptions(overrides: Partial<VietnameseIdentityMigrationOptions> = {}) {
  const leaseEvents: string[] = []
  const sqliteVerifications: Array<{ path: string; phase: string; kind: string }> = []
  const ownerToken = nextOwnerToken()

  const options: VietnameseIdentityMigrationOptions = {
    acquireExclusiveMigrationLease: async scope => {
      let held = true
      leaseEvents.push('acquire')

      return {
        coverage: 'state-directory-and-both-identity-roots',
        implementation: 'os-backed-cross-process',
        lifetime: 'non-expiring-until-explicit-release-or-process-exit',
        transferability: 'non-transferable',
        ownerToken,
        planFingerprint: scope.planFingerprint,
        assertHeld: async () => {
          leaseEvents.push('assert-held')

          return held
        },
        release: async () => {
          assert.equal(held, true)
          held = false
          leaseEvents.push('release')
        }
      }
    },
    verifyPathSafety: async () => true,
    getStorageCapacity: async () => ({
      device: 'test-volume',
      availableBytes: 1024n * 1024n * 1024n
    }),
    capacitySafetyMarginBytes: 0n,
    verifySqliteIntegrity: async (filePath, context) => {
      const contents = await readFile(filePath)

      if (context.kind === 'database') {
        assert.deepEqual(contents.subarray(0, SQLITE_HEADER.length), SQLITE_HEADER)
      } else {
        assert.ok(contents.length > 0)
      }

      sqliteVerifications.push({
        path: filePath,
        phase: context.phase,
        kind: context.kind
      })
    },
    ...overrides
  }

  return { leaseEvents, options, sqliteVerifications }
}

async function readJournal(plan: VietnameseIdentityMigrationPlan) {
  const { journalPath } = vietnameseIdentityMigrationStatePaths(plan)

  return JSON.parse(await readFile(journalPath, 'utf8')) as {
    leaseOwnerToken: string
    state: string
    roots: Array<{
      id: string
      state: string
      snapshotPath: string
      stagingPath: string
    }>
  }
}

describe('Vietnamese identity migration', () => {
  test('binds the external OS lease provider to the exact state directory and identity plan', async () => {
    const setup = await fixture()
    let observedScope: ExclusiveIdentityMigrationScope | undefined

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope => {
        observedScope = scope

        return {
          coverage: 'state-directory-and-both-identity-roots',
          implementation: 'os-backed-cross-process',
          lifetime: 'non-expiring-until-explicit-release-or-process-exit',
          transferability: 'non-transferable',
          ownerToken: nextOwnerToken(),
          planFingerprint: scope.planFingerprint,
          assertHeld: async () => true,
          release: async () => undefined
        }
      }
    })

    const result = await migrateVietnameseIdentity(setup.plan, options)

    expect(result.status).toBe('completed')
    expect(observedScope).toBeDefined()
    expect(observedScope!.planFingerprint).toBe(result.planFingerprint)
    expect(observedScope!.stateDirectory).toBe(setup.stateDirectory)
    expect(observedScope!.roots).toEqual(setup.plan.roots)
    expect(Object.isFrozen(observedScope!)).toBe(true)
    expect(Object.isFrozen(observedScope!.roots)).toBe(true)
    expect(observedScope!.roots.every(root => Object.isFrozen(root))).toBe(true)
  })

  test('rejects a lease that is not bound to the requested plan fingerprint', async () => {
    const setup = await fixture()
    let released = false

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async () => ({
        coverage: 'state-directory-and-both-identity-roots',
        implementation: 'os-backed-cross-process',
        lifetime: 'non-expiring-until-explicit-release-or-process-exit',
        transferability: 'non-transferable',
        ownerToken: nextOwnerToken(),
        planFingerprint: '0'.repeat(64),
        assertHeld: async () => true,
        release: async () => {
          released = true
        }
      })
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({ code: 'INVALID_PLAN' })
    expect(released).toBe(true)
    await expect(readdir(setup.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('rejects a provider that cannot attest to an OS-backed cross-process lease', async () => {
    const setup = await fixture()
    let released = false

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope =>
        ({
          coverage: 'state-directory-and-both-identity-roots',
          implementation: 'in-process-only',
          ownerToken: nextOwnerToken(),
          planFingerprint: scope.planFingerprint,
          assertHeld: async () => true,
          release: async () => {
            released = true
          }
        }) as unknown as ExclusiveIdentityMigrationLease
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({ code: 'INVALID_PLAN' })
    expect(released).toBe(true)
  })

  test('rejects TTL or transferable lease semantics as an unsafe rename fence', async () => {
    const setup = await fixture()
    let released = false

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope =>
        ({
          coverage: 'state-directory-and-both-identity-roots',
          implementation: 'os-backed-cross-process',
          lifetime: 'ttl-heartbeat',
          transferability: 'transferable',
          ownerToken: nextOwnerToken(),
          planFingerprint: scope.planFingerprint,
          assertHeld: async () => true,
          release: async () => {
            released = true
          }
        }) as unknown as ExclusiveIdentityMigrationLease
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({ code: 'INVALID_PLAN' })
    expect(released).toBe(true)
  })

  test('holds one exclusive lease across snapshot, verification, staging, promotion and marker commit', async () => {
    const setup = await fixture()
    const originalConfig = await readFile(join(setup.legacyHermesHome, 'config.yaml'), 'utf8')
    const originalDatabase = await readFile(join(setup.legacyElectronUserData, 'databases', 'state.db'))
    const { leaseEvents, options, sqliteVerifications } = successfulOptions()

    const result = await migrateVietnameseIdentity(setup.plan, options)

    expect(result.status).toBe('completed')
    expect(leaseEvents[0]).toBe('acquire')
    expect(leaseEvents.at(-1)).toBe('release')
    expect(leaseEvents.filter(event => event === 'assert-held').length).toBeGreaterThan(5)
    expect(new Set(sqliteVerifications.map(item => item.kind))).toEqual(new Set(['database', 'wal', 'shm']))
    expect(sqliteVerifications.map(item => item.phase)).toEqual([
      'snapshot',
      'snapshot',
      'snapshot',
      'staging',
      'staging',
      'staging',
      'destination',
      'destination',
      'destination'
    ])
    expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe(originalConfig)
    expect(await readFile(join(setup.vietnameseElectronUserData, 'databases', 'state.db'))).toEqual(originalDatabase)
    expect(await readdir(join(setup.vietnameseHermesHome, 'empty-directory'))).toEqual([])
    expect(await readFile(join(setup.legacyHermesHome, 'config.yaml'), 'utf8')).toBe(originalConfig)
    expect(await readFile(join(setup.legacyElectronUserData, 'databases', 'state.db'))).toEqual(originalDatabase)

    const stateEntries = await readdir(setup.stateDirectory)
    expect(stateEntries).toContain('migration-journal.v1.json')
    expect(stateEntries).toContain('migration-complete.v1.json')
    expect(stateEntries.some(entry => entry.endsWith('.tmp'))).toBe(false)
  })

  test('fails closed and releases an exclusive lease that is not held', async () => {
    const setup = await fixture()
    const events: string[] = []

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope => ({
        coverage: 'state-directory-and-both-identity-roots',
        implementation: 'os-backed-cross-process',
        lifetime: 'non-expiring-until-explicit-release-or-process-exit',
        transferability: 'non-transferable',
        ownerToken: nextOwnerToken(),
        planFingerprint: scope.planFingerprint,
        assertHeld: async () => false,
        release: async () => {
          events.push('release')
        }
      })
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'QUIESCENCE_LEASE_LOST'
    })
    expect(events).toEqual(['release'])
    await expect(readdir(setup.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('releases the exclusive lease after an ordinary migration failure', async () => {
    const setup = await fixture()

    const { leaseEvents, options } = successfulOptions({
      getStorageCapacity: async () => ({ device: 'test-volume', availableBytes: 1n })
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'CAPACITY_INSUFFICIENT'
    })
    expect(leaseEvents.at(-1)).toBe('release')
  })

  test('does not let release failure mask the original migration failure', async () => {
    const setup = await fixture()
    let releaseAttempted = false

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope => ({
        coverage: 'state-directory-and-both-identity-roots',
        implementation: 'os-backed-cross-process',
        lifetime: 'non-expiring-until-explicit-release-or-process-exit',
        transferability: 'non-transferable',
        ownerToken: nextOwnerToken(),
        planFingerprint: scope.planFingerprint,
        assertHeld: async () => true,
        release: async () => {
          releaseAttempted = true
          throw new Error('injected release failure')
        }
      }),
      getStorageCapacity: async () => ({ device: 'test-volume', availableBytes: 1n })
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'CAPACITY_INSUFFICIENT'
    })
    expect(releaseAttempted).toBe(true)
  })

  test('rejects a destination collision before capacity checks or copying', async () => {
    const setup = await fixture()
    await mkdir(setup.vietnameseHermesHome)
    let capacityChecked = false

    const { options } = successfulOptions({
      getStorageCapacity: async () => {
        capacityChecked = true

        return { device: 'test-volume', availableBytes: 1024n }
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'DESTINATION_COLLISION'
    })
    expect(capacityChecked).toBe(false)
    await expect(readdir(setup.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('rejects symlinks anywhere inside a legacy root before lstat follows them', async context => {
    const setup = await fixture()
    const outside = join(setup.root, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'secret.txt'), 'must not be followed', 'utf8')

    try {
      await symlink(
        outside,
        join(setup.legacyHermesHome, 'linked-directory'),
        process.platform === 'win32' ? 'junction' : 'dir'
      )
    } catch (error) {
      if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        context.skip()

        return
      }

      throw error
    }

    const { options } = successfulOptions()
    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({ code: 'SYMLINK_REJECTED' })
    expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toBe('must not be followed')
  })

  test('checks aggregate snapshot plus staging capacity before the first copy', async () => {
    const setup = await fixture()
    const checkpoints: MigrationCheckpoint[] = []

    const { options } = successfulOptions({
      getStorageCapacity: async () => ({ device: 'single-volume', availableBytes: 1n }),
      checkpoint: async checkpoint => {
        checkpoints.push(checkpoint)
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'CAPACITY_INSUFFICIENT'
    })
    expect(checkpoints).toEqual([])
    await expect(readdir(setup.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('fails closed when SQLite candidates exist without a read-only integrity verifier', async () => {
    const setup = await fixture()
    const { options } = successfulOptions()
    delete options.verifySqliteIntegrity

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'SQLITE_VERIFIER_REQUIRED'
    })
    await expect(readdir(setup.vietnameseHermesHome)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('rejects a .sqlite candidate whose main database header is missing', async () => {
    const setup = await fixture()
    await writeFile(join(setup.legacyHermesHome, 'corrupt.sqlite'), 'not a sqlite database', 'utf8')
    const { options } = successfulOptions()

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({
      code: 'SQLITE_HEADER_INVALID'
    })
    expect(await readFile(join(setup.legacyHermesHome, 'corrupt.sqlite'), 'utf8')).toBe('not a sqlite database')
  })

  test('detects and rejects an integrity verifier that mutates its snapshot', async () => {
    const setup = await fixture()

    const { options } = successfulOptions({
      verifySqliteIntegrity: async (filePath, context) => {
        if (context.phase === 'snapshot' && context.kind === 'database') {
          await writeFile(filePath, Buffer.concat([SQLITE_HEADER, Buffer.from('mutated by verifier')]))
        }
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toMatchObject({ code: 'TREE_MISMATCH' })
    expect(await readFile(join(setup.legacyElectronUserData, 'databases', 'state.db'))).toEqual(
      Buffer.concat([SQLITE_HEADER, Buffer.from('fixture database payload')])
    )
  })

  test(
    'rolls the first root back when the second promote faults, then resumes safely',
    async () => {
      const setup = await fixture()

      const { options } = successfulOptions({
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'before-root-promote' && checkpoint.rootId === 'electron-user-data') {
            throw new Error('injected second-root promote failure')
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toBeInstanceOf(
        VietnameseIdentityMigrationError
      )
      await expect(readdir(setup.vietnameseHermesHome)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readdir(setup.vietnameseElectronUserData)).rejects.toMatchObject({ code: 'ENOENT' })
      const failedJournal = await readJournal(setup.plan)
      expect(failedJournal.state).toBe('failed')
      expect(failedJournal.roots.find(root => root.id === 'hermes-home')?.state).toBe('staged')

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)
      expect(result.status).toBe('completed')
      expect(await readFile(join(setup.vietnameseHermesHome, 'nested', 'memory.txt'), 'utf8')).toBe(
        'nguon du lieu goc\n'
      )
    },
    MIGRATION_TEST_TIMEOUT
  )

  test(
    'recovers a crash after one root rename by rolling it back before resuming',
    async () => {
      const setup = await fixture()

      const { options } = successfulOptions({
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'after-root-promote' && checkpoint.rootId === 'hermes-home') {
            throw new VietnameseIdentityMigrationInterruption('crash after first rename')
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toBeInstanceOf(
        VietnameseIdentityMigrationInterruption
      )
      expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)
      expect(result.status).toBe('completed')
      expect(await readFile(join(setup.vietnameseElectronUserData, 'Preferences'), 'utf8')).toBe('{"theme":"dark"}\n')
    },
    MIGRATION_TEST_TIMEOUT
  )

  test(
    'recovers when the second root rename landed before its journal update',
    async () => {
      const setup = await fixture()

      const first = successfulOptions({
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'after-root-promote' && checkpoint.rootId === 'electron-user-data') {
            throw new VietnameseIdentityMigrationInterruption('crash after second rename before journal update')
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, first.options)).rejects.toBeInstanceOf(
        VietnameseIdentityMigrationInterruption
      )
      expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')
      expect(await readFile(join(setup.vietnameseElectronUserData, 'Preferences'), 'utf8')).toBe('{"theme":"dark"}\n')
      const paths = vietnameseIdentityMigrationStatePaths(setup.plan)
      await expect(readFile(paths.completionMarkerPath)).rejects.toMatchObject({ code: 'ENOENT' })

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)
      expect(result.status).toBe('recovered-complete')
      expect(JSON.parse(await readFile(paths.completionMarkerPath, 'utf8')).planFingerprint).toBe(
        result.planFingerprint
      )
    },
    MIGRATION_TEST_TIMEOUT
  )

  test(
    'stops mutating covered paths when the exclusive lease is lost and remains recoverable',
    async () => {
      const setup = await fixture()
      let held = true
      let releaseAttempted = false

      const first = successfulOptions({
        acquireExclusiveMigrationLease: async scope => ({
          coverage: 'state-directory-and-both-identity-roots',
          implementation: 'os-backed-cross-process',
          lifetime: 'non-expiring-until-explicit-release-or-process-exit',
          transferability: 'non-transferable',
          ownerToken: nextOwnerToken(),
          planFingerprint: scope.planFingerprint,
          assertHeld: async () => held,
          release: async () => {
            releaseAttempted = true
          }
        }),
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'after-root-promote' && checkpoint.rootId === 'hermes-home') {
            held = false
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, first.options)).rejects.toMatchObject({
        code: 'QUIESCENCE_LEASE_LOST'
      })
      expect(releaseAttempted).toBe(true)
      expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')
      await expect(readdir(setup.vietnameseElectronUserData)).rejects.toMatchObject({ code: 'ENOENT' })

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)
      expect(result.status).toBe('completed')
    },
    MIGRATION_TEST_TIMEOUT
  )

  test(
    'finishes recovery when every rename landed but the completion marker did not',
    async () => {
      const setup = await fixture()

      const { options } = successfulOptions({
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'after-all-promotes') {
            throw new VietnameseIdentityMigrationInterruption('crash before marker')
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toBeInstanceOf(
        VietnameseIdentityMigrationInterruption
      )
      const paths = vietnameseIdentityMigrationStatePaths(setup.plan)
      await expect(readFile(paths.completionMarkerPath)).rejects.toMatchObject({ code: 'ENOENT' })

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)
      expect(result.status).toBe('recovered-complete')
      expect(JSON.parse(await readFile(paths.completionMarkerPath, 'utf8')).planFingerprint).toBe(
        result.planFingerprint
      )
    },
    MIGRATION_TEST_TIMEOUT
  )

  test('resumes a snapshot crash only while the source still matches its original manifest', async () => {
    const setup = await fixture()

    const { options } = successfulOptions({
      checkpoint: async checkpoint => {
        if (checkpoint.phase === 'snapshot-ready' && checkpoint.rootId === 'hermes-home') {
          throw new VietnameseIdentityMigrationInterruption('crash after snapshot rename')
        }
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, options)).rejects.toBeInstanceOf(
      VietnameseIdentityMigrationInterruption
    )
    await writeFile(join(setup.legacyHermesHome, 'config.yaml'), 'model: changed-after-crash\n', 'utf8')
    const resumed = successfulOptions()
    await expect(migrateVietnameseIdentity(setup.plan, resumed.options)).rejects.toMatchObject({
      code: 'SOURCE_CHANGED'
    })
    await expect(readdir(setup.vietnameseHermesHome)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('rechecks capacity from journal manifests before copying missing snapshot or staging data', async () => {
    const setup = await fixture()

    const first = successfulOptions({
      checkpoint: async checkpoint => {
        if (checkpoint.phase === 'journal-created') {
          throw new VietnameseIdentityMigrationInterruption('crash before first snapshot copy')
        }
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, first.options)).rejects.toBeInstanceOf(
      VietnameseIdentityMigrationInterruption
    )

    let capacityChecks = 0

    const resumed = successfulOptions({
      getStorageCapacity: async () => {
        capacityChecks += 1

        return { device: 'test-volume', availableBytes: 1n }
      }
    })

    await expect(migrateVietnameseIdentity(setup.plan, resumed.options)).rejects.toMatchObject({
      code: 'CAPACITY_INSUFFICIENT'
    })
    expect(capacityChecks).toBeGreaterThan(0)
    await expect(readdir(setup.vietnameseHermesHome)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test(
    'quarantines and rebuilds a staging copy after a hard crash mid-sentinel publication',
    async () => {
      const setup = await fixture()
      let interrupted = false

      const first = successfulOptions({
        checkpoint: async checkpoint => {
          if (
            !interrupted &&
            checkpoint.phase === 'sentinel-temporary-written' &&
            checkpoint.rootId === 'hermes-home'
          ) {
            interrupted = true
            throw new VietnameseIdentityMigrationInterruption('crash after sentinel temp sync, before rename')
          }
        }
      })

      await expect(migrateVietnameseIdentity(setup.plan, first.options)).rejects.toBeInstanceOf(
        VietnameseIdentityMigrationInterruption
      )

      const journal = await readJournal(setup.plan)
      const hermesRoot = journal.roots.find(root => root.id === 'hermes-home')!
      const copyingPath = `${hermesRoot.stagingPath}.copying`
      const partialEntries = await readdir(copyingPath)

      expect(
        partialEntries.some(
          entry => entry.startsWith('..hermes-vietnamese-migration-owner.v1.json.') && entry.endsWith('.tmp')
        )
      ).toBe(true)
      expect(partialEntries).not.toContain('.hermes-vietnamese-migration-owner.v1.json')
      await expect(readdir(hermesRoot.stagingPath)).rejects.toMatchObject({ code: 'ENOENT' })

      const resumed = successfulOptions()
      const result = await migrateVietnameseIdentity(setup.plan, resumed.options)

      expect(result.status).toBe('completed')
      expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')
      expect(
        JSON.parse(
          await readFile(join(setup.vietnameseHermesHome, '.hermes-vietnamese-migration-owner.v1.json'), 'utf8')
        ).planFingerprint
      ).toBe(result.planFingerprint)
    },
    MIGRATION_TEST_TIMEOUT
  )

  test('treats a valid marker as final even after runtime legitimately changes files and SQLite', async () => {
    const setup = await fixture()
    const first = successfulOptions()
    await migrateVietnameseIdentity(setup.plan, first.options)
    await writeFile(join(setup.vietnameseHermesHome, 'runtime-created.txt'), 'new runtime state\n', 'utf8')
    await writeFile(join(setup.vietnameseElectronUserData, 'databases', 'state.db'), 'runtime changed database bytes')

    const second = successfulOptions({
      verifySqliteIntegrity: async () => {
        throw new Error('marker branch must not invoke SQLite verification')
      }
    })

    const result = await migrateVietnameseIdentity(setup.plan, second.options)
    expect(result.status).toBe('already-complete')
    expect(await readFile(join(setup.vietnameseHermesHome, 'runtime-created.txt'), 'utf8')).toBe('new runtime state\n')
  })

  test('fails closed when a marker destination root is recreated empty, missing or not a directory', async () => {
    const missing = await fixture()
    await migrateVietnameseIdentity(missing.plan, successfulOptions().options)
    await rm(missing.vietnameseHermesHome, { recursive: true, force: true })
    await mkdir(missing.vietnameseHermesHome)
    await expect(migrateVietnameseIdentity(missing.plan, successfulOptions().options)).rejects.toMatchObject({
      code: 'TREE_MISMATCH'
    })
    await rm(missing.vietnameseHermesHome, { recursive: true, force: true })
    await expect(migrateVietnameseIdentity(missing.plan, successfulOptions().options)).rejects.toMatchObject({
      code: 'TREE_MISMATCH'
    })

    const fileRoot = await fixture()
    await migrateVietnameseIdentity(fileRoot.plan, successfulOptions().options)
    await rm(fileRoot.vietnameseHermesHome, { recursive: true, force: true })
    await writeFile(fileRoot.vietnameseHermesHome, 'not a directory', 'utf8')
    await expect(migrateVietnameseIdentity(fileRoot.plan, successfulOptions().options)).rejects.toMatchObject({
      code: 'TREE_MISMATCH'
    })
  })

  test('fails closed when a marker destination root becomes a symlink or junction', async context => {
    const setup = await fixture()
    await migrateVietnameseIdentity(setup.plan, successfulOptions().options)
    const outside = join(setup.root, 'replacement-directory')
    await mkdir(outside)
    await rm(setup.vietnameseHermesHome, { recursive: true, force: true })

    try {
      await symlink(outside, setup.vietnameseHermesHome, process.platform === 'win32' ? 'junction' : 'dir')
    } catch (error) {
      if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        context.skip()

        return
      }

      throw error
    }

    await expect(migrateVietnameseIdentity(setup.plan, successfulOptions().options)).rejects.toMatchObject({
      code: 'SYMLINK_REJECTED'
    })
  })

  test(
    'keeps destinations committed when a durability fault occurs after marker rename',
    async () => {
      const setup = await fixture()

      const { options } = successfulOptions({
        checkpoint: async checkpoint => {
          if (checkpoint.phase === 'completion-marker-published') {
            throw new Error('injected post-publication durability failure')
          }
        }
      })

      const result = await migrateVietnameseIdentity(setup.plan, options)
      expect(result.status).toBe('recovered-complete')
      expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')
      expect(await readFile(join(setup.vietnameseElectronUserData, 'Preferences'), 'utf8')).toBe('{"theme":"dark"}\n')
      expect(JSON.parse(await readFile(result.completionMarkerPath, 'utf8')).planFingerprint).toBe(
        result.planFingerprint
      )
    },
    MIGRATION_TEST_TIMEOUT
  )

  test('reports a release warning without undoing a committed migration', async () => {
    const setup = await fixture()
    let releaseAttempted = false

    const { options } = successfulOptions({
      acquireExclusiveMigrationLease: async scope => ({
        coverage: 'state-directory-and-both-identity-roots',
        implementation: 'os-backed-cross-process',
        lifetime: 'non-expiring-until-explicit-release-or-process-exit',
        transferability: 'non-transferable',
        ownerToken: nextOwnerToken(),
        planFingerprint: scope.planFingerprint,
        assertHeld: async () => true,
        release: async () => {
          releaseAttempted = true
          throw new Error('injected release failure after commit')
        }
      })
    })

    const result = await migrateVietnameseIdentity(setup.plan, options)
    expect(result.status).toBe('completed')
    expect(result.warnings).toEqual(['LEASE_RELEASE_FAILED_AFTER_COMMIT'])
    expect(releaseAttempted).toBe(true)
    expect(JSON.parse(await readFile(result.completionMarkerPath, 'utf8')).planFingerprint).toBe(result.planFingerprint)
    expect(await readFile(join(setup.vietnameseHermesHome, 'config.yaml'), 'utf8')).toBe('model: test\n')
  })

  test('allows only one deterministic concurrent migration owner', async () => {
    const setup = await fixture()
    let activeOwner: string | undefined

    const acquireExclusiveMigrationLease: VietnameseIdentityMigrationOptions['acquireExclusiveMigrationLease'] =
      async scope => {
        if (activeOwner) {
          throw new VietnameseIdentityMigrationError('MIGRATION_LOCKED', 'test lease already held')
        }

        const ownerToken = nextOwnerToken()
        activeOwner = ownerToken

        return {
          coverage: 'state-directory-and-both-identity-roots',
          implementation: 'os-backed-cross-process',
          lifetime: 'non-expiring-until-explicit-release-or-process-exit',
          transferability: 'non-transferable',
          ownerToken,
          planFingerprint: scope.planFingerprint,
          assertHeld: async () => activeOwner === ownerToken,
          release: async () => {
            assert.equal(activeOwner, ownerToken)
            activeOwner = undefined
          }
        }
      }

    let releaseFirst!: () => void
    let reportFirstReached!: () => void

    const firstReached = new Promise<void>(resolveReached => {
      reportFirstReached = resolveReached
    })

    const holdFirst = new Promise<void>(resolveHold => {
      releaseFirst = resolveHold
    })

    const first = successfulOptions({
      acquireExclusiveMigrationLease,
      checkpoint: async checkpoint => {
        if (checkpoint.phase === 'journal-created') {
          reportFirstReached()
          await holdFirst
        }
      }
    })

    const firstRun = migrateVietnameseIdentity(setup.plan, first.options)
    await firstReached

    const second = successfulOptions({ acquireExclusiveMigrationLease })
    await expect(migrateVietnameseIdentity(setup.plan, second.options)).rejects.toMatchObject({
      code: 'MIGRATION_LOCKED'
    })
    expect(activeOwner).toBeTruthy()
    releaseFirst()
    await expect(firstRun).resolves.toMatchObject({ status: 'completed' })
    expect(activeOwner).toBeUndefined()
  })
})
