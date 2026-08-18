// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIRST_RUN_LOCALE_KEY, I18nProvider } from '@/i18n'

import { FirstRunJourney } from './first-run-journey'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
describe('FirstRunJourney', () => {
  it('shows the same three setup steps and marks the active step', () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <FirstRunJourney activeStep={2} />
      </I18nProvider>
    )

    expect(screen.getByText('Install')).toBeTruthy()
    expect(screen.getByText('Connect a model').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('Start working')).toBeTruthy()
  })

  it('switches the setup language before the backend is ready and remembers it locally', () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <FirstRunJourney activeStep={1} showLanguage />
      </I18nProvider>
    )

    expect(screen.getByText('No Terminal commands or configuration files are required for setup.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }))

    expect(screen.getByText('Không cần mở Terminal, chạy lệnh hay sửa tệp cấu hình để thiết lập.')).toBeTruthy()
    expect(window.localStorage.getItem(FIRST_RUN_LOCALE_KEY)).toBe('vi')
  })
})
