import { atom, computed } from 'nanostores'

import { persistentAtom } from '@/lib/persisted'
import { normalize } from '@/lib/text'

import {
  $rightRailActiveTabId,
  $rightSidebarView,
  type RightRailTabId,
  selectRightRailTab,
  setFileBrowserOpen,
  setRightSidebarView
} from './layout'

/**
 * PREVIEW RAIL — one list of tabs, one way in.
 *
 * Everything the rail can show is a `PreviewTarget` in `$previewTabs`: a file
 * on disk, a live URL, or a generated artifact. There is no privileged "live
 * preview" slot alongside the tabs; `openPreview` is the only entry point, so
 * a tool result, a file-browser click, and an artifact card all travel the
 * same road and behave identically once open.
 *
 * Tabs are global and outlive the session that created them, like tabs
 * anywhere else — they close when you close them.
 */

export interface PreviewTarget {
  binary?: boolean
  byteSize?: number
  /** Inline image bytes (a `data:` URL) when the renderer already holds them —
   * e.g. a pasted/dropped screenshot whose only on-disk copy is a transient
   * path the preview can't reliably re-read. Rendered directly and NOT
   * persisted (it would bloat localStorage). */
  dataUrl?: string
  /** `artifact` targets have nothing behind them on disk or on the network —
   * `url` is an id into the artifact registry, which owns the content. They
   * are what lets the rail preview generated HTML the workspace never saw. */
  kind: 'artifact' | 'file' | 'url'
  label: string
  large?: boolean
  language?: string
  mimeType?: string
  path?: string
  previewKind?: 'binary' | 'html' | 'image' | 'pdf' | 'text'
  renderMode?: 'preview' | 'source'
  source: string
  /** Runtime-only target that cannot be restored from persisted state. */
  transient?: boolean
  url: string
}

export interface PreviewServerRestart {
  message?: string
  status: 'complete' | 'error' | 'running'
  taskId: string
  url: string
}

/** Where an open came from. Only affects how an HTML file is first rendered:
 *  browsing files is "peek at the source", a tool/link handing you something is
 *  "run it". Not a separate code path — just a property of the target. */
export type PreviewRecordSource = 'explicit-link' | 'file-browser' | 'manual' | 'tool-result'

export interface PreviewTab {
  id: RightRailTabId
  target: PreviewTarget
}

const TABS_STORAGE_KEY = 'hermes.desktop.previewTabs.v2'
/** Superseded by the tab list above; cleared so it can't leak forever. */
const LEGACY_SESSION_REGISTRY_KEY = 'hermes.desktop.sessionPreviews.v1'
// Keep the first Browser id stable so existing installs retain their page and
// cookies. Extra tabs extend it with a numeric suffix.
export const SHARED_BROWSER_TAB_ID: RightRailTabId = 'url:shared-browser-v2'
export const SHARED_BROWSER_HOME = 'https://www.google.com/'

function nextBrowserTabId(tabs: PreviewTab[]): RightRailTabId {
  if (!tabs.some(tab => tab.id === SHARED_BROWSER_TAB_ID)) {
    return SHARED_BROWSER_TAB_ID
  }

  let ordinal = 2

  while (tabs.some(tab => tab.id === `${SHARED_BROWSER_TAB_ID}:${ordinal}`)) {
    ordinal += 1
  }

  return `${SHARED_BROWSER_TAB_ID}:${ordinal}`
}

function isPreviewTarget(value: unknown): value is PreviewTarget {
  if (!value || typeof value !== 'object') {
    return false
  }

  const r = value as Record<string, unknown>

  return (
    (r.kind === 'artifact' || r.kind === 'file' || r.kind === 'url') &&
    typeof r.label === 'string' &&
    typeof r.source === 'string' &&
    typeof r.url === 'string'
  )
}

// Artifact tabs are never written (their registry is memory-only), so a
// restored artifact row is stale storage — drop it rather than reviving a tab
// with nothing behind it.
function isPreviewTab(value: unknown): value is PreviewTab {
  if (!value || typeof value !== 'object') {
    return false
  }

  const r = value as Record<string, unknown>

  return typeof r.id === 'string' && (r.id.startsWith('file:') || r.id.startsWith('url:')) && isPreviewTarget(r.target)
}

function isPdfFileTarget(target: PreviewTarget): boolean {
  if (target.kind !== 'file') {
    return false
  }

  if (target.mimeType?.toLowerCase() === 'application/pdf') {
    return true
  }

  if ([target.path, target.source].some(value => (value ? /\.pdf$/i.test(value) : false))) {
    return true
  }

  try {
    return /\.pdf$/i.test(new URL(target.url).pathname)
  } catch {
    return false
  }
}

