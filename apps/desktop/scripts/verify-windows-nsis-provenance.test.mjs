import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import { verifyWindowsNsisProvenance } from './verify-windows-nsis-provenance.mjs'

const COMMIT = '1'.repeat(40)
const STALE_COMMIT = '2'.repeat(40)
const TAG = 'vi-v0.32.0-1'
const roots = []

function writePe(file, arch = 'x64') {
  const content = Buffer.alloc(128)
  content.write('MZ', 0, 'binary')
  content.writeUInt32LE(0x40, 0x3c)
  content.write('PE\0\0', 0x40, 'binary')
  content.writeUInt16LE(arch === 'arm64' ? 0xaa64 : 0x8664, 0x44)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function fixture({ commit = COMMIT, executableArch = 'x64', nestedDecoy = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-nsis-verifier-test-'))
  const artifact = path.join(root, 'Hermes-0.32.0-vi.1-win-x64.exe')
  fs.writeFileSync(artifact, 'non-empty fake outer artifact')
  roots.push(root)

  const extract = async (_artifact, scratch) => {
    const appRoot = path.join(scratch, 'application')
    const resources = nestedDecoy
      ? path.join(appRoot, 'decoy', 'application', 'resources')
      : path.join(appRoot, 'resources')
    const surface = {
      commit,
      releaseClass: 'community-prerelease',
      tag: TAG,
      updateChannel: 'community-prerelease',
      updateFeedEnabled: false
    }
    fs.mkdirSync(path.join(resources, 'agent-payload'), { recursive: true })
    fs.writeFileSync(
      path.join(resources, 'install-stamp.json'),
      JSON.stringify({ payload: true, ...surface })
    )
    fs.writeFileSync(
      path.join(resources, 'agent-payload', 'manifest.json'),
      JSON.stringify({ schemaVersion: 2, ...surface })
    )
    writePe(path.join(appRoot, 'Hermes.exe'), executableArch)
    writePe(path.join(resources, 'agent-payload', 'node', 'node.exe'), executableArch)
    return appRoot
  }
  return { artifact, extract }
}

function env() {
  return {
    HERMES_PAYLOAD_GIT_REF: COMMIT,
    HERMES_PAYLOAD_TAG: TAG,
    HERMES_RELEASE_CLASS: 'community-prerelease'
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

test('accepts provenance and PE architecture extracted from the installer bytes themselves', async () => {
  const { artifact, extract } = fixture()
  const result = await verifyWindowsNsisProvenance({ artifactPath: artifact, env: env(), extract })
  assert.equal(result.commit, COMMIT)
  assert.equal(result.tag, TAG)
  assert.ok(result.size > 0)
})

test('rejects a stale installer even when a separate unpacked tree could be current', async () => {
  const { artifact, extract } = fixture({ commit: STALE_COMMIT })
  await assert.rejects(
    verifyWindowsNsisProvenance({ artifactPath: artifact, env: env(), extract }),
    /install-stamp\.json commit mismatch/
  )
})

test('rejects an empty installer before extraction', async () => {
  const { artifact, extract } = fixture()
  fs.writeFileSync(artifact, '')
  await assert.rejects(
    verifyWindowsNsisProvenance({ artifactPath: artifact, env: env(), extract }),
    /missing or empty/
  )
})

test('rejects a wrong-architecture executable embedded in an otherwise matching installer', async () => {
  const { artifact, extract } = fixture({ executableArch: 'arm64' })
  await assert.rejects(
    verifyWindowsNsisProvenance({ artifactPath: artifact, env: env(), extract }),
    /packaged Hermes\.exe PE architecture mismatch/
  )
})

test('rejects a matching decoy subtree outside electron-builder installed layout', async () => {
  const { artifact, extract } = fixture({ nestedDecoy: true })
  await assert.rejects(
    verifyWindowsNsisProvenance({ artifactPath: artifact, env: env(), extract }),
    /at <application>\/resources/
  )
})
