import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KNOWN_TARGETS = ['windows-x64', 'macos-arm64', 'linux-x64']

/**
 * Danh sách tệp tải theo đúng thứ tự công bố, suy từ metadata từng nền tảng:
 * Windows (.exe + tên tương thích nếu có), macOS (.dmg), Linux (.AppImage + .deb nếu có).
 */
export function expectedDownloadFiles(release) {
  const files = []
  const w = release.windowsX64

  if (w) {
    files.push(w.filename)

    if (w.compatibilityFilename) {
      files.push(w.compatibilityFilename)
    }
  }

  if (release.macosArm64) {
    files.push(release.macosArm64.filename)
  }

  if (release.linuxX64) {
    files.push(release.linuxX64.filename)

    if (release.linuxX64.deb) {
      files.push(release.linuxX64.deb.filename)
    }
  }

  return files
}

/** Bảng tên tệp → {size, sha256} cho mọi tệp tải, kể cả tên tương thích và gói deb. */
export function assetIndex(release) {
  const index = new Map()
  const w = release.windowsX64

  if (w) {
    index.set(w.filename, { size: w.size, sha256: w.sha256 })

    if (w.compatibilityFilename) {
      index.set(w.compatibilityFilename, { size: w.size, sha256: w.sha256 })
    }
  }

  if (release.macosArm64) {
    index.set(release.macosArm64.filename, { size: release.macosArm64.size, sha256: release.macosArm64.sha256 })
  }

  if (release.linuxX64) {
    index.set(release.linuxX64.filename, { size: release.linuxX64.size, sha256: release.linuxX64.sha256 })

    if (release.linuxX64.deb) {
      index.set(release.linuxX64.deb.filename, { size: release.linuxX64.deb.size, sha256: release.linuxX64.deb.sha256 })
    }
  }

  return index
}

export function checkPublicDocs(release, documents, live) {
  const repository = 'LucDinhLe/hermes-agent-vietnamese'
  const base = `https://github.com/${repository}/releases`
  assert.match(release.version, /^\d{4}\.(?:[1-9]|1[0-2])\.[1-9]\d*$/)
  assert.equal(release.tag, `v${release.version}`)
  assert.equal(release.releaseClass, 'community-pilot')
  assert.equal(typeof release.updateFeedEnabled, 'boolean')
  assert.match(release.sourceCommit, /^[a-f0-9]{40}$/)

  // Nền tảng: Windows x64 bắt buộc; macOS Apple Silicon và Linux x64 tuỳ bản, nhưng đã khai là phải có tệp.
  assert.ok(Array.isArray(release.supportedTargets) && release.supportedTargets.length > 0, 'supportedTargets required')
  assert.ok(release.supportedTargets.every(t => KNOWN_TARGETS.includes(t)), `unsupported target in ${release.supportedTargets}`)
  assert.ok(release.supportedTargets.includes('windows-x64'), 'windows-x64 is required')
  assert.equal(new Set(release.supportedTargets).size, release.supportedTargets.length)

  const sha = /^[a-f0-9]{64}$/
  assert.equal(release.windowsX64.authenticode, 'NotSigned')
  assert.match(release.windowsX64.sha256, sha)
  assert.equal(release.windowsX64.filename, `Hermes-${release.version}-win-x64.exe`)
  assert.equal(typeof release.windowsX64.size, 'number')

  if (release.supportedTargets.includes('macos-arm64')) {
    assert.ok(release.macosArm64, 'macosArm64 metadata missing')
    assert.equal(release.macosArm64.filename, `Hermes-${release.version}-mac-arm64.dmg`)
    assert.match(release.macosArm64.sha256, sha)
    assert.equal(release.macosArm64.codesign, 'AdHoc')
  } else {
    assert.equal(release.macosArm64, undefined, 'macosArm64 present but not in supportedTargets')
  }

  if (release.supportedTargets.includes('linux-x64')) {
    assert.ok(release.linuxX64, 'linuxX64 metadata missing')
    assert.equal(release.linuxX64.filename, `Hermes-${release.version}-linux-x86_64.AppImage`)
    assert.match(release.linuxX64.sha256, sha)

    if (release.linuxX64.deb) {
      assert.match(release.linuxX64.deb.filename, new RegExp(`^Hermes-${release.version.replace(/\./g, '\\.')}-linux-[a-z0-9_]+\\.deb$`))
      assert.match(release.linuxX64.deb.sha256, sha)
    }
  } else {
    assert.equal(release.linuxX64, undefined, 'linuxX64 present but not in supportedTargets')
  }

  const downloadFiles = expectedDownloadFiles(release)
  assert.deepEqual(release.downloadFiles, downloadFiles)
  assert.equal(new Set(release.downloadFiles).size, release.downloadFiles.length)
  const index = assetIndex(release)
  const platformLabels = ['Windows x64', ...(release.macosArm64 ? ['macOS'] : []), ...(release.linuxX64 ? ['Linux'] : [])]

  for (const filename of release.documentationFiles) {
    const text = documents[filename]
    assert.equal(typeof text, 'string', `Missing document ${filename}`)
    const blocks = [...text.matchAll(/<!-- current-release:start -->([\s\S]*?)<!-- current-release:end -->/g)]
    assert.equal(blocks.length, 1, `${filename}: one current-release block required`)
    const block = blocks[0][1]
    const expectedStrings = [release.version, `${base}/tag/${release.tag}`, ...platformLabels, 'chưa ký số', 'chưa phải stable']

    for (const { size, sha256 } of index.values()) {
      expectedStrings.push(String(size), sha256)
    }

    for (const expected of expectedStrings) {
      assert.ok(block.includes(expected), `${filename}: missing ${expected}`)
    }

    for (const asset of [...downloadFiles, 'SHA256SUMS.txt']) {
      assert.ok(block.includes(`${base}/download/${release.tag}/${asset}`), `${filename}: missing download ${asset}`)
    }

    for (const match of block.matchAll(/(?:vi-v\d+\.\d+\.\d+-\d+|\bv\d+\.\d+|\b\d{4}\.\d+\.\d+)/g)) {
      assert.ok([release.tag, release.version, `v${release.version.split('.').slice(0, 2).join('.')}`].includes(match[0]), `${filename}: stale release label ${match[0]}`)
    }

    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    for (const match of text.matchAll(new RegExp(`${escaped}/download/([^/]+)/([^\\s)"<>]+)`, 'g'))) {
      assert.equal(match[1], release.tag, `${filename}: stale download tag`)
      assert.ok([...downloadFiles, 'SHA256SUMS.txt'].includes(match[2]), `${filename}: unknown download asset`)
    }

    assert.ok(!text.includes('\uFFFD'), `${filename}: invalid Unicode`)
  }

  if (live) {
    assert.equal(live.tag_name, release.tag, 'GitHub Latest differs from public descriptor')
    assert.equal(live.draft, false)
    assert.equal(live.prerelease, false)
    assert.equal(live.target_commitish, release.sourceCommit)
    assert.deepEqual(live.assets.map(a => a.name).sort(), [...downloadFiles, 'SHA256SUMS.txt'].sort())

    for (const filename of downloadFiles) {
      const asset = live.assets.find(a => a.name === filename)
      const expected = index.get(filename)
      assert.equal(asset.size, expected.size, `${filename}: size`)
      assert.equal(asset.digest, `sha256:${expected.sha256}`, `${filename}: digest`)
      assert.equal(asset.browser_download_url, `${base}/download/${release.tag}/${filename}`)
    }
  }

  return { tag: release.tag, documents: release.documentationFiles.length, targets: release.supportedTargets.length, liveVerified: Boolean(live) }
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
