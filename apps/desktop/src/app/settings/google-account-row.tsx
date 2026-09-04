// google-account-row.tsx — hàng "Google (tài khoản Google)" trong trang Tài khoản của Cài đặt.
// Thuộc vỏ Hermes Vietnamese: nói chuyện với cầu nối ở Electron main qua window.hermesDesktop.google,
// lõi Hermes chỉ thấy một custom endpoint. Không hiện khi không chạy trong desktop.

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DesktopGoogleBridgeStatus } from '@/global'
import { useI18n } from '@/i18n'
import { Check, Loader2 } from '@/lib/icons'

type Status = DesktopGoogleBridgeStatus

function bridge() {
  return typeof window !== 'undefined' ? window.hermesDesktop?.google ?? null : null
}

export function GoogleAccountRow({ onChanged }: { onChanged?: () => void }) {
  const { t } = useI18n()
  const g = t.settings.providers.googleAccount
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<'in' | 'out' | 'default' | 'project' | null>(null)
  const [project, setProject] = useState('')

  const refresh = useCallback(async () => {
    const api = bridge()

    if (!api) {
      return
    }

    try {
      setStatus(await api.status())
    } catch {
      /* không có cầu nối */
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const api = bridge()

  if (!api || !status || !status.available) {
    return null
  }

  const run = async (kind: 'in' | 'out' | 'default') => {
    setBusy(kind)

    try {
      const next = kind === 'in' ? await api.signIn() : kind === 'out' ? await api.signOut() : await api.activate()
      setStatus(next)
      onChanged?.()
    } finally {
      setBusy(null)
    }
  }

  const saveProject = async () => {
    setBusy('project')

    try {
      setStatus(await api.setProject(project.trim() || null))
      onChanged?.()
    } finally {
      setBusy(null)
    }
  }

  // Một số tài khoản được Google xếp vào bậc đòi dự án Google Cloud; khi đó cho nhập mã dự án.
  const needsProject = status.signedIn && Boolean(status.lastError) && !status.serverPort

  return (
    <div className="grid gap-2 rounded-[6px] px-3 py-2.5" data-testid="google-account-row">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[length:var(--conversation-text-font-size)] font-semibold">{g.title}</span>
            {status.signedIn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-(--ui-control-hover-background) px-2 py-0.5 text-[11px] text-muted-foreground">
                <Check className="size-3" />
                {g.connected}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status.signedIn
              ? [status.email, status.tier ? `${g.tierLabel}: ${status.tier}` : null].filter(Boolean).join(' · ')
              : g.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status.signedIn ? (
            <>
              <Button disabled={busy !== null} onClick={() => void run('default')} size="sm" type="button" variant="outline">
                {busy === 'default' ? <Loader2 className="size-3.5 animate-spin" /> : g.makeDefault}
              </Button>
              <Button disabled={busy !== null} onClick={() => void run('out')} size="sm" type="button" variant="text">
                {busy === 'out' ? <Loader2 className="size-3.5 animate-spin" /> : g.signOut}
              </Button>
            </>
          ) : (
            <Button disabled={busy !== null} onClick={() => void run('in')} size="sm" type="button" variant="outline">
              {busy === 'in' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> {g.signingIn}
                </>
              ) : (
                g.signIn
              )}
            </Button>
          )}
        </div>
      </div>
      {status.lastError && (
        <p className="text-xs leading-5 text-destructive">
          {g.errorPrefix}: {status.lastError}
        </p>
      )}
      {needsProject && (
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-[6px] bg-(--ui-bg-quaternary) px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            onChange={event => setProject(event.target.value)}
            placeholder={g.projectPlaceholder}
            value={project || status.projectOverride || ''}
          />
          <Button disabled={busy !== null} onClick={() => void saveProject()} size="sm" type="button" variant="outline">
            {busy === 'project' ? <Loader2 className="size-3.5 animate-spin" /> : g.projectSave}
          </Button>
        </div>
      )}
      <p className="text-[11px] leading-4 text-(--ui-text-tertiary)">{g.caveat}</p>
    </div>
  )
}
