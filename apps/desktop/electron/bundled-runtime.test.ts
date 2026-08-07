import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  decideResidentRuntime,
  findResidentPython,
  latestReleaseFromLsRemote,
  type PayloadInfo,
  resolveChannel,
  resolvePayload
} from '../electron/bundled-runtime'

// ─── resolvePayload ────────────────────────────────────────────────

const readerFor = (manifest: unknown) => (p: string) => {
  if (!p.endsWith('manifest.json')) {throw new Error('ENOENT')}

  return JSON.stringify(manifest)
}

test('resolvePayload returns null for dev runs, thin stubs, and garbage', () => {
  assert.equal(resolvePayload(null), null)
  assert.equal(resolvePayload(undefined), null)
  assert.equal(resolvePayload('/res', readerFor({ schemaVersion: 1, thin: true, items: {} })), null)
  assert.equal(
    resolvePayload('/res', () => {
      throw new Error('ENOENT')
    }),
    null
  )
  assert.equal(resolvePayload('/res', readerFor('not-an-object')), null)
  // A manifest with items but no staged item returns null (an all-skipped payload).
  assert.equal(
    resolvePayload('/res', readerFor({ tag: 'v1.0.0', items: { repo: { status: 'skipped' } } })),
    null
  )
})

test('resolvePayload returns dir + tag for a real payload', () => {
  const p = resolvePayload('/res', readerFor({ tag: 'v1.2.3', items: { repo: { status: 'staged' } } }))
  assert.ok(p)
  assert.match(p.dir, /agent-payload$/)
  assert.equal(p.tag, 'v1.2.3')
})

// ─── decideResidentRuntime ─────────────────────────────────────────

const residentPayload = (overrides: Partial<PayloadInfo> = {}): PayloadInfo => ({
  dir: '/res/agent-payload',
  tag: 'v2.0.0',
  schemaVersion: 2,
  items: {
    repo: { status: 'staged' },
    uv: { status: 'staged' },
    python: { status: 'staged' },
    'site-packages': { status: 'staged' },
    node: { status: 'staged' }
  },
  ...overrides
})

test('a complete schema-2 payload runs resident on a fresh machine', () => {
  const d = decideResidentRuntime({
    payload: residentPayload(),
    checkoutExists: false,
    checkoutManifest: null,
    markerSaysDesktop: false
  })

  assert.equal(d.resident, true)
})

test('resident even over an old desktop-managed checkout (marker or bundled manifest)', () => {
  // Phase-1 materialized checkout: manifest says bundled.
  assert.equal(
    decideResidentRuntime({
      payload: residentPayload(),
      checkoutExists: true,
      checkoutManifest: { installMode: 'bundled' },
      markerSaysDesktop: true
    }).resident,
    true
  )
  // Pre-manifest desktop install: no manifest, but the desktop marker
  // proves provenance.
  assert.equal(
    decideResidentRuntime({
      payload: residentPayload(),
      checkoutExists: true,
      checkoutManifest: null,
      markerSaysDesktop: true
    }).resident,
    true
  )
})

test('never resident over a checkout the user owns', () => {
  // Ejected / deliberate source install.
  const ejected = decideResidentRuntime({
    payload: residentPayload(),
    checkoutExists: true,
    checkoutManifest: { installMode: 'source' },
    markerSaysDesktop: true
  })

  assert.equal(ejected.resident, false)
  assert.match(ejected.reason, /source-managed/)

  // CLI-first user: checkout exists, no manifest, no desktop marker.
  const cliFirst = decideResidentRuntime({
    payload: residentPayload(),
    checkoutExists: true,
    checkoutManifest: null,
    markerSaysDesktop: false
  })

  assert.equal(cliFirst.resident, false)
  assert.match(cliFirst.reason, /CLI-first/)
})

test('thin, pre-resident, and incomplete payloads never run resident', () => {
  assert.match(
    decideResidentRuntime({
      payload: null,
      checkoutExists: false,
      checkoutManifest: null,
      markerSaysDesktop: false
    }).reason,
    /thin/
  )
  // Phase-1 artifact: schemaVersion 1.
  assert.match(
    decideResidentRuntime({
      payload: residentPayload({ schemaVersion: 1 }),
      checkoutExists: false,
      checkoutManifest: null,
      markerSaysDesktop: false
    }).reason,
    /predates/
  )
  // uv is mandatory: runtime lazy installs for plugins depend on it.
  const noUv = residentPayload()
  noUv.items = { ...noUv.items, uv: { status: 'skipped' } }

  const d = decideResidentRuntime({
    payload: noUv,
    checkoutExists: false,
    checkoutManifest: null,
    markerSaysDesktop: false
  })

  assert.equal(d.resident, false)
  assert.match(d.reason, /missing: uv/)
})

