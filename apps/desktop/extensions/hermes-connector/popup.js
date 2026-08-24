import {
  CONNECTOR_PROTOCOL as PROTOCOL,
  cookiePermissionOrigins,
  hasAnyPermissionOrigin,
  revocableCookiePermissionOrigins,
  readCookieTransferPreview,
  revokeCookiePermissions
} from './cookie-transfer.js'

const LOOPBACK_PERMISSION = 'http://127.0.0.1/*'
const POLL_INTERVAL_MS = 500
const PAIR_TIMEOUT_MS = 120_000

const elements = {
  hostname: document.querySelector('#hostname'),
  status: document.querySelector('#status'),
  preview: document.querySelector('#preview'),
  cookieCount: document.querySelector('#cookie-count'),
  sessionCount: document.querySelector('#session-count'),
  unsupportedCount: document.querySelector('#unsupported-count'),
  expiry: document.querySelector('#expiry'),
  previewButton: document.querySelector('#preview-button'),
  pairForm: document.querySelector('#pair-form'),
  pairingCode: document.querySelector('#pairing-code'),
  revokePermission: document.querySelector('#revoke-permission')
}

let activeTab
let sourcePatterns = []
let revocableSourcePatterns = []
let transferCookies = []
let transferPreview

function message(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key
}

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage().split('-')[0]
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = message(element.dataset.i18n)
  }
}

function setStatus(key, error = false) {
  elements.status.textContent = message(key)
  elements.status.classList.toggle('error', error)
}

function setBusy(busy) {
  for (const button of document.querySelectorAll('button')) button.disabled = busy
  elements.pairingCode.disabled = busy
}

function clearSensitiveState() {
  transferCookies = []
  transferPreview = undefined
  elements.pairingCode.value = ''
}

function resetPreview() {
  elements.preview.hidden = true
  elements.pairForm.hidden = true
  elements.previewButton.hidden = false
  clearSensitiveState()
}

function parsePairingCode(raw) {
  const match = /^(\d{2,5})\.([A-Za-z0-9_-]{32})$/.exec(raw.trim())
  if (!match) throw new Error('INVALID_PAIRING_CODE')
  const port = Number(match[1])
  if (port < 1 || port > 65535) throw new Error('INVALID_PAIRING_CODE')
  return { endpoint: `http://127.0.0.1:${port}`, secret: match[2] }
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) throw new Error('NO_ACTIVE_TAB')
  const url = new URL(tab.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('UNSUPPORTED_TAB')
  return { tab, url }
}

async function cookieStoreId(tabId) {
  const stores = await chrome.cookies.getAllCookieStores()
  const store = stores.find(item => item.tabIds.includes(tabId))
  if (!store) throw new Error('COOKIE_STORE_NOT_FOUND')
  return store.id
}

async function requestSitePermission() {
  return chrome.permissions.request({ permissions: ['cookies'], origins: sourcePatterns })
}

async function previewCurrentSite() {
  setBusy(true)
  try {
    if (!(await requestSitePermission())) throw new Error('PERMISSION_DENIED')
    elements.revokePermission.hidden = false
    const storeId = await cookieStoreId(activeTab.id)
    const summary = await readCookieTransferPreview(chrome.cookies, {
      url: activeTab.url,
      storeId,
      userAgent: navigator.userAgent
    })
    if (summary.importable.length === 0) throw new Error('NO_IMPORTABLE_COOKIES')

    transferCookies = summary.importable
    transferPreview = summary.preview
    elements.cookieCount.textContent = String(summary.preview.cookieCount)
    elements.sessionCount.textContent = String(summary.preview.sessionCount)
    elements.unsupportedCount.textContent = String(summary.preview.unsupportedCount)
    elements.expiry.textContent = summary.preview.latestExpiry
      ? new Date(summary.preview.latestExpiry * 1000).toLocaleString()
      : message('sessionOnly')
    elements.preview.hidden = false
    elements.previewButton.hidden = true
    elements.pairForm.hidden = false
    elements.revokePermission.hidden = false
    setStatus('previewReady')
    elements.pairingCode.focus()
  } catch (error) {
    setStatus(error?.message === 'NO_IMPORTABLE_COOKIES' ? 'noCookies' : 'previewFailed', true)
    resetPreview()
  } finally {
    setBusy(false)
  }
}

