/** About describes the verified runtime, not the Git checkout used by updates. */
export function runtimeMetadataRoot(
  bundled: boolean,
  candidate: { status: 'needs-bootstrap' | 'ready'; targetRoot: string } | null | undefined,
  updateRoot: string
): string | null {
  if (!bundled) {
    return updateRoot
  }

  return candidate?.status === 'ready' ? candidate.targetRoot : null
}
