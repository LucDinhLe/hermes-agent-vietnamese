import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { sha256File } from "./vietnamese-release.mjs"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const AGENT_BROWSER_VERSION = "0.26.0"
export const AGENT_BROWSER_PACKAGE = Object.freeze({
  version: AGENT_BROWSER_VERSION,
  integrity: "sha512-pdqSfjwbFSp+qnwlb2g23e9wXveIOfMi19xpPA9xZUbzEAUp6W4YBZj6Ybj8z4M7WkcbGDDYc+oDIHDt9R3EDQ==",
  url: "https://registry.npmjs.org/agent-browser/-/agent-browser-0.26.0.tgz",
})
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

export function sha512IntegrityFile(filePath) {
  const digest = crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64")
  return `sha512-${digest}`
}

function hostTarBin() {
  return process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe")
    : "tar"
}

/**
 * Materialize the exact npm tarball into a release-only work directory.
 * agent-browser intentionally stays out of the root workspace dependency graph
 * (#43564); the resident desktop still embeds an offline-ready copy whose
 * tarball bytes are pinned here by SHA-512.
 */
export function prepareAgentBrowserPackage(outDir, platform = process.platform, arch = process.arch) {
  fs.rmSync(outDir, { recursive: true, force: true })
  const extractDir = path.join(outDir, "extract")
  const archive = path.join(outDir, `agent-browser-${AGENT_BROWSER_PACKAGE.version}.tgz`)
  fs.mkdirSync(extractDir, { recursive: true })

  const curl = process.platform === "win32" ? "curl.exe" : "curl"
  run(curl, ["-fsSL", "--retry", "5", "--retry-all-errors", "-o", archive, AGENT_BROWSER_PACKAGE.url])
  const actualIntegrity = sha512IntegrityFile(archive)
  if (actualIntegrity !== AGENT_BROWSER_PACKAGE.integrity) {
    throw new Error(
      `agent-browser npm integrity mismatch: expected ${AGENT_BROWSER_PACKAGE.integrity}, got ${actualIntegrity}`
    )
  }

  run(hostTarBin(), ["-xf", archive, "-C", extractDir])
  const packageRoot = path.join(extractDir, "package")
  prepareAgentBrowserNative(platform, arch, packageRoot)
  return packageRoot
}

export function prepareAgentBrowserNative(platform = process.platform, arch = process.arch, packageRoot) {
  if (!packageRoot) {
    throw new Error("agent-browser package root is required for resident release staging")
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
  if (packageJson.version !== AGENT_BROWSER_VERSION) {
    throw new Error(`agent-browser must be ${AGENT_BROWSER_VERSION}, got ${packageJson.version}`)
  }

  const binaryPath = path.join(packageRoot, "bin", agentBrowserBinaryName(platform, arch))
  if (fs.existsSync(binaryPath)) {
    if (platform !== "win32") fs.chmodSync(binaryPath, 0o755)
    return binaryPath
  }
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
