import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

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

export function stagePlaywrightDependencies({ destinationRepo, nodeModulesRoot }) {
  const packages = ['@playwright/test', 'playwright', 'playwright-core']
  for (const packageName of packages) {
    const source = path.join(nodeModulesRoot, ...packageName.split('/'))
    if (!fs.statSync(source, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`required offline Playwright dependency is missing: ${source}`)
    }
    assertLinkFreeTree(source)
    const destination = path.join(destinationRepo, 'node_modules', ...packageName.split('/'))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.cpSync(source, destination, { dereference: false, errorOnExist: true, force: false, recursive: true })
  }
  assertLinkFreeTree(destinationRepo)
  return packages
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