/** Upgrade tabs persisted by builds that classified PDFs as generic binary.
 * Without this restore-time migration, an already-open PDF keeps taking the
 * obsolete raw-binary path after Desktop itself has been upgraded. */
export function decodePreviewTabs(raw: string): PreviewTab[] {
  const parsed = JSON.parse(raw) as unknown

  const tabs = (Array.isArray(parsed) ? parsed.filter(isPreviewTab) : []).map(tab =>
    isPdfFileTarget(tab.target) && tab.target.previewKind === 'binary'
      ? { ...tab, target: { ...tab.target, previewKind: 'pdf' as const } }
      : tab
  )

  // URL rows written before Browser tabs existed carried one id per address.
  // Rekey those legacy rows while preserving every page and any already-new
  // ids, resolving duplicates defensively as we go.
  return tabs.reduce<PreviewTab[]>((restored, tab) => {
    if (tab.target.kind !== 'url') {
      return [...restored, tab]
    }

    const isCurrentBrowserId = tab.id === SHARED_BROWSER_TAB_ID || tab.id.startsWith(`${SHARED_BROWSER_TAB_ID}:`)
    const id = isCurrentBrowserId && !restored.some(item => item.id === tab.id) ? tab.id : nextBrowserTabId(restored)

    return [...restored, { ...tab, id }]
  }, [])
}

export const $previewTabs = persistentAtom<PreviewTab[]>(TABS_STORAGE_KEY, [], {
  decode: decodePreviewTabs,
  // Inline bytes are not restorable. Strip them from images, and skip remote
  // HTML and artifact tabs that cannot render without their in-memory payload.
  encode: tabs =>
    JSON.stringify(
      tabs.filter(
        tab =>
          tab.target.kind !== 'artifact' &&
          !tab.target.transient &&
          !(tab.target.previewKind === 'html' && tab.target.dataUrl)
      ),
      (key, value) => (key === 'dataUrl' ? undefined : value)
    )
})

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(LEGACY_SESSION_REGISTRY_KEY)
  } catch {
    // Storage access can throw in locked-down contexts; nothing depends on it.
  }
}

/** The tab the rail actually shows. A stale or missing selection falls back to
 *  the first tab, so the strip, `⌘W`, and the pane never disagree about which
 *  tab is on screen. */
function resolveActiveTab(tabs: PreviewTab[], activeTabId: RightRailTabId | null): PreviewTab | null {
  return tabs.find(tab => tab.id === activeTabId) ?? tabs[0] ?? null
}

function activePreviewTab(): PreviewTab | null {
  return resolveActiveTab($previewTabs.get(), $rightRailActiveTabId.get())
}

// A restored active id whose tab didn't survive validation would leave the rail
// pointing at nothing.
selectRightRailTab(activePreviewTab()?.id ?? null)

/** The target the rail is currently showing, or null when it has no tabs. */
export const $previewTarget = computed(
  [$previewTabs, $rightRailActiveTabId],
  (tabs, activeTabId) => resolveActiveTab(tabs, activeTabId)?.target ?? null
)

/** Raw `source` strings of every open tab, for the composer rows that toggle a
 *  preview open and closed by the target they were handed. */
export const $previewTabSources = computed($previewTabs, tabs => tabs.map(tab => tab.target.source))

export const $previewReloadRequest = atom(0)
export const $previewServerRestart = atom<PreviewServerRestart | null>(null)
export const $previewServerRestartStatus = computed($previewServerRestart, restart => restart?.status ?? 'idle')

export function previewTabId(target: PreviewTarget): RightRailTabId {
  return target.kind === 'url' ? SHARED_BROWSER_TAB_ID : `${target.kind}:${target.url}`
}

// Browsing files is "peek at the source"; a tool or an explicit link handing
// you an HTML file means "run it".
function isFilePreviewSource(source: PreviewRecordSource): boolean {
  return source === 'file-browser' || source === 'manual'
}

function previewTargetForSource(target: PreviewTarget, source: PreviewRecordSource): PreviewTarget {
  if (target.kind !== 'file' || target.previewKind !== 'html' || target.renderMode === 'source') {
    return target
  }

  return { ...target, renderMode: isFilePreviewSource(source) ? 'source' : 'preview' }
}

/** Open (or re-front) the tab for `target`. Re-opening an existing tab refreshes
 *  its target so a stale label/path can't outlive the thing it points at. The
 *  only way anything reaches a preview. */
