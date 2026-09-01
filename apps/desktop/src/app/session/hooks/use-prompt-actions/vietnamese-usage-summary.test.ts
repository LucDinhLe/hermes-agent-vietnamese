import { afterEach, describe, expect, it } from 'vitest'

import { setRuntimeI18nLocale } from '@/i18n'

import { renderRpcResult } from './utils'

afterEach(() => setRuntimeI18nLocale('en'))

describe('Vietnamese session usage summary', () => {
  it('uses Vietnamese labels and separators for the user-visible RPC result', () => {
    setRuntimeI18nLocale('vi')

    expect(renderRpcResult({ calls: 12, input: 1_234_567, output: 89_012, total: 1_323_579 }, 'usage')).toBe(
      'Mức sử dụng: 12 lượt gọi · 1.234.567 đầu vào / 89.012 đầu ra · 1.323.579 tổng cộng'
    )
  })
})
