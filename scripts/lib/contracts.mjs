import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function normalizeRelative(file) {
  return file.split(path.sep).join('/')
}

export function assertSafeRelativePath(file, label = 'path', { allowDirectoryGlob = false } = {}) {
  if (typeof file !== 'string' || file.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }

  const normalized = file.replaceAll('\\', '/')
  const hasDirectoryGlob = allowDirectoryGlob && normalized.endsWith('/**')
  const pathPart = hasDirectoryGlob ? normalized.slice(0, -3) : normalized
  const withoutTrailingSlash = pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart
  const segments = withoutTrailingSlash.split('/')
  const windowsDevice = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9])(?:\.|$)/i

  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    pathPart.includes('*') ||
    /[<>:"|?\u0000-\u001f]/.test(pathPart) ||
    segments.some(
      (part) => part === '.' || part === '..' || part === '' || /[. ]$/.test(part) || windowsDevice.test(part)
    )
  ) {
    throw new Error(`${label} must stay inside the edition tree: ${file}`)
  }

  return normalized
}

export function matchesAllowedPath(file, patterns) {
  const normalized = assertSafeRelativePath(file)

  return patterns.some((pattern) => {
    const allowed = assertSafeRelativePath(pattern, 'allowed path', { allowDirectoryGlob: true })

    if (allowed.endsWith('/**')) {
      const prefix = allowed.slice(0, -2)

      return normalized.startsWith(prefix)
    }

    return normalized === allowed
  })
}

export function isForbiddenPath(file, prefixes) {
  const normalized = assertSafeRelativePath(file)

  return prefixes.some((prefix) => normalized.startsWith(assertSafeRelativePath(prefix, 'forbidden prefix')))
}

export function collectFiles(root) {
  if (!existsSync(root)) {
    return []
  }

  const files = []

  function walk(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)

      if (entry.isSymbolicLink()) {
        throw new Error(`Edition overlays may not contain symlinks: ${absolute}`)
      }

      if (entry.isDirectory()) {
        walk(absolute)
      } else if (entry.isFile()) {
        files.push(normalizeRelative(path.relative(root, absolute)))
      }
    }
  }

  walk(root)

  return files.sort()
}

export function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function sha256Tree(root) {
  const hash = createHash('sha256')

  for (const file of collectFiles(root)) {
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(path.join(root, ...file.split('/'))))
    hash.update('\0')
  }

  return hash.digest('hex')
}

export function pathsDeclaredByPatch(file) {
  const text = readFileSync(file, 'utf8')
  const paths = new Set()

  for (const line of text.split(/\r?\n/)) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line)

    if (!match) {
      continue
    }

    if (match[1] !== match[2]) {
      throw new Error(`Rename patches are not allowed in the core ledger: ${line}`)
    }

    paths.add(assertSafeRelativePath(match[1], 'patch path'))
  }

  if (paths.size === 0) {
    throw new Error(`Patch has no declared diff paths: ${file}`)
  }

  return [...paths].sort()
}

export function runGit(args, cwd, { allowFailure = false, timeoutMs = 60_000 } = {}) {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0 && !allowFailure) {
    const detail = (result.stderr || result.stdout || '').trim()

    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }

  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  }
}

export function normalizeRepositoryUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  let normalized = value.trim().replaceAll('\\', '/')
  const scpLike = /^git@([^:]+):(.+)$/.exec(normalized)

  if (scpLike) {
    normalized = `https://${scpLike[1]}/${scpLike[2]}`
  } else {
    normalized = normalized.replace(/^ssh:\/\/git@/i, 'https://')
  }

  return normalized
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export function resolveShellState(root, expectedRepository = null) {
  const inside = runGit(['rev-parse', '--is-inside-work-tree'], root, { allowFailure: true })

  if (!inside.ok || inside.stdout !== 'true') {
    return { commit: null, dirty: true, remoteCandidates: [], remoteTrackingRefs: [] }
  }

  const commit = runGit(['rev-parse', 'HEAD'], root, { allowFailure: true })
  const status = runGit(['status', '--porcelain=v1', '--untracked-files=normal'], root)
  const expected = normalizeRepositoryUrl(expectedRepository)
  const remoteCandidates = []

  if (commit.ok && expected) {
    const remotes = runGit(['remote'], root).stdout.split(/\r?\n/).filter(Boolean)

    for (const remote of remotes) {
      const url = runGit(['remote', 'get-url', remote], root, { allowFailure: true })

      if (!url.ok || normalizeRepositoryUrl(url.stdout) !== expected) {
        continue
      }

      const refs = runGit(
        ['for-each-ref', '--format=%(refname)', '--contains', commit.stdout, `refs/remotes/${remote}`],
        root,
        { allowFailure: true }
      )

      if (refs.ok) {
        for (const trackingRef of refs.stdout.split(/\r?\n/).filter((ref) => ref && !ref.endsWith('/HEAD'))) {
          const branch = trackingRef.slice(`refs/remotes/${remote}/`.length)
          const trackingCommit = runGit(['rev-parse', trackingRef], root, { allowFailure: true })

          if (branch && trackingCommit.ok) {
            remoteCandidates.push({
              remote,
              remoteRef: `refs/heads/${branch}`,
              trackingCommit: trackingCommit.stdout,
              trackingRef
            })
          }
        }
      }
    }
  }

  return {
    commit: commit.ok ? commit.stdout : null,
    dirty: status.stdout.length > 0,
    remoteCandidates,
    remoteTrackingRefs: [...new Set(remoteCandidates.map((candidate) => candidate.trackingRef))].sort()
  }
}

export function verifyLiveRemoteRefs(root, candidates) {
  const live = []

  for (const candidate of candidates) {
    const result = runGit(['ls-remote', '--exit-code', candidate.remote, candidate.remoteRef], root, {
      allowFailure: true
    })

    if (!result.ok) {
      continue
    }

    const advertised = result.stdout
      .split(/\r?\n/)
      .map((line) => /^(\S+)\s+(\S+)$/.exec(line))
      .find((match) => match?.[2] === candidate.remoteRef)?.[1]

    if (advertised === candidate.trackingCommit) {
      live.push(candidate.trackingRef)
    }
  }

  return [...new Set(live)].sort()
}

export function assertRegularFile(file, label = 'file') {
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`${label} does not exist: ${file}`)
  }
}
