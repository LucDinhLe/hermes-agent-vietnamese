const RELEASE_CLASSES = new Set(['community-prerelease', 'stable'])
export const BUNDLED_BUILD_NODE_MIN_MAJOR = 26

export function validateBundledBuildNode(version) {
  const normalized = String(version || '').trim().replace(/^v/i, '')
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

export function validateLocalCandidateCheckout({ expectedCommit, headCommit, trackedStatus }) {
  if (!/^[0-9a-f]{40}$/i.test(String(expectedCommit || ''))) {
    throw new Error('--local-candidate requires --commit=<full 40-character HEAD SHA>')
  }
  if (expectedCommit.toLowerCase() !== String(headCommit || '').toLowerCase()) {
    throw new Error(`--commit ${expectedCommit} does not match HEAD ${headCommit || '(missing)'}`)
  }
  if (String(trackedStatus || '').trim()) {
    throw new Error('tagless local candidate requires a clean tracked index and worktree')
  }

  return Object.freeze({ commit: headCommit.toLowerCase(), localCandidate: true })
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
