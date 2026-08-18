import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { CookieImportLedger, CookieImportRecord } from './cookie-import'

type LedgerEnvelope = {
  version: 1
  records: CookieImportRecord[]
}

function isRecord(value: unknown): value is CookieImportRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as CookieImportRecord

  return (
    typeof record.id === 'string' &&
    typeof record.hostname === 'string' &&
    Number.isFinite(record.cookieCount) &&
    Number.isFinite(record.importedAt) &&
    Array.isArray(record.cookies) &&
    record.cookies.every(
      cookie =>
        cookie &&
        typeof cookie.name === 'string' &&
        typeof cookie.domain === 'string' &&
        typeof cookie.hostOnly === 'boolean' &&
        typeof cookie.path === 'string' &&
        typeof cookie.secure === 'boolean' &&
        typeof cookie.url === 'string'
    )
  )
}

function parseLedger(raw: string): CookieImportRecord[] {
  const parsed = JSON.parse(raw) as LedgerEnvelope

  if (parsed?.version !== 1 || !Array.isArray(parsed.records) || !parsed.records.every(isRecord)) {
    throw new Error('INVALID_CONNECTOR_LEDGER')
  }

  return parsed.records
}

export function createFileCookieLedger(filePath: string, now: () => number = Date.now): CookieImportLedger {
  return {
    async list() {
      try {
        return parseLedger(await readFile(filePath, 'utf8'))
      } catch (error) {
        const code = error && typeof error === 'object' ? (error as NodeJS.ErrnoException).code : undefined

        if (code === 'ENOENT') {
          return []
        }

        try {
          await rename(filePath, `${filePath}.corrupt-${now()}`)
        } catch {
          // Fail closed even if quarantine itself cannot complete.
        }

        throw new Error('CONNECTOR_LEDGER_CORRUPT')
      }
    },
    async replace(records) {
      await mkdir(dirname(filePath), { recursive: true })
      const temporaryPath = `${filePath}.tmp`
      const body = `${JSON.stringify({ version: 1, records } satisfies LedgerEnvelope, null, 2)}\n`
      await writeFile(temporaryPath, body, { encoding: 'utf8', mode: 0o600 })
      await chmod(temporaryPath, 0o600).catch(() => undefined)
      await rename(temporaryPath, filePath)
      await chmod(filePath, 0o600).catch(() => undefined)
    }
  }
}