// ─── findResidentPython ────────────────────────────────────────────

test('findResidentPython picks the patch-versioned dir and needs a real binary', () => {
  const fsStub = (dirs: string[], files: string[]) => ({
    readdirSync: (p: string) => {
      if (!p.endsWith('python')) {throw new Error('ENOENT')}

      return dirs
    },
    existsSync: (p: string) => files.some(f => p === f)
  })

  // Patch-versioned real dir wins over the minor alias (reverse sort).
  const python = findResidentPython(
    '/res/agent-payload',
    'darwin',
    fsStub(
      ['cpython-3.11-macos-aarch64-none', 'cpython-3.11.15-macos-aarch64-none'],
      ['/res/agent-payload/python/cpython-3.11.15-macos-aarch64-none/bin/python3']
    ) as never
  )

  assert.match(String(python), /3\.11\.15.*bin\/python3$/)

  // No python dir at all → null, not a throw.
  assert.equal(
    findResidentPython('/res/agent-payload', 'darwin', {
      readdirSync: () => {
        throw new Error('ENOENT')
      },
      existsSync: () => false
    } as never),
    null
  )

  // Windows binary lives at the install root, not bin/. The
  // implementation joins with the HOST path module, so the test builds
  // its expected path the same way to stay host-agnostic.
  const winRoot = 'win-res/agent-payload'
  const winExpected = ['win-res/agent-payload', 'python', 'cpython-3.11.15-windows-x86_64-none', 'python.exe'].join('/')

  const winPython = findResidentPython(
    winRoot,
    'win32',
    fsStub(['cpython-3.11.15-windows-x86_64-none'], [winExpected]) as never
  )

  assert.match(String(winPython), /python\.exe$/)
})

test('channel: bundled is always stable, source carries its own, absent means main', () => {
  assert.equal(resolveChannel({ installMode: 'bundled', channel: 'main' }), 'stable')
  assert.equal(resolveChannel({ installMode: 'source', channel: 'stable' }), 'stable')
  assert.equal(resolveChannel({ installMode: 'source', channel: 'main' }), 'main')
  assert.equal(resolveChannel(null), 'main')
  assert.equal(resolveChannel({}), 'main')
})

// ── latestReleaseFromLsRemote ───────────────────────────────────────

test('release picking is numeric, skips prereleases, prefers peeled shas', () => {
  const output = [
    `${'a'.repeat(40)}\trefs/tags/v0.9.0`,
    `${'b'.repeat(40)}\trefs/tags/v0.10.0`,
    `${'c'.repeat(40)}\trefs/tags/v0.10.0^{}`,
    `${'d'.repeat(40)}\trefs/tags/v0.11.0-rc1`,
    `${'e'.repeat(40)}\trefs/tags/v2026.7.20`
  ].join('\n')

  const latest = latestReleaseFromLsRemote(output)

  // v0.10.0 beats v0.9.0 numerically (a lexicographic sort would invert
  // it), the rc prerelease is skipped, and the CalVer tag is excluded by
  // the three-digit major cap — otherwise 2026 would beat every SemVer
  // release forever.
  assert.equal(latest?.tag, 'v0.10.0')
  assert.equal(latest?.sha, 'c'.repeat(40))

  const semverOnly = latestReleaseFromLsRemote(
    [`${'a'.repeat(40)}\trefs/tags/v0.9.0`, `${'b'.repeat(40)}\trefs/tags/v0.10.0`, `${'c'.repeat(40)}\trefs/tags/v0.10.0^{}`].join('\n')
  )

  assert.equal(semverOnly?.tag, 'v0.10.0')
  assert.equal(semverOnly?.sha, 'c'.repeat(40))
})

test('release picking returns null when no final release tag exists', () => {
  assert.equal(latestReleaseFromLsRemote(''), null)
  assert.equal(latestReleaseFromLsRemote(`${'d'.repeat(40)}\trefs/tags/v1.0.0-beta.2`), null)
})
