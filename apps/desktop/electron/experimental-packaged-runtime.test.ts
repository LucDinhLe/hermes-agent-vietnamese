import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  configureExperimentalPackagedEnvironment,
  materializeExperimentalPackagedRuntime,
  verifyExperimentalRuntimeBundle
} from './experimental-packaged-runtime'

const roots: string[] = []
const APP_VERSION = '0.33.0-dev.11-advisor-exp.11'
const CANDIDATE = `d11e11-${'c'.repeat(8)}-${'d'.repeat(8)}`
const OFFICIAL_ENGINE_BASE = 'a'.repeat(40)
const BASE_EDITION_SHELL = 'b'.repeat(40)
const EXPERIMENTAL_ENGINE_SOURCE = 'c'.repeat(40)
const MATERIALIZED_BUILD = 'd'.repeat(40)
const RECIPE_SHELL = 'e'.repeat(40)

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-experimental-runtime-'))
  roots.push(root)

  return root
}

function digest(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function fixture() {
  const root = tempRoot()
  const resourcesPath = path.join(root, 'resources')
  const bundleRoot = path.join(resourcesPath, 'advisor-runtime')
  const payloadRoot = path.join(bundleRoot, 'payload')
  const payloadFile = path.join(payloadRoot, 'hermes_cli', 'main.py')
  const experimentRoot = path.join(root, 'experimental-state')
  const profileRoot = path.join(experimentRoot, 'profile')
  const manifestPath = path.join(bundleRoot, 'runtime-manifest.json')
  const syncScriptPath = path.join(bundleRoot, 'Sync-Hermes-Advisor-Runtime.ps1')

  const composition = {
    schemaVersion: 1,
    status: 'local-experimental-only',
    releaseCandidate: false,
    publicDistributionAllowed: false,
    productVersion: APP_VERSION,
    shellRecipeCommit: RECIPE_SHELL,
    officialEngineBase: OFFICIAL_ENGINE_BASE,
    experimentalEngineHead: EXPERIMENTAL_ENGINE_SOURCE,
    identity: {
      appId: 'vn.lucledinh.hermes-vietnamese.advisor-experimental',
      executableName: 'HermesVietnameseAdvisorExperimental',
      protocol: 'hermes-advisor-experimental'
    }
  }

  fs.mkdirSync(path.dirname(payloadFile), { recursive: true })
  fs.writeFileSync(payloadFile, 'print("candidate")\n', 'utf8')
  fs.writeFileSync(syncScriptPath, 'Write-Output "verified sync"\n', 'utf8')

  const manifest = {
    schemaVersion: 1,
    candidateId: CANDIDATE,
    productVersion: APP_VERSION,
    sourceCommit: EXPERIMENTAL_ENGINE_SOURCE,
    buildCommit: MATERIALIZED_BUILD,
    fileCount: 1,
    files: [
      {
        path: 'hermes_cli/main.py',
        sha256: digest(payloadFile),
        size: fs.statSync(payloadFile).size
      }
    ]
  }

  writeJson(manifestPath, manifest)
  writeJson(path.join(resourcesPath, 'edition-receipt.json'), {
    schemaVersion: 1,
    releaseMode: false,
    engine: { commit: OFFICIAL_ENGINE_BASE },
    edition: { shellCommit: BASE_EDITION_SHELL, shellDirty: false, shellLiveRemoteRefs: [] }
  })
  writeJson(path.join(resourcesPath, 'install-stamp.json'), {
    schemaVersion: 1,
    commit: manifest.buildCommit,
    branch: 'experimental/test',
    dirty: false,
    source: 'local'
  })
  writeJson(path.join(resourcesPath, 'experimental-composition.json'), composition)
  writeJson(path.join(resourcesPath, 'experimental-candidate-receipt.json'), {
    schemaVersion: 1,
    status: composition.status,
    releaseCandidate: composition.releaseCandidate,
    publicDistributionAllowed: composition.publicDistributionAllowed,
    product: {
      packageName: 'hermes-vietnamese-advisor-experimental',
      productName: 'Hermes Vietnamese Advisor Experimental',
      version: APP_VERSION,
      appId: composition.identity.appId,
      executableName: composition.identity.executableName,
      protocol: composition.identity.protocol
    },
    runtime: {
      candidateId: CANDIDATE,
      sourceCommit: manifest.sourceCommit,
      buildCommit: manifest.buildCommit,
      fileCount: manifest.fileCount
    },
    sources: {
      officialEngineBase: OFFICIAL_ENGINE_BASE,
      baseEditionShellCommit: BASE_EDITION_SHELL,
      baseEditionReleaseMode: false,
      recipeShellCommit: RECIPE_SHELL,
      experimentalEngineSource: manifest.sourceCommit,
      materializedBuildCommit: manifest.buildCommit,
      installStampSource: 'local',
      installStampBranch: 'experimental/test'
    },
    components: {
      advisorRuntimeManifest: {
        file: 'advisor-runtime/runtime-manifest.json',
        sha256: digest(manifestPath)
      },
      advisorRuntimeSyncScript: {
        file: 'advisor-runtime/Sync-Hermes-Advisor-Runtime.ps1',
        sha256: digest(syncScriptPath)
      },
      editionReceipt: {
        file: 'edition-receipt.json',
        sha256: digest(path.join(resourcesPath, 'edition-receipt.json'))
      },
      installStamp: {
        file: 'install-stamp.json',
        sha256: digest(path.join(resourcesPath, 'install-stamp.json'))
      },
      experimentalComposition: {
        file: 'experimental-composition.json',
        sha256: digest(path.join(resourcesPath, 'experimental-composition.json'))
      }
    }
  })

  return {
    bundleRoot,
    experimentRoot,
    manifest,
    manifestPath,
    payloadFile,
    payloadRoot,
    profileRoot,
    resourcesPath,
    root,
    syncScriptPath
  }
}

function rewriteReceiptedComponent(
  resourcesPath: string,
  component: 'advisorRuntimeManifest' | 'editionReceipt' | 'experimentalComposition' | 'installStamp',
  relativePath: string,
  mutate: (value: any) => void
) {
  const componentPath = path.join(resourcesPath, ...relativePath.split('/'))
  const value = JSON.parse(fs.readFileSync(componentPath, 'utf8'))
  mutate(value)
  writeJson(componentPath, value)

  const receiptPath = path.join(resourcesPath, 'experimental-candidate-receipt.json')
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
  receipt.components[component].sha256 = digest(componentPath)
  writeJson(receiptPath, receipt)
}

function createBootstrapVenv(profileRoot: string) {
  const venv = path.join(profileRoot, 'hermes-agent', 'venv')
  fs.mkdirSync(path.join(venv, 'Scripts'), { recursive: true })
  fs.mkdirSync(path.join(venv, 'Lib', 'site-packages'), { recursive: true })
  fs.writeFileSync(path.join(venv, 'pyvenv.cfg'), 'home = fixture\n', 'utf8')
  fs.writeFileSync(path.join(venv, 'Scripts', 'python.exe'), 'python', 'utf8')
  fs.writeFileSync(path.join(venv, 'Scripts', 'python.marker'), 'launcher dependency', 'utf8')
  fs.writeFileSync(path.join(venv, 'Lib', 'site-packages', 'dependency.py'), 'VALUE = 1\n', 'utf8')

  return venv
}

function successfulSync(bundle: ReturnType<typeof verifyExperimentalRuntimeBundle>) {
  return ({ experimentRoot, profileRoot }: { bundleRoot: string; experimentRoot: string; profileRoot: string }) => {
    const targetRoot = bundle.expectedTargetRoot
    const sourceVenv = path.join(profileRoot, 'hermes-agent', 'venv')
    fs.mkdirSync(path.dirname(targetRoot), { recursive: true })
    fs.cpSync(bundle.payloadRoot, targetRoot, { recursive: true })
    const targetVenv = path.join(targetRoot, '.venv')
    fs.mkdirSync(targetVenv, { recursive: true })

    for (const entry of fs.readdirSync(sourceVenv, { withFileTypes: true })) {
      if (entry.isFile()) {
        fs.copyFileSync(path.join(sourceVenv, entry.name), path.join(targetVenv, entry.name))
      }
    }

    fs.cpSync(path.join(sourceVenv, 'Scripts'), path.join(targetVenv, 'Scripts'), { recursive: true })
    fs.mkdirSync(path.join(targetVenv, 'Lib', 'site-packages'), { recursive: true })
    fs.writeFileSync(
      path.join(targetVenv, 'Lib', 'site-packages', '_hermes_legacy_site_packages.pth'),
      `import site; site.addsitedir(${JSON.stringify(path.join(sourceVenv, 'Lib', 'site-packages'))})\n`,
      'utf8'
    )
    writeJson(path.join(targetRoot, 'advisor-runtime-receipt.json'), {
      schemaVersion: 2,
      candidateId: bundle.candidateId,
      productVersion: bundle.manifest.productVersion,
      sourceCommit: bundle.manifest.sourceCommit,
      manifestSha256: bundle.manifestSha256,
      venvSource: sourceVenv,
      venvLayout: 'copied-scripts-pth-lib-v2'
    })
    fs.mkdirSync(experimentRoot, { recursive: true })
    fs.writeFileSync(path.join(experimentRoot, 'runtime-current.txt'), `${targetRoot}\n`, 'utf8')
  }
}

function plantDirectoryReparse(link: string) {
  const target = path.join(tempRoot(), 'reparse-target')

  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, 'injected.py'), 'raise SystemExit\n', 'utf8')
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

