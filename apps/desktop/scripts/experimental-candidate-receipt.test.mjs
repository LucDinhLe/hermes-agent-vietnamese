import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'vitest'

import {
  composeExperimentalCandidateReceipt,
  validateExperimentalCandidateReceiptFile,
  writeExperimentalCandidateReceipt
} from './experimental-candidate-receipt.mjs'

const roots = []
const commit = character => character.repeat(40)
const json = value => `${JSON.stringify(value, null, 2)}\n`
const digest = value => createHash('sha256').update(json(value)).digest('hex')

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hermes-experimental-receipt-'))
  const build = path.join(root, 'build')
  const runtimeRoot = path.join(build, 'advisor-runtime')
  roots.push(root)
  mkdirSync(runtimeRoot, { recursive: true })

  const packageJson = {
    name: 'hermes-vietnamese-advisor-experimental',
    productName: 'Hermes Vietnamese Advisor Experimental',
    version: '0.33.0-dev.11-advisor-exp.9',
    build: {
      appId: 'vn.lucledinh.hermes-vietnamese.advisor-experimental',
      executableName: 'HermesVietnameseAdvisorExperimental',
      protocols: [{ schemes: ['hermes-advisor-experimental'] }]
    }
  }
  const editionReceipt = {
    schemaVersion: 1,
    releaseMode: false,
    engine: { commit: commit('a') },
    edition: { shellCommit: commit('b'), shellDirty: false, shellLiveRemoteRefs: [] }
  }
  const installStamp = {
    schemaVersion: 1,
    commit: commit('d'),
    branch: 'experimental/materialized-advisor-exp9',
    dirty: false,
    source: 'local'
  }
  const composition = {
    schemaVersion: 1,
    status: 'local-experimental-only',
    releaseCandidate: false,
    publicDistributionAllowed: false,
    productVersion: packageJson.version,
    shellRecipeCommit: commit('c'),
    officialEngineBase: editionReceipt.engine.commit,
    experimentalEngineHead: commit('e'),
    identity: {
      appId: packageJson.build.appId,
      executableName: packageJson.build.executableName,
      protocol: 'hermes-advisor-experimental'
    }
  }
  const runtimeManifest = {
    schemaVersion: 1,
    candidateId: 'd11e9-eeeeeeee-dddddddd',
    productVersion: packageJson.version,
    sourceCommit: composition.experimentalEngineHead,
    buildCommit: installStamp.commit,
    fileCount: 2,
    files: []
  }

  const files = {
    packageJson: path.join(root, 'package.json'),
    editionReceipt: path.join(build, 'edition-receipt.json'),
    installStamp: path.join(build, 'install-stamp.json'),
    composition: path.join(build, 'experimental-composition.json'),
    runtimeManifest: path.join(runtimeRoot, 'runtime-manifest.json'),
    runtimeSyncScript: path.join(runtimeRoot, 'Sync-Hermes-Advisor-Runtime.ps1'),
    candidateReceipt: path.join(build, 'experimental-candidate-receipt.json')
  }

  function persist() {
    writeFileSync(files.packageJson, json(packageJson))
    writeFileSync(files.editionReceipt, json(editionReceipt))
    writeFileSync(files.installStamp, json(installStamp))
    writeFileSync(files.composition, json(composition))
    writeFileSync(files.runtimeManifest, json(runtimeManifest))
    writeFileSync(files.runtimeSyncScript, 'Write-Output "verified sync"\n')
  }

  persist()
  return { root, packageJson, editionReceipt, installStamp, composition, runtimeManifest, files, persist }
}

function inputs(f) {
  return {
    packageJson: f.packageJson,
    editionReceipt: f.editionReceipt,
    installStamp: f.installStamp,
    composition: f.composition,
    runtimeManifest: f.runtimeManifest,
    componentSha256: {
      editionReceipt: digest(f.editionReceipt),
      installStamp: digest(f.installStamp),
      experimentalComposition: digest(f.composition),
      advisorRuntimeManifest: digest(f.runtimeManifest),
      advisorRuntimeSyncScript: createHash('sha256').update(readFileSync(f.files.runtimeSyncScript)).digest('hex')
    }
  }
}

