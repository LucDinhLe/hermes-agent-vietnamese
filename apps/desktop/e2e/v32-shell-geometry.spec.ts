import type { Locator, Page } from '@playwright/test'
import * as fs from 'node:fs'

import { MOCK_REPLY } from './mock-server'
import { expect, test } from './test'
import {
  type ContractViewport,
  setupV32ShellContract,
  type V32ShellContractFixture
} from './v32-shell-contract-fixture'

const VIEWPORTS: ContractViewport[] = [
  { height: 800, width: 1280 },
  { height: 800, width: 1000 }
]

const EXPECTED_NAVIGATION = [
  ['new-session', 'Phiên mới'],
  ['projects', 'Dự án'],
  ['hermes-vietnamese:usage-nav', 'Thống kê sử dụng'],
  ['skills', 'Kỹ năng'],
  ['messaging', 'Nhắn tin'],
  ['artifacts', 'Tệp kết quả'],
  ['cron', 'Tác vụ định kỳ']
] as const

interface Box {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

async function visibleBox(locator: Locator): Promise<Box> {
  await expect(locator).toBeVisible()

  const box = await locator.boundingBox()

  expect(box).not.toBeNull()

  return {
    bottom: box!.y + box!.height,
    height: box!.height,
    left: box!.x,
    right: box!.x + box!.width,
    top: box!.y,
    width: box!.width
  }
}

function expectNear(actual: number, expected: number, tolerance = 2): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

function expectContained(inner: Box, outer: Box, tolerance = 1): void {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance)
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance)
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance)
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance)
}

async function assertHomeHeroFitsWorkspace(page: Page, viewport: ContractViewport): Promise<void> {
  const workspace = await visibleBox(page.locator('[data-tree-group="grp-main"]'))
  const wordmark = page.getByLabel('HERMES VIETNAMESE', { exact: true })
  const metrics = await wordmark.evaluate(element => {
    const text = element.querySelector(':scope > span:not([aria-hidden]) > span')

    if (!(text instanceof HTMLElement)) {
      return null
    }

    const range = document.createRange()

    range.selectNodeContents(text)
    const textBox = range.getBoundingClientRect()

    return {
      fontSize: Number.parseFloat(getComputedStyle(text).fontSize),
      left: textBox.left,
      right: textBox.right
    }
  })

  expect(metrics).not.toBeNull()
  expect(metrics!.left).toBeGreaterThanOrEqual(workspace.left + 4)
  expect(metrics!.right).toBeLessThanOrEqual(workspace.right - 4)
  expect(metrics!.fontSize).toBeGreaterThanOrEqual(viewport.width >= 1200 ? 44 : 32)
}

async function assertThreeRegionGeometry(page: Page, viewport: ContractViewport): Promise<void> {
  const actualViewport = await page.evaluate(() => ({
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth
  }))

  expect(actualViewport.width).toBe(viewport.width)
  expect(actualViewport.height).toBe(viewport.height)
  expect(actualViewport.scrollWidth).toBeLessThanOrEqual(viewport.width + 1)

  const root = await visibleBox(page.locator('[data-tree-split="spl-root"]'))
  const sessions = await visibleBox(page.locator('[data-tree-group="grp-sessions"]'))
  const workspace = await visibleBox(page.locator('[data-tree-group="grp-main"]'))
  const rightRail = await visibleBox(page.locator('[data-tree-split="spl-right"]'))
  const chat = await visibleBox(page.locator('[data-chat-surface]').first())
  const composer = await visibleBox(page.locator('[data-slot="composer-root"]').first())

  expectNear(root.width, viewport.width, 1)
  expectNear(sessions.left, root.left, 1)
  expectNear(rightRail.right, root.right, 1)

  for (const region of [sessions, workspace, rightRail]) {
    expectNear(region.top, root.top, 1)
    expectNear(region.bottom, root.bottom, 1)
    expect(region.width).toBeGreaterThan(0)
    expect(region.height).toBeGreaterThan(0)
  }

  const leftSash = workspace.left - sessions.right
  const rightSash = rightRail.left - workspace.right

  expect(leftSash).toBeGreaterThanOrEqual(-1)
  expect(leftSash).toBeLessThanOrEqual(6)
  expect(rightSash).toBeGreaterThanOrEqual(-1)
  expect(rightSash).toBeLessThanOrEqual(6)
  // The accepted V32 workspace keeps the sessions rail compact and gives the
  // shared Files/Browser surface about 27% of the window. This is the fresh
  // profile default; a user's persisted sash override remains authoritative.
  expect(sessions.width).toBeGreaterThanOrEqual(237)
  expect(sessions.width).toBeLessThanOrEqual(360)
  const expectedRightRailWidth = Math.min(36 * 16, Math.max(15 * 16, viewport.width * 0.27))

  expectNear(rightRail.width, expectedRightRailWidth, 2)
  expect(workspace.width).toBeGreaterThanOrEqual(Math.max(300, viewport.width * 0.22))

  expectContained(chat, workspace)
  expectContained(composer, chat)
  expect(composer.width).toBeGreaterThan(300)

  const composerOverflow = await page
    .locator('[data-slot="composer-root"]')
    .first()
    .evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }))

  expect(composerOverflow.scrollWidth).toBeLessThanOrEqual(composerOverflow.clientWidth + 1)
}

