import productMetadata from './product-metadata.json'

/** Preserve truthful product/runtime layers. Older bridges reported only the
 * engine through appVersion, so the edition metadata remains a safe fallback. */
export function adaptVietnameseDesktopVersion<
  VersionInfo extends { appVersion: string; engineVersion?: string }
>(raw: VersionInfo): VersionInfo & { engineVersion: string } {
  return {
    ...raw,
    appVersion: raw.engineVersion ? raw.appVersion : productMetadata.technicalVersion,
    engineVersion: raw.engineVersion ?? raw.appVersion
  }
}
