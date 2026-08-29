import assert from 'node:assert/strict'
import test from 'node:test'

import { brandIndexHtml, brandPackageManifest } from '../scripts/lib/branding.mjs'

const protectedIdentity = {
  packageName: 'hermes',
  packageProductName: 'Hermes',
  buildProductName: 'Hermes',
  appId: 'com.nousresearch.hermes',
  executableName: 'Hermes',
  protocol: 'hermes',
  protocolSchemes: [['hermes']],
  artifactName: 'Hermes-${version}-${os}-${arch}.${ext}'
}

const edition = {
  displayName: 'Hermes Vietnamese',
  technicalVersion: '0.33.0-dev.3',
  branding: {
    description: 'Vietnamese edition',
    protectedIdentity
  }
}

function manifest() {
  return {
    name: 'hermes',
    productName: 'Hermes',
    version: '0.17.0',
    description: 'Upstream',
    build: {
      appId: 'com.nousresearch.hermes',
      productName: 'Hermes',
      executableName: 'Hermes',
      artifactName: 'Hermes-${version}-${os}-${arch}.${ext}',
      protocols: [{ name: 'Hermes Protocol', schemes: ['hermes'] }],
      dmg: { title: 'Install Hermes' },
      mac: { extendInfo: { CFBundleDisplayName: 'Hermes' } },
      win: { legalTrademarks: 'Hermes' },
      linux: { synopsis: 'Hermes' },
      nsis: { shortcutName: 'Hermes', uninstallDisplayName: 'Hermes' }
    }
  }
}

test('presentation branding preserves every installer identity field', () => {
  const branded = brandPackageManifest(manifest(), edition)

  assert.equal(branded.description, 'Vietnamese edition')
  assert.equal(branded.version, '0.33.0-dev.3')
  assert.equal(branded.build.dmg.title, 'Install Hermes Vietnamese')
  assert.equal(branded.build.nsis.shortcutName, 'Hermes Vietnamese')
  assert.equal(branded.productName, 'Hermes')
  assert.equal(branded.build.productName, 'Hermes')
  assert.equal(branded.build.appId, 'com.nousresearch.hermes')
  assert.equal(branded.build.executableName, 'Hermes')
  assert.deepEqual(branded.build.protocols[0].schemes, ['hermes'])
  assert.equal(branded.build.artifactName, 'Hermes-${version}-${os}-${arch}.${ext}')
})

test('branding refuses a technical version that electron-builder cannot package', () => {
  assert.throws(
    () => brandPackageManifest(manifest(), { ...edition, technicalVersion: 'V33 dev 2' }),
    /not a packageable SemVer/
  )
})

test('branding refuses an upstream identity drift', () => {
  const changed = manifest()
  changed.build.appId = 'unexpected.app'

  assert.throws(() => brandPackageManifest(changed, edition), /must not change appId/)
})

test('branding refuses added or reordered protocol schemes', () => {
  const changed = manifest()
  changed.build.protocols.push({ name: 'Unexpected Protocol', schemes: ['unexpected'] })

  assert.throws(() => brandPackageManifest(changed, edition), /must not change protocolSchemes/)
})

test('window title replacement is exact and fail-closed', () => {
  assert.equal(brandIndexHtml('<title>Hermes</title>', 'Hermes Vietnamese'), '<title>Hermes Vietnamese</title>')
  assert.throws(() => brandIndexHtml('<title>Other</title>', 'Hermes Vietnamese'), /exactly one upstream title/)
})
