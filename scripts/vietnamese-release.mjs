import { createHash } from "node:crypto"
import fs from "node:fs"

export const VI_RELEASE_TAG_RE = /^vi-v(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-(0|[1-9]\d*)$/

const productMetadata = JSON.parse(
  fs.readFileSync(new URL("../apps/desktop/product-metadata.json", import.meta.url), "utf8"),
)

export const VI_PRODUCT_RELEASE = Object.freeze({
  displayName: productMetadata.displayName,
  productVersion: productMetadata.productVersion,
  technicalVersion: productMetadata.technicalVersion,
  upstreamVersion: productMetadata.upstream?.version,
  releaseTitle: `${productMetadata.displayName} ${productMetadata.productVersion}`,
})

// Kênh composite (kế hoạch 04/09/2026): tag lịch vYYYY.M.D hoặc vYYYY.M.D-thunghiem.N.
// appVersion giữ nguyên chuỗi (SemVer hợp lệ, hậu tố thunghiem là prerelease),
// khớp cách electron/release-notice.ts suy kênh từ phiên bản đang chạy.
export const CALVER_RELEASE_TAG_RE = /^v(\d{4})\.(\d{1,2})\.(\d{1,3})(?:-thunghiem\.(\d{1,4}))?$/

export function parseVietnameseReleaseTag(tag) {
  const normalized = String(tag).trim()
  const calver = CALVER_RELEASE_TAG_RE.exec(normalized)
  if (calver) {
    const [, year, month, day, iteration] = calver
    const baseVersion = `${year}.${month}.${day}`
    return {
      tag: normalized,
      baseVersion,
      iteration: iteration === undefined ? 0 : Number(iteration),
      calver: true,
      channel: iteration === undefined ? "latest" : "thunghiem",
      appVersion: normalized.slice(1),
    }
  }
  const match = VI_RELEASE_TAG_RE.exec(normalized)
  if (!match) {
    throw new Error(`release tag must be vi-vX.Y.Z-N or vYYYY.M.D[-thunghiem.N], got: ${tag}`)
  }
  const [, major, minor, patch, iteration] = match
  const baseVersion = `${major}.${minor}.${patch}`
  return {
    tag: normalized,
    baseVersion,
    iteration: Number(iteration),
    calver: false,
    channel: "legacy",
    // GitHub stays on a stable vi-* release. Electron needs valid SemVer
    // for comparison inside latest*.yml, so encode the community revision
    // as a numeric prerelease component.
    appVersion: `${baseVersion}-vi.${iteration}`,
  }
}

export function resolveVietnameseReleaseCandidate(tag) {
  const release = parseVietnameseReleaseTag(tag)
  const metadata = VI_PRODUCT_RELEASE

  if (!/^v\d+\.\d+$/.test(metadata.productVersion || "")) {
    throw new Error(`product metadata has an invalid productVersion: ${metadata.productVersion}`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(metadata.technicalVersion || "")) {
    throw new Error(`product metadata has an invalid technicalVersion: ${metadata.technicalVersion}`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(metadata.upstreamVersion || "")) {
    throw new Error(`product metadata has an invalid upstream version: ${metadata.upstreamVersion}`)
  }
  if (!release.calver && release.baseVersion !== metadata.technicalVersion) {
    throw new Error(
      `release tag ${tag} does not match Hermes Vietnamese technical version ${metadata.technicalVersion}`,
    )
  }

  return { ...release, ...metadata }
}

export function compareVietnameseReleaseTags(leftTag, rightTag) {
  const order = (tag) => {
    const normalized = parseVietnameseReleaseTag(tag).tag
    const match = VI_RELEASE_TAG_RE.exec(normalized)
    return match.slice(1, 5).map((value) => BigInt(value))
  }
  const left = order(leftTag)
  const right = order(rightTag)

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) return 1
    if (left[index] < right[index]) return -1
  }
  return 0
}

/** Refuse a stable publication that would move GitHub Latest backward. */
export function validateStablePromotionOrder({ previousLatestTag, tag }) {
  if (compareVietnameseReleaseTags(tag, previousLatestTag) <= 0) {
    throw new Error(`stable tag ${tag} must be newer than current Latest ${previousLatestTag}`)
  }
  return { newer: true, previousLatestTag, tag }
}

/** Refuse local candidate builds from untagged, mismatched, or dirty bytes. */
export function validateVietnameseCandidateCheckout({ headCommit, status, tag, tagCommit }) {
  parseVietnameseReleaseTag(tag)
  if (!/^[0-9a-f]{40}$/.test(String(headCommit ?? ""))) {
    throw new Error("candidate checkout HEAD must be a full Git commit")
  }
  if (!/^[0-9a-f]{40}$/.test(String(tagCommit ?? ""))) {
    throw new Error(`candidate tag ${tag} does not resolve to a full Git commit`)
  }
  if (tagCommit !== headCommit) {
    throw new Error(`candidate tag ${tag} points to ${tagCommit}, but HEAD is ${headCommit}`)
  }
  if (String(status ?? "").trim()) {
    throw new Error("candidate checkout must be clean before building exact artifacts")
  }

  return { clean: true, commit: headCommit, tag }
}

function normalizedReleaseBody(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/\n+$/g, "")
}

