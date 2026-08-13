import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n/context'

import { Intro } from './intro'

afterEach(cleanup)

describe('Intro locale', () => {
  it('shows a Vietnamese tagline when the interface language is Vietnamese', () => {
    render(
      <I18nProvider configClient={null} initialLocale="vi">
        <Intro personality="none" seed={0} />
      </I18nProvider>
    )

    expect(
      screen.getByText(
        'Nhập một nhiệm vụ, câu hỏi hoặc đoạn mã. Hermes ghi nhớ phiên làm việc, dẫn nguồn và sẽ hỏi lại khi chưa chắc chắn.'
      )
    ).toBeTruthy()
  })
})
