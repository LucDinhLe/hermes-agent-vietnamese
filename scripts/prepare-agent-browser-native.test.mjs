import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"

import {
  AGENT_BROWSER_PACKAGE,
  AGENT_BROWSER_SOURCE,
  agentBrowserBinaryName,
  hostTarBin,
  peMachine,
} from "./prepare-agent-browser-native.mjs"

test("maps every advertised platform to its exact helper binary", () => {
  assert.equal(agentBrowserBinaryName("win32", "arm64"), "agent-browser-win32-arm64.exe")
  assert.equal(agentBrowserBinaryName("win32", "x64"), "agent-browser-win32-x64.exe")
  assert.equal(agentBrowserBinaryName("darwin", "arm64"), "agent-browser-darwin-arm64")
  assert.equal(agentBrowserBinaryName("darwin", "x64"), "agent-browser-darwin-x64")
  assert.equal(agentBrowserBinaryName("linux", "arm64"), "agent-browser-linux-arm64")
  assert.equal(agentBrowserBinaryName("linux", "x64"), "agent-browser-linux-x64")
})

test("Windows ARM64 source is locked to a full commit and digest", () => {
  assert.match(AGENT_BROWSER_SOURCE.commit, /^[0-9a-f]{40}$/)
  assert.match(AGENT_BROWSER_SOURCE.sha256, /^[0-9a-f]{64}$/)
  assert.match(AGENT_BROWSER_SOURCE.url, new RegExp(AGENT_BROWSER_SOURCE.commit))
})

test("Windows archive extraction always uses the inbox tar executable", () => {
  assert.equal(hostTarBin("win32", "C:\\Windows"), "C:\\Windows\\System32\\tar.exe")
  assert.equal(hostTarBin("linux"), "tar")

  const source = fs.readFileSync(new URL("./prepare-agent-browser-native.mjs", import.meta.url), "utf8")
  assert.doesNotMatch(source, /run\(["']tar\.exe["']/)
})

test("resident runtime pins agent-browser outside the root workspace graph", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  const lock = JSON.parse(fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"))

  assert.equal(manifest.dependencies?.["agent-browser"], undefined)
  assert.equal(lock.packages?.["node_modules/agent-browser"], undefined)
  assert.equal(AGENT_BROWSER_PACKAGE.version, "0.26.0")
  assert.match(AGENT_BROWSER_PACKAGE.url, /agent-browser-0\.26\.0\.tgz$/)
  assert.match(AGENT_BROWSER_PACKAGE.integrity, /^sha512-[A-Za-z0-9+/]+=*$/)
})

test("reads the ARM64 machine field from a PE executable", () => {
  const fixture = Buffer.alloc(128)
  fixture.write("MZ", 0, "ascii")
  fixture.writeUInt32LE(64, 0x3c)
  fixture.write("PE\0\0", 64, "ascii")
  fixture.writeUInt16LE(0xaa64, 68)
  assert.equal(peMachine(fixture), 0xaa64)
  assert.throws(() => peMachine(Buffer.from("not PE")), /not a PE/)
})
