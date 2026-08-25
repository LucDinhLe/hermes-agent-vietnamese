import fs from 'node:fs'
import path from 'node:path'

// Exact ignored output roots whose contents are later copied into the
// installer. Local candidates recreate every one of these from committed
// sources and pinned dependencies, so stale files must not survive a run.
export const LOCAL_CANDIDATE_DERIVED_OUTPUTS = Object.freeze([
  'ui-tui/dist',
  'hermes_cli/web_dist',
  'apps/desktop/dist',
  // electron-builder does not guarantee that output from an interrupted run
  // is removed before the next one. A failed NSIS bootstrap can therefore
  // leave a candidate-shaped .exe, blockmap or feed beside the next build.
  'apps/desktop/release',
  'apps/desktop/build/install-stamp.json',
  'apps/desktop/build/hermes-connector',
  'apps/desktop/build/hermes-connector-trust.json',
  'apps/desktop/build/agent-payload'
])

export function purgeLocalCandidateDerivedOutputs(repoRoot) {
  if (!String(repoRoot || '').trim()) {
    throw new Error('local-candidate derived-output purge requires a repository root')
  }
  const root = path.resolve(repoRoot)
  const purged = []

  for (const relativePath of LOCAL_CANDIDATE_DERIVED_OUTPUTS) {
    const target = path.resolve(root, ...relativePath.split('/'))
    const relativeTarget = path.relative(root, target)
    if (!relativeTarget || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
      throw new Error(`refusing to purge local-candidate path outside the repository: ${relativePath}`)
    }
    fs.rmSync(target, { recursive: true, force: true })
    purged.push(target)
  }

  return Object.freeze(purged)
}
