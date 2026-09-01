import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $draftTitles } from '@/store/composer'

import { SessionDraftTitle } from './session-draft-title'

describe('SessionDraftTitle', () => {
  afterEach(() => {
    cleanup()
    $draftTitles.set({})
  })

  it('shows the Vietnamese V32 label for an empty draft', () => {
    render(
      <I18nProvider configClient={null} initialLocale="vi">
        <SessionDraftTitle scope={null} />
      </I18nProvider>
    )

    expect(screen.getByText('Phiên mới')).toBeTruthy()
    expect(screen.queryByText('New session')).toBeNull()
  })

  it('preserves a title derived from user content', () => {
    $draftTitles.set({ __new__: 'Xây dựng cầu nối OAuth' })

    render(
      <I18nProvider configClient={null} initialLocale="vi">
        <SessionDraftTitle scope={null} />
      </I18nProvider>
    )

    expect(screen.getByText('Xây dựng cầu nối OAuth')).toBeTruthy()
  })
})
