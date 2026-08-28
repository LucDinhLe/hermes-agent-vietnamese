import productMetadata from './product-metadata.json'

export const EDITION_INFO = {
  displayName: productMetadata.displayName,
  productVersion: productMetadata.productVersion,
  technicalVersion: productMetadata.technicalVersion,
  engineName: productMetadata.upstream.productName,
  engineVersion: productMetadata.upstream.version,
  engineTag: productMetadata.upstream.tag,
  engineCommit: productMetadata.upstream.commit,
  maintainer: productMetadata.communityMaintainer.displayName,
  repositoryUrl: productMetadata.communityLinks.repository,
  issuesUrl: productMetadata.communityLinks.issues,
  releasesUrl: productMetadata.communityLinks.releases
} as const
