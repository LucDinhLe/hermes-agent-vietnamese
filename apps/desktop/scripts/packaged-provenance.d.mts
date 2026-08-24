export interface ExpectedBundledProvenance {
  commit: string
  releaseClass: 'community-prerelease' | 'stable'
  tag: string
}

export function expectedBundledProvenanceFromEnv(
  env?: Record<string, string | undefined>,
): Readonly<ExpectedBundledProvenance>

export function readAndValidateBundledProvenance(options: {
  expected: ExpectedBundledProvenance
  resourcesPath: string
}): Readonly<{
  manifest: Record<string, unknown>
  provenance: ExpectedBundledProvenance & {
    updateChannel: string
    updateFeedEnabled: boolean
  }
  stamp: Record<string, unknown>
}>
