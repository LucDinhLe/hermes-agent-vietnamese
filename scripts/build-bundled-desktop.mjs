#!/usr/bin/env node
// build-bundled-desktop.mjs — build the fully bundled desktop installer
// locally, on any of the three platforms. This is the same sequence as
// .github/workflows/desktop-bundled-release.yml, in one runnable script:
//
//   1. preflight: uv, git, npm exist; a release tag is resolvable
//   2. npm ci at the repo root (skip with --no-install)
//   3. build ui-tui (with hermes-ink) and the dashboard SPA
//   4. download the payload node dist for this platform (22.x)
//   5. npm run build in apps/desktop with HERMES_DESKTOP_BUNDLED=1
//   6. npm run builder -- <platform targets>   (skip with --no-package)
//
// Usage:
//   node scripts/build-bundled-desktop.mjs --tag=v0.20.0
//   node scripts/build-bundled-desktop.mjs --tag=v0.20.0 --no-install --no-package
//
// Signing is CI's job (Azure/Apple secrets). Local builds are unsigned.

import { execSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { hostTarBin } from "../apps/desktop/scripts/stage-agent-payloads.mjs"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PAYLOAD_NODE_MAJOR = "22" // matches NODE_VERSION in scripts/install.sh

const args = process.argv.slice(2)
const tagArg = args.find((a) => a.startsWith("--tag="))?.slice("--tag=".length)
const skipInstall = args.includes("--no-install")
const skipPackage = args.includes("--no-package")
// Everything after `--` goes to electron-builder verbatim (CI appends its
// signing configuration this way).
const dashDash = process.argv.indexOf("--")
const extraBuilderArgs = dashDash === -1 ? [] : process.argv.slice(dashDash + 1)

function fail(message) {
  console.error(`[build-bundled] ${message}`)
  process.exit(1)
}

function run(cmd, argv, opts = {}) {
  console.log(`[build-bundled] $ ${cmd} ${argv.join(" ")}`)
  const result = spawnSync(cmd, argv, { stdio: "inherit", cwd: REPO_ROOT, shell: process.platform === "win32", ...opts })
  if (result.status !== 0) {
    fail(`${cmd} exited ${result.status}`)
  }
}

function capture(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8" }).trim()
}

// ── 1. preflight ────────────────────────────────────────────────────────────

for (const tool of ["uv", "git", "npm", "tar"]) {
  const probe = spawnSync(tool, ["--version"], { stdio: "ignore", shell: process.platform === "win32" })
  if (probe.status !== 0) {
    fail(`required tool missing: ${tool}`)
  }
}

let tag = tagArg
if (!tag) {
  try {
    tag = capture("git describe --tags --exact-match")
  } catch {
    fail("no --tag=vX.Y.Z given and HEAD is not at an exact release tag")
  }
}
if (!/^v(?:0|[1-9]\d{0,2})\.\d+\.\d+$/.test(tag)) {
  fail(`'${tag}' is not a final release tag (vX.Y.Z)`)
}

// The canonical Hermes version is owned by pyproject.toml (the same rule
// the Nix derivation applies). electron-builder gets it via extraMetadata,
// so app.getVersion(), the artifact names, and the latest*.yml feed all
// carry the real release version instead of the UI manifest's stale one.
// The tag must agree with it: a v0.21.0 payload inside an app that
// announces 0.20.0 would make electron-updater blind to the mismatch.
const pyprojectVersion = fs
  .readFileSync(path.join(REPO_ROOT, "pyproject.toml"), "utf8")
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1]
if (!pyprojectVersion) {
  fail("could not read version from pyproject.toml")
}
if (tag !== `v${pyprojectVersion}`) {
  fail(`tag ${tag} does not match pyproject.toml version ${pyprojectVersion}`)
}

const targets = { linux: "--linux AppImage", darwin: "--mac dmg zip", win32: "--win nsis" }[process.platform]
if (!targets) {
  fail(`unsupported platform: ${process.platform}`)
}

console.log(`[build-bundled] tag=${tag} platform=${process.platform}-${process.arch}`)

// ── 2-3. deps + JS surfaces ─────────────────────────────────────────────────

// ui-tui, ui-tui/packages/*, and web are npm workspaces of the repo root:
// ONE root `npm ci` installs all of them, hoisted into the root
// node_modules. Never run npm ci inside a workspace directory — that
// builds a partial shadow tree beside the hoisted one and breaks module
// resolution for the workspace builds below.
if (!skipInstall) {
  run("npm", ["ci", "--no-audit", "--no-fund"])
}
run("npm", ["run", "build", "--workspace", "ui-tui"])
run("npm", ["run", "build", "--workspace", "web"])

// ── 4. payload node dist ────────────────────────────────────────────────────

const distName = { linux: "linux", darwin: "darwin", win32: "win" }[process.platform]
const distArch = { x64: "x64", arm64: "arm64" }[process.arch]
const distExt = process.platform === "win32" ? "zip" : process.platform === "darwin" ? "tar.gz" : "tar.xz"

const index = JSON.parse(
  execSync(`curl -fsSL https://nodejs.org/dist/index.json`, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
)
const version = index.find((e) => e.version.startsWith(`v${PAYLOAD_NODE_MAJOR}.`))?.version
if (!version) {
  fail(`no node ${PAYLOAD_NODE_MAJOR}.x release found in nodejs.org index`)
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "hermes-node-payload-"))
const archive = `node-${version}-${distName}-${distArch}.${distExt}`
const extractDir = path.join(work, "extract")
const nodeDir = path.join(work, "node-payload")
fs.mkdirSync(extractDir, { recursive: true })

console.log(`[build-bundled] payload node: ${version}`)
run("curl", ["-fsSL", "-o", path.join(work, archive), `https://nodejs.org/dist/${version}/${archive}`])
run(hostTarBin(), ["-xf", path.join(work, archive), "-C", extractDir])
const [topDir] = fs.readdirSync(extractDir)
fs.renameSync(path.join(extractDir, topDir), nodeDir)

const nodeBinary = process.platform === "win32" ? path.join(nodeDir, "node.exe") : path.join(nodeDir, "bin", "node")
if (!fs.existsSync(nodeBinary)) {
  fail(`extracted node dist has no runnable node at ${nodeBinary}`)
}

// ── 5-6. bundled desktop build + package ────────────────────────────────────

const env = {
  ...process.env,
  HERMES_DESKTOP_BUNDLED: "1",
  HERMES_PAYLOAD_TAG: tag,
  HERMES_PAYLOAD_PYTHON: process.env.HERMES_PAYLOAD_PYTHON || "3.11",
  HERMES_PAYLOAD_NODE_DIST: nodeDir,
}

const desktop = path.join(REPO_ROOT, "apps", "desktop")
run("npm", ["run", "build"], { cwd: desktop, env })

if (skipPackage) {
  console.log("[build-bundled] --no-package: stopping after payload staging")
} else {
  run(
    "npm",
    [
      "run", "builder", "--",
      ...targets.split(" "),
      `-c.extraMetadata.version=${pyprojectVersion}`,
      ...extraBuilderArgs,
    ],
    { cwd: desktop, env }
  )
  console.log(`[build-bundled] artifacts: ${path.join(desktop, "release")}`)
}

fs.rmSync(work, { recursive: true, force: true })
