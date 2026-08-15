import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  parseVietnameseReleaseTag,
  payloadNodeDescriptor,
  sha256File,
} from "./vietnamese-release.mjs"

test("Vietnamese release tags map to deterministic Electron SemVer", () => {
  assert.deepEqual(parseVietnameseReleaseTag("vi-v0.20.0-15"), {
    tag: "vi-v0.20.0-15",
    baseVersion: "0.20.0",
    iteration: 15,
    appVersion: "0.20.0-vi.15",
  })
  assert.throws(() => parseVietnameseReleaseTag("v0.20.0"), /vi-vX.Y.Z-N/)
})

test("every advertised native target has one immutable Node archive", () => {
  for (const [platform, arch] of [
    ["win32", "x64"], ["win32", "arm64"],
    ["darwin", "x64"], ["darwin", "arm64"],
    ["linux", "x64"], ["linux", "arm64"],
  ]) {
    const descriptor = payloadNodeDescriptor(platform, arch)
    assert.equal(descriptor.version, "v26.5.1")
    assert.match(descriptor.sha256, /^[0-9a-f]{64}$/)
    assert.equal(descriptor.url, `https://nodejs.org/dist/v26.5.1/${descriptor.archive}`)
  }
})

test("sha256File hashes the exact bytes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-release-input-"))
  const file = path.join(dir, "input.bin")
  try {
    fs.writeFileSync(file, "Hermes\n")
    assert.equal(sha256File(file), "e8a6e32094432e8c602c3e0576d9dae9addc1c09df402dbe8a24ad00adcec5bf")
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