/** Validate the two mutable GitHub release fields against the immutable tag. */
export function validateVietnameseReleasePresentation({ body, expectedBody, expectedTitle, name }) {
  if (String(name ?? "") !== String(expectedTitle ?? "")) {
    throw new Error(`release title mismatch; expected ${expectedTitle}, got ${name}`)
  }

  if (normalizedReleaseBody(body) !== normalizedReleaseBody(expectedBody)) {
    throw new Error("release body differs from the notes committed by the candidate tag")
  }

  return { title: String(name), bodyMatches: true }
}

/** Bind prerelease promotion to the exact public callout prepared by the tag. */
export function validateFeaturedCandidatePromotion({ featuredCandidate, tag }) {
  if (featuredCandidate?.tag !== tag) {
    throw new Error(`featured candidate tag mismatch; expected ${tag}, got ${featuredCandidate?.tag}`)
  }
  if (featuredCandidate.releaseClass !== "community-prerelease") {
    throw new Error(
      `featured candidate releaseClass must be community-prerelease, got ${featuredCandidate.releaseClass}`,
    )
  }
  if (featuredCandidate.published !== true) {
    throw new Error("featured candidate must describe the target published state")
  }

  return { tag, published: true }
}

/** Ensure immutable release notes describe the class the operator will publish. */
export function validateVietnameseReleaseNotesForClass({ body, releaseClass }) {
  const notes = normalizedReleaseBody(body)
  const communityClaim = /community[ -]prerelease/i
  const notStableClaim = /chưa phải stable/i
  const stableClassClaim = /lớp phát hành:\s*(?:\*\*)?stable\b/i
  const stableLatestClaim = /\bstable\s*\/\s*latest\b/i

  if (releaseClass === "community-prerelease") {
    if (!communityClaim.test(notes) || !notStableClaim.test(notes)) {
      throw new Error("community-prerelease notes must say community prerelease and chưa phải stable")
    }
    if (stableClassClaim.test(notes) || stableLatestClaim.test(notes)) {
      throw new Error("community-prerelease notes must not claim Stable/Latest")
    }
  } else if (releaseClass === "stable") {
    if (!stableClassClaim.test(notes) || !stableLatestClaim.test(notes)) {
      throw new Error("stable notes must identify the stable release as Stable/Latest")
    }
    if (communityClaim.test(notes) || notStableClaim.test(notes)) {
      throw new Error("stable notes must not contain community-prerelease or not-stable claims")
    }
  } else {
    throw new Error(`unsupported release class for notes: ${releaseClass}`)
  }

  return { releaseClass, classMatches: true }
}

// Runtime Node is an immutable build input. Values are from the official
// Node.js v26.5.1 SHASUMS256.txt; the build refuses bytes that do not match.
export const PAYLOAD_NODE_VERSION = "v26.5.1"
const PAYLOAD_NODE_SHA256 = Object.freeze({
  "darwin-arm64": "f4387df0b46556516d19abf2f2d6806481ac8368aa7f9d96bafed422a56a1d01",
  "darwin-x64": "077d5c936868dab19d21f77f1e71ce13697e80b3e86a399dcab238902a2ebf93",
  "linux-arm64": "0b6b0cc2a1eecbe736f9918de8b5a6c9a48d286b88bec1298a3c1e3376182ea8",
  "linux-x64": "cc7b3484ade63bd203a9d304f21ec37a3b622b988d7bdecf1dc4d68fc44a91b7",
  "win32-arm64": "467f425228a2fdcc83a330f5f38b124b5b43b42f5033d7848b4e47c9becc36f9",
  "win32-x64": "c432c996b95cbf7568f13a0fbb37526de84a27e3a5c520c3be15f05a9a168212",
})

export function payloadNodeDescriptor(platform, arch) {
  const osName = { linux: "linux", darwin: "darwin", win32: "win" }[platform]
  const cpu = { x64: "x64", arm64: "arm64" }[arch]
  const sha256 = PAYLOAD_NODE_SHA256[`${platform}-${arch}`]
  if (!osName || !cpu || !sha256) {
    throw new Error(`unsupported payload Node target: ${platform}-${arch}`)
  }
  const ext = platform === "win32" ? "zip" : platform === "darwin" ? "tar.gz" : "tar.xz"
  const archive = `node-${PAYLOAD_NODE_VERSION}-${osName}-${cpu}.${ext}`
  return {
    version: PAYLOAD_NODE_VERSION,
    archive,
    sha256,
    url: `https://nodejs.org/dist/${PAYLOAD_NODE_VERSION}/${archive}`,
  }
}

export function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
