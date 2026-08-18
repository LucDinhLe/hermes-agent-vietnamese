import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { sha256File } from "./vietnamese-release.mjs"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const AGENT_BROWSER_VERSION = "0.26.0"
export const AGENT_BROWSER_SOURCE = Object.freeze({
  commit: "717d1b09e1c841a4c0206033886a1a861e3ca5d9",
  sha256: "10328d943918aaf04d96668912bea1a13850b5ff69976aed0170c9d711d78326",
  url: "https://github.com/vercel-labs/agent-browser/archive/717d1b09e1c841a4c0206033886a1a861e3ca5d9.tar.gz",
})

export function agentBrowserBinaryName(platform, arch) {
  const key = `${platform}-${arch}`
  const name = {
    "darwin-arm64": "agent-browser-darwin-arm64",
    "darwin-x64": "agent-browser-darwin-x64",
    "linux-arm64": "agent-browser-linux-arm64",
    "linux-x64": "agent-browser-linux-x64",
    "win32-arm64": "agent-browser-win32-arm64.exe",
    "win32-x64": "agent-browser-win32-x64.exe",
  }[key]
  if (!name) {
    throw new Error(`unsupported agent-browser target: ${key}`)
  }
  return name
}

export function peMachine(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 64 || buffer.toString("ascii", 0, 2) !== "MZ") {
    throw new Error("agent-browser output is not a PE executable")
  }
  const peOffset = buffer.readUInt32LE(0x3c)
  if (peOffset + 6 > buffer.length || buffer.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error("agent-browser output has no PE signature")
  }
  return buffer.readUInt16LE(peOffset + 4)
}

function run(command, args, cwd = REPO_ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`)
}

export function prepareAgentBrowserNative(platform = process.platform, arch = process.arch) {
  const packageRoot = path.join(REPO_ROOT, "node_modules", "agent-browser")
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
  if (packageJson.version !== AGENT_BROWSER_VERSION) {
    throw new Error(`agent-browser must be ${AGENT_BROWSER_VERSION}, got ${packageJson.version}`)
  }

  const binaryPath = path.join(packageRoot, "bin", agentBrowserBinaryName(platform, arch))
  if (fs.existsSync(binaryPath)) return binaryPath
  if (platform !== "win32" || arch !== "arm64") {
    throw new Error(`agent-browser package is missing ${path.basename(binaryPath)}`)
  }

  // Upstream does not publish a win32-arm64 binary in 0.26.0. Build that one
  // native helper from the exact tagged source instead of silently running the
  // x64 helper under emulation. The archive digest and Cargo.lock make every
  // source input immutable; cargo --locked refuses dependency drift.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-agent-browser-arm64-"))
  try {
    const archive = path.join(work, "source.tar.gz")
    const sourceRoot = path.join(work, `agent-browser-${AGENT_BROWSER_SOURCE.commit}`)
    run("curl.exe", ["-fsSL", "-o", archive, AGENT_BROWSER_SOURCE.url])
    const actual = sha256File(archive)
    if (actual !== AGENT_BROWSER_SOURCE.sha256) {
      throw new Error(`agent-browser source SHA-256 mismatch: expected ${AGENT_BROWSER_SOURCE.sha256}, got ${actual}`)
    }
    run("tar.exe", ["-xf", archive, "-C", work])
    run("cargo.exe", [
      "build",
      "--locked",
      "--release",
      "--target",
      "aarch64-pc-windows-msvc",
      "--manifest-path",
      path.join(sourceRoot, "cli", "Cargo.toml"),
    ])
    const built = path.join(sourceRoot, "cli", "target", "aarch64-pc-windows-msvc", "release", "agent-browser.exe")
    if (peMachine(fs.readFileSync(built)) !== 0xaa64) {
      throw new Error("built agent-browser executable is not Windows ARM64")
    }
    fs.copyFileSync(built, binaryPath)
    return binaryPath
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
