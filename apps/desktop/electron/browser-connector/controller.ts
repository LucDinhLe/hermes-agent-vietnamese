import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import { ConnectorCookieError, CookieImportService, type CookieImportSummary, type CookieStore } from './cookie-import'
import { createFileCookieLedger } from './cookie-ledger'
import { ConnectorPairingError, ConnectorPairingServer, type PairingSnapshot } from './pairing-server'

export const OFFICIAL_CONNECTOR_EXTENSION_ID = 'jabfgpkkfcoiiegikmdccooedjoooflm'
export const OFFICIAL_CONNECTOR_ORIGIN = `chrome-extension://${OFFICIAL_CONNECTOR_EXTENSION_ID}`
const OPTIONAL_HOST_PERMISSIONS = ['http://*/*', 'https://*/*', 'http://127.0.0.1/*']

type ConnectorTrustFile = {
  extensionId: string
  version: string
  manifestVersion: number
  permissions: string[]
  optionalPermissions: string[]
  optionalHostPermissions: string[]
  files: string[]
  sha256: string
}

export type ConnectorTrustStatus = Omit<ConnectorTrustFile, 'files'> & {
  extensionPath: string
  verified: boolean
}

export type BrowserConnectorStatus = {
  enabled: boolean
  imports: Awaited<ReturnType<CookieImportService['list']>>
  trust: ConnectorTrustStatus
}

export type BrowserConnectorResult<T> = { ok: true; value: T } | { ok: false; error: string }

type ControllerOptions = {
  cookieStore: CookieStore
  extensionPath: string
  importLedgerPath: string
  settingsPath: string
  trustPath: string
}

async function pathsUnder(root: string): Promise<string[]> {
  const result: string[] = []

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile()) {
        result.push(relative(root, path).replaceAll('\\', '/'))
      }
    }
  }

  await walk(root)

  return result.sort((left, right) => left.localeCompare(right))
}

async function treeDigest(root: string, files: string[]): Promise<string> {
  const hash = createHash('sha256')

  for (const file of files) {
    hash.update(file, 'utf8')
    hash.update(Buffer.from([0]))
    hash.update(await readFile(join(root, file)))
    hash.update(Buffer.from([0]))
  }

  return hash.digest('hex')
}

async function loadTrust(extensionPath: string, trustPath: string): Promise<ConnectorTrustStatus> {
  const trust = JSON.parse(await readFile(trustPath, 'utf8')) as ConnectorTrustFile
  const actualFiles = await pathsUnder(extensionPath)
  const actualDigest = await treeDigest(extensionPath, actualFiles)
  const manifest = JSON.parse(await readFile(join(extensionPath, 'manifest.json'), 'utf8')) as Record<string, unknown>

  const verified =
    trust.extensionId === OFFICIAL_CONNECTOR_EXTENSION_ID &&
    trust.manifestVersion === 3 &&
    trust.sha256 === actualDigest &&
    JSON.stringify(trust.files) === JSON.stringify(actualFiles) &&
    manifest.version === trust.version &&
    manifest.incognito === 'not_allowed' &&
    JSON.stringify(manifest.permissions) === JSON.stringify(['activeTab']) &&
    JSON.stringify(manifest.optional_permissions) === JSON.stringify(['cookies']) &&
    JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(OPTIONAL_HOST_PERMISSIONS) &&
    JSON.stringify(trust.permissions) === JSON.stringify(manifest.permissions) &&
    JSON.stringify(trust.optionalPermissions) === JSON.stringify(manifest.optional_permissions) &&
    JSON.stringify(trust.optionalHostPermissions) === JSON.stringify(manifest.optional_host_permissions)

  return {
    extensionId: trust.extensionId,
    version: trust.version,
    manifestVersion: trust.manifestVersion,
    permissions: trust.permissions,
    optionalPermissions: trust.optionalPermissions,
    optionalHostPermissions: trust.optionalHostPermissions,
    sha256: actualDigest,
    extensionPath,
    verified
  }
}

async function readEnabled(settingsPath: string): Promise<boolean> {
  try {
    const value = JSON.parse(await readFile(settingsPath, 'utf8')) as { version?: number; enabled?: boolean }

    return value.version === 1 && value.enabled === true
  } catch {
    return false
  }
}

