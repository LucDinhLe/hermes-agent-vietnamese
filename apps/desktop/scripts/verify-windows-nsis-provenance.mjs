import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { getPath7za } from 'app-builder-lib/out/toolsets/7zip.js'

import { classifyPeArchitecture } from './stage-native-deps.mjs'
import {
  expectedBundledProvenanceFromEnv,
  readAndValidateBundledProvenance
} from './packaged-provenance.mjs'

function allFiles(root, predicate) {
  const matches = []
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(fullPath)
      else if (entry.isFile() && predicate(fullPath, entry.name)) matches.push(fullPath)
    }
  }
  return matches.sort()
}

function run7za(binary, args, label) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    shell: false,
    timeout: 300_000,
    windowsHide: true
  })
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || '').trim()
    throw new Error(`${label} failed (${result.status ?? 'spawn'}): ${detail}`)
  }
}

function isFile(file) {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true
}

export function resolveExtractedWindowsNsisLayout(outer, arch) {
  const expectedArchiveName = arch === 'arm64' ? 'app-arm64.7z' : 'app-64.7z'
  const applicationArchives = allFiles(
    outer,
    (_file, name) => name.toLowerCase() === expectedArchiveName
  )
  if (applicationArchives.length > 1) {
    throw new Error(
      `NSIS must contain at most one ${expectedArchiveName}; found ${applicationArchives.length}`
    )
  }
  if (applicationArchives.length === 1) {
    return Object.freeze({
      applicationArchive: applicationArchives[0],
      applicationRoot: null,
      kind: 'archive'
    })
  }

  // Newer 7-Zip NSIS handlers may expand electron-builder's embedded
  // app-<arch>.7z in one pass. Accept that representation only when the
  // application is rooted exactly at the extraction directory; the later
  // provenance and PE gates still validate the immutable payload and target
  // architecture. Nested matching decoys therefore remain fail-closed.
  const directLayoutFiles = [
    path.join(outer, 'Hermes.exe'),
    path.join(outer, 'resources', 'install-stamp.json'),
    path.join(outer, 'resources', 'agent-payload', 'manifest.json')
  ]
  if (directLayoutFiles.every(isFile)) {
    return Object.freeze({
      applicationArchive: null,
      applicationRoot: outer,
      kind: 'direct'
    })
  }

  throw new Error(
    `NSIS contains neither one ${expectedArchiveName} nor a directly extracted application root`
  )
}

export async function extractWindowsNsisWithoutInstalling(artifactPath, outputRoot, arch) {
  const sevenZip = await getPath7za()
  const outer = path.join(outputRoot, 'outer')
  fs.mkdirSync(outer, { recursive: true })
  run7za(sevenZip, ['x', '-bd', '-y', `-o${outer}`, artifactPath], 'NSIS outer extraction')

  const layout = resolveExtractedWindowsNsisLayout(outer, arch)
  if (layout.kind === 'direct') return layout.applicationRoot

  const application = path.join(outputRoot, 'application')
  fs.mkdirSync(application, { recursive: true })
  run7za(
    sevenZip,
    ['x', '-bd', '-y', `-o${application}`, layout.applicationArchive],
    'NSIS resident application extraction'
  )
  return application
}

function findUniqueResourcesPath(extractedRoot) {
  const expectedResourcesPath = path.join(extractedRoot, 'resources')
  const stamps = allFiles(extractedRoot, (_file, name) => name === 'install-stamp.json')
    .filter(stampPath => fs.statSync(
      path.join(path.dirname(stampPath), 'agent-payload', 'manifest.json'),
      { throwIfNoEntry: false }
    )?.isFile())
  if (stamps.length !== 1 || path.dirname(stamps[0] || '') !== expectedResourcesPath) {
    throw new Error(
      'extracted NSIS must contain exactly one resident install-stamp/manifest pair ' +
        `at <application>/resources; found ${stamps.length} at ` +
        `${stamps.map(stamp => path.relative(extractedRoot, stamp)).join(', ') || '(none)'}`
    )
  }
  return expectedResourcesPath
}

function validateInstalledPe(file, arch, label) {
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`extracted NSIS is missing ${label}: ${file}`)
  }
  const actualArch = classifyPeArchitecture(file)
  if (actualArch !== arch) {
    throw new Error(`${label} PE architecture mismatch; expected ${arch}, got ${actualArch ?? 'unknown'}`)
  }
}

export async function verifyWindowsNsisProvenance({
  arch = process.arch === 'arm64' ? 'arm64' : 'x64',
  artifactPath,
  env = process.env,
  extract = extractWindowsNsisWithoutInstalling,
  extractionRoot = null
}) {
  const artifact = path.resolve(artifactPath)
  const stat = fs.statSync(artifact, { throwIfNoEntry: false })
  if (!stat?.isFile() || stat.size === 0) {
    throw new Error(`Windows NSIS artifact is missing or empty: ${artifact}`)
  }
  if (!['arm64', 'x64'].includes(arch)) {
    throw new Error(`unsupported Windows NSIS architecture: ${arch}`)
  }

  const expected = expectedBundledProvenanceFromEnv(env)
  const callerOwnedScratch = extractionRoot != null
  const scratch = callerOwnedScratch
    ? path.resolve(extractionRoot)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-nsis-provenance-'))
  if (callerOwnedScratch) {
    if (fs.existsSync(scratch) && fs.readdirSync(scratch).length > 0) {
      throw new Error(`explicit NSIS extraction root must be empty: ${scratch}`)
    }
    fs.mkdirSync(scratch, { recursive: true })
  }
  try {
    const extractedRoot = await extract(artifact, scratch, arch)
    const resourcesPath = findUniqueResourcesPath(extractedRoot)
    const result = readAndValidateBundledProvenance({ expected, resourcesPath })
    const appRoot = path.dirname(resourcesPath)
    validateInstalledPe(path.join(appRoot, 'Hermes.exe'), arch, 'packaged Hermes.exe')
    validateInstalledPe(
      path.join(resourcesPath, 'agent-payload', 'node', 'node.exe'),
      arch,
      'resident Node.exe'
    )
    return Object.freeze({
      artifact,
      applicationBinary: path.join(appRoot, 'Hermes.exe'),
      commit: result.provenance.commit,
      releaseClass: result.provenance.releaseClass,
      size: stat.size,
      tag: result.provenance.tag
    })
  } finally {
    if (!callerOwnedScratch) {
      fs.rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 })
    }
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const artifactPath = process.argv[2]
  const arch = process.argv.find(arg => arg.startsWith('--arch='))?.slice('--arch='.length)
  const extractionRoot = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  try {
    if (!artifactPath) throw new Error('usage: verify-windows-nsis-provenance.mjs <installer.exe> --arch=x64|arm64')
    const result = await verifyWindowsNsisProvenance({ arch, artifactPath, extractionRoot })
    console.log(
      `[verify-windows-nsis] exact embedded payload: ${result.tag} ${result.commit} ` +
        `${result.releaseClass} (${result.size} bytes)`
    )
    if (extractionRoot) console.log(`[verify-windows-nsis] extracted application: ${result.applicationBinary}`)
  } catch (error) {
    console.error(`[verify-windows-nsis] fatal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