async function assertSidebarContract(page: Page): Promise<void> {
  const nav = page.locator('[data-tree-group="grp-sessions"] [data-sidebar-nav-id]')

  await expect(nav).toHaveCount(EXPECTED_NAVIGATION.length)
  expect(await nav.evaluateAll(rows => rows.map(row => row.getAttribute('data-sidebar-nav-id')))).toEqual(
    EXPECTED_NAVIGATION.map(([id]) => id)
  )

  for (const [id, label] of EXPECTED_NAVIGATION) {
    const directRow = page.locator(`[data-tree-group="grp-sessions"] [data-sidebar-nav-id="${id}"]`)

    await expect(directRow).toBeVisible()
    await expect(directRow.getByText(label, { exact: true })).toBeVisible()
  }

  const boxes = await nav.evaluateAll(rows =>
    rows.map(row => {
      const box = row.getBoundingClientRect()

      return { bottom: box.bottom, top: box.top }
    })
  )

  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom - 1)
  }

  const sessionArea = page.locator('[data-sessions-mode="flat"]')

  await expect(page.getByRole('textbox', { name: 'Tìm phiên' })).toBeVisible()
  await expect(sessionArea.getByText('Đã ghim', { exact: true })).toBeVisible()
  await expect(sessionArea.getByText('Shift + nhấp vào cuộc trò chuyện để ghim', { exact: true })).toBeVisible()
  await expect(sessionArea.getByText('Dự án đã ghim', { exact: true })).toBeVisible()
  await expect(sessionArea.getByText('Ghim dự án để truy cập nhanh tại đây.', { exact: true })).toBeVisible()
  await expect(sessionArea.getByText('Phiên', { exact: true })).toBeVisible()
  await expect(sessionArea.getByText('Chưa có phiên nào', { exact: true })).toBeVisible()

  await expect(page.locator('[data-slot="aui_intro"]')).toContainText('Hermes Vietnamese')
  await expect(page.locator('[data-slot="aui_intro-attribution"]')).toHaveText('Phát triển và Việt hóa bởi Lê Đình Lực')
  const workspaceTab = page.locator('[data-tree-tab="workspace"]')

  await expect(workspaceTab).toContainText('Phiên mới')
  await expect(workspaceTab.getByRole('button', { name: /^(?:Đóng|Close)$/u })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-hermes-theme', 'ember')
  await expect(page.locator('html')).toHaveAttribute('data-hermes-mode', 'light')
  expect(
    await page
      .locator('html')
      .evaluate(element => getComputedStyle(element).getPropertyValue('--theme-midground').trim())
  ).toBe('#d97316')

  const statusbar = page.locator('[data-slot="statusbar"]')

  await expect(statusbar).toContainText('v0.33.0-dev.11')
  await expect(statusbar).not.toContainText('v0.20.5')

  const visibleText = await page.locator('body').innerText()

  expect(visibleText).not.toMatch(/\bSESSIONS\b|\bBOTS\b/u)
  expect(visibleText).not.toContain('Hồ sơ tác nhân')
  await expect(page.locator('[data-tree-tab="hermes-bots:pane"]')).toHaveCount(0)
}

