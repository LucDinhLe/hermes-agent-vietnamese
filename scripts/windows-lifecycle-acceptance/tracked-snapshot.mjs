import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const PLAYWRIGHT_DEPENDENCY_SPECS = Object.freeze([
  Object.freeze({
    fileCount: 11,
    integrity: 'sha512-akea+6bHYBBfA9uQqSYmlJXn61cTa+jbO87xVLCWbTqbWadRVmhxlXATaOjOgcBaWU4ePo0wB41KMFv3o35IXA==',
    packageName: '@playwright/test',
    sha256: '0fcc89f9baee99e79e5db8757dc5efc8956f13766243daa9888e995b00e8ee63',
    version: '1.58.2'
  }),
  Object.freeze({
    fileCount: 182,
    integrity: 'sha512-vA30H8Nvkq/cPBnNw4Q8TWz1EJyqgpuinBcHET0YVJVFldr8JDNiU9LaWAE1KqSkRYazuaBhTpB5ZzShOezQ6A==',
    packageName: 'playwright',
    sha256: 'fddb73a78c9338f49ad760200cb5cb2cd5d53084b70eb75263c05e0ebe03d5e5',
    version: '1.58.2'
  }),
  Object.freeze({
    fileCount: 363,
    integrity: 'sha512-yZkEtftgwS8CsfYo7nm0KE8jsvm6i/PTgVtB8DL726wNf6H2IMsDuxCpJj59KDaxCtSnrWan2AeDqM7JBaultg==',
    packageName: 'playwright-core',
    sha256: '0ce0305dae280c85549de2e2485498a99b62d40a040ec17a9eb477a02dee88f5',
    version: '1.58.2'
  })
])

function git(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`)
  return result.stdout.trim()
}

export function stageTrackedSnapshot({ destination, expectedCommit, repoRoot }) {
  if (fs.existsSync(destination) && fs.readdirSync(destination).length > 0) {
    throw new Error(`tracked snapshot destination must be empty: ${destination}`)
  }
  fs.mkdirSync(destination, { recursive: true })
  const head = git(repoRoot, ['rev-parse', 'HEAD'])
  if (head !== expectedCommit) throw new Error(`tracked snapshot HEAD ${head} does not match ${expectedCommit}`)
  const archive = `${path.resolve(destination)}.git-archive.tar`
  try {
    git(repoRoot, ['archive', '--format=tar', `--output=${archive}`, expectedCommit])
    const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'
    const extracted = spawnSync(tar, ['-xf', archive, '-C', destination], {
      encoding: 'utf8',
      windowsHide: true
    })
    if (extracted.error) throw extracted.error
    if (extracted.status !== 0) {
      throw new Error(`tar extraction failed: ${(extracted.stderr || extracted.stdout).trim()}`)
    }
  } finally {
    fs.rmSync(archive, { force: true })
  }
  assertLinkFreeTree(destination)
  return { commit: head, destination: fs.realpathSync.native(destination) }
}

export function assertLinkFreeTree(root) {
  const walk = current => {
    for (const name of fs.readdirSync(current)) {
      const entry = path.join(current, name)
      const stat = fs.lstatSync(entry)
      if (stat.isSymbolicLink()) throw new Error(`snapshot input may not contain a link or junction: ${entry}`)
      if (stat.isDirectory()) walk(entry)
      else if (!stat.isFile()) throw new Error(`snapshot input contains an unsupported entry: ${entry}`)
    }
  }
  walk(root)
}

export function stagePlaywrightDependencies({ destinationRepo, nodeModulesRoot, specs = PLAYWRIGHT_DEPENDENCY_SPECS }) {
  const lockPath = path.join(destinationRepo, 'package-lock.json')
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  const staged = []
  for (const spec of specs) {
    const { fileCount, integrity, packageName, sha256, version } = spec
    const lockEntry = lock.packages?.[`node_modules/${packageName}`]
    if (lockEntry?.version !== version || lockEntry?.integrity !== integrity) {
      throw new Error(`package-lock provenance mismatch for ${packageName}; expected ${version} / ${integrity}`)
    }
    const source = path.join(nodeModulesRoot, ...packageName.split('/'))
    if (!fs.statSync(source, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`required offline Playwright dependency is missing: ${source}`)
    }
    assertLinkFreeTree(source)
    const installedPackage = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
    if (installedPackage.version !== version) {
      throw new Error(
        `installed Playwright dependency version mismatch for ${packageName}; expected ${version}, got ${installedPackage.version}`
      )
    }
    const sourceFingerprint = fingerprintSnapshot(source)
    if (sourceFingerprint.fileCount !== fileCount || sourceFingerprint.sha256 !== sha256) {
      throw new Error(`installed Playwright dependency fingerprint mismatch for ${packageName}`)
    }
    const destination = path.join(destinationRepo, 'node_modules', ...packageName.split('/'))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.cpSync(source, destination, { dereference: false, errorOnExist: true, force: false, recursive: true })
    const stagedFingerprint = fingerprintSnapshot(destination)
    if (
      stagedFingerprint.fileCount !== sourceFingerprint.fileCount ||
      stagedFingerprint.sha256 !== sourceFingerprint.sha256
    ) {
      throw new Error(`staged Playwright dependency changed during copy: ${packageName}`)
    }
    staged.push({ fileCount, integrity, packageName, sha256, version })
  }
  assertLinkFreeTree(destinationRepo)
  return staged
}

export function fingerprintSnapshot(root) {
  const records = []
  const walk = current => {
    for (const name of fs.readdirSync(current).sort()) {
      const entry = path.join(current, name)
      const stat = fs.lstatSync(entry)
      if (stat.isSymbolicLink()) throw new Error(`snapshot may not contain a link or junction: ${entry}`)
      if (stat.isDirectory()) walk(entry)
      else if (stat.isFile()) {
        const sha256 = crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex')
        records.push({ path: path.relative(root, entry).split(path.sep).join('/'), sha256, size: stat.size })
      } else throw new Error(`snapshot contains an unsupported entry: ${entry}`)
    }
  }
  walk(root)
  return {
    fileCount: records.length,
    sha256: crypto
      .createHash('sha256')
      .update(`${JSON.stringify(records)}\n`)
      .digest('hex')
  }
}
