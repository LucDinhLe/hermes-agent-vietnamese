import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider, useI18n } from '@/i18n'

import { useComposerPlaceholder } from './use-composer-placeholder'

vi.mock('../composer-utils', () => ({
  pickPlaceholder: (pool: readonly string[]) => pool[0]
}))

vi.mock('@/store/composer-input-history', () => ({
  resetBrowseState: vi.fn()
}))

afterEach(cleanup)

function PlaceholderProbe() {
  const { setLocale } = useI18n()
  const placeholder = useComposerPlaceholder({ disabled: false, reconnecting: false, sessionId: 'same-session' })

  return (
    <>
      <output aria-label="placeholder">{placeholder}</output>
      <button onClick={() => void setLocale('vi')} type="button">
        switch locale
      </button>
    </>
  )
}

describe('useComposerPlaceholder locale changes', () => {
  it('refreshes the placeholder when locale changes without changing session', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <PlaceholderProbe />
      </I18nProvider>
    )

    expect(screen.getByLabelText('placeholder').textContent).toBe('Send a follow-up')

    fireEvent.click(screen.getByRole('button', { name: 'switch locale' }))

    await waitFor(() => expect(screen.getByLabelText('placeholder').textContent).toBe('Gửi yêu cầu'))
  })
})
