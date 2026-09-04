/**
 * after-pack.mjs — electron-builder afterPack hook.
 *
 * Stamps the Hermes icon + identity onto the packed Windows Hermes.exe via
 * rcedit (delegated to set-exe-identity.mjs). This runs for EVERY packed build
 * — first install, `hermes desktop`, the installer's --update rebuild, and a
 * dev's manual `npm run pack` — so the branded exe can never silently revert
 * to the stock "Electron" icon/name (the bug when the stamp lived only in
 * install.ps1, which the update path doesn't use).
 *
 * Windows-only: rcedit edits PE resources, irrelevant on macOS/Linux where the
 * app identity comes from the bundle Info.plist / desktop entry. Best-effort:
 * a stamp failure must never fail an otherwise-good build (worst case is the
 * stock icon, not a broken app), so we log and resolve rather than throw.
 *
 * electron-builder passes a context with:
 *   - electronPlatformName: 'win32' | 'darwin' | 'linux'
 *   - appOutDir:            the unpacked app directory for this target
 *   - packager.appInfo.productFilename: the exe basename (e.g. 'Hermes')
 */

import path from 'node:path'

import { normalizeBundleSymlinks } from './mac-bundle-symlinks.mjs'
import { stampExeIdentity } from './set-exe-identity.mjs'

export default async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    // Chạy TRƯỚC khi electron-builder ký: dọn symlink mà codesign --strict từ chối.
    const productName = context.packager?.appInfo?.productFilename || 'Hermes'
    const app = path.join(context.appOutDir, `${productName}.app`)
    const { fixed, removed } = normalizeBundleSymlinks(app)
    console.log(`[after-pack] macOS symlink: viết lại ${fixed.length}, xoá ${removed.length}`)

    return
  }

  if (context.electronPlatformName !== 'win32') {
    return
  }

  const productName = context.packager?.appInfo?.productFilename || 'Hermes'
  const exe = path.join(context.appOutDir, `${productName}.exe`)
  const desktopRoot = path.resolve(import.meta.dirname, '..')

  try {
    await stampExeIdentity(exe, desktopRoot)
  } catch (err) {
    console.warn(`[after-pack] exe identity stamp failed (${err.message}); Hermes.exe keeps the stock Electron icon`)
    // A developer pack may stay best-effort, but a candidate must never ship
    // with stock Electron metadata after the public display name was changed.
    if (process.env.HERMES_RELEASE_CLASS || process.env.HERMES_DESKTOP_BUNDLED === '1') {
      throw err
    }
  }
}
