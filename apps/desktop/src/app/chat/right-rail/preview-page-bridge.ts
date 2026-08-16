import type { PreviewInteractiveElement, PreviewInteractOptions, PreviewInteractResult } from './preview-reader'

export interface PreviewWebviewBridge {
  canGoBack?: () => boolean
  canGoForward?: () => boolean
  executeJavaScript?: (code: string) => Promise<unknown>
  getTitle?: () => string
  getURL?: () => string
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
}

export interface PreviewPageSnapshot {
  elements: PreviewInteractiveElement[]
  text: string
  title: string
  url: string
}

const snapshotScript = String.raw`(() => {
  const refAttribute = 'data-hermes-preview-ref'
  const isVisible = element => {
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0
  }
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240)
  const labelledBy = element => clean((element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '))
  const labelText = element => {
    if (element.labels?.length) return clean(Array.from(element.labels).map(label => label.textContent || '').join(' '))
    const id = element.id
    if (id) return clean(document.querySelector('label[for="' + CSS.escape(id) + '"]')?.textContent || '')
    return clean(element.closest('label')?.textContent || '')
  }
  const roleOf = element => {
    const explicit = clean(element.getAttribute('role'))
    if (explicit) return explicit
    const tag = element.tagName.toLowerCase()
    if (tag === 'a') return 'link'
    if (tag === 'button') return 'button'
    if (tag === 'select') return 'combobox'
    if (tag === 'textarea') return 'textbox'
    if (tag === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase()
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'submit' || type === 'button') return 'button'
      return type === 'password' ? 'password' : 'textbox'
    }
    return element.isContentEditable ? 'textbox' : 'control'
  }
  const nameOf = element => clean(
    element.getAttribute('aria-label') ||
    labelledBy(element) ||
    labelText(element) ||
    element.getAttribute('alt') ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder') ||
    (element.tagName === 'INPUT' && (element.getAttribute('type') || '').toLowerCase() !== 'password' ? element.getAttribute('value') : '') ||
    element.textContent
  )

  document.querySelectorAll('[' + refAttribute + ']').forEach(element => element.removeAttribute(refAttribute))
  const selector = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[contenteditable="true"],[tabindex]'
  const elements = Array.from(document.querySelectorAll(selector)).filter(isVisible).slice(0, 500).map((element, index) => {
    const rawRef = 'p' + (index + 1)
    element.setAttribute(refAttribute, rawRef)
    return {
      disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
      name: nameOf(element),
      ref: '@' + rawRef,
      role: roleOf(element)
    }
  })

  return { elements, text: document.body ? document.body.innerText : '' }
})()`

function pageIdentity(webview: PreviewWebviewBridge): Pick<PreviewInteractResult, 'title' | 'url'> {
  return {
    title: webview.getTitle?.() ?? '',
    url: webview.getURL?.() ?? ''
  }
}

function result(
  webview: PreviewWebviewBridge,
  action: PreviewInteractOptions['action'],
  ok: boolean,
  message: string
): PreviewInteractResult {
  return { action, message, ok, ...pageIdentity(webview) }
}

function normalizedRef(ref: string | undefined): string {
  const value = (ref || '').trim().replace(/^@/, '')

  return /^p\d+$/.test(value) ? value : ''
}

function elementActionScript(action: 'click' | 'type', rawRef: string, text = ''): string {
  return `(() => {
    const element = document.querySelector('[data-hermes-preview-ref="${rawRef}"]')
    if (!element) return { ok: false, message: ${JSON.stringify(`Element @${rawRef} is stale. Read the page again.`)} }
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return { ok: false, message: ${JSON.stringify(`Element @${rawRef} is disabled.`)} }
    element.scrollIntoView({ block: 'center', inline: 'nearest' })
    element.focus()
    ${
      action === 'click'
        ? `element.click(); return { ok: true, message: ${JSON.stringify(`Clicked @${rawRef}.`)} }`
        : `
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'password') {
      return { ok: false, message: 'Password fields must be filled by the user.' }
    }
    const value = ${JSON.stringify(text)}
    if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter ? setter.call(element, value) : (element.value = value)
    } else if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter ? setter.call(element, value) : (element.value = value)
    } else if (element instanceof HTMLSelectElement) {
      element.value = value
    } else if (element.isContentEditable) {
      element.textContent = value
    } else {
      return { ok: false, message: ${JSON.stringify(`Element @${rawRef} does not accept text.`)} }
    }
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, message: ${JSON.stringify(`Entered text in @${rawRef}.`)} }
    `
    }
  })()`
}

export async function readPreviewWebview(webview: PreviewWebviewBridge): Promise<PreviewPageSnapshot> {
  if (!webview.executeJavaScript) {
    throw new Error('preview webview is not ready')
  }

  const raw = (await webview.executeJavaScript(snapshotScript)) as Partial<PreviewPageSnapshot> | null

  return {
    elements: Array.isArray(raw?.elements) ? raw.elements : [],
    text: typeof raw?.text === 'string' ? raw.text : '',
    ...pageIdentity(webview)
  }
}

export async function interactPreviewWebview(
  webview: PreviewWebviewBridge,
  opts: PreviewInteractOptions
): Promise<PreviewInteractResult> {
  if (!webview.executeJavaScript) {
    return result(webview, opts.action, false, 'The Browser pane is not ready.')
  }

  if (opts.action === 'back') {
    if (webview.canGoBack?.() === false) {
      return result(webview, opts.action, false, 'No previous page is available.')
    }
    webview.goBack?.()

    return result(webview, opts.action, true, 'Went back.')
  }

  if (opts.action === 'forward') {
    if (webview.canGoForward?.() === false) {
      return result(webview, opts.action, false, 'No next page is available.')
    }
    webview.goForward?.()

    return result(webview, opts.action, true, 'Went forward.')
  }

  if (opts.action === 'reload') {
    webview.reload?.()

    return result(webview, opts.action, true, 'Reloaded the page.')
  }

  if (opts.action === 'scroll') {
    const delta = Math.max(-5000, Math.min(5000, opts.delta_y ?? 600))

    await webview.executeJavaScript(`window.scrollBy({ top: ${delta}, behavior: 'auto' })`)

    return result(webview, opts.action, true, `Scrolled ${delta} pixels.`)
  }

  if (opts.action === 'press') {
    const key = (opts.key || '').slice(0, 64)

    if (!key) {
      return result(webview, opts.action, false, 'A key is required.')
    }

    const raw = (await webview.executeJavaScript(`(() => {
      const target = document.activeElement || document.body
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ${JSON.stringify(key)} }))
      target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ${JSON.stringify(key)} }))
      if (key === 'Enter' && target instanceof HTMLInputElement && target.form) target.form.requestSubmit()
      return { ok: true, message: 'Pressed ' + ${JSON.stringify(key)} + '.' }
    })()`)) as { message?: unknown; ok?: unknown } | null

    return result(webview, opts.action, raw?.ok === true, String(raw?.message || `Pressed ${key}.`))
  }

  const ref = normalizedRef(opts.ref)

  if (!ref) {
    return result(webview, opts.action, false, 'A current element ref such as @p1 is required.')
  }

  const raw = (await webview.executeJavaScript(elementActionScript(opts.action, ref, opts.text))) as {
    message?: unknown
    ok?: unknown
  } | null

  return result(webview, opts.action, raw?.ok === true, String(raw?.message || 'The page did not answer.'))
}
