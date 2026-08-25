import fs from 'node:fs'
import path from 'node:path'

export function canonicalHostPath(value) {
  return fs.realpathSync.native(path.resolve(value))
}

export function isSameOrWithin(candidate, parent) {
  const relative = path.relative(canonicalHostPath(parent), canonicalHostPath(candidate))
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

export function resolveLifecycleStagingRoot({ isolationMode, runnerTemp, systemTemp }) {
  let selected
  if (isolationMode === 'github-hosted-ephemeral-vm') {
    if (typeof runnerTemp !== 'string' || runnerTemp.trim() === '') {
      throw new Error('GitHub-hosted lifecycle staging requires RUNNER_TEMP')
    }
    selected = runnerTemp
  } else if (isolationMode === 'windows-sandbox') {
    selected = systemTemp
  } else {
    throw new Error(`unsupported lifecycle isolation mode: ${isolationMode}`)
  }

  const stat = fs.statSync(selected, { throwIfNoEntry: false })
  if (!stat?.isDirectory()) throw new Error(`lifecycle staging root is not a directory: ${selected}`)
  return canonicalHostPath(selected)
}

export function assertEmptyEvidenceDirectory(directory) {
  const linkStat = fs.lstatSync(directory, { throwIfNoEntry: false })
  if (linkStat?.isSymbolicLink()) throw new Error(`evidence path may not be a link or junction: ${directory}`)
  const stat = fs.statSync(directory, { throwIfNoEntry: false })
  if (stat && !stat.isDirectory()) throw new Error(`evidence path is not a directory: ${directory}`)
  if (stat && fs.readdirSync(directory).length > 0) {
    throw new Error(`evidence directory must be new or empty: ${directory}`)
  }
  fs.mkdirSync(directory, { recursive: true })
  const created = fs.lstatSync(directory)
  if (created.isSymbolicLink() || !created.isDirectory()) {
    throw new Error(`evidence path did not resolve to a newly controlled directory: ${directory}`)
  }
}

export function assertEvidenceBoundary(directory, protectedPaths) {
  const evidence = canonicalHostPath(directory)
  if (evidence.toLowerCase() === path.parse(evidence).root.toLowerCase()) {
    throw new Error(`evidence directory is too broad to map writable: ${evidence}`)
  }
  for (const rawProtectedPath of protectedPaths) {
    const protectedPath = canonicalHostPath(rawProtectedPath)
    if (isSameOrWithin(evidence, protectedPath) || isSameOrWithin(protectedPath, evidence)) {
      throw new Error(`evidence directory overlaps a protected host path: ${rawProtectedPath}`)
    }
  }
}
