import { describe, expect, it } from 'vitest'

import type { PreviewTarget } from '@/store/preview'

import { isLayoutPreviewTarget, previewTileDock } from './preview-tile'

describe('previewTileDock', () => {
  it('keeps the shared Browser out of the center workspace tab strip', () => {
    const browser: PreviewTarget = {
      kind: 'url',
      label: 'Browser',
      source: 'https://example.com',
      url: 'https://example.com'
    }

    expect(isLayoutPreviewTarget(browser)).toBe(false)
  })

  it('keeps file previews beside the workspace', () => {
    const file: PreviewTarget = {
      kind: 'file',
      label: 'notes.md',
      source: '/work/notes.md',
      url: 'file:///work/notes.md'
    }

    expect(isLayoutPreviewTarget(file)).toBe(true)
    expect(previewTileDock(file)).toEqual({ anchor: 'workspace', dir: 'right' })
  })
})
