import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux', 'win32'])
const SUPPORTED_ARCHES = new Set(['arm64', 'x64'])

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function findArtifact(releaseDir, platformToken, arch, extension) {
  const suffix = `-${platformToken}-${arch}${extension}`.toLowerCase()
  const candidates = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(suffix))
    .map(entry => entry.name)
    .sort()

  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one ${platformToken}-${arch}${extension} artifact in ${releaseDir}; found ${candidates.length}: ${candidates.join(', ') || '(none)'}`
    )
  }

  return path.join(releaseDir, candidates[0])
}

function copyArtifact(source, outputDir, outputName) {
  const destination = path.join(outputDir, outputName)
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
  return destination
}

export function writeChecksums(directory, outputName = 'SHA256SUMS.txt') {
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.startsWith('SHA256SUMS'))
    .map(entry => entry.name)
    .sort()

  if (entries.length === 0) {
    throw new Error(`No release files found in ${directory}`)
  }

  const lines = entries.map(name => {
    const content = fs.readFileSync(path.join(directory, name))
    return `${createHash('sha256').update(content).digest('hex')}  ${name}`
  })
  const outputPath = path.join(directory, outputName)
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
  return outputPath
}

export function collectCommunityArtifacts({ arch, outputDir, platform, releaseDir }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  if (!SUPPORTED_ARCHES.has(arch)) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }
  if (platform === 'darwin' && arch !== 'arm64') {
    throw new Error('The community macOS release supports Apple Silicon (arm64) only')
  }

  ensureDirectory(outputDir)
  const copied = []

  if (platform === 'win32') {
    copied.push(
      copyArtifact(
        findArtifact(releaseDir, 'win', arch, '.exe'),
        outputDir,
        `Hermes-Vietnamese-Windows-${arch}-Setup.exe`
      )
    )
  } else if (platform === 'darwin') {
    const prefix = 'Hermes-Vietnamese-macOS-Apple-Silicon'
    copied.push(copyArtifact(findArtifact(releaseDir, 'mac', arch, '.dmg'), outputDir, `${prefix}.dmg`))
    copied.push(copyArtifact(findArtifact(releaseDir, 'mac', arch, '.zip'), outputDir, `${prefix}.zip`))
  } else {
    const prefix = `Hermes-Vietnamese-Linux-${arch}`
    const artifactArches = arch === 'x64'
      ? { '.AppImage': 'x86_64', '.deb': 'amd64', '.rpm': 'x86_64' }
      : { '.AppImage': 'arm64', '.deb': 'arm64', '.rpm': 'aarch64' }
    for (const [extension, artifactArch] of Object.entries(artifactArches)) {
      copied.push(
        copyArtifact(
          findArtifact(releaseDir, 'linux', artifactArch, extension),
          outputDir,
          `${prefix}${extension}`
        )
      )
    }
  }

  const checksumPath = writeChecksums(outputDir, `SHA256SUMS-${platform}-${arch}.txt`)
  return { checksumPath, copied }
}

function usage() {
  return [
    'Usage:',
    '  node collect-community-artifacts.mjs collect <platform> <arch> <releaseDir> <outputDir>',
    '  node collect-community-artifacts.mjs checksums <directory> [outputName]'
  ].join('\n')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const [command, ...args] = process.argv.slice(2)

  try {
    if (command === 'collect' && args.length === 4) {
      const [platform, arch, releaseDir, outputDir] = args
      const result = collectCommunityArtifacts({
        arch,
        outputDir: path.resolve(outputDir),
        platform,
        releaseDir: path.resolve(releaseDir)
      })
      console.log(`Collected ${result.copied.length} release file(s); checksums: ${result.checksumPath}`)
    } else if (command === 'checksums' && (args.length === 1 || args.length === 2)) {
      const [directory, outputName] = args
      console.log(`Wrote checksums: ${writeChecksums(path.resolve(directory), outputName)}`)
    } else {
      throw new Error(usage())
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
