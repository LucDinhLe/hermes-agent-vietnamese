import { describe, expect, it } from 'vitest'

import {
  TITLEBAR_CONTROL_HEIGHT,
  TITLEBAR_CONTROL_OFFSET_X,
  TITLEBAR_EDGE_INSET,
  TITLEBAR_FALLBACK_WINDOW_BUTTON_X,
  TITLEBAR_ICON_SIZE,
  titlebarControlsPosition
} from './titlebar'

describe('titlebar control accessibility', () => {
  it('uses a readable glyph and a 32px pointer target', () => {
    expect(TITLEBAR_ICON_SIZE).toBeGreaterThanOrEqual(16)
    expect(TITLEBAR_CONTROL_HEIGHT).toBeGreaterThanOrEqual(32)
  })
})

describe('titlebarControlsPosition', () => {
  it('offsets controls from visible traffic lights', () => {
    expect(titlebarControlsPosition({ x: 24, y: 10 }).left).toBe(24 + TITLEBAR_CONTROL_OFFSET_X)
  })

  it('pins to the edge when macOS fullscreen hides traffic lights', () => {
    expect(titlebarControlsPosition({ x: 24, y: 10 }, true).left).toBe(TITLEBAR_EDGE_INSET)
  })

  it('pins to the edge on Windows/Linux where native controls render on the right', () => {
    expect(titlebarControlsPosition(null).left).toBe(TITLEBAR_EDGE_INSET)
  })

  it('uses the macOS fallback while the initial window state is unknown', () => {
    expect(titlebarControlsPosition(undefined).left).toBe(TITLEBAR_FALLBACK_WINDOW_BUTTON_X + TITLEBAR_CONTROL_OFFSET_X)
  })
})