async function assertSessionsCloseAndRestore(page: Page): Promise<void> {
  const sessions = page.locator('[data-tree-group="grp-sessions"]')
  const close = sessions.locator('[data-tree-tab="sessions"]').getByRole('button', { name: /^(?:Đóng|Close)$/u })

  await expect(close).toBeVisible()
  await close.click()
  await expect(sessions).toBeHidden()
  await page.getByRole('button', { name: /^(?:Hiển thị thanh bên|Show sidebar)$/u }).click()
  await expect(sessions).toBeVisible()
}

async function assertSessionStripGeometry(page: Page): Promise<void> {
  const stripLocator = page.locator('[data-session-control-strip]')
  const controlsLocator = stripLocator.locator('[data-v32-control]')
  const strip = await visibleBox(stripLocator)
  const chat = await visibleBox(page.locator('[data-chat-surface]').first())
  const composer = await visibleBox(page.locator('[data-slot="composer-root"]').first())

  await expect(controlsLocator).toHaveCount(4)
  expect(
    await controlsLocator.evaluateAll(controls => controls.map(control => control.getAttribute('data-v32-control')))
  ).toEqual(['gateway', 'agents', 'context', 'model'])

  expectContained(strip, chat)
  expect(strip.bottom).toBeLessThanOrEqual(composer.top + 1)
  expect(strip.height).toBeGreaterThanOrEqual(28)
  expect(strip.height).toBeLessThanOrEqual(40)

  const controlBoxes = await controlsLocator.evaluateAll(controls =>
    controls.map(control => {
      const box = control.getBoundingClientRect()

      return {
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        top: box.top
      }
    })
  )

  for (let index = 1; index < controlBoxes.length; index += 1) {
    expect(controlBoxes[index].left).toBeGreaterThanOrEqual(controlBoxes[index - 1].right - 1)
    expectNear(controlBoxes[index].top, controlBoxes[0].top, 2)
    expectNear(controlBoxes[index].bottom, controlBoxes[0].bottom, 2)
  }

  const overflow = await stripLocator.locator('[data-v32-session-controls]').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }))

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
  await expect(stripLocator).not.toContainText(/Advisor|Giám sát/u)
}

function currentRoute(page: Page): Promise<string> {
  return page.evaluate(() => `${location.pathname}${location.search}${location.hash}`)
}

async function clickControlAndReturn(page: Page, selector: string, route: string): Promise<void> {
  await page.locator(selector).click()
  await expect.poll(() => currentRoute(page), { timeout: 20_000 }).toContain(route)
  await page.goBack()
  await expect(page.locator('[data-session-control-strip]')).toBeVisible({
    timeout: 20_000
  })
}

async function assertControlsUseRealUpstreamRoutes(page: Page): Promise<void> {
  await clickControlAndReturn(page, '[data-session-gateway-control]', '/command-center?section=system')
  await clickControlAndReturn(page, '[data-session-agents-control]', '/agents')
  await clickControlAndReturn(page, '[data-session-context-control]', '/command-center?section=usage')
  await clickControlAndReturn(page, '[data-session-model-control]', '/settings?tab=config:model')

  const projects = page.locator('[data-sidebar-nav-id="projects"]')

  await projects.click()
  await expect(projects).toHaveAttribute('data-active', 'true')
  await expect(projects).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Dự án mới' })).toBeVisible()

  await page.locator('[data-sidebar-nav-id="hermes-vietnamese:usage-nav"]').click()
  await expect.poll(() => currentRoute(page), { timeout: 20_000 }).toContain('/command-center?section=usage')
  await page.goBack()
  await expect(page.locator('[data-session-control-strip]')).toBeVisible({
    timeout: 20_000
  })
  await page.locator('[data-sidebar-nav-id="new-session"]').click()
  await expect(page.locator('[data-slot="aui_intro"]')).toContainText('Hermes Vietnamese')
}

