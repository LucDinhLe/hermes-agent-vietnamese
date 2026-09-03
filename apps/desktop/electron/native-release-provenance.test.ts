import { describe, expect, test } from 'vitest'
import { assertNativeReleaseProvenance, RELEASE_REPOSITORY } from './native-release-provenance'

function fixture() {
  const commit = 'd'.repeat(40)
  const engineCommit = 'e'.repeat(40)
  return {
    stamp: {
      source: 'local',
      dirty: false,
      branch: 'release/calendar',
      commit,
      nativeRelease: {
        schemaVersion: 1,
        repository: RELEASE_REPOSITORY,
        ref: 'refs/heads/release/calendar',
        commit,
        engineCommit,
        platform: 'win32',
        arch: 'x64',
        nodeVersion: 'v26.7.0'
      }
    },
    composition: {
      productVersion: '2026.9.2',
      experimentalEngineHead: engineCommit,
      distribution: { kind: 'community-pilot', signed: false, updateFeed: false, target: 'win-x64' }
    },
    manifest: { buildCommit: commit, python: { layout: 'portable-cpython-win-x64-v1' } }
  }
}

describe('native unsigned calendar pilot provenance', () => {
  test('accepts explicit native proof without claiming a CI build', () => {
    const f = fixture()
    expect(() => assertNativeReleaseProvenance(f.stamp, f.composition, f.manifest)).not.toThrow()
    expect(f.stamp.source).toBe('local')
  })
  test.each([
    ['repository', 'https://example.com/other.git'],
    ['commit', 'a'.repeat(40)],
    ['ref', 'refs/heads/other'],
    ['engineCommit', 'b'.repeat(40)],
    ['platform', 'linux'],
    ['arch', 'arm64'],
    ['nodeVersion', 'v24.0.0']
  ])('rejects mismatched %s', (key, value) => {
    const f = fixture()
    Object.assign(f.stamp.nativeRelease, { [key]: value })
    expect(() => assertNativeReleaseProvenance(f.stamp, f.composition, f.manifest)).toThrow()
  })
  test('rejects dirty source, CI impersonation, unsigned feed and absent Python', () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => {
        f.stamp.dirty = true
      },
      (f: ReturnType<typeof fixture>) => {
        f.stamp.source = 'ci'
      },
      (f: ReturnType<typeof fixture>) => {
        f.composition.distribution.updateFeed = true
      },
      (f: ReturnType<typeof fixture>) => {
        f.manifest.python.layout = 'borrowed-venv'
      }
    ]) {
      const f = fixture()
      change(f)
      expect(() => assertNativeReleaseProvenance(f.stamp, f.composition, f.manifest)).toThrow()
    }
  })
})
