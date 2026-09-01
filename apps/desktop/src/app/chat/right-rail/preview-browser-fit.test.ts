import { describe, expect, it } from 'vitest'

import { previewBrowserZoomFactor } from './preview-browser-fit'

describe('previewBrowserZoomFactor', () => {
  it('keeps the page at 100% when the rail is wide enough', () => {
    expect(previewBrowserZoomFactor(960)).toBe(1)
    expect(previewBrowserZoomFactor(1440)).toBe(1)
  })

  it('fits a desktop-width page into a narrow browser rail', () => {
    expect(previewBrowserZoomFactor(640)).toBe(0.67)
    expect(previewBrowserZoomFactor(480)).toBe(0.5)
  })

  it('keeps very narrow rails readable and ignores invalid measurements', () => {
    expect(previewBrowserZoomFactor(320)).toBe(0.45)
    expect(previewBrowserZoomFactor(0)).toBe(1)
    expect(previewBrowserZoomFactor(Number.NaN)).toBe(1)
  })
})
