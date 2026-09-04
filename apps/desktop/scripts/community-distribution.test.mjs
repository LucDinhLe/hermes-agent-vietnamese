import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test } from 'vitest'

import { resolveVietnameseReleaseCandidate } from '../../../scripts/vietnamese-release.mjs'

const repoRoot = resolve(import.meta.dirname, '..', '..', '..')
const communityRepo = 'LucDinhLe/hermes-agent-vietnamese'
const upstreamRepo = 'NousResearch/hermes-agent'

// Hợp đồng composite (engine.lock): lõi ở gốc kho là upstream nguyên bản, nên
// install.ps1/install.sh/update_cmd.py/banner.py trỏ NousResearch là ĐÚNG.
// Chỉ vỏ desktop mới trỏ kho cộng đồng.
const shellDistributionFiles = ['apps/desktop/electron/bootstrap-runner.ts']
const engineDistributionFiles = ['scripts/install.ps1', 'scripts/install.sh', 'hermes_cli/update_cmd.py']

test('desktop shell update paths use the Vietnamese repository', () => {
  for (const relativePath of shellDistributionFiles) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    assert.match(source, new RegExp(communityRepo.replace('/', '\\/')))
    assert.doesNotMatch(source, new RegExp(upstreamRepo.replace('/', '\\/')))
  }
})

test('engine install/update scripts stay upstream-pristine (engine.lock)', () => {
  for (const relativePath of engineDistributionFiles) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    assert.match(source, new RegExp(upstreamRepo.replace('/', '\\/')))
    assert.doesNotMatch(source, new RegExp(communityRepo.replace('/', '\\/')))
  }
})

test('upstream contributor bookkeeping stays disabled in community forks', () => {
  const workflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8')

  assert.match(workflow, /github\.repository == 'NousResearch\/hermes-agent'/)
})

test('packaged upgrades retain the installed identity and disclose the MIT license', () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'apps/desktop/package.json'), 'utf8'))
  const metadata = JSON.parse(readFileSync(resolve(repoRoot, 'apps/desktop/product-metadata.json'), 'utf8'))
  const candidate = resolveVietnameseReleaseCandidate(`vi-v${metadata.technicalVersion}-1`)
  const main = readFileSync(resolve(repoRoot, 'apps/desktop/electron/main.ts'), 'utf8')
  const exeIdentity = readFileSync(resolve(repoRoot, 'apps/desktop/scripts/set-exe-identity.mjs'), 'utf8')

  assert.equal(metadata.displayName, 'Hermes Vietnamese')
  assert.equal(metadata.productVersion, candidate.productVersion)
  assert.match(metadata.upstream.version, /^\d+\.\d+\.\d+$/)
  assert.notEqual(metadata.upstream.version, metadata.technicalVersion)
  assert.equal(pkg.version, metadata.technicalVersion)
  assert.equal(pkg.productName, metadata.technicalIdentity.packageProductName)
  assert.equal(pkg.build.appId, metadata.technicalIdentity.appId)
  assert.equal(pkg.build.productName, metadata.technicalIdentity.packageProductName)
  assert.equal(pkg.build.executableName, metadata.technicalIdentity.executableName)
  assert.deepEqual(pkg.build.protocols[0].schemes, [metadata.technicalIdentity.protocol])
  assert.ok(pkg.build.nsis.shortcutName.startsWith(metadata.displayName)) // hậu tố '(thử nghiệm)' cho kênh pre-release
  assert.ok(pkg.build.nsis.uninstallDisplayName.startsWith(metadata.displayName))
  assert.equal(pkg.build.mac.extendInfo.CFBundleDisplayName, metadata.displayName)
  assert.equal(pkg.build.mac.extendInfo.CFBundleExecutable, metadata.technicalIdentity.executableName)
  assert.equal(pkg.build.dmg.title, `Install ${metadata.displayName}`)
  assert.equal(pkg.build.linux.desktop.entry.Name, metadata.displayName)
  assert.equal(pkg.build.linux.desktop.entry.StartupWMClass, metadata.technicalIdentity.executableName)
  assert.equal(
    pkg.build.linux.maintainer,
    `${metadata.communityMaintainer.displayName} <${metadata.communityMaintainer.publicEmail}>`
  )
  assert.equal(pkg.license, metadata.license.spdx)
  assert.equal(pkg.author, metadata.communityMaintainer.displayName)
  assert.equal(pkg.build.publish[0].owner, metadata.updateRepository.owner)
  assert.equal(pkg.build.publish[0].repo, metadata.updateRepository.repo)
  assert.match(main, /const APP_NAME = process\.env\.HERMES_DESKTOP_APP_NAME \|\| 'Hermes Vietnamese'/)
  assert.match(main, /app\.setAppUserModelId\('vn\.lucledinh\.hermes-vietnamese'\)/)
  assert.equal(pkg.build.nsis.guid, metadata.technicalIdentity.nsisGuid)
  assert.doesNotMatch(main, /title: 'Hermes'/)
  assert.match(exeIdentity, /product-metadata\.json/)
  assert.match(exeIdentity, /ProductName: displayName/)
  assert.match(exeIdentity, /CompanyName: maintainer/)
  assert.match(exeIdentity, /MIT License/)
  assert.match(
    readFileSync(resolve(repoRoot, 'apps/desktop/scripts/after-pack.mjs'), 'utf8'),
    /HERMES_RELEASE_CLASS.*HERMES_DESKTOP_BUNDLED/s
  )
})
