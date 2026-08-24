import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const defaultElectronMacPath = path.join(repoRoot, 'node_modules', 'app-builder-lib', 'out', 'electron', 'electronMac.js')

export const electronBuilderMacPatchMarker = 'hermes-macos-electron-binary-fallback'
export const electronBuilderMacPatchNeedle = `    await Promise.all([
        doRename(path.join(contentsPath, "MacOS"), electronBranding.productName, appPlist.CFBundleExecutable),
        (0, builder_util_1.unlinkIfExists)(path.join(appOutDir, "LICENSE")),
        (0, builder_util_1.unlinkIfExists)(path.join(appOutDir, "LICENSES.chromium.html")),
    ]);`
const replacement = `    // ${electronBuilderMacPatchMarker}: electron-builder 26.8.x can sometimes copy
    // Electron.app without its main MacOS/Electron binary before this rename.
    // Restore it from the installed Electron runtime so local desktop installs
    // do not fail with ENOENT during macOS arm64 packaging.
    const macosDir = path.join(contentsPath, "MacOS");
    const bundledElectronBinary = path.join(macosDir, electronBranding.productName);
    if (!fs.existsSync(bundledElectronBinary)) {
        const candidates = [
            path.join(packager.info.framework.distMacOsAppName, "Contents", "MacOS", electronBranding.productName),
            // npm may nest the workspace-only electron devDep under
            // apps/desktop/node_modules (process.cwd() during pack), or hoist
            // it to the repo root. Try the workspace-local install first, then
            // the root hoist, so the fallback works under either layout.
            path.join(process.cwd(), "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", electronBranding.productName),
            path.join(process.cwd(), "..", "..", "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", electronBranding.productName),
        ];
        const sourceBinary = candidates.find(candidate => fs.existsSync(candidate));
        if (sourceBinary == null) {
            throw new Error("Electron binary missing from packaged app and Electron runtime: " + bundledElectronBinary);
        }
        await (0, promises_1.copyFile)(sourceBinary, bundledElectronBinary);
        await (0, promises_1.chmod)(bundledElectronBinary, 0o755);
    }
    await Promise.all([
        doRename(macosDir, electronBranding.productName, appPlist.CFBundleExecutable),
        (0, builder_util_1.unlinkIfExists)(path.join(appOutDir, "LICENSE")),
        (0, builder_util_1.unlinkIfExists)(path.join(appOutDir, "LICENSES.chromium.html")),
    ]);`

export function patchElectronBuilderMacBinary({
  platform = process.platform,
  electronMacPath = defaultElectronMacPath,
} = {}) {
  if (platform !== 'darwin') {
    console.log(`[patch-electron-builder] skipped: platform ${platform} is not macOS`)
    return 'skipped-platform'
  }

  if (!fs.existsSync(electronMacPath)) {
    throw new Error(`required electron-builder macOS patch target not found: ${electronMacPath}`)
  }

  const source = fs.readFileSync(electronMacPath, 'utf8')
  if (source.includes(electronBuilderMacPatchMarker)) {
    console.log('[patch-electron-builder] macOS Electron binary fallback already applied')
    return 'already-applied'
  }

  if (!source.includes(electronBuilderMacPatchNeedle)) {
    throw new Error(
      `required electron-builder macOS patch could not be applied: expected electronMac.js shape not found in ${electronMacPath}`,
    )
  }

  fs.writeFileSync(
    electronMacPath,
    source.replace(electronBuilderMacPatchNeedle, replacement),
  )
  console.log('[patch-electron-builder] applied macOS Electron binary fallback')
  return 'applied'
}

const isMain = process.argv[1] != null
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  try {
    patchElectronBuilderMacBinary()
  } catch (error) {
    console.error(`[patch-electron-builder] fatal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
