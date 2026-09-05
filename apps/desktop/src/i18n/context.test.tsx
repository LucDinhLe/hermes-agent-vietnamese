import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HermesConfigRecord } from '@/hermes'
import type { BackendOwner } from '@/store/backend-owner'

import { FIRST_RUN_LOCALE_KEY, type I18nConfigClient, I18nProvider, useI18n } from './context'
import { getRuntimeI18nLocale } from './runtime'
import type { Locale } from './types'

function LanguageProbe({ target = 'zh' }: { target?: Locale }) {
  const { isLoadingConfig, isSavingLocale, locale, previewLocale, saveError, setLocale, t } = useI18n()

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="label">{t.language.label}</p>
      <p data-testid="save">{t.common.save}</p>
      <p data-testid="loading">{String(isLoadingConfig)}</p>
      <p data-testid="saving">{String(isSavingLocale)}</p>
      <p data-testid="save-error">{saveError?.message ?? ''}</p>
      <button onClick={() => void setLocale(target).catch(() => undefined)} type="button">
        switch
      </button>
      <button onClick={() => previewLocale(target)} type="button">
        preview
      </button>
    </div>
  )
}

function RuntimeLocaleProbe() {
  const { setLocale } = useI18n()

  return (
    <div>
      <p data-testid="runtime-locale">{getRuntimeI18nLocale()}</p>
      <button onClick={() => void setLocale('vi')} type="button">
        switch-runtime
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('defaults to Vietnamese without a config client', () => {
    render(
      <I18nProvider configClient={null}>
        <LanguageProbe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale').textContent).toBe('vi')
    expect(screen.getByTestId('label').textContent).toBe('Ngôn ngữ')
  })

  it('normalizes an initial locale alias and switches translations', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="zh-CN">
        <LanguageProbe target="en" />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale').textContent).toBe('zh')
    expect(screen.getByTestId('label').textContent).toBe('语言')

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'))
    expect(screen.getByTestId('label').textContent).toBe('Language')
  })

  it('publishes the new runtime locale before descendants render', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <RuntimeLocaleProbe />
      </I18nProvider>
    )

    expect(screen.getByTestId('runtime-locale').textContent).toBe('en')
    fireEvent.click(screen.getByRole('button', { name: 'switch-runtime' }))

    await waitFor(() => expect(screen.getByTestId('runtime-locale').textContent).toBe('vi'))
  })

  it('loads the initial locale from display.language config', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({ display: { language: 'zh-Hans' } }),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('zh')
    expect(screen.getByTestId('label').textContent).toBe('语言')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('uses Vietnamese for a fresh profile without a configured language', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({}),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('vi')
    expect(screen.getByTestId('label').textContent).toBe('Ngôn ngữ')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('restores an early setup language until the backend can persist it', async () => {
    window.localStorage.setItem(FIRST_RUN_LOCALE_KEY, 'en')

    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({}),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('locale').textContent).toBe('en')
  })

  it('previews a setup language without calling a backend and persists it locally', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({}),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe target="en" />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'preview' }))

    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(window.localStorage.getItem(FIRST_RUN_LOCALE_KEY)).toBe('en')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('keeps the community Vietnamese default when config loading fails', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockRejectedValue(new Error('config unavailable')),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient} initialLocale="zh">
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('vi')
    expect(screen.getByTestId('label').textContent).toBe('Ngôn ngữ')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('loads zh-hant from display.language config', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({ display: { language: 'zh-TW' } }),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient} initialLocale="zh">
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('zh-hant')
    expect(screen.getByTestId('save').textContent).toBe('儲存')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('loads ja from display.language config', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({ display: { language: 'ja-JP' } }),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(screen.getByTestId('save').textContent).toBe('保存')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('does not overwrite unsupported configured languages', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({ display: { language: 'de' } }),
      saveConfig: vi.fn()
    }

    render(
      <I18nProvider configClient={configClient} initialLocale="zh">
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(screen.getByTestId('label').textContent).toBe('Language')
    expect(configClient.saveConfig).not.toHaveBeenCalled()
  })

  it('reads latest config before saving language and preserves unrelated values', async () => {
    const saveConfig = vi.fn().mockResolvedValue({ ok: true })

    const latestConfig: HermesConfigRecord = {
      display: { language: 'en', skin: 'slate' },
      terminal: { cwd: '/new' }
    }

    const configClient: I18nConfigClient = {
      getConfig: vi
        .fn()
        .mockResolvedValueOnce({ display: { language: 'en', skin: 'mono' }, terminal: { cwd: '/old' } })
        .mockResolvedValueOnce(latestConfig),
      saveConfig
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1))
    expect(saveConfig).toHaveBeenCalledWith({
      display: { language: 'zh', skin: 'slate' },
      terminal: { cwd: '/new' }
    })
  })

  it('keeps a locale save on its captured backend and ignores its late rollback after an owner switch', async () => {
    const ownerA = { connectionId: 'source-a', profile: 'research' }
    const ownerB = { connectionId: 'source-b', profile: 'research' }
    let rejectSaveA!: (error: Error) => void

    const saveA = new Promise<{ ok: boolean }>((_resolve, reject) => {
      rejectSaveA = reject
    })

    const getConfig = vi.fn(async (owner?: BackendOwner) => ({
      display: { language: owner?.connectionId === 'source-b' ? 'ja' : 'en' }
    }))

    const saveConfig = vi.fn((_config: HermesConfigRecord, owner?: BackendOwner) =>
      owner?.connectionId === 'source-a' ? saveA : Promise.resolve({ ok: true })
    )

    const configClient: I18nConfigClient = { getConfig, saveConfig }

    const view = render(
      <I18nProvider backendOwner={ownerA} configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'))
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(saveConfig).toHaveBeenCalledWith({ display: { language: 'zh' } }, ownerA))

    view.rerender(
      <I18nProvider backendOwner={ownerB} configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('ja'))

    await act(async () => {
      rejectSaveA(new Error('late source-a failure'))
      await Promise.resolve()
    })

    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(screen.getByTestId('save-error').textContent).toBe('')
    expect(getConfig).toHaveBeenCalledWith(ownerA)
    expect(getConfig).toHaveBeenCalledWith(ownerB)
  })

  it('saves newly supported locales to display.language', async () => {
    const saveConfig = vi.fn().mockResolvedValue({ ok: true })

    const configClient: I18nConfigClient = {
      getConfig: vi
        .fn()
        .mockResolvedValueOnce({ display: { language: 'en' } })
        .mockResolvedValueOnce({ display: { language: 'en', skin: 'mono' } }),
      saveConfig
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe target="ja" />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1))
    expect(saveConfig).toHaveBeenCalledWith({ display: { language: 'ja', skin: 'mono' } })
    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(window.localStorage.getItem(FIRST_RUN_LOCALE_KEY)).toBe('ja')
  })

  it('applies RTL direction for Arabic and restores LTR on switch back', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="ar">
        <LanguageProbe target="en" />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale').textContent).toBe('ar')
    expect(window.document.documentElement.dir).toBe('rtl')
    expect(window.document.documentElement.lang).toBe('ar')

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en'))
    expect(window.document.documentElement.dir).toBe('ltr')
    expect(window.document.documentElement.lang).toBe('en')
  })

  it('rolls back the visible locale when saving fails', async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue({ display: { language: 'en' } }),
      saveConfig: vi.fn().mockRejectedValue(new Error('save failed'))
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageProbe />
      </I18nProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    await waitFor(() => expect(screen.getByTestId('save-error').textContent).toBe('save failed'))

    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(screen.getByTestId('label').textContent).toBe('Language')
  })
})
