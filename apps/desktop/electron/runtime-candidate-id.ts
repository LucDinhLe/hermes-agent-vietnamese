/** Shared by staging, package receipts and startup verification. Legacy IDs stay
 * readable so upgrading does not invalidate the previous rollback runtime. */
export const RUNTIME_CANDIDATE_PATTERN = /^(?:d\d+e\d+|c[1-9]\d{3}m(?:[1-9]|1[0-2])r[1-9]\d*)-[0-9a-f]{8}-[0-9a-f]{8}$/

export function expectedRuntimeCandidateId(version: string, sourceCommit: string, buildCommit: string): string {
  for (const commit of [sourceCommit, buildCommit]) {
    if (!/^[0-9a-f]{40}$/.test(commit) || /^0+$/.test(commit)) {
      throw new Error('Runtime candidate requires exact nonzero source and build commits')
    }
  }

  const calendar = version.match(/^([1-9]\d{3})\.([1-9]|1[0-2])\.([1-9]\d*)$/)
  const legacy = version.match(/^\d+\.\d+\.\d+-dev\.(\d+)-advisor-exp\.(\d+)$/)

  if (!calendar && !legacy) {
    throw new Error(`Unsupported runtime product version: ${version}`)
  }

  const prefix = calendar ? `c${calendar[1]}m${calendar[2]}r${calendar[3]}` : `d${legacy![1]}e${legacy![2]}`
  const id = `${prefix}-${sourceCommit.slice(0, 8)}-${buildCommit.slice(0, 8)}`

  if (id.length > 32) {
    throw new Error(`Runtime candidate exceeds the Windows path budget: ${id}`)
  }

  return id
}
