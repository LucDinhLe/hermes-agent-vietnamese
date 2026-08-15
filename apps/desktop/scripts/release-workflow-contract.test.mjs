import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

const candidate = readFileSync(new URL('../../../.github/workflows/release-vietnamese.yml', import.meta.url), 'utf8')
const promotion = readFileSync(new URL('../../../.github/workflows/promote-vietnamese.yml', import.meta.url), 'utf8')
const runtimeSmoke = readFileSync(
  new URL('../../../.github/workflows/runtime-smoke-vietnamese.yml', import.meta.url),
  'utf8'
)
const jsTests = readFileSync(new URL('../../../.github/workflows/js-tests.yml', import.meta.url), 'utf8')

test('candidate workflow builds the complete resident runtime on every advertised native target', () => {
  for (const runner of [
    'windows-2025',
    'windows-11-arm',
    'macos-15',
    'macos-15-intel',
    'ubuntu-24.04',
    'ubuntu-24.04-arm'
  ]) {
    assert.match(candidate, new RegExp(runner.replaceAll('.', '\\.')))
  }
  assert.match(candidate, /HERMES_DESKTOP_BUNDLED: '1'/)
  assert.match(candidate, /build-bundled-desktop\.mjs/)
  assert.match(candidate, /dtolnay\/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c/)
  assert.match(candidate, /aarch64-pc-windows-msvc/)
  assert.match(candidate, /signpath\/github-action-submit-signing-request@c92b958760219087e01f8d67a1669ed57afe2627/)
  assert.match(candidate, /Get-AuthenticodeSignature/)
  assert.match(candidate, /SIGNPATH_SIGNING_POLICY_SLUG/)
  assert.match(candidate, /SIGNPATH_ARTIFACT_CONFIGURATION_SLUG/)
  assert.match(candidate, /skip-decompress: true/)
  assert.match(candidate, /Bắt buộc cấu hình ký và công chứng Apple/)
  assert.match(candidate, /CSC_IDENTITY_AUTO_DISCOVERY/)
  assert.match(candidate, /community-prerelease/)
  assert.match(candidate, /release_class/)
  assert.ok(
    candidate.indexOf('Thay bằng đúng byte đã ký') < candidate.indexOf('Ghi lại checksum sau ký'),
    'Windows checksum must be regenerated after replacing the unsigned installer'
  )
  assert.match(candidate, /test:desktop:all/)
  assert.match(candidate, /uv sync --locked --python 3\.11 --extra dev/)
  assert.match(candidate, /\.\/scripts\/run_tests\.sh -q/)
  assert.doesNotMatch(candidate, /uv run pytest/)
  assert.match(candidate, /Upload đúng byte vào draft/)
})

test('candidate workflow can only create a draft and never promotes it', () => {
  assert.match(candidate, /gh release create "\$TAG" --verify-tag --target "\$COMMIT" --draft/)
  assert.doesNotMatch(candidate, /--draft=false/)
  assert.match(candidate, /--draft --prerelease/)
})

test('promotion is separate and requires exact manifest plus successful runtime smoke evidence', () => {
  assert.match(promotion, /environment: release-production/)
  assert.match(promotion, /sha256sums_sha256/)
  assert.match(promotion, /runtime_smoke_run_id/)
  assert.match(promotion, /release-evidence\.json/)
  assert.match(promotion, /e\.commit!==process\.env\.CANDIDATE_COMMIT/)
  assert.match(promotion, /\.conclusion.*success/)
  assert.match(promotion, /gh release edit "\$TAG" --draft=false --prerelease=true/)
  assert.match(promotion, /gh release edit "\$TAG" --draft=false --prerelease=false/)
  assert.match(promotion, /releaseClass!==process\.env\.RELEASE_CLASS/)
})

test('runtime smoke refuses missing platform, update, persistence, signing, or real-machine evidence', () => {
  assert.match(runtimeSmoke, /name: Kiểm thử runtime artifact Hermes tiếng Việt/)
  assert.match(runtimeSmoke, /windows-11-arm/)
  assert.match(runtimeSmoke, /macos-15-intel/)
  assert.match(runtimeSmoke, /validate-release-evidence\.mjs/)
  assert.match(runtimeSmoke, /release-runtime-evidence\.json/)
  assert.match(runtimeSmoke, /community-prerelease/)
  assert.match(runtimeSmoke, /release_class/)
  assert.match(runtimeSmoke, /candidate_commit="\$\(git rev-parse HEAD\)"/)
})

test('the ordinary packaged desktop gate installs uv before invoking the build', () => {
  assert.match(jsTests, /matrix\.script == 'check:test:desktop:all'/)
  assert.match(jsTests, /astral-sh\/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39/)
})
