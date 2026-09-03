// Native, unsigned Windows community pilots retain their historical base receipt.
// This is build provenance, not a substitute for exact-installer release acceptance.
export const RELEASE_REPOSITORY = 'https://github.com/LucDinhLe/hermes-agent-vietnamese.git'

export function assertNativeReleaseProvenance(
  stamp: Record<string, any>,
  composition: Record<string, any>,
  manifest: Record<string, any>
): void {
  const proof = stamp.nativeRelease
  const require = (ok: boolean, label: string) => {
    if (!ok) throw new Error(`Native release provenance: ${label}`)
  }
  require(/^20\d{2}\.(?:[1-9]|1[0-2])\.[1-9]\d*$/.test(composition.productVersion), 'calendar version required')
  require(stamp.source === 'local' && stamp.dirty === false, 'clean local source required')
  require(proof?.schemaVersion === 1, 'missing native proof')
  require(proof.repository === RELEASE_REPOSITORY, 'repository mismatch')
  require(proof.ref === `refs/heads/${stamp.branch}` && Boolean(stamp.branch), 'source ref mismatch')
  require(/^[0-9a-f]{40}$/.test(stamp.commit) && !/^0+$/.test(stamp.commit), 'invalid commit')
  require(proof.commit === stamp.commit && manifest.buildCommit === stamp.commit, 'commit mismatch')
  require(proof.engineCommit === composition.experimentalEngineHead, 'engine ancestry mismatch')
  require(proof.platform === 'win32' && proof.arch === 'x64', 'native Windows x64 required')
  require(/^v26\./.test(proof.nodeVersion), 'Node 26 required')
  require(composition.distribution?.kind === 'community-pilot' &&
    composition.distribution?.signed === false &&
    composition.distribution?.updateFeed === false &&
    composition.distribution?.target === 'win-x64', 'unsigned pilot distribution mismatch')
  require(manifest.python?.layout === 'portable-cpython-win-x64-v1', 'bundled Python required')
}
