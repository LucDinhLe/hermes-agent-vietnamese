import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Windows assisted installer preserves either existing installation scope', () => {
  const { build } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  // With assisted NSIS, false enables its existing HKCU/HKLM detection;
  // true forces HKLM and relocates upgrades from the previous per-user release.
  assert.equal(build.nsis.oneClick, false)
  assert.equal(build.nsis.perMachine, false)
  assert.equal(build.nsis.allowToChangeInstallationDirectory, true)
})
