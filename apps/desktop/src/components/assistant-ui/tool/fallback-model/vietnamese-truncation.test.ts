import { afterEach, describe, expect, it } from 'vitest'

import { setRuntimeI18nLocale } from '@/i18n'

import { clampForDisplay, MAX_TOOL_RENDER_CHARS } from './format'

afterEach(() => setRuntimeI18nLocale('en'))

describe('Vietnamese oversized tool output', () => {
  it('localizes the omitted count and recovery action', () => {
    setRuntimeI18nLocale('vi')

    const output = clampForDisplay('x'.repeat(MAX_TOOL_RENDER_CHARS + 5_000))

    expect(output).toContain('5.000 ký tự khác đã được lược bớt')
    expect(output).toContain('dùng Sao chép để lấy toàn bộ nội dung')
    expect(output).not.toContain('more characters truncated')
  })
})
