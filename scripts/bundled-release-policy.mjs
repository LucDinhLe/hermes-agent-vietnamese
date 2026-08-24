const RELEASE_CLASSES = new Set(['community-prerelease', 'stable'])
export const BUNDLED_BUILD_NODE_MIN_MAJOR = 26
export const BUNDLED_BUILD_NPM_RANGE = '<11.10.0 || >=11.17.0'
export const LOCAL_CANDIDATE_STATUS_COMMAND = 'git status --porcelain=v1 --untracked-files=all'
// `git status` deliberately omits ignored files, but several ignored paths are
// still production inputs: Vite loads local .env files, and stale compiler
// emissions under source trees can win module resolution over TypeScript.
// Query only live input surfaces. Derived trees (node_modules, dist, build,
// release, and web_dist) are intentionally absent because the pinned install
// and build steps recreate them.
export const LOCAL_CANDIDATE_IGNORED_INPUT_GIT_ARGS = Object.freeze([
  'ls-files',
  '--others',
  '--ignored',
  '--exclude-standard',
  '--',
  ':(top,glob).env*',
  ':(top,glob)apps/desktop/.env*',
  ':(top,glob)ui-tui/.env*',
  ':(top,glob)web/.env*',
  ':(top,glob)apps/desktop/assets/**',
  ':(top,glob)apps/desktop/electron/**',
  ':(top,glob)apps/desktop/public/**',
  ':(top,glob)apps/desktop/src/**',
  ':(top,glob)apps/shared/src/**',
  ':(top,glob)ui-tui/src/**',
  ':(top,glob)ui-tui/packages/*/src/**',
  ':(top,glob)web/public/**',
  ':(top,glob)web/src/**'
])

export function validateBundledBuildNode(version) {
  const normalized = String(version || '')
    .trim()
    .replace(/^v/i, '')
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(normalized)
  if (!match) {
    throw new Error(`cannot determine bundled build host Node version from: ${version || '(missing)'}`)
  }
  const major = Number(match[1])
  if (major < BUNDLED_BUILD_NODE_MIN_MAJOR) {
    throw new Error(
      `bundled release builds require Node ${BUNDLED_BUILD_NODE_MIN_MAJOR} or newer; ` +
        `current host is Node ${normalized}. Invoke this script with the digest-pinned Node 26 executable.`
    )
  }
  return Object.freeze({ major, version: normalized })
}

export function validateBundledBuildNpm(version) {
  const normalized = String(version || '')
    .trim()
    .replace(/^v/i, '')
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(normalized)
  if (!match) {
    throw new Error(`cannot determine bundled build host npm version from: ${version || '(missing)'}`)
  }
  const [major, minor, patch] = match.slice(1, 4).map(Number)
  const accepted = major < 11 || major > 11 || minor < 10 || minor >= 17
  if (!accepted) {
    throw new Error(
      `bundled release builds require npm ${BUNDLED_BUILD_NPM_RANGE}; ` + `current host is npm ${normalized}`
    )
  }
  return Object.freeze({ major, minor, patch, version: normalized })
}

export function resolveBundledReleaseClass(value, { localCandidate = false } = {}) {
  const releaseClass = String(value || '').trim() || (localCandidate ? 'community-prerelease' : '')

  if (!RELEASE_CLASSES.has(releaseClass)) {
    throw new Error(
      'bundled builds require --release-class=community-prerelease|stable ' +
        '(or HERMES_RELEASE_CLASS with the same value)'
    )
  }
  if (localCandidate && releaseClass !== 'community-prerelease') {
    throw new Error('a tagless --local-candidate is unsigned and must use community-prerelease')
  }

  return releaseClass
}

export function bundledUpdatePolicy(releaseClass) {
  const normalized = resolveBundledReleaseClass(releaseClass)

  return Object.freeze({
    releaseClass: normalized,
    updateChannel: normalized === 'stable' ? 'stable' : 'community-prerelease',
    updateFeedEnabled: normalized === 'stable'
  })
}

export function validateLocalCandidateCheckout({
  expectedCommit,
  headCommit,
  ignoredBuildInputs = '',
  worktreeStatus
}) {
  if (!/^[0-9a-f]{40}$/i.test(String(expectedCommit || ''))) {
    throw new Error('--local-candidate requires --commit=<full 40-character HEAD SHA>')
  }
  if (expectedCommit.toLowerCase() !== String(headCommit || '').toLowerCase()) {
    throw new Error(`--commit ${expectedCommit} does not match HEAD ${headCommit || '(missing)'}`)
  }
  if (String(worktreeStatus || '').trim()) {
    throw new Error(
      'tagless local candidate requires a fully clean index and worktree; ' +
        'tracked and untracked files are forbidden'
    )
  }
  if (String(ignoredBuildInputs || '').trim()) {
    throw new Error(
      'tagless local candidate found ignored artifact-affecting build inputs; ' +
        'remove local .env files and ignored source shadows before building'
    )
  }

  return Object.freeze({ commit: headCommit.toLowerCase(), localCandidate: true })
}

export function createLocalCandidateProvenanceGuard({ expectedCommit, skipInstall = false }) {
  if (skipInstall) {
    throw new Error(
      'tagless local candidate forbids --no-install; npm ci must materialize dependencies from the committed lockfile'
    )
  }

  let initialCommit = null
  return Object.freeze({
    check({ headCommit, ignoredBuildInputs, worktreeStatus }) {
      const checkout = validateLocalCandidateCheckout({
        expectedCommit,
        headCommit,
        ignoredBuildInputs,
        worktreeStatus
      })
      if (initialCommit && checkout.commit !== initialCommit) {
        throw new Error(
          `tagless local candidate commit changed during the build: ${initialCommit} -> ${checkout.commit}`
        )
      }
      initialCommit ??= checkout.commit
      return checkout
    }
  })
}

export function resolvePayloadGitRef({ commit, localCandidate = false, tag }) {
  if (!localCandidate) {
    return tag
  }
  if (!/^[0-9a-f]{40}$/i.test(String(commit || ''))) {
    throw new Error('local candidate payload ref must be a full 40-character commit SHA')
  }
  return commit.toLowerCase()
}
