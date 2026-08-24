import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function strictManifestFilenames(checksumBytes) {
  const checksumText = Buffer.isBuffer(checksumBytes) ? checksumBytes.toString('utf8') : String(checksumBytes)
  const filenames = []
  const seen = new Set()

  for (const line of checksumText.split(/\r?\n/)) {
    if (!line.trim()) continue
    const match = /^[0-9a-f]{64}\s{2}(.+)$/.exec(line)
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`)
    const filename = match[1]
    if (filename !== path.basename(filename) || filename.includes('\\')) {
      throw new Error(`manifest path is not a filename: ${filename}`)
    }
    if (seen.has(filename)) throw new Error(`duplicate manifest filename: ${filename}`)
    seen.add(filename)
    filenames.push(filename)
  }

  if (!filenames.length) throw new Error('SHA256SUMS.txt is empty')
  return filenames
}

export function validateReleaseAssetInventory(assetNames, checksumBytes, evidenceFilename) {
  if (!evidenceFilename || evidenceFilename !== path.basename(evidenceFilename) || evidenceFilename.includes('\\')) {
    throw new Error('release evidence filename must be a filename')
  }
  const manifestNames = strictManifestFilenames(checksumBytes)
  if (manifestNames.includes('SHA256SUMS.txt') || manifestNames.includes(evidenceFilename)) {
    throw new Error('manifest must not include itself or the post-smoke evidence file')
  }

  const actual = [...assetNames].sort()
  const expected = [...manifestNames, 'SHA256SUMS.txt', evidenceFilename].sort()
  if (new Set(actual).size !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('release asset inventory differs from the manifest plus its evidence file')
  }
  return manifestNames
}

function main() {
  const [candidateDir, evidenceFilename] = process.argv.slice(2)
  if (!candidateDir || !evidenceFilename || process.argv.length !== 4) {
    throw new Error('usage: release-asset-inventory.mjs <candidate-dir> <evidence-filename>')
  }
  const resolvedDir = path.resolve(candidateDir)
  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true })
  if (entries.some(entry => !entry.isFile())) throw new Error('release inventory must contain files only')
  const manifestNames = validateReleaseAssetInventory(
    entries.map(entry => entry.name),
    fs.readFileSync(path.join(resolvedDir, 'SHA256SUMS.txt')),
    evidenceFilename
  )
  process.stdout.write(`${JSON.stringify({ evidenceFilename, manifestAssets: manifestNames.length })}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
