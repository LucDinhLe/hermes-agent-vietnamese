import { afterEach, describe, expect, it } from 'vitest'

import { setRuntimeI18nLocale } from '@/i18n'
import type { SessionInfo } from '@/types/hermes'

import { sessionTabTitle } from './session-tab-title'

const session = (title: string) => ({ id: 'session-1', preview: '', title }) as SessionInfo

afterEach(() => setRuntimeI18nLocale('en'))

describe('sessionTabTitle', () => {
  it('localizes a legacy persisted NEW SESSION placeholder', () => {
    setRuntimeI18nLocale('vi')

    expect(sessionTabTitle(session('NEW SESSION'))).toBe('Phiên mới')
  })

  it('preserves a real session title', () => {
    setRuntimeI18nLocale('vi')

    expect(sessionTabTitle(session('Kế hoạch khóa học'))).toBe('Kế hoạch khóa học')
  })
})