async function assertFilesBrowserTerminalStack(
  fixture: V32ShellContractFixture,
  visualEvidencePath: string
): Promise<void> {
  const { page, viewport } = fixture
  const rightRail = page.locator('[data-tree-split="spl-right"]')
  const filesGroup = page.locator('[data-tree-group="grp-files"]')
  const terminalGroup = page.locator('[data-tree-group="grp-terminal"]')
  const filesSurface = filesGroup.getByTestId('right-sidebar-files')
  const browserSurface = filesGroup.getByTestId('right-sidebar-browser')
  const browserTab = filesGroup.getByRole('tab', {
    name: 'Trình duyệt',
    exact: true
  })
  const browserTreeTabs = page.locator('[data-tree-tab^="preview-tile:url:"]')

  const collapsedTerminal = await visibleBox(terminalGroup)

  expect(collapsedTerminal.height).toBeGreaterThanOrEqual(35)
  expect(collapsedTerminal.height).toBeLessThanOrEqual(37)
  await expect(browserTab).toHaveCount(0)
  await expect(browserTreeTabs).toHaveCount(0)
  await expect(filesSurface).toBeVisible()
  await expect(browserSurface).toBeHidden()
  await expect(page.getByText('Không có dự án nào mở', { exact: false })).toBeVisible()

  await page.keyboard.press('Control+Shift+L')
  await expect(browserTab).toBeVisible({ timeout: 20_000 })
  await expect(browserTab).toHaveAttribute('aria-selected', 'true')
  await expect(browserTreeTabs).toHaveCount(0)
  await expect(filesSurface).toBeHidden()
  await expect(browserSurface).toBeVisible()
  await expect(page.locator('[data-preview-browser="url:shared-browser-v2"]')).toBeVisible({ timeout: 20_000 })
  await expect(browserSurface.getByRole('status', { name: 'Dùng chung với agent' })).toBeVisible()
  await expect(browserSurface.getByRole('button', { name: 'Thêm thao tác trình duyệt' })).toBeVisible()

  const sharedLabel = browserSurface.locator('.preview-browser-shared-label')

  if (viewport.width >= 1200) {
    await expect(sharedLabel).toBeVisible()
  } else {
    await expect(sharedLabel).toBeHidden()
  }

  const address = browserSurface.getByRole('textbox', { name: 'Địa chỉ web' })

  await expect(address).toBeVisible()
  expect((await visibleBox(address)).width).toBeGreaterThanOrEqual(64)

  await address.fill(fixture.previewUrl)
  await address.press('Enter')

  const webview = browserSurface.locator('webview')

  await expect(webview).toBeVisible()
  await expect
    .poll(() => webview.evaluate(element => (element as HTMLElement & { getURL?: () => string }).getURL?.()), {
      timeout: 20_000
    })
    .toBe(fixture.previewUrl)

  const guestState = await webview.evaluate(async element => {
    const guest = element as HTMLElement & {
      executeJavaScript: (code: string) => Promise<{
        bodyText: string
        clientWidth: number
        scrollWidth: number
        title: string
      }>
      getURL: () => string
      getZoomFactor: () => number
    }
    const documentState = await guest.executeJavaScript(`(() => ({
      bodyText: document.body?.innerText ?? '',
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title
    }))()`)

    return {
      ...documentState,
      url: guest.getURL(),
      zoomFactor: guest.getZoomFactor()
    }
  })
  const webviewBox = await visibleBox(webview)
  const expectedZoomFactor =
    webviewBox.width >= 960 ? 1 : Math.max(0.45, Math.round((webviewBox.width / 960) * 100) / 100)

  expect(guestState.url).toBe(fixture.previewUrl)
  expect(guestState.title).toBe('Hermes Browser Fit')
  expect(guestState.bodyText).toContain('MÉP TRÁI')
  expect(guestState.bodyText).toContain('MÉP PHẢI')
  expect(guestState.scrollWidth).toBeLessThanOrEqual(guestState.clientWidth + 1)
  expectNear(guestState.zoomFactor, expectedZoomFactor, 0.02)

  // Browser must remain a right-side surface, not a `placement: main` pane.
  // Otherwise Ctrl+J falls through to Terminal instead of collapsing this rail.
  await page.keyboard.press('Control+J')
  await expect(filesGroup).toBeHidden()
  await page.keyboard.press('Control+J')
  await expect(browserSurface).toBeVisible()
  await expect
    .poll(
      () =>
        browserSurface
          .locator('webview')
          .evaluate(element => (element as HTMLElement & { getURL?: () => string }).getURL?.()),
      { timeout: 20_000 }
    )
    .toBe(fixture.previewUrl)

  await page.keyboard.press('Control+Shift+L')
  await expect(browserTab).toHaveCount(1)

  await page.keyboard.press('Control+`')
  await expect(page.locator('[data-terminal-slot]')).toBeVisible({
    timeout: 30_000
  })
  await expect(page.locator('[data-persistent-terminal] .xterm')).toBeVisible({
    timeout: 30_000
  })
  const terminalInstance = page.locator('[data-persistent-terminal] [data-terminal].visible')
  const terminalEmulator = page.locator('[data-persistent-terminal] .xterm')
  const terminalInput = terminalEmulator.locator('.xterm-helper-textarea')
  const terminalMarker = 'HERMES_V32_TERMINAL_OK'
  const markerPath = fixture.terminalMarkerPath
  const terminalCommand =
    process.platform === 'win32'
      ? `Write-Output ('HERMES_' + 'V32_TERMINAL_OK'); Set-Content -LiteralPath '${markerPath.replaceAll("'", "''")}' -Value '${terminalMarker}' -NoNewline -Encoding ascii`
      : `printf '%s\\n' '${terminalMarker}'; printf '%s' '${terminalMarker}' > '${markerPath.replaceAll("'", "'\\''")}'`

  await expect(terminalInstance).toBeVisible()
  await expect(terminalInstance.locator(':scope > .pointer-events-none.absolute.inset-0.z-10')).toHaveCount(0, {
    timeout: 30_000
  })
  expect(fs.existsSync(markerPath)).toBe(false)
  await terminalEmulator.click({ position: { x: 20, y: 20 } })
  await expect(terminalInput).toBeFocused()
  await page.keyboard.type(terminalCommand, { delay: 5 })
  await page.keyboard.press('Enter')
  await expect
    .poll(
      () => (fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8') : ''),
      { timeout: 30_000 }
    )
    .toBe(terminalMarker)

  const rail = await visibleBox(rightRail)
  const files = await visibleBox(filesGroup)
  const terminal = await visibleBox(terminalGroup)
  const slot = await visibleBox(page.locator('[data-terminal-slot]'))
  const overlay = await visibleBox(page.locator('[data-persistent-terminal]'))

  expectContained(files, rail)
  expectContained(terminal, rail)
  expectNear(files.left, terminal.left, 1)
  expectNear(files.right, terminal.right, 1)
  expect(terminal.top).toBeGreaterThanOrEqual(files.bottom - 1)
  expect(terminal.top - files.bottom).toBeLessThanOrEqual(3)
  expect(terminal.height).toBeGreaterThanOrEqual(120)
  expectNear(slot.left, overlay.left, 1)
  expectNear(slot.top, overlay.top, 1)
  expectNear(slot.width, overlay.width, 1)
  expectNear(slot.height, overlay.height, 1)
  await expect(page.locator('[data-preview-browser="url:shared-browser-v2"]')).toBeVisible()
  await expect(page.locator('[data-tree-tab="workspace"]')).toContainText('Phiên mới')
  await expect(
    page.locator('[data-tree-tab="workspace"]').getByRole('button', { name: /^(?:Đóng|Close)$/u })
  ).toBeVisible()
  await expect(page.locator('[data-sidebar-nav-id="projects"]')).not.toHaveAttribute('data-active', 'true')
  await expect(page.locator('[data-sidebar-nav-id="hermes-vietnamese:usage-nav"]')).not.toHaveAttribute(
    'data-active',
    'true'
  )
  await page.mouse.move(viewport.width / 2, viewport.height / 2)

  const compositedWindowPng = await fixture.app.evaluate(
    async ({ BrowserWindow, desktopCapturer }, target) => {
      const window = BrowserWindow.getAllWindows()[0]

      if (!window) {
        throw new Error('Hermes Electron window is unavailable for the visual contract capture')
      }

      const sources = await desktopCapturer.getSources({
        thumbnailSize: target,
        types: ['window']
      })
      const title = window.getTitle()
      const matches = sources.filter((candidate: (typeof sources)[number]) => candidate.name === title)
      const source = matches.length === 1 ? matches[0] : undefined

      if (!source || source.thumbnail.isEmpty()) {
        throw new Error(
          `Windows compositor returned ${matches.length} sources for Hermes title ${JSON.stringify(title)}`
        )
      }

      return source.thumbnail.toPNG().toString('base64')
    },
    viewport
  )

  const compositedWindowBuffer = Buffer.from(compositedWindowPng, 'base64')

  fs.writeFileSync(visualEvidencePath, compositedWindowBuffer)
  expect(compositedWindowBuffer).toMatchSnapshot(`v32-shell-ember-light-${viewport.width}x${viewport.height}.png`, {
    maxDiffPixelRatio: 0.015
  })

  const filesHeightWithTerminal = files.height

  await page.keyboard.press('Control+`')
  await expect.poll(async () => (await terminalGroup.boundingBox())?.height ?? 0).toBeLessThanOrEqual(37)
  expect((await visibleBox(filesGroup)).height).toBeGreaterThan(filesHeightWithTerminal)

  await browserTab.getByRole('button', { name: /^(Đóng|Close)$/u }).click()
  await expect(browserTab).toHaveCount(0)
  await expect(browserTreeTabs).toHaveCount(0)
  await expect(filesSurface).toBeVisible()
  await expect(browserSurface).toBeHidden()
  await expect(page.getByText('Không có dự án nào mở', { exact: false })).toBeVisible()
}

async function assertRealComposerTurn(fixture: V32ShellContractFixture): Promise<void> {
  const prompt = `Kiểm tra giao diện V32 ở ${fixture.viewport.width}x${fixture.viewport.height}`
  const composer = fixture.page.locator('[data-slot="composer-rich-input"]').first()

  await composer.click()
  await composer.type(prompt, { delay: 10 })
  await fixture.page.keyboard.press('Enter')

  // Keep a hard submit-to-provider budget. Raising this timeout hid the real
  // 4K-context fixture failure instead of surfacing it; the exact upstream
  // flow is expected to reach the isolated provider within 30 seconds.
  await expect.poll(() => fixture.mock.receivedPrompts, { timeout: 30_000 }).toContain(prompt)
  await expect(fixture.page.getByText(MOCK_REPLY, { exact: false }).last()).toBeVisible({ timeout: 60_000 })

  const composerBox = await visibleBox(fixture.page.locator('[data-slot="composer-root"]').first())
  const workspaceBox = await visibleBox(fixture.page.locator('[data-tree-group="grp-main"]'))

  expectContained(composerBox, workspaceBox)
}

for (const viewport of VIEWPORTS) {
  test.describe(`V32 shell blocking contract ${viewport.width}x${viewport.height}`, () => {
    test.describe.configure({ mode: 'serial', retries: 0 })
    test.setTimeout(180_000)

    let fixture: V32ShellContractFixture | null = null

    test.beforeAll(async () => {
      fixture = await setupV32ShellContract(viewport)
    })

    test.afterAll(async () => {
      await fixture?.cleanup()
      fixture = null
    })

    test('keeps the inherited three-zone shell usable through real upstream surfaces', async ({}, testInfo) => {
      const active = fixture!

      await test.step('three-zone geometry and composer containment', async () => {
        await assertThreeRegionGeometry(active.page, viewport)
      })

      await test.step('V32 sidebar order and Vietnamese home identity', async () => {
        await assertSidebarContract(active.page)
        await assertHomeHeroFitsWorkspace(active.page, viewport)
        await assertSessionsCloseAndRestore(active.page)
      })

      await test.step('session control strip geometry and real route clicks', async () => {
        await assertSessionStripGeometry(active.page)
        await assertControlsUseRealUpstreamRoutes(active.page)
      })

      await test.step('Files and Browser exclusivity above the Terminal deck', async () => {
        await assertFilesBrowserTerminalStack(
          active,
          testInfo.outputPath(`v32-shell-current-${viewport.width}x${viewport.height}.png`)
        )
      })

      await test.step('real composer submit through gateway and isolated mock inference', async () => {
        await assertRealComposerTurn(active)
      })
    })
  })
}
