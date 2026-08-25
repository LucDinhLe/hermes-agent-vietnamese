/**
 * Exact packaged-binary acceptance for v32.
 *
 * The built app supplies the renderer, resident Python/Node payload and
 * gateway. Only the inference endpoint is mocked. HERMES_HOME and Electron
 * userData are disposable and credential-shaped host variables are stripped.
 */

import { expect, test, type Page } from './test'

import {
  packagedBinaryExists,
  type PackagedMockBackendFixture,
  setupPackagedMockBackend,
  waitForAppReady,
} from './fixtures'
import { MOCK_REPLY, type MockServer } from './mock-server'

function activeChatSurface(page: Page) {
  return page
    .locator('[data-slot="composer-rich-input"]:visible')
    .locator('xpath=ancestor::*[@data-chat-surface][1]')
}

function activeThread(page: Page) {
  return activeChatSurface(page).locator('[data-slot="aui_thread-viewport"]')
}

async function send(page: Page, mock: MockServer, prompt: string): Promise<void> {
  const composer = page.locator('[data-slot="composer-rich-input"]:visible')
  const agentCallsBefore = mock.receivedCompletions.filter(
    request => request.kind === 'agent' && request.userText === prompt,
  ).length

  await composer.click()
  await page.keyboard.insertText(prompt)
  const composerRoot = composer.locator('xpath=ancestor::*[@data-slot="composer-root"][1]')
  const sendButton = composerRoot.getByRole('button', { name: /^(Send|Gửi)$/ })

  // A freshly created tile can still be starting its profile backend. Enter
  // during that interval intentionally remains a draft, which is not evidence
  // of a provider turn. Wait for the actual action and click it physically.
  await expect(sendButton).toBeEnabled({ timeout: 120_000 })
  await sendButton.click()
  await expect
    .poll(
      () =>
        mock.receivedCompletions.filter(request => request.kind === 'agent' && request.userText === prompt).length,
      { timeout: 60_000 },
    )
    .toBe(agentCallsBefore + 1)
  await expect(activeThread(page)).toContainText(prompt, { timeout: 90_000 })
  await expect(activeThread(page)).toContainText(MOCK_REPLY, { timeout: 90_000 })
}

test.describe('v32 exact packaged candidate', () => {
  test.describe.configure({ mode: 'serial', timeout: 360_000 })
  test.skip(
    !packagedBinaryExists() && process.env.HERMES_REQUIRE_PACKAGED_CANDIDATE !== '1',
    'Exact packaged binary is absent; build the candidate once before running this acceptance spec.',
  )

  let fixture: PackagedMockBackendFixture

  test.beforeAll(async () => {
    fixture = await setupPackagedMockBackend()
    await waitForAppReady(fixture, 180_000)
  })

  test.afterAll(async () => {
    await fixture?.cleanup()
  })

  test('runs resident gateway, preserves state, proves the three UX fixes, and compacts', async ({}, testInfo) => {
    test.setTimeout(360_000)
    const primaryPrompt = 'Persist this exact packaged v32 primary session'
    const focusedTilePrompt = 'Persist this exact packaged v32 focused-tile session'
    const draft = 'Bản nháp packaged v32 vẫn còn sau khi mở lại'

    await send(fixture.page, fixture.mock, primaryPrompt)

    // Keep the first stored session selected as primary, then create and send
    // a turn in a different focused tile. Messaging Back must resolve the tile,
    // not fall back to the primary session.
    const tabs = fixture.page.locator('[data-tree-tab^="session-tile:"]')
    const before = await tabs.count()

    await fixture.page.locator('[data-session-tab-plus] button').first().click()
    await expect(tabs).toHaveCount(before + 1)
    const activeTab = fixture.page.locator('[data-tree-tab^="session-tile:"][data-active="true"]')

    await expect(activeTab).toHaveCount(1)
    await fixture.page.waitForFunction(
      () => document.activeElement?.getAttribute('data-slot') === 'composer-rich-input',
    )
    await send(fixture.page, fixture.mock, focusedTilePrompt)

    const focusedTileKey = await activeTab.getAttribute('data-tree-tab')

    if (!focusedTileKey) {
      throw new Error('focused packaged session tile has no stable data-tree-tab identity')
    }
    await expect(fixture.page.locator(`[data-tree-tab=${JSON.stringify(focusedTileKey)}]`)).toHaveAttribute(
      'data-active',
      'true'
    )

    let composer = fixture.page.locator('[data-slot="composer-rich-input"]:visible')

    await composer.click()
    await composer.type(draft, { delay: 8 })
    await expect(composer).toContainText(draft)

    await fixture.page.getByText('Nhắn tin', { exact: true }).first().click()
    const back = fixture.page.getByRole('button', { name: /Quay lại phiên|Back to session/i })

    await expect(back).toBeVisible()
    await back.click()
    await expect(composer).toContainText(draft)
    await expect(activeThread(fixture.page)).toContainText(focusedTilePrompt, { timeout: 30_000 })

    let meter = activeChatSurface(fixture.page).locator('[data-session-context-meter]')

    await expect(meter).toBeEnabled()
    await meter.click()
    await expect(fixture.page.locator('[data-slot="context-usage-panel"]')).toBeVisible()
    await fixture.page.screenshot({ fullPage: true, path: testInfo.outputPath('packaged-v32-ux.png') })
    await fixture.page.keyboard.press('Escape')

    // Relaunch the same exact binary against the same disposable profile.
    await fixture.relaunch()
    await waitForAppReady(fixture, 180_000)
    composer = fixture.page.locator('[data-slot="composer-rich-input"]:visible')
    await expect(activeThread(fixture.page)).toContainText(focusedTilePrompt, { timeout: 90_000 })
    await expect(composer).toContainText(draft, { timeout: 30_000 })

    // Clear the restored draft, add enough completed history for manual
    // compaction, then prove that the continued session still accepts a turn.
    await composer.click()
    await fixture.page.keyboard.press('Control+A')
    await fixture.page.keyboard.press('Backspace')
    await expect(composer).toHaveText('')

    await send(fixture.page, fixture.mock, 'PACKAGED_V32_COMPACTION_SECOND')
    await send(fixture.page, fixture.mock, 'PACKAGED_V32_COMPACTION_THIRD')

    await composer.click()
    await fixture.page.keyboard.insertText('/compress preserve packaged v32 acceptance anchors')
    await composer
      .locator('xpath=ancestor::*[@data-slot="composer-root"][1]')
      .getByRole('button', { name: /^(Send|Gửi)$/ })
      .click()
    await expect
      .poll(() => activeThread(fixture.page).textContent(), { timeout: 120_000 })
      .toMatch(/Compressed|No changes from compression/)

    await send(fixture.page, fixture.mock, 'PACKAGED_V32_AFTER_COMPACTION')
    meter = activeChatSurface(fixture.page).locator('[data-session-context-meter]')
    await meter.click()
    await expect(fixture.page.locator('[data-slot="context-usage-panel"]')).toContainText(
      /(?:Số lần compact|Compactions).*1/i,
    )
    await fixture.page.screenshot({ fullPage: true, path: testInfo.outputPath('packaged-v32-compaction.png') })
  })
})
