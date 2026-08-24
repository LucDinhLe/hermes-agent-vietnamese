/**
 * End-to-end acceptance evidence for the v32 navigation and context meter.
 *
 * The fixture owns an isolated HERMES_HOME, Electron userData directory, and
 * mock backend. No real credential, provider, or user profile is reachable.
 */

import { type MockBackendFixture, setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

let fixture: MockBackendFixture | null = null

test.beforeAll(async () => {
  fixture = await setupMockBackend()
  await waitForAppReady(fixture, 120_000)
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test('Messaging back preserves the draft and the context meter exposes transparent details', async ({}, testInfo) => {
  const page = fixture!.page
  const composer = page.locator('[data-slot="composer-rich-input"]:visible')
  const setupPrompt = 'Persist this isolated v32 evidence session'
  const draft = 'Bản nháp v32 phải còn nguyên khi quay lại phiên'

  // Send one mock-backed turn so Messaging's Back action has a concrete
  // persisted session to restore, then leave an unsent draft in that session.
  await composer.click()
  await composer.type(setupPrompt, { delay: 10 })
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    prompt => (document.body.textContent ?? '').includes(String(prompt)),
    setupPrompt,
    { timeout: 15_000 }
  )
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? ''

      return text.includes('mock inference server') || text.includes('boot chain is working')
    },
    undefined,
    { timeout: 60_000 }
  )

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
})
