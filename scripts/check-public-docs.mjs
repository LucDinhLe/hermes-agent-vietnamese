import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function checkPublicDocs(release, documents, live) {
  const repository = 'LucDinhLe/hermes-agent-vietnamese'
  const base = `https://github.com/${repository}/releases`
  assert.match(release.version, /^\d{4}\.(?:[1-9]|1[0-2])\.[1-9]\d*$/)
  assert.equal(release.tag, `v${release.version}`)
  assert.equal(release.releaseClass, 'community-pilot')
  assert.equal(typeof release.updateFeedEnabled, 'boolean')
  assert.deepEqual(release.supportedTargets, ['windows-x64'])
  assert.equal(release.windowsX64.authenticode, 'NotSigned')
  assert.match(release.sourceCommit, /^[a-f0-9]{40}$/)
  assert.match(release.windowsX64.sha256, /^[a-f0-9]{64}$/)
  assert.equal(release.windowsX64.filename, `Hermes-${release.version}-win-x64.exe`)
  assert.deepEqual(release.downloadFiles, [release.windowsX64.filename, release.windowsX64.compatibilityFilename])
  assert.equal(new Set(release.downloadFiles).size, release.downloadFiles.length)
  for (const filename of release.documentationFiles) {
    const text = documents[filename]
    assert.equal(typeof text, 'string', `Missing document ${filename}`)
    const blocks = [...text.matchAll(/<!-- current-release:start -->([\s\S]*?)<!-- current-release:end -->/g)]
    assert.equal(blocks.length, 1, `${filename}: one current-release block required`)
    const block = blocks[0][1]
    for (const expected of [release.version, `${base}/tag/${release.tag}`, 'Windows x64', 'chưa ký số', 'chưa phải stable', String(release.windowsX64.size), release.windowsX64.sha256]) {
      assert.ok(block.includes(expected), `${filename}: missing ${expected}`)
    }
    for (const asset of [...release.downloadFiles, 'SHA256SUMS.txt']) {
      assert.ok(block.includes(`${base}/download/${release.tag}/${asset}`), `${filename}: missing download ${asset}`)
    }
    for (const match of block.matchAll(/(?:vi-v\d+\.\d+\.\d+-\d+|\bv\d+\.\d+|\b\d{4}\.\d+\.\d+)/g)) {
      assert.ok([release.tag, release.version, `v${release.version.split('.').slice(0, 2).join('.')}`].includes(match[0]), `${filename}: stale release label ${match[0]}`)
    }
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const match of text.matchAll(new RegExp(`${escaped}/download/([^/]+)/([^\\s)"<>]+)`, 'g'))) {
      assert.equal(match[1], release.tag, `${filename}: stale download tag`)
      assert.ok([...release.downloadFiles, 'SHA256SUMS.txt'].includes(match[2]), `${filename}: unknown download asset`)
    }
    assert.ok(!text.includes('\uFFFD'), `${filename}: invalid Unicode`)
  }
  if (live) {
    assert.equal(live.tag_name, release.tag, 'GitHub Latest differs from public descriptor')
    assert.equal(live.draft, false)
    assert.equal(live.prerelease, false)
    assert.equal(live.target_commitish, release.sourceCommit)
    assert.deepEqual(live.assets.map(a => a.name).sort(), [...release.downloadFiles, 'SHA256SUMS.txt'].sort())
    for (const filename of release.downloadFiles) {
      const asset = live.assets.find(a => a.name === filename)
      assert.equal(asset.size, release.windowsX64.size)
      assert.equal(asset.digest, `sha256:${release.windowsX64.sha256}`)
      assert.equal(asset.browser_download_url, `${base}/download/${release.tag}/${filename}`)
    }
  }
  return { tag: release.tag, documents: release.documentationFiles.length, liveVerified: Boolean(live) }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const release = JSON.parse(fs.readFileSync(path.join(root, '.github/public-release.json'), 'utf8'))
    const documents = Object.fromEntries(release.documentationFiles.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]))
    const live = process.argv.includes('--live')
      ? JSON.parse(execFileSync('gh', ['api', 'repos/LucDinhLe/hermes-agent-vietnamese/releases/latest'], { encoding: 'utf8' }))
      : undefined
    console.log(JSON.stringify(checkPublicDocs(release, documents, live)))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
