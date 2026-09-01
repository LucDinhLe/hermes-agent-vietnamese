import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { registerPluginLocales } from '@/i18n/plugin-i18n'
import { VIETNAMESE_EDITION_LOCALES } from '@/plugins/hermes-vietnamese/i18n'

import { Intro } from './intro'

let disposeLocales = () => {}

beforeEach(() => {
  disposeLocales = registerPluginLocales('hermes-vietnamese', VIETNAMESE_EDITION_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
})

describe('Hermes Vietnamese home', () => {
  it('restores the Vietnamese product identity and owner credit', () => {
    render(
      <I18nProvider configClient={null} initialLocale="vi">
        <Intro personality="none" seed={0} />
      </I18nProvider>
    )

    const wordmark = screen.getByLabelText('HERMES VIETNAMESE')

    expect(wordmark.className).toContain('fit-text')
    expect(wordmark.style.getPropertyValue('--fit-min')).toBe('2rem')

    const tagline = screen.getByText(
      'Nhập một nhiệm vụ, câu hỏi hoặc đoạn mã. Hermes Vietnamese ghi nhớ phiên làm việc, dẫn nguồn và sẽ hỏi lại khi chưa chắc chắn.'
    )

    const attribution = screen.getByText('Phát triển và Việt hóa bởi Lê Đình Lực')

    expect(tagline.getAttribute('data-slot')).toBe('aui_intro-tagline')
    expect(attribution.getAttribute('data-slot')).toBe('aui_intro-attribution')
    expect(screen.queryByLabelText('HERMES AGENT')).toBeNull()
    expect(screen.queryByText(/Send a bug|What should Hermes|Bring the code/i)).toBeNull()
  })
})
