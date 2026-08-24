/**
 * Pointer-path regression for the session-strip plus button.
 *
 * Runs only against the isolated mock profile/provider fixture. No real
 * credentials, provider, profile, screenshots, or external publication.
 */

import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test('one real pointer click creates and selects exactly one tab, then focuses its composer', async () => {
  const fixture = await setupMockBackend()

  try {
    await waitForAppReady(fixture, 120_000)

    const page = fixture.page
    const plus = page.locator('[data-session-tab-plus] button').first()
    const sessionTabs = page.locator('[data-tree-tab^="session-tile:"]')

    await plus.waitFor({ state: 'visible' })
    const before = await sessionTabs.count()

    await page.evaluate(() => {
      type Trace = Array<{ phase: 'bubble' | 'capture'; type: string }>
      const tracedWindow = window as typeof window & { __PLUS_POINTER_TRACE__?: Trace }
      const trace: Trace = []
      tracedWindow.__PLUS_POINTER_TRACE__ = trace

      for (const type of ['pointerdown', 'pointerup', 'click']) {
        const record = (phase: 'bubble' | 'capture') => (event: Event) => {
          const target = event.target

          if (target instanceof Element && target.closest('[data-session-tab-plus]')) {
            trace.push({ phase, type })
          }
        }

        window.addEventListener(type, record('capture'), true)
        window.addEventListener(type, record('bubble'))
      }
    })

    await plus.click()

    await expect(sessionTabs).toHaveCount(before + 1)
    await expect(page.locator('[data-tree-tab^="session-tile:"][data-active="true"]')).toHaveCount(1)
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-slot') === 'composer-rich-input')

    const trace = await page.evaluate(() => {
      const tracedWindow = window as typeof window & {
        __PLUS_POINTER_TRACE__?: Array<{ phase: 'bubble' | 'capture'; type: string }>
      }

      return tracedWindow.__PLUS_POINTER_TRACE__ ?? []
    })

    expect(trace).toContainEqual({ phase: 'capture', type: 'pointerdown' })
    expect(trace).toContainEqual({ phase: 'capture', type: 'click' })
    expect(trace).not.toContainEqual({ phase: 'bubble', type: 'pointerdown' })
  } finally {
    await fixture.cleanup()
  }
})
