import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPublicDocs } from './check-public-docs.mjs'

function fixture() {
  const version = '2030.2.3'
  const release = {
    version, tag: `v${version}`, releaseClass: 'community-pilot', updateFeedEnabled: false,
    supportedTargets: ['windows-x64'], sourceCommit: 'a'.repeat(40),
    windowsX64: { filename: `Hermes-${version}-win-x64.exe`, compatibilityFilename: 'Hermes-Vietnamese-Windows-x64-Setup.exe', size: 1234, sha256: 'b'.repeat(64), authenticode: 'NotSigned' },
    documentationFiles: ['README.md']
  }
  release.downloadFiles = [release.windowsX64.filename, release.windowsX64.compatibilityFilename]
  const base = 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases'
  const body = `${version} Windows x64 chưa ký số, chưa phải stable 1234 ${release.windowsX64.sha256}\n${base}/tag/${release.tag}\n` + [...release.downloadFiles, 'SHA256SUMS.txt'].map(f => `${base}/download/${release.tag}/${f}`).join('\n')
  const documents = { 'README.md': `<!-- current-release:start -->\n${body}\n<!-- current-release:end -->` }
  const live = { tag_name: release.tag, draft: false, prerelease: false, target_commitish: release.sourceCommit,
    assets: [...release.downloadFiles, 'SHA256SUMS.txt'].map(name => ({ name, size: 1234, digest: `sha256:${release.windowsX64.sha256}`, browser_download_url: `${base}/download/${release.tag}/${name}` })) }
  return { release, documents, live }
}

test('matches documents to a changing calendar release and exact public assets', () => {
  const { release, documents, live } = fixture()
  assert.equal(checkPublicDocs(release, documents, live).liveVerified, true)
})
for (const [name, mutate] of [
  ['stale label beside correct URLs', f => { f.documents['README.md'] = f.documents['README.md'].replace('2030.2.3 Windows', 'v32.1 Windows') }],
  ['old download outside the featured block', f => { f.documents['README.md'] += '\nhttps://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/old.exe' }],
  ['missing warning', f => { f.documents['README.md'] = f.documents['README.md'].replace('chưa ký số', '') }],
  ['missing document', f => { delete f.documents['README.md'] }],
  ['different Latest', f => { f.live.tag_name = 'v2030.2.4' }],
  ['changed asset bytes', f => { f.live.assets[0].digest = `sha256:${'c'.repeat(64)}` }],
  ['extra update feed', f => { f.live.assets.push({ name: 'latest.yml' }) }],
  ['unsupported platform claim', f => { f.release.supportedTargets.push('macos-arm64') }]
]) {
  test(`rejects ${name}`, () => {
    const f = fixture()
    mutate(f)
    assert.throws(() => checkPublicDocs(f.release, f.documents, f.live))
  })
}
