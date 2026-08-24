import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseVietnameseReleaseTag } from '../../../scripts/vietnamese-release.mjs'

const MANIFESTS = [
  {
    name: 'latest.yml',
    artifacts: [
      'Hermes-Vietnamese-Windows-x64-Setup.exe',
      'Hermes-Vietnamese-Windows-arm64-Setup.exe'
    ]
  },
  {
    name: 'latest-mac.yml',
    artifacts: [
      'Hermes-Vietnamese-macOS-Intel.zip',
      {
        name: 'Hermes-Vietnamese-macOS-Apple-Silicon.zip',
        // electron-updater detects Apple Silicon by finding "arm64" in the
        // URL. A fragment supplies that marker but is never sent to GitHub,
        // so the downloaded and verified asset remains the normalized ZIP.
        url: 'Hermes-Vietnamese-macOS-Apple-Silicon.zip#arm64'
      }
    ]
  },
  { name: 'latest-linux.yml', artifacts: ['Hermes-Vietnamese-Linux-x64.AppImage'] },
  { name: 'latest-linux-arm64.yml', artifacts: ['Hermes-Vietnamese-Linux-arm64.AppImage'] }
]

function artifactInfo(directory, artifact) {
  const name = typeof artifact === 'string' ? artifact : artifact.name
  const file = path.join(directory, name)

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Missing normalized update artifact: ${name}`)
  }

  const bytes = fs.readFileSync(file)

  return {
    name,
    sha512: createHash('sha512').update(bytes).digest('base64'),
    size: bytes.length,
    url: typeof artifact === 'string' ? artifact : artifact.url
  }
}

function singleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function manifestYaml(version, releaseDate, artifacts) {
  const primary = artifacts[0]
  const lines = [`version: ${version}`, 'files:']

  for (const artifact of artifacts) {
    lines.push(
      `  - url: ${singleQuoted(artifact.url)}`,
      `    sha512: ${artifact.sha512}`,
      `    size: ${artifact.size}`
    )
  }

  lines.push(
    `path: ${primary.name}`,
    `sha512: ${primary.sha512}`,
    `releaseDate: ${singleQuoted(releaseDate)}`
  )

  return `${lines.join('\n')}\n`
}

export function generateCommunityUpdateMetadata({ directory, releaseClass, releaseDate, tag }) {
  const { appVersion } = parseVietnameseReleaseTag(tag)

  if (releaseClass !== 'stable') {
    throw new Error(
      `update metadata is stable-only; ${releaseClass || 'missing release class'} must ship without latest*.yml`
    )
  }

  if (!releaseDate || Number.isNaN(Date.parse(releaseDate))) {
    throw new Error(`releaseDate must be an ISO timestamp, got: ${releaseDate}`)
  }

  const outputs = []

  for (const manifest of MANIFESTS) {
    const artifacts = manifest.artifacts.map(name => artifactInfo(directory, name))
    const output = path.join(directory, manifest.name)
    fs.writeFileSync(output, manifestYaml(appVersion, releaseDate, artifacts), 'utf8')
    outputs.push(output)
  }

  return outputs
}

function usage() {
  return 'Usage: node generate-community-update-metadata.mjs <release-assets-dir> <vi-tag> <release-date> stable'
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const [directory, tag, releaseDate, releaseClass] = process.argv.slice(2)

  try {
    if (!directory || !tag || !releaseDate || !releaseClass || process.argv.length !== 6) {
      throw new Error(usage())
    }

    const outputs = generateCommunityUpdateMetadata({
      directory: path.resolve(directory),
      releaseClass,
      releaseDate,
      tag
    })
    console.log(`Wrote ${outputs.length} update manifest(s): ${outputs.map(file => path.basename(file)).join(', ')}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
