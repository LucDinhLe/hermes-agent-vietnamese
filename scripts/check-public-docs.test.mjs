import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetIndex, checkPublicDocs, expectedDownloadFiles } from './check-public-docs.mjs'

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
  const live = { tag_name: release.tag, draft: false, prerelease: false, tagCommit: release.sourceCommit,
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

function fixtureThreeTargets() {
  const { release, live } = fixture()
  const version = release.version
  release.supportedTargets = ['windows-x64', 'macos-arm64', 'linux-x64']
  release.macosArm64 = { filename: `Hermes-${version}-mac-arm64.dmg`, size: 2345, sha256: 'd'.repeat(64), codesign: 'AdHoc' }
  release.linuxX64 = { filename: `Hermes-${version}-linux-x86_64.AppImage`, size: 3456, sha256: 'e'.repeat(64), deb: { filename: `Hermes-${version}-linux-amd64.deb`, size: 4567, sha256: 'f'.repeat(64) } }
  release.downloadFiles = expectedDownloadFiles(release)
  const base = 'https://github.com/LucDinhLe/hermes-agent-vietnamese/releases'
  const index = assetIndex(release)
  const body = `${version} Windows x64 macOS Linux chưa ký số, chưa phải stable\n${base}/tag/${release.tag}\n` +
    [...index.entries()].map(([f, a]) => `${f} ${a.size} ${a.sha256} ${base}/download/${release.tag}/${f}`).join('\n') +
    `\n${base}/download/${release.tag}/SHA256SUMS.txt`
  const documents = { 'README.md': `<!-- current-release:start -->\n${body}\n<!-- current-release:end -->` }
  live.assets = [...release.downloadFiles.map(name => ({ name, size: index.get(name).size, digest: `sha256:${index.get(name).sha256}`, browser_download_url: `${base}/download/${release.tag}/${name}` })),
    { name: 'SHA256SUMS.txt', size: 1, digest: 'sha256:x', browser_download_url: `${base}/download/${release.tag}/SHA256SUMS.txt` }]
  return { release, documents, live }
}

test('three targets: expected download order, per-file size and digest, all platform labels', () => {
  const { release, documents, live } = fixtureThreeTargets()
  assert.deepEqual(release.downloadFiles, [
    `Hermes-${release.version}-win-x64.exe`, 'Hermes-Vietnamese-Windows-x64-Setup.exe',
    `Hermes-${release.version}-mac-arm64.dmg`, `Hermes-${release.version}-linux-x86_64.AppImage`, `Hermes-${release.version}-linux-amd64.deb`
  ])
  assert.equal(checkPublicDocs(release, documents, live).targets, 3)
})

for (const [name, mutate] of [
  ['macOS metadata missing while claimed', f => { delete f.release.macosArm64 }],
  ['deb digest drift on GitHub', f => { f.live.assets.find(a => a.name.endsWith('.deb')).digest = `sha256:${'0'.repeat(64)}` }],
  ['macOS label missing from document', f => { f.documents['README.md'] = f.documents['README.md'].replace(' macOS ', ' ') }],
  ['downloadFiles out of order', f => { f.release.downloadFiles.reverse() }]
]) {
  test(`three targets: rejects ${name}`, () => {
    const f = fixtureThreeTargets()
    mutate(f)
    assert.throws(() => checkPublicDocs(f.release, f.documents, f.live))
  })
}
