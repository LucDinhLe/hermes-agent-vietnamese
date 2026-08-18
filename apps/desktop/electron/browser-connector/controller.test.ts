import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from 'vitest'

import { buildConnectorExtension, buildDir, trustPath } from '../../scripts/build-connector-extension.mjs'

import { BrowserConnectorController } from './controller'
import { type CookieSetDetails, type CookieStore, type StoredCookie } from './cookie-import'

class EmptyStore implements CookieStore {
  async get(): Promise<StoredCookie[]> {
    return []
  }
  async set(_details: CookieSetDetails): Promise<void> {}
  async remove(_url: string, _name: string): Promise<void> {}
  async flushStore(): Promise<void> {}
}

async function fixture() {
  await buildConnectorExtension()
  const root = await mkdtemp(join(tmpdir(), 'hermes-connector-controller-'))
  const extensionPath = join(root, 'extension')
  const copiedTrustPath = join(root, 'trust.json')
  await cp(buildDir, extensionPath, { recursive: true })
  await cp(trustPath, copiedTrustPath)

  return {
    root,
    controller: new BrowserConnectorController({
      cookieStore: new EmptyStore(),
      extensionPath,
      trustPath: copiedTrustPath,
      settingsPath: join(root, 'settings.json'),
      importLedgerPath: join(root, 'imports.json')
    })
  }
}

test('connector is disabled by default and persists explicit enablement', async () => {
  const { controller, root } = await fixture()
  const initial = await controller.status()
  assert.equal(initial.ok && initial.value.enabled, false)
  assert.equal(initial.ok && initial.value.trust.verified, true)

  assert.deepEqual(await controller.setEnabled(true), { ok: true, value: { enabled: true } })
  const persisted = JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'))
  assert.deepEqual(persisted, { version: 1, enabled: true })
  await controller.shutdown()
})

test('connector refuses to enable when the bundled extension digest changes', async () => {
  const { controller, root } = await fixture()
  await writeFile(join(root, 'extension', 'popup.js'), 'tampered')

  assert.deepEqual(await controller.setEnabled(true), { ok: false, error: 'CONNECTOR_TRUST_FAILED' })
})

test('disabled connector cannot open a loopback endpoint', async () => {
  const { controller } = await fixture()
  assert.deepEqual(await controller.start('https://app.example.com/'), { ok: false, error: 'CONNECTOR_DISABLED' })
})

test('invalid settings fail closed instead of enabling the connector', async () => {
  const { controller, root } = await fixture()
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'settings.json'), '{broken')
  const status = await controller.status()
  assert.equal(status.ok && status.value.enabled, false)
})