describe('packaged Experimental environment', () => {
  it('turns a direct packaged EXE launch into isolated profile and userData roots', () => {
    const localAppData = tempRoot()
    const stableRoot = path.join(localAppData, 'hermes')

    const env: Record<string, string | undefined> = {
      LOCALAPPDATA: localAppData,
      HERMES_HOME: stableRoot,
      HERMES_DESKTOP_HERMES_ROOT: path.join(stableRoot, 'hermes-agent')
    }

    const configured = configureExperimentalPackagedEnvironment({ env, isPackaged: true, isWindows: true })

    expect(configured.experimentRoot).toBe(path.join(localAppData, 'HermesVietnameseAdvisorExperimental'))
    expect(env.HERMES_HOME).toBe(path.join(configured.experimentRoot!, 'profile'))
    expect(env.HERMES_DESKTOP_USER_DATA_DIR).toBe(path.join(configured.experimentRoot!, 'user-data'))
    expect(env.HERMES_DESKTOP_HERMES_ROOT).toBeUndefined()
    expect(env.HERMES_HOME).not.toBe(stableRoot)
    expect(env.HERMES_DESKTOP_IGNORE_EXISTING).toBe('1')
  })

  it('rejects explicit roots in or outside the isolated Experimental tree', () => {
    const localAppData = tempRoot()
    const stableRoot = path.join(localAppData, 'hermes')

    expect(() =>
      configureExperimentalPackagedEnvironment({
        env: {
          LOCALAPPDATA: localAppData,
          HERMES_ADVISOR_EXPERIMENT_ROOT: path.join(stableRoot, 'experimental')
        },
        isPackaged: true,
        isWindows: true
      })
    ).toThrow(/stable Hermes tree/)

    expect(() =>
      configureExperimentalPackagedEnvironment({
        env: {
          LOCALAPPDATA: localAppData,
          HERMES_ADVISOR_EXPERIMENT_ROOT: localAppData
        },
        isPackaged: true,
        isWindows: true
      })
    ).toThrow(/stable Hermes tree/)

    expect(() =>
      configureExperimentalPackagedEnvironment({
        env: {
          LOCALAPPDATA: localAppData,
          HERMES_ADVISOR_EXPERIMENT_ROOT: path.join(localAppData, 'isolated'),
          HERMES_DESKTOP_USER_DATA_DIR: path.join(localAppData, 'elsewhere', 'user-data')
        },
        isPackaged: true,
        isWindows: true
      })
    ).toThrow(/userData root must stay inside/)

    expect(() =>
      configureExperimentalPackagedEnvironment({
        env: {
          LOCALAPPDATA: localAppData,
          HERMES_DESKTOP_USER_DATA_DIR: path.join(localAppData, 'isolated', 'state'),
          HERMES_HOME: path.join(localAppData, 'isolated', 'state', 'profile')
        },
        isPackaged: true,
        isWindows: true
      })
    ).toThrow(/profile and userData roots must be separate/)
  })

  it('does not change non-packaged development environments', () => {
    const env = { HERMES_HOME: 'dev-home', HERMES_DESKTOP_HERMES_ROOT: 'dev-checkout' }

    expect(configureExperimentalPackagedEnvironment({ env, isPackaged: false, isWindows: true }).enabled).toBe(false)
    expect(env).toEqual({ HERMES_HOME: 'dev-home', HERMES_DESKTOP_HERMES_ROOT: 'dev-checkout' })
  })
})

