import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n'

type Props = {
  onOpenChange: (open: boolean) => void
  open: boolean
  url: string
}

function expiryLabel(epochSeconds: number | undefined, sessionOnly: string): string {
  return epochSeconds ? new Date(epochSeconds * 1000).toLocaleString() : sessionOnly
}

export function BrowserConnectorDialog({ onOpenChange, open, url }: Props) {
  const { t } = useI18n()
  const copy = t.preview.web.connector
  const api = window.hermesDesktop?.browserConnector
  const [status, setStatus] = useState<BrowserConnectorStatus | null>(null)
  const [pairing, setPairing] = useState<BrowserConnectorPairing | null>(null)
  const [imported, setImported] = useState<BrowserConnectorImportSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!api) {
      setError('CONNECTOR_UNAVAILABLE')

      return
    }

    const result = await api.status()

    if (result.ok) {
      setStatus(result.value)
    } else {
      setError(result.error)
    }
  }, [api])

  useEffect(() => {
    if (!open) {
      return
    }

    setError('')
    setImported(null)
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open || !api || !pairing || pairing.state !== 'pairing') {
      return
    }

    const timer = window.setInterval(() => {
      void api.pairingStatus(pairing.attemptId).then(result => {
        if (!result.ok) {
          setError(result.error)
          window.clearInterval(timer)

          return
        }

        setPairing(previous => ({ ...result.value, pairingCode: previous?.pairingCode }))

        if (result.value.state !== 'pairing') {
          window.clearInterval(timer)
        }
      })
    }, 500)

    return () => window.clearInterval(timer)
  }, [api, open, pairing])

  const close = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && busy) {
        return
      }

      if (!nextOpen && pairing?.attemptId) {
        void api?.cancel(pairing.attemptId)
      }

      if (!nextOpen) {
        setPairing(null)
      }

      onOpenChange(nextOpen)
    },
    [api, busy, onOpenChange, pairing]
  )

  const toggleEnabled = async () => {
    if (!api || !status) {
      return
    }

    setBusy(true)
    setError('')
    const result = await api.setEnabled(!status.enabled)

    if (!result.ok) {
      setError(result.error)
    }

    await refresh()
    setBusy(false)
  }

  const start = async () => {
    if (!api) {
      return
    }

    setBusy(true)
    setError('')
    setImported(null)
    const result = await api.start(url)

    if (result.ok) {
      setPairing(result.value)
    } else {
      setError(result.error)
    }

    setBusy(false)
  }

  const approve = async () => {
    if (!api || !pairing) {
      return
    }

    setBusy(true)
    setError('')
    const result = await api.approve(pairing.attemptId)

    if (result.ok) {
      setImported(result.value)
      setPairing(null)
      await refresh()
    } else {
      setError(result.error)
    }

    setBusy(false)
  }

  const revoke = async (importId: string) => {
    if (!api) {
      return
    }

    setBusy(true)
    setError('')
    const result = await api.revoke(importId)

    if (!result.ok) {
      setError(result.error)
    }

    await refresh()
    setBusy(false)
  }

  const preview = pairing?.preview

  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="max-h-[min(44rem,90vh)] overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {!status && !error && <p className="text-sm text-muted-foreground">{copy.loading}</p>}

        {status && (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{copy.officialExtension}</p>
                  <p className="mt-1 text-muted-foreground">
                    {status.trust.verified ? copy.trustVerified : copy.trustFailed}
                  </p>
                </div>
                <Button onClick={() => void api?.openExtensionFolder()} size="sm" type="button" variant="outline">
                  {copy.openFolder}
                </Button>
              </div>
              <dl className="mt-3 grid gap-1 text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>{copy.extensionId}</dt>
                  <dd className="font-mono text-[0.65rem] text-foreground">{status.trust.extensionId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{copy.digest}</dt>
                  <dd className="font-mono text-[0.65rem] text-foreground">{status.trust.sha256.slice(0, 16)}…</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{status.enabled ? copy.enabled : copy.disabled}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.enableDescription}</p>
                </div>
                <Button
                  disabled={busy || !status.trust.verified}
                  onClick={() => void toggleEnabled()}
                  size="sm"
                  type="button"
                  variant={status.enabled ? 'outline' : 'default'}
                >
                  {status.enabled ? copy.disable : copy.enable}
                </Button>
              </div>
            </section>

            {status.enabled && !pairing && !imported && (
              <section className="space-y-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{copy.currentSite}</p>
                  <p className="mt-1 break-all text-sm font-medium text-foreground">{new URL(url).hostname}</p>
                </div>
                <Button disabled={busy} onClick={() => void start()} type="button">
                  {copy.createCode}
                </Button>
              </section>
            )}

            {pairing && (
              <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">{preview ? copy.previewReady : copy.pairingTitle}</p>
                {!preview && (
                  <>
                    <p className="text-xs text-muted-foreground">{copy.pairingInstructions}</p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-md bg-background px-3 py-2 text-xs text-foreground">
                        {pairing.pairingCode}
                      </code>
                      <Button
                        onClick={() => void window.hermesDesktop.writeClipboard(pairing.pairingCode ?? '')}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {copy.copy}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {copy.expiresAt(new Date(pairing.expiresAt).toLocaleTimeString())}
                    </p>
                  </>
                )}

                {preview && (
                  <>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">{copy.browser}</dt>
                        <dd>{preview.browser}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.domain}</dt>
                        <dd>{preview.hostname}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.cookies}</dt>
                        <dd>{preview.cookieCount}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.sessionCookies}</dt>
                        <dd>{preview.sessionCount}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.unsupported}</dt>
                        <dd>{preview.unsupportedCount}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.expiry}</dt>
                        <dd>{expiryLabel(preview.latestExpiry, copy.sessionOnly)}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">{copy.importWarning}</p>
                    <Button disabled={busy} onClick={() => void approve()} type="button">
                      {busy ? copy.importing : copy.confirmImport(preview.cookieCount, preview.hostname)}
                    </Button>
                  </>
                )}
              </section>
            )}

            {imported && (
              <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                {copy.imported(imported.cookieCount, imported.hostname)}
                {imported.skippedUnsupported > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.skippedUnsupported(imported.skippedUnsupported)}
                  </p>
                )}
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">{copy.importedSessions}</h3>
              {status.imports.length === 0 ? (
                <p className="text-xs text-muted-foreground">{copy.noImports}</p>
              ) : (
                status.imports.map(record => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2"
                    key={record.id}
                  >
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-medium text-foreground">{record.hostname}</p>
                      <p className="text-muted-foreground">
                        {copy.importRecord(record.cookieCount, new Date(record.importedAt).toLocaleString())}
                      </p>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => void revoke(record.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {copy.revoke}
                    </Button>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground">{copy.revokeWarning}</p>
            </section>
          </div>
        )}

        {error && <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{copy.error(error)}</p>}

        <DialogFooter>
          <Button disabled={busy} onClick={() => close(false)} type="button" variant="outline">
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
