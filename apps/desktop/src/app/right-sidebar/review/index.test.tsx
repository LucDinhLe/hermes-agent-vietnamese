import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { HermesReviewFile } from '@/global'
import { I18nProvider } from '@/i18n'
import {
  $reviewFiles,
  $reviewIsRepo,
  $reviewLoading,
  $reviewOpen,
  $reviewSelectedPath,
  $reviewTreeMode
} from '@/store/review'

import { ReviewPane } from './index'

const changedFile: HermesReviewFile = {
  added: 1,
  path: 'changed.ts',
  removed: 0,
  staged: false,
  status: 'M'
}

function renderPane() {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <ReviewPane />
    </I18nProvider>
  )
}

describe('ReviewPane header actions', () => {
  beforeEach(() => {
    $reviewFiles.set([])
    $reviewIsRepo.set(true)
    $reviewLoading.set(false)
    $reviewOpen.set(true)
    $reviewSelectedPath.set(null)
    $reviewTreeMode.set('tree')
  })

  afterEach(() => {
    cleanup()
    $reviewFiles.set([])
    $reviewOpen.set(false)
    $reviewSelectedPath.set(null)
  })

  it('hides file actions that cannot do anything in a clean working tree', () => {
    renderPane()

    expect(screen.queryByRole('button', { name: 'View as list' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stage all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Revert all' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh tree' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('shows file actions when there are changes to act on', () => {
    $reviewFiles.set([changedFile])

    renderPane()

    expect(screen.getByRole('button', { name: 'View as list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stage all' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revert all' })).toBeTruthy()
  })
})
