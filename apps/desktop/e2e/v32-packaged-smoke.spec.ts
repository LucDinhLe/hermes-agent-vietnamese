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

async function send(page: Page, mock: MockServer, prompt: string): Promise<void> {
  const composer = page.locator('[data-slot="composer-rich-input"]:visible')
  const agentCallsBefore = mock.receivedCompletions.filter(
    request => request.kind === 'agent' && request.userText === prompt,
  ).length

  await composer.click()
  await page.keyboard.insertText(prompt)
  await page.keyboard.press('Enter')
  await expect
    .poll(
      () =>
        mock.receivedCompletions.filter(request => request.kind === 'agent' && request.userText === prompt).length,
      { timeout: 60_000 },
    )
    .toBe(agentCallsBefore + 1)
  await page.waitForFunction(
    reply => document.querySelector('[data-slot="aui_thread-viewport"]')?.textContent?.includes(String(reply)) ?? false,
    MOCK_REPLY,
    { timeout: 90_000 },
  )
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
    const setupPrompt = 'Persist this exact packaged v32 acceptance session'
    const draft = 'Bản nháp packaged v32 vẫn còn sau khi mở lại'

    await send(fixture.page, fixture.mock, setupPrompt)

    // A physical pointer click creates one selected tab and focuses its
    // composer. Return to the persisted tab before checking its draft.
    const tabs = fixture.page.locator('[data-tree-tab^="session-tile:"]')
    const before = await tabs.count()
    const previousTab = tabs.nth(before - 1)

    await fixture.page.locator('[data-session-tab-plus] button').first().click()
    await expect(tabs).toHaveCount(before + 1)
    await expect(fixture.page.locator('[data-tree-tab^="session-tile:"][data-active="true"]')).toHaveCount(1)
    await fixture.page.waitForFunction(
      () => document.activeElement?.getAttribute('data-slot') === 'composer-rich-input',
    )
    await previousTab.click()

    let composer = fixture.page.locator('[data-slot="composer-rich-input"]:visible')

    await composer.click()
    await composer.type(draft, { delay: 8 })
    await expect(composer).toContainText(draft)

    await fixture.page.getByText('Nhắn tin', { exact: true }).first().click()
    const back = fixture.page.getByRole('button', { name: /Quay lại phiên|Back to session/i })

    await expect(back).toBeVisible()
    await back.click()
    await expect(composer).toContainText(draft)

    const meter = fixture.page.locator('[data-session-context-meter]').first()

    await expect(meter).toBeEnabled()
    await meter.click()
    await expect(fixture.page.locator('[data-slot="context-usage-panel"]')).toBeVisible()
    await fixture.page.screenshot({ fullPage: true, path: testInfo.outputPath('packaged-v32-ux.png') })
    await fixture.page.keyboard.press('Escape')

    // Relaunch the same exact binary against the same disposable profile.
    await fixture.relaunch()
    await waitForAppReady(fixture, 180_000)
    composer = fixture.page.locator('[data-slot="composer-rich-input"]:visible')
    await expect(fixture.page.locator('[data-slot="aui_thread-viewport"]')).toContainText(setupPrompt)
    await expect(composer).toContainText(draft)

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
    await fixture.page.getByRole('button', { name: /^(Send|Gửi)$/ }).click()
    await expect
      .poll(() => fixture.page.locator('[data-slot="aui_thread-viewport"]').textContent(), { timeout: 120_000 })
      .toMatch(/Compressed|No changes from compression/)

    await send(fixture.page, fixture.mock, 'PACKAGED_V32_AFTER_COMPACTION')
    await meter.click()
    await expect(fixture.page.locator('[data-slot="context-usage-panel"]')).toContainText(
      /(?:Số lần compact|Compactions).*1/i,
    )
    await fixture.page.screenshot({ fullPage: true, path: testInfo.outputPath('packaged-v32-compaction.png') })
  })
})
