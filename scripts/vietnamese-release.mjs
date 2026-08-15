import { createHash } from "node:crypto"
import fs from "node:fs"

export const VI_RELEASE_TAG_RE = /^vi-v(0|[1-9]\d{0,2})\.(\d+)\.(\d+)-(0|[1-9]\d*)$/

export function parseVietnameseReleaseTag(tag) {
  const normalized = String(tag).trim()
  const match = VI_RELEASE_TAG_RE.exec(normalized)
  if (!match) {
    throw new Error(`release tag must be vi-vX.Y.Z-N, got: ${tag}`)
  }
  const [, major, minor, patch, iteration] = match
  const baseVersion = `${major}.${minor}.${patch}`
  return {
    tag: normalized,
    baseVersion,
    iteration: Number(iteration),
    // GitHub stays on a stable vi-* release. Electron needs valid SemVer
    // for comparison inside latest*.yml, so encode the community revision
    // as a numeric prerelease component.
    appVersion: `${baseVersion}-vi.${iteration}`,
  }
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
