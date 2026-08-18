const PREVIEW_BROWSER_DESKTOP_WIDTH = 960
const PREVIEW_BROWSER_MIN_ZOOM = 0.45

/**
 * Keep a desktop-width page visible inside the persistent browser rail.
 * Electron zoom changes the guest's effective CSS viewport, so this avoids
 * page-specific DOM/CSS injection and returns naturally to 100% when the rail
 * is wide enough.
 */
export function previewBrowserZoomFactor(width: number): number {
  if (!Number.isFinite(width) || width <= 0 || width >= PREVIEW_BROWSER_DESKTOP_WIDTH) {
    return 1
  }

  const fitted = width / PREVIEW_BROWSER_DESKTOP_WIDTH

  return Math.max(PREVIEW_BROWSER_MIN_ZOOM, Math.round(fitted * 100) / 100)
}
