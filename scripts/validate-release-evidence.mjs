import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const RELEASE_PLATFORMS = Object.freeze([
  "windows-x64",
  "windows-arm64",
  "macos-arm64",
  "macos-x64",
  "linux-x64",
  "linux-arm64",
])

export const REQUIRED_RUNTIME_GATES = Object.freeze([
  "architecture",
  "residentRuntime",
  "firstRunWithoutDeveloperTools",
  "gateway",
  "onboarding",
  "sessionCreate",
  "safeTool",
  "persistenceAfterRestart",
  "updateFromPrevious",
  "repair",
  "uninstallKeepData",
  "uninstallDeleteData",
  "rollback",
])

export function parseChecksumManifest(text) {
  const entries = new Map()
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue
    const match = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line)
    if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`)
    entries.set(match[2], match[1])
  }
  return entries
}

export function validateReleaseEvidence(evidence, checksumText, expected = {}) {
  if (!evidence || evidence.schemaVersion !== 1) throw new Error("release evidence must use schemaVersion 1")
  if (expected.tag && evidence.tag !== expected.tag) throw new Error(`evidence tag mismatch: ${evidence.tag}`)
  if (!/^[0-9a-f]{40}$/.test(evidence.commit ?? "")) throw new Error("evidence commit must be a full Git SHA")
  if (expected.commit && evidence.commit !== expected.commit) {
    throw new Error(`evidence commit mismatch: ${evidence.commit}`)
  }
  if (expected.sha256sumsSha256 && evidence.sha256sumsSha256 !== expected.sha256sumsSha256) {
    throw new Error("evidence SHA256SUMS digest does not match the promoted manifest")
  }
  const checksums = parseChecksumManifest(checksumText)

  for (const platform of RELEASE_PLATFORMS) {
    const record = evidence.platforms?.[platform]
    if (!record || record.decision !== "GO") throw new Error(`${platform}: decision is not GO`)
    if (!record.machine || !record.osVersion || !record.arch) throw new Error(`${platform}: machine evidence is incomplete`)
    if (!record.artifact || checksums.get(record.artifact) !== record.sha256) {
      throw new Error(`${platform}: artifact SHA-256 is absent from or disagrees with SHA256SUMS.txt`)
    }
    for (const gate of REQUIRED_RUNTIME_GATES) {
      if (record.gates?.[gate] !== true) throw new Error(`${platform}: missing runtime gate ${gate}`)
    }
    if (!Array.isArray(record.logs) || record.logs.length === 0) throw new Error(`${platform}: no logs recorded`)
    if (!Array.isArray(record.screenshots) || record.screenshots.length === 0) throw new Error(`${platform}: no screenshots recorded`)

    if (platform.startsWith("windows-") && record.signing?.authenticode !== "Valid") {
      throw new Error(`${platform}: Authenticode is not Valid`)
    }
    if (platform.startsWith("macos-") &&
        !(record.signing?.developerId === true && record.signing?.notarized === true && record.signing?.stapled === true)) {
      throw new Error(`${platform}: Developer ID/notarization/stapling evidence is incomplete`)
    }
  }
  return evidence
}

function main() {
  const [evidencePath, checksumPath, tag, commit, manifestSha] = process.argv.slice(2)
  if (!evidencePath || !checksumPath || !tag || !commit || !manifestSha) {
    throw new Error("usage: validate-release-evidence.mjs <evidence.json> <SHA256SUMS.txt> <tag> <commit> <manifest-sha256>")
  }
  const evidence = JSON.parse(fs.readFileSync(path.resolve(evidencePath), "utf8"))
  validateReleaseEvidence(evidence, fs.readFileSync(path.resolve(checksumPath), "utf8"), {
    tag,
    commit,
    sha256sumsSha256: manifestSha,
  })
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
