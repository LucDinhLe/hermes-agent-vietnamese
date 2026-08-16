import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { interactPreviewWebview, type PreviewWebviewBridge, readPreviewWebview } from './preview-page-bridge'

function bridge(): PreviewWebviewBridge {
  return {
    executeJavaScript: async code => window.eval(code) as unknown,
    getTitle: () => 'Shared page',
    getURL: () => 'https://example.com/form'
  }
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 20,
    height: 20,
    left: 0,
    right: 100,
    toJSON: () => ({}),
    top: 0,
    width: 100,
    x: 0,
    y: 0
  })
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('shared preview page bridge', () => {
  it('returns visible controls with refs and readable names', async () => {
    document.body.innerHTML = '<label>Email <input id="email"></label><button>Continue</button>'

    const snapshot = await readPreviewWebview(bridge())

    expect(snapshot).toMatchObject({
      elements: [
        { name: 'Email', ref: '@p1', role: 'textbox' },
        { name: 'Continue', ref: '@p2', role: 'button' }
      ],
      title: 'Shared page',
      url: 'https://example.com/form'
    })
  })

  it('types and clicks on the same DOM the user sees', async () => {
    document.body.innerHTML = '<input aria-label="Search"><button>Go</button>'
    const clicked = vi.fn()
    document.querySelector('button')?.addEventListener('click', clicked)
    await readPreviewWebview(bridge())

    await expect(
      interactPreviewWebview(bridge(), { action: 'type', ref: '@p1', text: 'Hermes' })
    ).resolves.toMatchObject({
      ok: true
    })
    await expect(interactPreviewWebview(bridge(), { action: 'click', ref: '@p2' })).resolves.toMatchObject({ ok: true })

    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Hermes')
    expect(clicked).toHaveBeenCalledOnce()
  })

  it('never lets the agent fill a password field', async () => {
    document.body.innerHTML = '<label>Password <input type="password"></label>'
    await readPreviewWebview(bridge())

    await expect(
      interactPreviewWebview(bridge(), { action: 'type', ref: '@p1', text: 'secret' })
    ).resolves.toMatchObject({
      message: expect.stringContaining('user') as string,
      ok: false
    })
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('')
  })

  it('uses the live webview history controls', async () => {
    const goBack = vi.fn()
    const reload = vi.fn()
    const webview = { ...bridge(), canGoBack: () => true, goBack, reload }

    await interactPreviewWebview(webview, { action: 'back' })
    await interactPreviewWebview(webview, { action: 'reload' })

    expect(goBack).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })
})
