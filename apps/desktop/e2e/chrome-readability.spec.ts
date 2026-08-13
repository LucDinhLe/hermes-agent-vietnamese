import { expect, test } from './test'

import { type MockBackendFixture, setupMockBackend, waitForAppReady } from './fixtures'

let fixture: MockBackendFixture | null = null

test.beforeAll(async () => {
  fixture = await setupMockBackend()
  await waitForAppReady(fixture, 120_000)
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test('window and pane chrome stay readable at 100% zoom', async () => {
  const page = fixture!.page
  const titlebarControls = page.locator('[data-size="icon-titlebar"]:visible')

  expect(await titlebarControls.count()).toBeGreaterThanOrEqual(4)

  for (const control of await titlebarControls.all()) {
    const box = await control.boundingBox()

    expect(box?.width).toBeGreaterThanOrEqual(32)
    expect(box?.height).toBeGreaterThanOrEqual(32)
  }

  const firstTitlebarIcon = titlebarControls.first().locator('.codicon, svg').first()
  const titlebarIconSize = await firstTitlebarIcon.evaluate(element => {
    const box = element.getBoundingClientRect()

    return Math.min(box.width, box.height)
  })

  expect(titlebarIconSize).toBeGreaterThanOrEqual(16)

  await page.keyboard.press('Control+`')

  const strip = page.locator('[data-zone-tabstrip]').filter({ has: page.locator('[data-tree-tab="terminal"]') })
  const collapse = strip.locator('button:has(.codicon-chevron-up)')

  await expect(collapse).toBeVisible()

  const collapseBox = await collapse.boundingBox()

  expect(collapseBox?.width).toBeGreaterThanOrEqual(32)
  expect(collapseBox?.height).toBeGreaterThanOrEqual(32)

  await collapse.click()

  const restore = strip.locator('button:has(.codicon-chevron-down)')

  await expect(restore).toBeVisible()
  await restore.click()
  await expect(collapse).toBeVisible()
})