async function connectorFetch(url, init = {}) {
  return fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'X-Hermes-Connector': '1', ...(init.headers || {}) }
  })
}

async function waitForApproval(endpoint, attemptId, receiptToken) {
  const deadline = Date.now() + PAIR_TIMEOUT_MS
  while (Date.now() < deadline) {
    const response = await connectorFetch(`${endpoint}/v1/status?attemptId=${encodeURIComponent(attemptId)}`, {
      headers: { Authorization: `Bearer ${receiptToken}` }
    })
    const body = await response.json()
    if (response.ok && body.transferToken) return body.transferToken
    if (response.status !== 202) throw new Error('PAIR_REJECTED')
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error('PAIR_EXPIRED')
}

async function submitPairing(event) {
  event.preventDefault()
  setBusy(true)
  try {
    if (!transferPreview || transferCookies.length === 0) throw new Error('PREVIEW_REQUIRED')
    const { endpoint, secret } = parsePairingCode(elements.pairingCode.value)
    if (!(await chrome.permissions.request({ origins: [LOOPBACK_PERMISSION] }))) {
      throw new Error('PERMISSION_DENIED')
    }

    setStatus('waitingForHermes')
    const pairResponse = await connectorFetch(`${endpoint}/v1/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hermes-Pairing-Code': secret },
      body: JSON.stringify(transferPreview)
    })
    const pairBody = await pairResponse.json()
    if (!pairResponse.ok) throw new Error('PAIR_REJECTED')

    const transferToken = await waitForApproval(endpoint, pairBody.attemptId, pairBody.receiptToken)
    const transferResponse = await connectorFetch(`${endpoint}/v1/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${transferToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocol: PROTOCOL,
        hostname: transferPreview.hostname,
        cookies: transferCookies
      })
    })
    if (!transferResponse.ok) throw new Error('TRANSFER_REJECTED')

    setStatus('transferComplete')
    elements.pairForm.hidden = true
  } catch (error) {
    const key = error?.message === 'PAIR_EXPIRED' ? 'pairExpired' : 'transferFailed'
    setStatus(key, true)
  } finally {
    clearSensitiveState()
    setBusy(false)
  }
}

async function revokeCurrentSitePermission() {
  setBusy(true)
  resetPreview()
  try {
    await revokeCookiePermissions(chrome.permissions, {
      origins: revocableSourcePatterns,
      transportOrigins: [LOOPBACK_PERMISSION]
    })
    elements.revokePermission.hidden = true
    setStatus('permissionRevoked')
  } catch {
    let hasPermission = true
    try {
      hasPermission = await hasAnyPermissionOrigin(chrome.permissions, revocableSourcePatterns)
    } catch {
      // Keep Revoke visible when Chrome cannot prove the target grants are gone.
    }
    elements.revokePermission.hidden = !hasPermission
    setStatus('permissionRevokeFailed', true)
  } finally {
    setBusy(false)
  }
}

async function initialize() {
  localize()
  try {
    const current = await currentTab()
    activeTab = current.tab
    sourcePatterns = cookiePermissionOrigins(current.url)
    revocableSourcePatterns = revocableCookiePermissionOrigins(current.url)
    elements.hostname.textContent = current.url.hostname
    const hasPermission = await hasAnyPermissionOrigin(chrome.permissions, revocableSourcePatterns)
    elements.revokePermission.hidden = !hasPermission
  } catch {
    elements.previewButton.disabled = true
    setStatus('unsupportedPage', true)
  }
}

elements.previewButton.addEventListener('click', previewCurrentSite)
elements.pairForm.addEventListener('submit', submitPairing)
elements.revokePermission.addEventListener('click', revokeCurrentSitePermission)
window.addEventListener('unload', clearSensitiveState)
void initialize()
