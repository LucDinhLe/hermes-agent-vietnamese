/**
 * stage-agent-payloads.mjs: assemble the resources-resident agent runtime
 * that ships inside the bundled desktop artifact. Design:
 * .hermes/plans/2026-08-07_resources-resident-bundled-runtime.md.
 *
 * Output: apps/desktop/build/agent-payload/
 *   manifest.json          schemaVersion, tag, commit, platform, arch, per-item status
 *   repo/                  plain source tree at the release tag (no .git),
 *                          plus the PREBUILT JS surfaces (ui-tui dist +
 *                          node_modules, web_dist) and the build stamp
 *   uv/                    static uv binary for this platform/arch
 *   python/                uv-managed CPython (python-build-standalone).
 *                          Its own site-packages carries hermes-bundle.pth
 *                          with RELATIVE paths to repo/ and site-packages/,
 *                          so the interpreter resolves the runtime wherever
 *                          the app bundle sits — no venv, no PYTHONPATH.
 *   site-packages/         the full dependency tree from uv.lock, installed
 *                          at build time with `pip install --target` on the
 *                          payload interpreter. The backend runs directly
 *                          from here; nothing materializes at first launch.
 *   node/                  official node dist for this platform/arch
 *
 * Gating: the script does nothing unless HERMES_DESKTOP_BUNDLED=1. That
 * variable is an internal build-time env for CI wiring, not user config.
 * Thus dev builds and current CI keep producing thin builds. You can skip
 * individual items with --skip=<item,item> for incremental CI caching.
 * The manifest.json records every skip. The desktop only runs resident when
 * every runtime item is staged; a partial payload falls back to the network
 * bootstrap path.
 *
 * The heavy work shells out to git, uv, and tar. The decision logic
 * (target resolution, pip arg construction, manifest shape) is exported as
 * pure functions. Thus vitest covers it without network or toolchains.
 */

import { execSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { isMain } from "./utils.mjs"
import { AGENT_BROWSER_VERSION } from "../../../scripts/prepare-agent-browser-native.mjs"
import { parseVietnameseReleaseTag } from "../../../scripts/vietnamese-release.mjs"

export { parseVietnameseReleaseTag } from "../../../scripts/vietnamese-release.mjs"

export const PAYLOAD_SCHEMA_VERSION = 2

const DESKTOP_ROOT = path.resolve(import.meta.dirname, "..")
const REPO_ROOT = path.resolve(DESKTOP_ROOT, "..", "..")
const OUT_DIR = path.join(DESKTOP_ROOT, "build", "agent-payload")

export const PAYLOAD_ITEMS = ["repo", "uv", "python", "site-packages", "node"]

/**
 * Map (process.platform, process.arch) to the uv, python-build-standalone,
 * and node target descriptors. There is one artifact per (os, arch) pair.
 * Mac universal2 is deliberately NOT a target. We ship two artifacts
 * (plan §6).
 *
 * There are no cross-platform wheel tags here, on purpose. A CI runner per
 * (os, arch) pair assembles the payloads. electron-builder needs per-OS
 * runners for signing anyway. Thus the script fetches wheels NATIVELY with
 * `uvx pip wheel --only-binary=:all:`. The platform of the runner is the
 * target platform.
 */
export function resolveTargets(platform = process.platform, arch = process.arch) {
  const table = {
    "linux-x64": {
      uvTarget: "x86_64-unknown-linux-gnu",
      pythonPlatform: "x86_64-unknown-linux-gnu",
      nodeDist: "linux-x64",
      uvPython: "linux-x86_64-gnu",
    },
    "linux-arm64": {
      uvTarget: "aarch64-unknown-linux-gnu",
      pythonPlatform: "aarch64-unknown-linux-gnu",
      nodeDist: "linux-arm64",
      uvPython: "linux-aarch64-gnu",
    },
    "darwin-x64": {
      uvTarget: "x86_64-apple-darwin",
      pythonPlatform: "x86_64-apple-darwin",
      nodeDist: "darwin-x64",
      uvPython: "macos-x86_64-none",
      // cryptography 50.0.0 removed macOS x86_64 wheels. Build the exact
      // hash-locked sdist on the Intel runner against the workflow's pinned,
      // statically linked OpenSSL instead of weakening the security floor.
      sourceBuild: ["cryptography"],
    },
    "darwin-arm64": {
      uvTarget: "aarch64-apple-darwin",
      pythonPlatform: "aarch64-apple-darwin",
      nodeDist: "darwin-arm64",
      uvPython: "macos-aarch64-none",
    },
    "win32-x64": {
      uvTarget: "x86_64-pc-windows-msvc",
      pythonPlatform: "x86_64-pc-windows-msvc",
      nodeDist: "win-x64",
      uvPython: "windows-x86_64-none",
    },
    "win32-arm64": {
      uvTarget: "aarch64-pc-windows-msvc",
      pythonPlatform: "aarch64-pc-windows-msvc",
      nodeDist: "win-arm64",
      uvPython: "windows-aarch64-none",
      // Pinned packages with no published win_arm64 wheel. pip builds
      // these from sdist on the runner (needs MSVC arm64 + Rust).
      // pyyaml publishes win_arm64 wheels for cp312+ only — the payload
      // python is 3.11, so it builds here too (pure fallback when the
      // libyaml accelerator is unavailable).
      sourceBuild: ["cryptography", "httptools", "ruamel-yaml-clib", "pyyaml"],
    },
  }
  const key = `${platform}-${arch}`
  const target = table[key]
  if (!target) {
    throw new Error(`unsupported payload target: ${key}`)
  }
  return { key, platform, arch, ...target }
}

/**
 * Build the `pip install --target` argument list that fills the payload's
 * site-packages. The caller invokes the digest-pinned build uv against the
 * staged payload interpreter, natively on the target runner, so wheels resolve
 * for the target platform/arch. With --only-binary=:all: it never
 * compiles on the user machine — there IS no install step on the user
 * machine; the backend imports straight from this directory.
 *
 * Exception: the target's sourceBuild list. Some pinned packages publish
 * no wheel for a target (darwin-x64: cryptography 50.0.0 dropped Intel
 * wheels; win32-arm64: cryptography dropped win_arm64 after 46.0.3;
 * httptools and ruamel-yaml-clib never shipped one).
 * pywinpty is intentionally absent because pinned 3.0.5 publishes native
 * wheels for both Windows architectures. For the named packages pip builds the
 * EXACT pinned version from its sdist ON the build runner, which yields
 * real target-arch code in site-packages — the user machine still
 * never compiles. The build runner needs the toolchains (MSVC arm64 +
 * Rust on windows-11-arm). A later --no-binary overrides --only-binary
 * per package; the list stays empty for every target whose pins are
 * fully covered by published wheels.
 */
export function pipTargetArgs({ sitePackagesDir, sourceBuild = [] }) {
  return [
    "install",
    "--require-hashes",
    "--only-binary", ":all:",
    ...(sourceBuild.length > 0 ? ["--no-binary", sourceBuild.join(",")] : []),
    "-r", "requirements-payload.txt",
    "--target", sitePackagesDir,
    // pip warns without this when --target sees an existing dir; staging
    // wipes first, so upgrade semantics never actually apply.
    "--upgrade",
    // No console-script shims: the bundle always launches `python -m`,
    // and --target's scripts would carry the BUILD host's shebang paths.
    "--no-compile",
  ]
}

export function payloadImportProbe(target) {
  const modules = ["pydantic_core", "cryptography", "charset_normalizer"]
  if (target.platform === "win32") modules.push("winpty")
  return `import ${modules.join(", ")}`
}

/**
 * The full uv python-install request for a target: version AND platform.
 * A bare version request ("3.11") lets uv fall back to another
 * architecture when the native build is unavailable — the arm64 Windows
 * test box got a silent x86_64 CPython that way. The full request either
 * installs the right build or fails loudly.
 */
export function pythonRequest(target, version = process.env.HERMES_PAYLOAD_PYTHON || "3.11") {
  return `cpython-${version}-${target.uvPython}`
}

/**
 * Assert that a staged tool's own version banner names the target triple.
 * `uv --version` and `python -VV` both print their build triple/platform.
 * A mismatch means the payload carries the WRONG architecture (for
 * example, an x64 uv copied from PATH into an arm64 artifact — it runs
 * on the build host through emulation and ships broken). The manifest
 * would then lie about the payload's contents. Fail the build instead.
 */
export function assertBanner(item, banner, mustContain) {
  if (!banner.includes(mustContain)) {
    throw new Error(
      `${item}: staged binary reports "${banner.trim()}" which does not ` +
        `contain the build target "${mustContain}" — wrong-architecture ` +
        `payload. Provide a matching binary (HERMES_PAYLOAD_UV for uv) or ` +
        `build on a native runner.`
    )
  }
}

/**
 * The substring that each staged tool's banner must contain for a target.
 * uv prints a full triple (x86_64-pc-windows-msvc). CPython's `python -VV`
 * prints a compiler/platform line that differs per OS, so the check keys
 * on the architecture words for it. Node prints nothing useful in
 * --version, so its check uses `node -p process.arch` = target arch.
 */
export function bannerExpectations(target) {
  const archWords = {
    x64: ["x86_64", "AMD64", "x64"],
    arm64: ["aarch64", "ARM64", "arm64"],
  }[target.arch]

  return {
    uv: target.uvTarget,
    pythonAny: archWords,
    node: target.arch,
  }
}

/**
 * Resolve the release tag to stage. CI passes --tag=vi-vX.Y.Z-N. Local runs can
 * fall back to `git describe` for smoke tests. When bundling was requested
 * and no tag exists, payload staging is a hard error. A bundled artifact
 * without a pinned tag produces un-adoptable, un-updatable installs.
 */
export function resolveTag(argv, describeFn) {
  const explicit = argv.find((a) => a.startsWith("--tag="))
  if (explicit) {
    const tag = explicit.slice("--tag=".length).trim()
    return parseVietnameseReleaseTag(tag).tag
  }
  const described = describeFn()
  if (described) {
    try {
      return parseVietnameseReleaseTag(described).tag
    } catch {
      // Fall through to the release-specific error below.
    }
  }
  throw new Error(
    "no Vietnamese release tag: pass --tag=vi-vX.Y.Z-N (CI) or run from an exact release tag"
  )
}

export function parseSkips(argv) {
  const flag = argv.find((a) => a.startsWith("--skip="))
  if (!flag) return new Set()
  const skips = new Set(
    flag
      .slice("--skip=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
  for (const s of skips) {
    if (!PAYLOAD_ITEMS.includes(s)) {
      throw new Error(`unknown --skip item: ${s} (valid: ${PAYLOAD_ITEMS.join(", ")})`)
    }
  }
  return skips
}

/**
 * Build the manifest that describes the contents of the payload tree.
 * `items` records per-item presence. Thus the resident-runtime gate in
 * the Electron main process can require exactly the items it needs and
 * refuse to run resident from an incomplete artifact.
 */
export function buildManifest({ tag, commit, target, staged, skipped }) {
  const items = {}
  for (const item of PAYLOAD_ITEMS) {
    items[item] = staged.includes(item)
      ? { status: "staged" }
      : { status: "skipped", reason: skipped.has(item) ? "explicit-skip" : "failed" }
  }
  return {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    tag,
    commit,
    platform: target.platform,
    arch: target.arch,
    builtAt: new Date().toISOString(),
    items,
  }
}

/**
 * Write deterministic agent-browser launchers beside the bundled npm package.
 * npm's `.bin/agent-browser` is a regular shim on Windows but can be a Unix
 * symlink that Node 26 classifies as a directory when cpSync dereferences it.
 * Generate launchers from the package's public bin contract instead of copying
 * package-manager implementation details into the release artifact.
 */
export function stageAgentBrowserLaunchers(browserPackage, stagedBinDir) {
  const entryPoint = path.join(browserPackage, "bin", "agent-browser.js")
  if (!fs.statSync(entryPoint, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("repo: agent-browser package is missing bin/agent-browser.js")
  }

  fs.mkdirSync(stagedBinDir, { recursive: true })
  const shellPath = path.join(stagedBinDir, "agent-browser")
  fs.writeFileSync(
    shellPath,
    `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")
if [ -x "$basedir/node" ]; then
  exec "$basedir/node" "$basedir/../agent-browser/bin/agent-browser.js" "$@"
else
  exec node "$basedir/../agent-browser/bin/agent-browser.js" "$@"
fi
`
  )
  fs.chmodSync(shellPath, 0o755)

  fs.writeFileSync(
    path.join(stagedBinDir, "agent-browser.cmd"),
    `@ECHO off\r
SETLOCAL\r
SET "basedir=%~dp0"\r
IF EXIST "%basedir%node.exe" (SET "_prog=%basedir%node.exe") ELSE (SET "_prog=node")\r
"%_prog%" "%basedir%..\\agent-browser\\bin\\agent-browser.js" %*\r
`
  )
  fs.writeFileSync(
    path.join(stagedBinDir, "agent-browser.ps1"),
    `#!/usr/bin/env pwsh\r
$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent\r
$exe="node"; if (Test-Path "$basedir/node.exe") { $exe="$basedir/node.exe" }\r
& $exe "$basedir/../agent-browser/bin/agent-browser.js" $args\r
exit $LASTEXITCODE\r
`
  )
}

export function resolveAgentBrowserPackageRoot(env = process.env) {
  const browserPackageInput = env.HERMES_AGENT_BROWSER_PACKAGE_ROOT?.trim()
  if (!browserPackageInput) {
    throw new Error("repo: HERMES_AGENT_BROWSER_PACKAGE_ROOT is required for bundled staging")
  }
  const browserPackage = path.resolve(browserPackageInput)
  const browserManifestPath = path.join(browserPackage, "package.json")
  if (!fs.statSync(browserManifestPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error("repo: verified agent-browser package is missing package.json")
  }
  const browserManifest = JSON.parse(fs.readFileSync(browserManifestPath, "utf8"))
  if (browserManifest.name !== "agent-browser" || browserManifest.version !== AGENT_BROWSER_VERSION) {
    throw new Error(
      `repo: expected agent-browser ${AGENT_BROWSER_VERSION}, got ${browserManifest.name || "unknown"} ${browserManifest.version || "unknown"}`
    )
  }
  return browserPackage
}

// ─── impure staging steps (they shell out, have no unit tests, and run in CI) ──────

function run(cmd, args, opts = {}) {
  // stdio: inherit — subprocess output (pip's resolution errors, uv's
  // install messages) streams to the build log in real time. The throw
  // below only names the command; the CAUSE is in the streamed output
  // directly above it.
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (result.error) {
    throw new Error(`${cmd} did not start: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status} — its error output is printed above`)
  }
}

/**
 * Capture a probe command's stdout for inspection (banner checks). On
 * failure the captured stderr goes into the thrown error, so probe
 * failures are never silent.
 */
function probe(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts })
  if (result.error) {
    throw new Error(`${cmd} did not start: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}: ${(result.stderr || "").trim()}`)
  }
  return result.stdout
}

export function repositoryGitQueries(tag) {
  return {
    commit: ["rev-parse", `${tag}^{commit}`],
    commitDate: ["log", "-1", "--format=%ct", tag],
  }
}

function stageRepo(tag, outDir) {
  const repoDir = path.join(outDir, "repo")
  fs.rmSync(repoDir, { recursive: true, force: true })
  fs.mkdirSync(repoDir, { recursive: true })
  const queries = repositoryGitQueries(tag)
  // Pass the peel expression as an argv item. A shell string loses the caret
  // on Windows (`tag^{commit}` becomes `tag{commit}` under cmd.exe).
  const commit = probe("git", queries.commit, { cwd: REPO_ROOT }).trim()
  const commitDate = probe("git", queries.commitDate, { cwd: REPO_ROOT }).trim()
  // The payload repo is a PLAIN SOURCE TREE, deliberately without .git.
  // Bundled installs never run git against the checkout: updates replace
  // the whole tree (electron-updater), and `hermes update --eject` makes
  // its own fresh clone. A shipped .git also broke in transit: `git gc`
  // packs all refs, which leaves .git/refs/ empty, and electron-builder's
  // resource copy drops empty directories — git then refuses to recognize
  // the repository at all. git archive gives a clean tree of exactly the
  // tag's tracked files.
  const archive = path.join(outDir, ".repo-archive.tar")
  run("git", ["archive", "--format=tar", "-o", archive, tag], { cwd: REPO_ROOT })
  run(hostTarBin(), ["-xf", archive, "-C", repoDir])
  fs.rmSync(archive, { force: true })
  // The PREBUILT JS surfaces live inside the repo tree, exactly where a
  // source checkout builds them. CI builds ui-tui (with hermes-ink) and
  // the dashboard SPA BEFORE this script runs; here they are copied in
  // as plain directories. The SPA's real outDir is hermes_cli/web_dist
  // (web/vite.config.ts) — the old js-prebuilt list named a root-level
  // web_dist that never existed, and its existsSync filter silently
  // dropped it from every artifact. dereference: ui-tui/node_modules
  // carries the hermes-ink workspace symlink, and symlinks do not
  // reliably survive the electron-builder resource copy.
  const jsSurfaces = ["ui-tui/dist", "ui-tui/node_modules", "hermes_cli/web_dist"].filter((p) =>
    fs.existsSync(path.join(REPO_ROOT, p))
  )
  if (jsSurfaces.length < 3) {
    throw new Error(`repo: prebuilt JS surfaces missing — run the ui-tui/web builds first (found: ${jsSurfaces.join(", ") || "none"})`)
  }
  for (const surface of jsSurfaces) {
    fs.cpSync(path.join(REPO_ROOT, surface), path.join(repoDir, surface), {
      recursive: true,
      dereference: true,
    })
  }
  // agent-browser intentionally stays out of root dependencies (#43564), so
  // the release builder materializes its exact SHA-512-pinned npm tarball in a
  // private work directory. Copy that verified package into the source
  // snapshot: the resident runtime remains offline-ready without re-entangling
  // agent-browser with the ui-tui/web workspace install graph.
  const browserPackage = resolveAgentBrowserPackageRoot()
  fs.cpSync(browserPackage, path.join(repoDir, "node_modules", "agent-browser"), {
    recursive: true,
    dereference: true,
  })
  const stagedBinDir = path.join(repoDir, "node_modules", ".bin")
  stageAgentBrowserLaunchers(browserPackage, stagedBinDir)
  // Version provenance without git: the schema-v2 build stamp. The
  // version_info ladder prefers this stamp over git probing, so bundled
  // installs report exact-release provenance (distance 0, the tag's
  // commit) with no .git present.
  const buildPython = process.env.HERMES_PAYLOAD_BUILD_PYTHON || (process.platform === "win32" ? "python" : "python3")
  run(buildPython, [
    path.join(repoDir, "scripts", "write_install_stamp.py"),
    "--output", path.join(repoDir, ".hermes_build_info.json"),
    "--commit", commit,
    "--commit-date", commitDate,
    "--base-version", parseVietnameseReleaseTag(tag).baseVersion,
    "--distance", "0",
    "--source", "ci",
  ])
  // The install manifest is BUILD metadata for a resident bundle: the
  // payload repo is always desktop-managed, always the stable channel,
  // always pinned to this tag. Shipping it statically means the Python
  // side (update refusal, eject, channel vocabulary) reads the same file
  // in a resident bundle as in a materialized checkout.
  fs.writeFileSync(
    path.join(repoDir, ".hermes-install.json"),
    JSON.stringify(
      { schemaVersion: 1, installMode: "bundled", channel: "stable", manageStyle: "adopted", pinnedTag: tag },
      null,
      2
    ) + "\n"
  )
  return commit
}

// Windows: name System32's bsdtar by full path. A GNU tar earlier on
// PATH (Git bash on the GitHub runners) reads "C:" in a path as a
// remote host name. bsdtar also reads .zip, so one extraction call
// covers every archive format the payload pipeline downloads.
export function hostTarBin() {
  return process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe")
    : "tar"
}

function stageUvAndPython(target, outDir) {
  const uvDir = path.join(outDir, "uv")
  const pythonDir = path.join(outDir, "python")
  // Wipe before staging (stageRepo does the same). A rerun after a failed
  // or wrong-arch attempt must not leave a stale interpreter beside the
  // new one — the banner probe would find the old build first.
  fs.rmSync(uvDir, { recursive: true, force: true })
  fs.rmSync(pythonDir, { recursive: true, force: true })
  fs.mkdirSync(uvDir, { recursive: true })
  fs.mkdirSync(pythonDir, { recursive: true })
  // Native runner: the uv that runs this build IS the target-platform uv.
  // HERMES_PAYLOAD_UV overrides this for unusual setups. The default is
  // `uv` on PATH.
  const uvName = target.platform === "win32" ? "uv.exe" : "uv"
  const uvSource =
    process.env.HERMES_PAYLOAD_UV ||
    execSync(
      target.platform === "win32" ? "where uv" : "command -v uv",
      { encoding: "utf8" }
    ).split(/\r?\n/)[0].trim()
  const uvStaged = path.join(uvDir, uvName)
  fs.copyFileSync(uvSource, uvStaged)

  const expect = bannerExpectations(target)

  // The staged uv must be built FOR the target triple, not merely run on
  // this host (emulation makes a wrong-arch binary run fine here).
  // uv prints its build triple in --version from 0.12 on; an older uv
  // prints only the version number, which is unverifiable — refuse it
  // with a message that says so instead of claiming a wrong arch.
  const uvBanner = probe(uvStaged, ["--version"])
  if (/^uv \d[\d.]*\s*$/.test(uvBanner.trim())) {
    throw new Error(
      `uv: "${uvBanner.trim()}" prints no build triple, so its architecture ` +
        `cannot be verified. Use uv 0.12 or newer.`
    )
  }
  assertBanner("uv", uvBanner, expect.uv)

  // --no-bin: staging must not write launcher shims into the build
  // host's ~/.local/bin (it collided with a preexisting python3.11.exe
  // on the Windows test box).
  run("uv", ["python", "install", "--no-bin", "--install-dir", pythonDir, pythonRequest(target)])

  // The installed CPython proves its architecture at runtime.
  // `python -VV` names the arch on Windows ("[MSC v.1944 64 bit (ARM64)]")
  // but not on Linux/macOS ("[Clang 22.1.3 ]"), so the check asks
  // platform.machine() — the value the binary itself reports. The
  // install-directory pattern above already pins the requested build;
  // this is the runtime backstop.
  const pythonBinary = findPythonBinary(pythonDir, target)
  const pythonMachine = probe(pythonBinary, ["-c", "import platform; print(platform.machine())"])
  if (!expect.pythonAny.some((word) => pythonMachine.includes(word))) {
    assertBanner("python", pythonMachine, expect.pythonAny.join("|"))
  }
  return pythonBinary
}

/**
 * Match the directory `uv python install` creates for a request. The
 * request names a minor version (cpython-3.11-windows-aarch64-none), and
 * uv installs into a PATCH-versioned directory
 * (cpython-3.11.15-windows-aarch64-none) plus a minor-version alias that
 * is a junction on Windows. The matcher accepts both shapes and nothing
 * of any other version or triple.
 */
export function pythonDirPattern(target, version = process.env.HERMES_PAYLOAD_PYTHON || "3.11") {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^cpython-${escape(version)}(\\.\\d+)?(rc\\d+)?-${escape(target.uvPython)}$`)
}

function findPythonBinary(pythonDir, target) {
  // Search only directories that match the REQUESTED build, so a stray
  // install of another architecture can never satisfy the probe. The
  // wipe above prevents strays; this is the backstop. The alias
  // entry is a junction/symlink — do not require isDirectory().
  const name = target.platform === "win32" ? "python.exe" : "python3"
  const pattern = pythonDirPattern(target)
  const roots = fs
    .readdirSync(pythonDir, { withFileTypes: true })
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && pattern.test(e.name))
    .map((e) => path.join(pythonDir, e.name))
  if (roots.length === 0) {
    throw new Error(`python: nothing matching ${pattern} under ${pythonDir} after uv python install`)
  }
  const stack = [...roots]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        stack.push(full)
      } else if (entry.name === name) {
        return full
      }
    }
  }
  throw new Error(`python: no ${name} found under ${roots.join(", ")}`)
}

function stageSitePackages(target, outDir, pythonBinary) {
  const sitePackagesDir = path.join(outDir, "site-packages")
  fs.rmSync(sitePackagesDir, { recursive: true, force: true })
  fs.mkdirSync(sitePackagesDir, { recursive: true })
  // Export the lock to a requirements file, then install the whole tree
  // with uv targeting THE STAGED PAYLOAD INTERPRETER: wheel resolution
  // platform tags for the interpreter that executes it, so this is what
  // pins site-packages to the target architecture. Do not use `uvx pip`:
  // that floats an extra tool package and once ran under uvx's own Python,
  // pulling win_amd64 wheels on an arm64 box. No venv anywhere: a venv's
  // bin/python is a symlink to an
  // ABSOLUTE build-host path, and the .app runs from unpredictable
  // locations (renames, Gatekeeper translocation, AppImage mounts).
  if (!pythonBinary) {
    throw new Error("site-packages: the uv/python stage must run first (it provides the payload interpreter)")
  }
  run("uv", ["export", "--frozen", "--no-emit-project", "-o", "requirements-payload.txt"], { cwd: REPO_ROOT })
  const pipArgs = pipTargetArgs({ sitePackagesDir, sourceBuild: target.sourceBuild || [] })
  run("uv", ["pip", pipArgs[0], "--python", pythonBinary, ...pipArgs.slice(1)], { cwd: REPO_ROOT })

  // hermes-agent's own code imports from repo/ (the .pth puts it first on
  // sys.path — PROJECT_ROOT derivations need the real tree around the
  // packages). But importlib.metadata.version("hermes-agent") needs a
  // dist-info. pip cannot produce one here: setup.py deliberately blocks
  // wheel builds outside Nix (and pip install --target builds a wheel
  // internally). importlib.metadata only reads METADATA, so write the
  // minimal dist-info directly — same trick as flat layouts everywhere.
  const version = probe(pythonBinary, [
    "-c",
    `import pathlib, re; print(re.search(r'__version__ = \"([^\"]+)\"', pathlib.Path(${JSON.stringify(
      path.join(outDir, "repo", "hermes_cli", "__init__.py")
    )}).read_text(encoding="utf-8")).group(1))`,
  ]).trim()
  const distInfo = path.join(sitePackagesDir, `hermes_agent-${version}.dist-info`)
  fs.mkdirSync(distInfo, { recursive: true })
  fs.writeFileSync(
    path.join(distInfo, "METADATA"),
    `Metadata-Version: 2.1\nName: hermes-agent\nVersion: ${version}\n`
  )
  fs.writeFileSync(path.join(distInfo, "INSTALLER"), "hermes-desktop-bundle\n")

  // Architecture backstop: import the heaviest native extensions with
  // site-packages on the path. On the native CI runner a wrong-arch
  // tree fails here instead of on the user machine. (The old wheelhouse
  // filename check has no equivalent — pip already unpacked the wheels —
  // and actually importing is the stronger proof.)
  probe(pythonBinary, [
    "-c",
    `import sys; sys.path.insert(0, ${JSON.stringify(sitePackagesDir)}); ${payloadImportProbe(target)}`,
  ])
}

/**
 * The relative sys.path entries for the bundle glue. A .pth file's
 * non-import lines are resolved against the DIRECTORY CONTAINING THE
 * .PTH FILE, so relative entries make the payload fully relocatable:
 * no absolute paths exist anywhere in the artifact. repo/ comes first
 * so its packages win over anything in site-packages.
 */
export function bundlePthLines(purelibDir, payloadRoot, pathModule = path) {
  return ["repo", "site-packages"].map((entry) =>
    pathModule.relative(purelibDir, pathModule.join(payloadRoot, entry))
  )
}

function writeBundlePth(outDir, pythonBinary) {
  // Ask the interpreter where its own site-packages lives instead of
  // hardcoding the layout (POSIX: lib/python3.11/site-packages,
  // Windows: Lib/site-packages).
  const purelib = probe(pythonBinary, ["-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"]).trim()
  if (!purelib || !fs.existsSync(purelib)) {
    throw new Error(`bundle pth: interpreter reports nonexistent purelib: ${purelib}`)
  }
  fs.writeFileSync(
    path.join(purelib, "hermes-bundle.pth"),
    bundlePthLines(purelib, outDir).join("\n") + "\n"
  )
}

function stageNode(target, outDir) {
  const nodeDir = path.join(outDir, "node")
  // Idempotent: a leftover tree from an interrupted run makes cpSync
  // throw EEXIST on directory merges; start clean every time.
  fs.rmSync(nodeDir, { recursive: true, force: true })
  fs.mkdirSync(nodeDir, { recursive: true })
  const src = process.env.HERMES_PAYLOAD_NODE_DIST
  if (!src) {
    throw new Error("HERMES_PAYLOAD_NODE_DIST must point at the extracted node dist for the target")
  }
  fs.cpSync(src, nodeDir, { recursive: true })

  // The dist must be FOR the target. Running the staged node is not a
  // valid probe here: a wrong-arch binary can still run through the
  // build host's emulation. `node -p process.arch` names the arch the
  // binary was BUILT for, so execute it only to read that value; when
  // the binary cannot run at all, that is the same wrong-arch verdict.
  const nodeBinary = target.platform === "win32" ? path.join(nodeDir, "node.exe") : path.join(nodeDir, "bin", "node")
  let reportedArch = null
  try {
    reportedArch = probe(nodeBinary, ["-p", "process.arch"]).trim()
  } catch {
    // Unrunnable on this host — for example an arm64 dist on an x64
    // builder with no emulation. That is not proof of a wrong payload,
    // but it IS unverifiable; refuse rather than ship unchecked.
    throw new Error(`node: staged binary at ${nodeBinary} did not run, so its architecture is unverified`)
  }
  assertBanner("node", reportedArch, bannerExpectations(target).node)
}

function main() {
  if (process.env.HERMES_DESKTOP_BUNDLED !== "1") {
    // Thin build: write a stub manifest anyway. Then the extraResources
    // entry always has a real directory to copy. The behavior of
    // electron-builder for a missing `from` changes between versions. The
    // stub also lets runtime code read manifest.json uniformly and learn
    // that there are no payloads.
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(OUT_DIR, "manifest.json"),
      JSON.stringify({ schemaVersion: PAYLOAD_SCHEMA_VERSION, thin: true, items: {} }, null, 2) + "\n"
    )
    console.log("[stage-agent-payloads] HERMES_DESKTOP_BUNDLED != 1 — wrote thin stub manifest")
    return
  }
  const target = resolveTargets()
  const skips = parseSkips(process.argv.slice(2))
  const tag = resolveTag(process.argv.slice(2), () => {
    try {
      return execSync("git describe --tags --exact-match", { cwd: REPO_ROOT, encoding: "utf8" }).trim()
    } catch {
      return null
    }
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const staged = []
  let commit = null
  let payloadPython = null

  const steps = {
    repo: () => {
      commit = stageRepo(tag, OUT_DIR)
    },
    uv: () => {
      payloadPython = stageUvAndPython(target, OUT_DIR)
    },
    python: () => {
      // The uv step stages python too (one uv invocation). Guard the
      // manifest: a --skip=uv run must not record python as staged.
      if (!payloadPython) {
        throw new Error("python: the uv step was skipped, so no interpreter was staged — skip python too")
      }
    },
    "site-packages": () => {
      stageSitePackages(target, OUT_DIR, payloadPython)
      // The glue that makes the payload interpreter resolve repo/ and
      // site-packages/ wherever the bundle sits. Written after both
      // stages exist so a failed staging run never leaves a .pth that
      // points at nothing.
      writeBundlePth(OUT_DIR, payloadPython)
    },
    node: () => stageNode(target, OUT_DIR),
  }

  for (const item of PAYLOAD_ITEMS) {
    if (skips.has(item)) {
      console.log(`[stage-agent-payloads] skip: ${item}`)
      continue
    }
    console.log(`[stage-agent-payloads] staging: ${item} (${target.key}, ${tag})`)
    steps[item]()
    staged.push(item)
  }

  const manifest = buildManifest({ tag, commit, target, staged, skipped: skips })
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  console.log(`[stage-agent-payloads] wrote ${path.join(OUT_DIR, "manifest.json")}`)
}

if (isMain(import.meta.url)) {
  main()
}