export function openPreview(target: PreviewTarget, source: PreviewRecordSource = 'manual') {
  const resolved = previewTargetForSource(target, source)
  const current = $previewTabs.get()
  const activeId = $rightRailActiveTabId.get()
  const activeBrowser = current.find(tab => tab.id === activeId && tab.target.kind === 'url')
  const existingBrowser = current.find(tab => tab.target.kind === 'url')

  const id =
    resolved.kind === 'url'
      ? (activeBrowser?.id ?? existingBrowser?.id ?? nextBrowserTabId(current))
      : previewTabId(resolved)

  const index = current.findIndex(tab => tab.id === id)
  const tab: PreviewTab = { id, target: resolved }

  $previewTabs.set(index === -1 ? [...current, tab] : current.map((item, i) => (i === index ? tab : item)))
  selectRightRailTab(id)

  if (resolved.kind === 'url') {
    setRightSidebarView('browser')
    setFileBrowserOpen(true)
  }
}

function browserHomeTarget(): PreviewTarget {
  return {
    kind: 'url',
    label: 'Browser',
    source: SHARED_BROWSER_HOME,
    url: SHARED_BROWSER_HOME
  }
}

/** Add a distinct Browser tab at the shared home and front it. */
export function openNewBrowserTab(): void {
  const current = $previewTabs.get()
  const id = nextBrowserTabId(current)

  $previewTabs.set([...current, { id, target: browserHomeTarget() }])
  selectRightRailTab(id)
  setRightSidebarView('browser')
  setFileBrowserOpen(true)
}

/** Reveal the selected Browser without resetting its current page. The first
 * explicit open starts at the shared home. */
export function openSharedBrowser(): void {
  const current = $previewTabs.get()
  const activeId = $rightRailActiveTabId.get()

  const existing =
    current.find(tab => tab.id === activeId && tab.target.kind === 'url') ??
    current.find(tab => tab.target.kind === 'url')

  if (existing) {
    selectRightRailTab(existing.id)
    setRightSidebarView('browser')
    setFileBrowserOpen(true)

    return
  }

  openNewBrowserTab()
}

export function closeRightRailTab(tabId: string) {
  const current = $previewTabs.get()
  const index = current.findIndex(tab => tab.id === tabId)

  if (index === -1) {
    return
  }

  const next = current.filter(tab => tab.id !== tabId)
  const closingTab = current[index]

  $previewTabs.set(next)

  if ($rightRailActiveTabId.get() === tabId) {
    const candidates = closingTab.target.kind === 'url' ? next.filter(tab => tab.target.kind === 'url') : next
    const precedingPeers = current.slice(0, index).filter(tab => tab.target.kind === closingTab.target.kind).length

    selectRightRailTab(candidates[Math.min(precedingPeers, candidates.length - 1)]?.id ?? next[0]?.id ?? null)
  }

  if (next.length === 0) {
    selectRightRailTab(null)
  }

  if (closingTab.target.kind === 'url' && !next.some(tab => tab.target.kind === 'url')) {
    setRightSidebarView('files')
  }
}

/** Close the tab showing `source`, if one is open. Returns whether it closed. */
export function closePreviewForSource(source: string): boolean {
  const tab = $previewTabs.get().find(item => item.target.source === source)

  if (!tab) {
    return false
  }

  closeRightRailTab(tab.id)

  return true
}

/** Artifact tabs can't outlive the registry they read from, so clearing it
 *  closes them. File and URL tabs re-read from their source and are left alone. */
export function closeArtifactPreviewTabs() {
  for (const tab of $previewTabs.get()) {
    if (tab.target.kind === 'artifact') {
      closeRightRailTab(tab.id)
    }
  }
}

/** Close every tab so the rail's panes leave the tree. */
export function closeRightRail() {
  $previewTabs.set([])
  selectRightRailTab(null)

  if ($rightSidebarView.get() === 'browser') {
    setRightSidebarView('files')
  }
}

export function requestPreviewReload() {
  $previewReloadRequest.set($previewReloadRequest.get() + 1)
}

export function beginPreviewServerRestart(taskId: string, url: string) {
  $previewServerRestart.set({ status: 'running', taskId, url })
}

export function completePreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId) {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text,
    status: normalize(text).startsWith('error:') ? 'error' : 'complete'
  })
}

export function progressPreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text
  })
}

export function failPreviewServerRestart(taskId: string, message: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message,
    status: 'error'
  })
}
