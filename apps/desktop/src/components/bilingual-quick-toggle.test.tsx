import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HermesConfigRecord } from '@/hermes'
import { type I18nConfigClient, I18nProvider } from '@/i18n'

import { BilingualQuickToggle } from './bilingual-quick-toggle'

describe('BilingualQuickToggle', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('switches Vietnamese to English in one click and preserves unrelated config', async () => {
    const saveConfig = vi.fn().mockResolvedValue({ ok: true })
    const latestConfig: HermesConfigRecord = { display: { language: 'vi', skin: 'slate' } }

    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue(latestConfig),
      saveConfig
    }

    render(
      <I18nProvider configClient={configClient} initialLocale="vi">
        <BilingualQuickToggle />
      </I18nProvider>
    )

    await waitFor(() =>
      expect((screen.getByRole('button', { name: /English/i }) as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(screen.getByRole('button', { name: /English/i }))

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1))
    expect(saveConfig).toHaveBeenCalledWith({ display: { language: 'en', skin: 'slate' } })
    expect((await screen.findByRole('button', { name: /Tiếng Việt/i })).textContent).toBe('VI')
  })
})
