import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { BilingualQuickToggle } from './bilingual-quick-toggle'

vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('@/store/notifications', () => ({ notifyError: vi.fn() }))

afterEach(cleanup)

describe('V32 bilingual titlebar control', () => {
  it('switches Vietnamese to English in one click and exposes the return action', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="vi">
        <BilingualQuickToggle />
      </I18nProvider>
    )

    const toEnglish = screen.getByRole('button', { name: 'Chuyển ngôn ngữ: English' })

    expect(toEnglish.textContent).toBe('EN')
    fireEvent.click(toEnglish)

    await waitFor(() => {
      const toVietnamese = screen.getByRole('button', { name: 'Switch language: Tiếng Việt' })

      expect(toVietnamese.textContent).toBe('VI')
    })
  })
})
