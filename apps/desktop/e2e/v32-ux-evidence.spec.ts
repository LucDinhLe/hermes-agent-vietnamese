/**
 * End-to-end acceptance evidence for the v32 navigation and context meter.
 *
 * The fixture owns an isolated HERMES_HOME, Electron userData directory, and
 * mock backend. No real credential, provider, or user profile is reachable.
 */

import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test('Messaging back preserves the draft and the context meter exposes transparent details', async ({}, testInfo) => {
  const fixture = await setupMockBackend()

  try {
    await waitForAppReady(fixture, 120_000)

    const page = fixture.page
    const composer = page.locator('[data-slot="composer-rich-input"]:visible')
    const setupPrompt = 'Persist this isolated v32 evidence session'
    const draft = 'Bản nháp v32 phải còn nguyên khi quay lại phiên'

    // Send one mock-backed turn so Messaging's Back action has a concrete
    // persisted session to restore, then leave an unsent draft in that session.
    await composer.click()
    await composer.type(setupPrompt, { delay: 10 })
    await page.keyboard.press('Enter')
    await page.waitForFunction(prompt => (document.body.textContent ?? '').includes(String(prompt)), setupPrompt, {
      timeout: 15_000
    })
    await page.waitForFunction(
      () => {
        const text = document.body.textContent ?? ''

        return text.includes('mock inference server') || text.includes('boot chain is working')
      },
      undefined,
      { timeout: 60_000 }
    )

    // Exercise the real multi-tab path: the old primary-only coverage could
    // not expose a draft that lived under a session tile's owner-scoped key.
    const tabs = page.locator('[data-tree-tab^="session-tile:"]')
    const before = await tabs.count()
    const previousTab = tabs.nth(before - 1)

    await page.locator('[data-session-tab-plus] button').first().click()
    await expect(tabs).toHaveCount(before + 1)
    await previousTab.click()

    await composer.click()
    await composer.type(draft, { delay: 10 })
    await expect(composer).toContainText(draft)

    await page.getByText('Nhắn tin', { exact: true }).first().click()

    const back = page.getByRole('button', { name: /Quay lại phiên|Back to session/i })

    await expect(back).toBeVisible()
    await page.screenshot({ fullPage: true, path: testInfo.outputPath('v32-messaging-back.png') })
    await back.click()

    await expect(composer).toContainText(draft)

    const meter = page.locator('[data-session-context-meter]').first()

    await expect(meter).toBeEnabled()
    await meter.click()
    await expect(page.locator('[data-slot="context-usage-panel"]')).toBeVisible()
    await page.screenshot({ fullPage: true, path: testInfo.outputPath('v32-context-meter.png') })
  } finally {
    await fixture.cleanup()
  }
})
