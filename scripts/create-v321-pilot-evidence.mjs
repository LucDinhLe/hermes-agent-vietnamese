#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseChecksumManifest } from './validate-release-evidence.mjs'
import { validatePilotReleaseEvidence } from './validate-pilot-release-evidence.mjs'
import { REQUIRED_LIFECYCLE_GATES, validateLifecycleReceipt } from './windows-lifecycle-acceptance/policy.mjs'

const PRIMARY_ARTIFACTS = Object.freeze({
  'windows-x64': 'Hermes-Vietnamese-Windows-x64-Setup.exe',
  'windows-arm64': 'Hermes-Vietnamese-Windows-arm64-Setup.exe',
  'macos-arm64': 'Hermes-Vietnamese-macOS-Apple-Silicon.dmg',
  'macos-x64': 'Hermes-Vietnamese-macOS-Intel.dmg',
  'linux-x64': 'Hermes-Vietnamese-Linux-x64.AppImage',
  'linux-arm64': 'Hermes-Vietnamese-Linux-arm64.AppImage'
})

const BUILD_ONLY_TARGETS = Object.freeze(['windows-arm64', 'macos-arm64', 'macos-x64', 'linux-x64', 'linux-arm64'])

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function requireChecksum(checksums, artifact) {
  const digest = checksums.get(artifact)
  if (!digest) throw new Error(`missing primary artifact in SHA256SUMS.txt: ${artifact}`)
  return digest
}

export function createV321PilotEvidence({ checksumBytes, manifestSha, provenance, receipt }) {
  const computedManifestSha = sha256(checksumBytes)
  if (computedManifestSha !== manifestSha) throw new Error('manifest digest mismatch')
  if (provenance?.releaseClass !== 'community-prerelease') {
    throw new Error('v32.1 pilot evidence requires community-prerelease provenance')
  }

  const descriptor = {
    candidate: receipt?.artifacts?.candidate,
    harnessCommit: receipt?.harnessCommit,
    previous: receipt?.artifacts?.previous,
    releaseClass: provenance.releaseClass,
    rollback: receipt?.artifacts?.rollback,
    runId: receipt?.runId,
    schemaVersion: 1
  }
  validateLifecycleReceipt(receipt, descriptor)
  if (receipt.artifacts.candidate.tag !== provenance.tag) throw new Error('candidate tag mismatch')
  if (receipt.artifacts.candidate.commit !== provenance.commit) throw new Error('candidate commit mismatch')

  const checksums = parseChecksumManifest(checksumBytes.toString('utf8'))
  const windowsArtifact = PRIMARY_ARTIFACTS['windows-x64']
  const windowsSha = requireChecksum(checksums, windowsArtifact)
  if (receipt.artifacts.candidate.fileName !== windowsArtifact || receipt.artifacts.candidate.sha256 !== windowsSha) {
    throw new Error('sealed Windows lifecycle byte does not match the staged primary artifact')
  }

  const gates = Object.fromEntries(
    REQUIRED_LIFECYCLE_GATES.map(gate => {
      if (receipt.gates?.[gate]?.status !== 'passed') throw new Error(`lifecycle gate is not passed: ${gate}`)
      return [gate, true]
    })
  )
  const platforms = {
    'windows-x64': {
      artifact: windowsArtifact,
      decision: 'PILOT-GO',
      gates,
      limitations: ['unsigned community candidate', 'mock provider on a disposable GitHub-hosted Windows x64 VM'],
      sha256: windowsSha
    }
  }

  for (const target of BUILD_ONLY_TARGETS) {
    const artifact = PRIMARY_ARTIFACTS[target]
    platforms[target] = {
      artifact,
      decision: 'BUILD-ONLY-PILOT',
      realMachineSmoke: false,
      sha256: requireChecksum(checksums, artifact)
    }
  }

  const evidence = {
    commit: provenance.commit,
    lifecycle: {
      harnessCommit: receipt.harnessCommit,
      receiptRunId: receipt.runId
    },
    platforms,
    policy: 'community-pilot',
    releaseClass: provenance.releaseClass,
    sha256sumsSha256: manifestSha,
    tag: provenance.tag
  }
  validatePilotReleaseEvidence(evidence, provenance, checksumBytes, {
    commit: provenance.commit,
    manifestSha,
    stagingRunId: provenance.runId,
    tag: provenance.tag
  })
  return evidence
}

function main() {
  const [receiptPath, provenancePath, checksumPath, manifestSha, outputPath] = process.argv.slice(2)
  if (!receiptPath || !provenancePath || !checksumPath || !manifestSha || !outputPath) {
    throw new Error(
      'usage: create-v321-pilot-evidence.mjs <lifecycle-result.json> <candidate-provenance.json> <SHA256SUMS.txt> <manifest-sha256> <output.json>'
    )
  }
  const evidence = createV321PilotEvidence({
    checksumBytes: fs.readFileSync(path.resolve(checksumPath)),
    manifestSha,
    provenance: JSON.parse(fs.readFileSync(path.resolve(provenancePath), 'utf8')),
    receipt: JSON.parse(fs.readFileSync(path.resolve(receiptPath), 'utf8'))
  })
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(evidence, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