async function writeEnabled(settingsPath: string, enabled: boolean): Promise<void> {
  await mkdir(dirname(settingsPath), { recursive: true })
  const temporaryPath = `${settingsPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify({ version: 1, enabled }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  await rename(temporaryPath, settingsPath)
}

function errorCode(error: unknown): string {
  if (error instanceof ConnectorPairingError || error instanceof ConnectorCookieError) {
    return error.code
  }

  return 'CONNECTOR_FAILED'
}

export class BrowserConnectorController {
  private readonly importer: CookieImportService
  private readonly pairing = new ConnectorPairingServer(new Set([OFFICIAL_CONNECTOR_ORIGIN]))
  private readonly urls = new Map<string, string>()

  constructor(private readonly options: ControllerOptions) {
    this.importer = new CookieImportService(options.cookieStore, createFileCookieLedger(options.importLedgerPath))
  }

  async status(): Promise<BrowserConnectorResult<BrowserConnectorStatus>> {
    return this.result(async () => ({
      enabled: await readEnabled(this.options.settingsPath),
      imports: await this.importer.list(),
      trust: await loadTrust(this.options.extensionPath, this.options.trustPath)
    }))
  }

  async setEnabled(enabled: boolean): Promise<BrowserConnectorResult<{ enabled: boolean }>> {
    return this.result(async () => {
      if (!enabled) {
        await this.pairing.cancel()
        this.urls.clear()
      } else {
        const trust = await loadTrust(this.options.extensionPath, this.options.trustPath)

        if (!trust.verified) {
          throw new ConnectorPairingError('CONNECTOR_TRUST_FAILED')
        }
      }

      await writeEnabled(this.options.settingsPath, enabled)

      return { enabled }
    })
  }

  async start(url: string): Promise<BrowserConnectorResult<PairingSnapshot & { pairingCode: string }>> {
    return this.result(async () => {
      if (!(await readEnabled(this.options.settingsPath))) {
        throw new ConnectorPairingError('CONNECTOR_DISABLED')
      }

      const trust = await loadTrust(this.options.extensionPath, this.options.trustPath)

      if (!trust.verified) {
        throw new ConnectorPairingError('CONNECTOR_TRUST_FAILED')
      }

      const started = await this.pairing.start(url)
      this.urls.clear()
      this.urls.set(started.attemptId, url)

      return started
    })
  }

  async pairingStatus(attemptId: string): Promise<BrowserConnectorResult<PairingSnapshot>> {
    return this.result(async () => {
      const snapshot = this.pairing.snapshot()

      if (snapshot.attemptId !== attemptId) {
        throw new ConnectorPairingError('PAIRING_ATTEMPT_MISMATCH')
      }

      return snapshot
    })
  }

  async approve(attemptId: string): Promise<BrowserConnectorResult<CookieImportSummary>> {
    return this.result(async () => {
      const sourceUrl = this.urls.get(attemptId)

      if (!sourceUrl) {
        throw new ConnectorPairingError('PAIRING_ATTEMPT_MISMATCH')
      }

      this.pairing.approve(attemptId)

      try {
        await this.pairing.waitForTransfer(attemptId)
        const transfer = this.pairing.consume(attemptId)

        try {
          return await this.importer.import(sourceUrl, transfer.cookies)
        } finally {
          await this.pairing.complete(attemptId)
        }
      } catch (error) {
        await this.pairing.cancel()
        throw error
      } finally {
        this.urls.delete(attemptId)
      }
    })
  }

  async cancel(attemptId?: string): Promise<BrowserConnectorResult<{ cancelled: boolean }>> {
    return this.result(async () => {
      if (attemptId) {
        const snapshot = this.pairing.snapshot()

        if (snapshot.attemptId !== attemptId) {
          throw new ConnectorPairingError('PAIRING_ATTEMPT_MISMATCH')
        }
      }

      await this.pairing.cancel()
      this.urls.clear()

      return { cancelled: true }
    })
  }

  async revoke(importId: string): Promise<BrowserConnectorResult<{ revoked: boolean }>> {
    return this.result(async () => {
      await this.importer.revoke(importId)

      return { revoked: true }
    })
  }

  async shutdown(): Promise<void> {
    await this.pairing.cancel()
    this.urls.clear()
  }

  private async result<T>(operation: () => Promise<T>): Promise<BrowserConnectorResult<T>> {
    try {
      return { ok: true, value: await operation() }
    } catch (error) {
      return { ok: false, error: errorCode(error) }
    }
  }
}