test('native calendar pilot preserves truthful historical local receipt', () => {
  const f = fixture()
  f.packageJson.version = f.composition.productVersion = f.runtimeManifest.productVersion = '2026.9.2'
  f.runtimeManifest.candidateId = 'c2026m9r2-eeeeeeee-dddddddd'
  f.runtimeManifest.python = { layout: 'portable-cpython-win-x64-v1' }
  Object.assign(f.composition, {
    status: 'release-candidate',
    releaseCandidate: true,
    publicDistributionAllowed: true,
    distribution: { kind: 'community-pilot', signed: false, updateFeed: false, target: 'win-x64' }
  })
  f.installStamp.nativeRelease = {
    schemaVersion: 1,
    repository: 'https://github.com/LucDinhLe/hermes-agent-vietnamese.git',
    ref: `refs/heads/${f.installStamp.branch}`,
    commit: f.installStamp.commit,
    engineCommit: f.composition.experimentalEngineHead,
    platform: 'win32',
    arch: 'x64',
    nodeVersion: 'v26.7.0'
  }
  const receipt = composeExperimentalCandidateReceipt(inputs(f))
  assert.equal(receipt.publicDistributionAllowed, true)
  assert.equal(receipt.sources.baseEditionReleaseMode, false)
  assert.equal(receipt.sources.installStampSource, 'local')
  delete f.installStamp.nativeRelease
  assert.throws(() => composeExperimentalCandidateReceipt(inputs(f)), /missing native proof/)
})

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

test('writes and validates one receipt over the actual component bytes', () => {
  const f = fixture()
  const written = writeExperimentalCandidateReceipt({ desktopRoot: f.root, generatedAt: '2026-09-01T00:00:00.000Z' })
  const verified = validateExperimentalCandidateReceiptFile({ desktopRoot: f.root })

  assert.equal(written.outputPath, f.files.candidateReceipt)
  assert.equal(verified.sha256, written.sha256)
  assert.equal(verified.receipt.sources.officialEngineBase, f.editionReceipt.engine.commit)
  assert.equal(verified.receipt.sources.experimentalEngineSource, f.runtimeManifest.sourceCommit)
  assert.equal(verified.receipt.sources.materializedBuildCommit, f.runtimeManifest.buildCommit)
  assert.equal(verified.receipt.runtime.candidateId, f.runtimeManifest.candidateId)
  assert.equal(
    verified.receipt.components.advisorRuntimeSyncScript.sha256,
    createHash('sha256').update(readFileSync(f.files.runtimeSyncScript)).digest('hex')
  )
  assert.equal(verified.receipt.releaseCandidate, false)
})

test('detects a component whose bytes changed after the candidate receipt was written', () => {
  const f = fixture()
  writeExperimentalCandidateReceipt({ desktopRoot: f.root })
  f.composition.notes = 'tampered after receipt generation'
  writeFileSync(f.files.composition, json(f.composition))

  assert.throws(
    () => validateExperimentalCandidateReceiptFile({ desktopRoot: f.root }),
    /experimentalComposition SHA-256 mismatch/
  )
})

test('detects sync-script tamper after the candidate receipt was written', () => {
  const f = fixture()
  writeExperimentalCandidateReceipt({ desktopRoot: f.root })
  writeFileSync(f.files.runtimeSyncScript, 'Write-Output "tampered sync"\n')

  assert.throws(
    () => validateExperimentalCandidateReceiptFile({ desktopRoot: f.root }),
    /advisorRuntimeSyncScript SHA-256 mismatch/
  )
})

