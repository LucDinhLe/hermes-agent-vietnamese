/**
 * End-to-end acceptance evidence for the v32 navigation and context meter.
 *
 * The fixture owns an isolated HERMES_HOME, Electron userData directory, and
 * mock backend. No real credential, provider, or user profile is reachable.
 */

import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test, type Page } from './test'

function activeChatSurface(page: Page) {
  return page
    .locator('[data-slot="composer-rich-input"]:visible')
    .locator('xpath=ancestor::*[@data-chat-surface][1]')
}

function activeThread(page: Page) {
  return activeChatSurface(page).locator('[data-slot="aui_thread-viewport"]')
}

test('Messaging back preserves the draft and the context meter exposes transparent details', async ({}, testInfo) => {
  const fixture = await setupMockBackend()

  try {
    await waitForAppReady(fixture, 120_000)

    const page = fixture.page
    const composer = page.locator('[data-slot="composer-rich-input"]:visible')
    const primaryPrompt = 'Persist this isolated primary v32 evidence session'
    const focusedTilePrompt = 'Persist this isolated focused-tile v32 evidence session'
    const draft = 'Bản nháp v32 phải còn nguyên khi quay lại phiên'

    // Send one mock-backed turn so Messaging's Back action has a concrete
    // persisted session to restore, then leave an unsent draft in that session.
    await composer.click()
    await composer.type(primaryPrompt, { delay: 10 })
    const composerRoot = composer.locator('xpath=ancestor::*[@data-slot="composer-root"][1]')
    const sendButton = composerRoot.getByRole('button', { name: /^(Send|Gửi)$/ })

    await expect(sendButton).toBeEnabled({ timeout: 120_000 })
    await sendButton.click()
    await expect(activeThread(page)).toContainText(primaryPrompt, { timeout: 15_000 })
    await expect(activeThread(page)).toContainText(/mock inference server|boot chain is working/, { timeout: 60_000 })

    // Exercise the real multi-tab path: keep the first stored session as the
    // primary selection, then create and persist a DIFFERENT focused tile. The
    // old primary-only coverage could not expose a draft owned by that tile.
    const tabs = page.locator('[data-tree-tab^="session-tile:"]')
    const before = await tabs.count()

    await page.locator('[data-session-tab-plus] button').first().click()
    await expect(tabs).toHaveCount(before + 1)
    const activeTab = page.locator('[data-tree-tab^="session-tile:"][data-active="true"]')

    await expect(activeTab).toHaveCount(1)
    await composer.click()
    await composer.type(focusedTilePrompt, { delay: 10 })
    // A new tile can be visible before its profile backend is ready. Treating
    // Enter during that interval as a sent turn leaves only a draft and masks
    // the primary-vs-tile Back bug this scenario exists to catch.
    await expect(sendButton).toBeEnabled({ timeout: 120_000 })
    await sendButton.click()
    await expect(activeThread(page)).toContainText(focusedTilePrompt, { timeout: 30_000 })
    await expect(activeThread(page)).toContainText(/mock inference server|boot chain is working/, { timeout: 60_000 })

    const focusedTileKey = await activeTab.getAttribute('data-tree-tab')

    if (!focusedTileKey) {
      throw new Error('focused stored session tile has no stable data-tree-tab identity')
    }
    await expect(page.locator(`[data-tree-tab=${JSON.stringify(focusedTileKey)}]`)).toHaveAttribute('data-active', 'true')

    await composer.click()
    await composer.type(draft, { delay: 10 })
    await expect(composer).toContainText(draft)

    await page.getByText('Nhắn tin', { exact: true }).first().click()

    const back = page.getByRole('button', { name: /Quay lại phiên|Back to session/i })

    await expect(back).toBeVisible()
    await page.screenshot({ fullPage: true, path: testInfo.outputPath('v32-messaging-back.png') })
    await back.click()

    await expect(composer).toContainText(draft)
    await expect(activeThread(page)).toContainText(focusedTilePrompt, { timeout: 30_000 })

    const meter = activeChatSurface(page).locator('[data-session-context-meter]')

    await expect(meter).toBeEnabled()
    await meter.click()
    await expect(page.locator('[data-slot="context-usage-panel"]')).toBeVisible()
    await page.screenshot({ fullPage: true, path: testInfo.outputPath('v32-context-meter.png') })
  } finally {
    await fixture.cleanup()
  }
})