describe('packaged Experimental runtime', () => {
  it('materializes and pins the exact candidate before backend selection', () => {
    const f = fixture()
    createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    const env: Record<string, string | undefined> = {}

    const result = materializeExperimentalPackagedRuntime({
      bundle,
      env,
      experimentRoot: f.experimentRoot,
      profileRoot: f.profileRoot,
      runSync: successfulSync(bundle)
    })

    expect(result).toEqual({ status: 'ready', candidateId: CANDIDATE, targetRoot: bundle.expectedTargetRoot })
    expect(env.HERMES_DESKTOP_HERMES_ROOT).toBe(bundle.expectedTargetRoot)
    expect(env.PYTHONDONTWRITEBYTECODE).toBe('1')
    expect(fs.readFileSync(path.join(bundle.expectedTargetRoot, 'hermes_cli', 'main.py'), 'utf8')).toContain(
      'candidate'
    )
  })

  it('returns needs-bootstrap without selecting an ambient or partial runtime', () => {
    const f = fixture()

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    const env: Record<string, string | undefined> = {}

    expect(
      materializeExperimentalPackagedRuntime({
        bundle,
        env,
        experimentRoot: f.experimentRoot,
        profileRoot: f.profileRoot
      })
    ).toEqual({ status: 'needs-bootstrap', candidateId: CANDIDATE, targetRoot: bundle.expectedTargetRoot })
    expect(env.HERMES_DESKTOP_HERMES_ROOT).toBeUndefined()
  })

  it('fails closed when the manifest is missing or corrupt', () => {
    const missing = fixture()
    fs.rmSync(missing.manifestPath)
    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: missing.experimentRoot,
        resourcesPath: missing.resourcesPath
      })
    ).toThrow(/missing advisor runtime manifest/)

    const corrupt = fixture()
    fs.writeFileSync(corrupt.manifestPath, '{broken', 'utf8')
    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: corrupt.experimentRoot,
        resourcesPath: corrupt.resourcesPath
      })
    ).toThrow(/invalid advisor runtime manifest/)
  })

  it('fails closed on payload tamper and on a sync that pins another candidate', () => {
    const tampered = fixture()
    fs.writeFileSync(tampered.payloadFile, 'tampered\n', 'utf8')
    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: tampered.experimentRoot,
        resourcesPath: tampered.resourcesPath
      })
    ).toThrow(/runtime file (size|SHA-256) mismatch/)

    const wrongPin = fixture()
    createBootstrapVenv(wrongPin.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: wrongPin.experimentRoot,
      resourcesPath: wrongPin.resourcesPath
    })

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: wrongPin.experimentRoot,
        profileRoot: wrongPin.profileRoot,
        runSync: paths => {
          successfulSync(bundle)(paths)
          fs.writeFileSync(
            path.join(paths.experimentRoot, 'runtime-current.txt'),
            `${path.join(paths.experimentRoot, 'runtimes', 'wrong')}\n`
          )
        }
      })
    ).toThrow(/does not pin the packaged candidate/)
  })

  it('fails closed when a non-runtime receipt component is tampered', () => {
    const f = fixture()
    fs.writeFileSync(path.join(f.resourcesPath, 'edition-receipt.json'), '{"tampered":true}\n', 'utf8')

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(/packaged editionReceipt SHA-256 mismatch/)
  })

  it('derives the candidate id from the packaged version and exact commits at launch', () => {
    const f = fixture()
    const manifest = JSON.parse(fs.readFileSync(f.manifestPath, 'utf8'))
    manifest.candidateId = `d11e9-${'f'.repeat(8)}-${'e'.repeat(8)}`
    writeJson(f.manifestPath, manifest)

    const receiptPath = path.join(f.resourcesPath, 'experimental-candidate-receipt.json')
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    receipt.runtime.candidateId = manifest.candidateId
    receipt.components.advisorRuntimeManifest.sha256 = digest(f.manifestPath)
    writeJson(receiptPath, receipt)

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(/candidate id does not match the packaged version and commits/)
  })

  it('receipts the sync script and verifies it again immediately before execution', () => {
    const packagedTamper = fixture()
    fs.writeFileSync(packagedTamper.syncScriptPath, 'Write-Output "tampered"\n', 'utf8')

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: packagedTamper.experimentRoot,
        resourcesPath: packagedTamper.resourcesPath
      })
    ).toThrow(/packaged advisorRuntimeSyncScript SHA-256 mismatch/)

    const preExecTamper = fixture()
    createBootstrapVenv(preExecTamper.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: preExecTamper.experimentRoot,
      resourcesPath: preExecTamper.resourcesPath
    })

    fs.writeFileSync(preExecTamper.syncScriptPath, 'Write-Output "swapped after launch verification"\n', 'utf8')
    let executed = false

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: preExecTamper.experimentRoot,
        profileRoot: preExecTamper.profileRoot,
        runSync: () => {
          executed = true
        }
      })
    ).toThrow(/sync script SHA-256 mismatch/)
    expect(executed).toBe(false)
  })

  it.each([
    {
      component: 'editionReceipt' as const,
      relativePath: 'edition-receipt.json',
      mutate: (value: any) => {
        value.engine.commit = 'f'.repeat(40)
      },
      error: /edition engine commit does not match/
    },
    {
      component: 'experimentalComposition' as const,
      relativePath: 'experimental-composition.json',
      mutate: (value: any) => {
        value.shellRecipeCommit = 'f'.repeat(40)
      },
      error: /composition shell recipe commit does not match/
    },
    {
      component: 'installStamp' as const,
      relativePath: 'install-stamp.json',
      mutate: (value: any) => {
        value.dirty = true
      },
      error: /install stamp must come from a clean materialized tree/
    },
    {
      component: 'advisorRuntimeManifest' as const,
      relativePath: 'advisor-runtime/runtime-manifest.json',
      mutate: (value: any) => {
        value.sourceCommit = 'f'.repeat(40)
      },
      error: /candidate id does not match the packaged version and commits/
    }
  ])('fails closed when the re-digested $component breaks the candidate graph', testCase => {
    const f = fixture()
    rewriteReceiptedComponent(f.resourcesPath, testCase.component, testCase.relativePath, testCase.mutate)

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(testCase.error)
  })

  it('fails closed when the authoritative candidate receipt changes product identity', () => {
    const f = fixture()
    const receiptPath = path.join(f.resourcesPath, 'experimental-candidate-receipt.json')
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    receipt.product.protocol = 'hermes'
    writeJson(receiptPath, receipt)

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(/candidate protocol mismatch/)
  })

  it('does not treat a missing local-distribution flag as false', () => {
    const f = fixture()
    const receiptPath = path.join(f.resourcesPath, 'experimental-candidate-receipt.json')
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    delete receipt.publicDistributionAllowed
    writeJson(receiptPath, receipt)

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(/candidate publicDistributionAllowed must be boolean/)
  })

  it('does not package a composition with an omitted local-distribution flag', () => {
    const f = fixture()

    rewriteReceiptedComponent(
      f.resourcesPath,
      'experimentalComposition',
      'experimental-composition.json',
      (composition: any) => {
        delete composition.publicDistributionAllowed
      }
    )

    expect(() =>
      verifyExperimentalRuntimeBundle({
        appVersion: APP_VERSION,
        experimentRoot: f.experimentRoot,
        resourcesPath: f.resourcesPath
      })
    ).toThrow(/composition publicDistributionAllowed must be boolean/)
  })

  it('fails closed when a materialized candidate contains an unreceipted source file', () => {
    const f = fixture()
    createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    const sync = successfulSync(bundle)

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: f.experimentRoot,
        profileRoot: f.profileRoot,
        runSync: paths => {
          sync(paths)
          fs.writeFileSync(
            path.join(bundle.expectedTargetRoot, 'hermes_cli', 'shadow.py'),
            'raise SystemExit\n',
            'utf8'
          )
        }
      })
    ).toThrow(/source inventory does not exactly match/)
  })

  it.each([
    {
      name: 'interpreter tamper',
      mutate: (venv: string) => fs.writeFileSync(path.join(venv, 'Scripts', 'python.exe'), 'tampered', 'utf8')
    },
    {
      name: 'dependency tamper',
      mutate: (venv: string) =>
        fs.writeFileSync(path.join(venv, 'Lib', 'site-packages', 'dependency.py'), 'VALUE = 2\n', 'utf8')
    },
    {
      name: 'an extra dependency',
      mutate: (venv: string) =>
        fs.writeFileSync(path.join(venv, 'Lib', 'site-packages', 'unreceipted.py'), 'VALUE = 3\n', 'utf8')
    },
    {
      name: 'a dependency reparse point',
      mutate: (venv: string) => plantDirectoryReparse(path.join(venv, 'Lib', 'site-packages', 'redirected'))
    }
  ])('rejects $name before rerunning the sync script', testCase => {
    const f = fixture()
    const venv = createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    materializeExperimentalPackagedRuntime({
      bundle,
      experimentRoot: f.experimentRoot,
      profileRoot: f.profileRoot,
      runSync: successfulSync(bundle)
    })
    testCase.mutate(venv)
    let executed = false

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: f.experimentRoot,
        profileRoot: f.profileRoot,
        runSync: () => {
          executed = true
        }
      })
    ).toThrow(/inventory changed|inventory does not exactly match|reparse point/)
    expect(executed).toBe(false)
  })

  it('keeps the bootstrap inventory authoritative when the candidate directory changes', () => {
    const f = fixture()
    const venv = createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    materializeExperimentalPackagedRuntime({
      bundle,
      experimentRoot: f.experimentRoot,
      profileRoot: f.profileRoot,
      runSync: successfulSync(bundle)
    })
    fs.rmSync(bundle.expectedTargetRoot, { force: true, recursive: true })
    fs.writeFileSync(path.join(venv, 'Lib', 'site-packages', 'injected-after-candidate.py'), 'VALUE = 4\n', 'utf8')
    let executed = false

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: f.experimentRoot,
        profileRoot: f.profileRoot,
        runSync: () => {
          executed = true
        }
      })
    ).toThrow(/bootstrap interpreter or dependency inventory changed/)
    expect(executed).toBe(false)
  })

  it('adopts a launcher-materialized candidate only after full verification', () => {
    const f = fixture()

    createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    const sync = successfulSync(bundle)

    sync({
      bundleRoot: bundle.bundleRoot,
      experimentRoot: f.experimentRoot,
      profileRoot: f.profileRoot
    })
    expect(fs.existsSync(path.join(bundle.expectedTargetRoot, 'advisor-runtime-receipt.json'))).toBe(true)
    expect(fs.existsSync(path.join(f.experimentRoot, 'bootstrap-python-inventory-receipt.json'))).toBe(false)

    const result = materializeExperimentalPackagedRuntime({
      bundle,
      experimentRoot: f.experimentRoot,
      profileRoot: f.profileRoot,
      runSync: sync
    })

    expect(result).toEqual({
      status: 'ready',
      candidateId: CANDIDATE,
      targetRoot: bundle.expectedTargetRoot
    })
    expect(fs.existsSync(path.join(f.experimentRoot, 'bootstrap-python-inventory-receipt.json'))).toBe(true)
  })

  it.each([
    {
      name: 'copied interpreter tamper',
      mutate: (targetVenv: string) =>
        fs.writeFileSync(path.join(targetVenv, 'Scripts', 'python.exe'), 'tampered copy', 'utf8')
    },
    {
      name: 'unsafe bridge text',
      mutate: (targetVenv: string) =>
        fs.appendFileSync(
          path.join(targetVenv, 'Lib', 'site-packages', '_hermes_legacy_site_packages.pth'),
          'import injected\n',
          'utf8'
        )
    },
    {
      name: 'a redirected bridge path',
      mutate: (targetVenv: string) =>
        fs.writeFileSync(
          path.join(targetVenv, 'Lib', 'site-packages', '_hermes_legacy_site_packages.pth'),
          `import site; site.addsitedir(${JSON.stringify(tempRoot())})\n`,
          'utf8'
        )
    },
    {
      name: 'extra bridge dependency',
      mutate: (targetVenv: string) =>
        fs.writeFileSync(path.join(targetVenv, 'Lib', 'site-packages', 'injected.pth'), 'import injected\n', 'utf8')
    },
    {
      name: 'materialized reparse point',
      mutate: (targetVenv: string) => plantDirectoryReparse(path.join(targetVenv, 'Scripts', 'redirected'))
    }
  ])('rejects $name before selecting the materialized backend', testCase => {
    const f = fixture()
    createBootstrapVenv(f.profileRoot)

    const bundle = verifyExperimentalRuntimeBundle({
      appVersion: APP_VERSION,
      experimentRoot: f.experimentRoot,
      resourcesPath: f.resourcesPath
    })

    const sync = successfulSync(bundle)

    expect(() =>
      materializeExperimentalPackagedRuntime({
        bundle,
        experimentRoot: f.experimentRoot,
        profileRoot: f.profileRoot,
        runSync: paths => {
          sync(paths)
          testCase.mutate(path.join(bundle.expectedTargetRoot, '.venv'))
        }
      })
    ).toThrow(/unsafe shape|points outside|inventory does not exactly match|reparse point/)
  })
})