test('rejects mismatched commit and product relationships', () => {
  const cases = [
    [
      'product version',
      f => {
        f.runtimeManifest.productVersion = '0.33.0-dev.11-advisor-exp.10'
      },
      /Package and Advisor runtime versions do not match/
    ],
    [
      'official base',
      f => {
        f.composition.officialEngineBase = commit('f')
      },
      /official engine base mismatch/
    ],
    [
      'runtime source',
      f => {
        f.runtimeManifest.sourceCommit = commit('f')
      },
      /runtime source commit mismatch/
    ],
    [
      'materialized build',
      f => {
        f.installStamp.commit = commit('f')
      },
      /Install stamp commit must equal/
    ],
    [
      'candidate id',
      f => {
        f.runtimeManifest.candidateId = 'd11e9-eeeeeeee-ffffffff'
      },
      /runtime candidate id mismatch/
    ]
  ]

  for (const [name, mutate, expected] of cases) {
    const f = fixture()
    mutate(f)
    assert.throws(() => composeExperimentalCandidateReceipt(inputs(f)), expected, name)
  }
})

test('rejects dirty and fallback install stamps', () => {
  const dirty = fixture()
  dirty.installStamp.dirty = true
  assert.throws(() => composeExperimentalCandidateReceipt(inputs(dirty)), /clean materialized tree/)

  const fallback = fixture()
  fallback.installStamp.commit = '0'.repeat(40)
  fallback.installStamp.source = 'fallback'
  fallback.runtimeManifest.buildCommit = fallback.installStamp.commit
  fallback.runtimeManifest.candidateId = 'd11e9-eeeeeeee-00000000'
  assert.throws(() => composeExperimentalCandidateReceipt(inputs(fallback)), /fallback zero commit/)
})

test('rejects a dirty base receipt and an unsupported stamp source', () => {
  const dirtyBase = fixture()
  dirtyBase.editionReceipt.edition.shellDirty = true
  assert.throws(() => composeExperimentalCandidateReceipt(inputs(dirtyBase)), /clean shell/)

  const unsupportedSource = fixture()
  unsupportedSource.installStamp.source = 'manual'
  assert.throws(() => composeExperimentalCandidateReceipt(inputs(unsupportedSource)), /source must be local or ci/)
})

test('requires release evidence before a composition can claim release-candidate status', () => {
  const f = fixture()
  f.composition.status = 'release-candidate'
  f.composition.releaseCandidate = true

  assert.throws(() => composeExperimentalCandidateReceipt(inputs(f)), /release-mode base edition receipt/)

  f.editionReceipt.releaseMode = true
  f.editionReceipt.edition.shellLiveRemoteRefs = ['refs/remotes/origin/experimental']
  f.installStamp.source = 'ci'
  const receipt = composeExperimentalCandidateReceipt(inputs(f), { generatedAt: '2026-09-01T00:00:00.000Z' })
  assert.equal(receipt.releaseCandidate, true)
  assert.equal(receipt.sources.installStampSource, 'ci')
})

test('candidate receipt on disk contains the same bytes returned by the writer', () => {
  const f = fixture()
  const result = writeExperimentalCandidateReceipt({ desktopRoot: f.root, generatedAt: '2026-09-01T00:00:00.000Z' })
  assert.deepEqual(JSON.parse(readFileSync(result.outputPath, 'utf8')), result.receipt)
  assert.equal(createHash('sha256').update(readFileSync(result.outputPath)).digest('hex'), result.sha256)
})

test('desktop build writes the candidate receipt after runtime staging and packages that exact resource', () => {
  const packageJson = JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'))
  const buildSteps = packageJson.scripts.build.split(' && ')
  const runtimeStage = buildSteps.indexOf('node scripts/stage-advisor-runtime.mjs')
  const candidateReceipt = buildSteps.indexOf('node scripts/experimental-candidate-receipt.mjs')
  const rendererBuild = buildSteps.indexOf('vite build')

  assert.ok(runtimeStage >= 0)
  assert.equal(candidateReceipt, runtimeStage + 1)
  assert.equal(rendererBuild, candidateReceipt + 1)
  assert.deepEqual(
    packageJson.build.extraResources.filter(entry => entry.to === 'experimental-candidate-receipt.json'),
    [
      {
        from: 'build/experimental-candidate-receipt.json',
        to: 'experimental-candidate-receipt.json'
      }
    ]
  )
})
