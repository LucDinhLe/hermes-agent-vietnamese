import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const defaultNsisTargetPath = path.join(
  repoRoot,
  'node_modules',
  'app-builder-lib',
  'out',
  'targets',
  'nsis',
  'NsisTarget.js',
)

export const electronBuilderWindowsNsisPatchMarker =
  'hermes-windows-nsis-uninstaller-reader'
export const electronBuilderWindowsNsisPatchNeedle = `        else {
            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
        }`

const replacement = `        else if (process.platform === "win32") {
            // ${electronBuilderWindowsNsisPatchMarker}: Smart App Control can block
            // electron-builder's unsigned bootstrap when it is executed only to
            // materialize the uninstaller. The bundled reader extracts the exact
            // same NSIS payload without executing an unsigned generated binary.
            await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
        }
        else {
            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
        }`

const requiredPatchedShape = [
  'else if (process.platform === "win32")',
  'await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);',
  'const wineVm = new WineVm_1.WineVmManager',
  'await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });',
]

export function hasCompleteElectronBuilderWindowsNsisPatch(source) {
  const markerCount = source.split(electronBuilderWindowsNsisPatchMarker).length - 1
  return markerCount === 1
    && requiredPatchedShape.every(fragment => source.includes(fragment))
}

export function patchElectronBuilderWindowsNsis({
  platform = process.platform,
  nsisTargetPath = defaultNsisTargetPath,
} = {}) {
  if (platform !== 'win32') {
    console.log(`[patch-electron-builder] skipped: platform ${platform} is not Windows`)
    return 'skipped-platform'
  }

  if (!fs.existsSync(nsisTargetPath)) {
    throw new Error(`required electron-builder Windows NSIS patch target not found: ${nsisTargetPath}`)
  }

  const source = fs.readFileSync(nsisTargetPath, 'utf8')
  if (source.includes(electronBuilderWindowsNsisPatchMarker)) {
    if (!hasCompleteElectronBuilderWindowsNsisPatch(source)) {
      throw new Error(
        `required electron-builder Windows NSIS patch marker is present but the patched shape is incomplete in ${nsisTargetPath}`,
      )
    }
    console.log('[patch-electron-builder] Windows NSIS uninstaller reader already applied')
    return 'already-applied'
  }

  if (!source.includes(electronBuilderWindowsNsisPatchNeedle)) {
    throw new Error(
      `required electron-builder Windows NSIS patch could not be applied: expected NsisTarget.js shape not found in ${nsisTargetPath}`,
    )
  }

  const patched = source.replace(electronBuilderWindowsNsisPatchNeedle, replacement)
  if (!hasCompleteElectronBuilderWindowsNsisPatch(patched)) {
    throw new Error(`required electron-builder Windows NSIS patch failed its post-apply shape check: ${nsisTargetPath}`)
  }
  fs.writeFileSync(nsisTargetPath, patched)
  console.log('[patch-electron-builder] applied Windows NSIS uninstaller reader')
  return 'applied'
}

const isMain = process.argv[1] != null
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  try {
    patchElectronBuilderWindowsNsis()
  } catch (error) {
    console.error(`[patch-electron-builder] fatal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
