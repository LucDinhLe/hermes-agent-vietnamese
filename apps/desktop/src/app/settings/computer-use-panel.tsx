import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getActionStatus, getComputerUseStatus, grantComputerUsePermissions } from '@/hermes'
import { useI18n } from '@/i18n'
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, X } from '@/lib/icons'
import { upsertDesktopActionTask } from '@/store/activity'
import { notify, notifyError } from '@/store/notifications'
import type { ComputerUseStatus } from '@/types/hermes'

import { Pill } from './primitives'

interface ComputerUsePanelProps {
  /** Re-read the parent toolset list after a permission/install change so the
   *  "Configured / Needs keys" pill stays in sync. */
  onConfiguredChange?: () => void
}

// Per-OS one-liner shown when there's no TCC grant flow (Windows/Linux). macOS
// drives the permission rows instead, so it has no entry here.
const PLATFORM_NOTE: Record<string, string> = {
  linux: 'Drives your desktop via the X11/XWayland accessibility stack — no permission prompt.',
  win32: 'First run may trigger a Windows SmartScreen prompt for the cua-driver UIAccess worker — allow it.'
}

function tone(granted: boolean | null) {
  return granted === true ? 'primary' : 'muted'
}

function GrantIcon({ granted }: { granted: boolean | null }) {
  const Icon = granted === true ? Check : granted === false ? X : AlertTriangle

  return <Icon className="size-3" />
}

function PermissionRow({ granted, label, hint }: { granted: boolean | null; label: string; hint: string }) {
  const { locale } = useI18n()
  const isVi = locale === 'vi'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/55 p-2.5">
      <div className="min-w-0">
        <span className="text-sm font-medium">{label}</span>
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>
      </div>
      <Pill tone={tone(granted)}>
        <GrantIcon granted={granted} />
        {granted === true
          ? isVi
            ? 'Đã cấp'
            : 'Granted'
          : granted === false
            ? isVi
              ? 'Chưa cấp'
              : 'Not granted'
            : isVi
              ? 'Chưa rõ'
              : 'Unknown'}
      </Pill>
    </div>
  )
}

/**
 * Cross-platform Computer Use preflight card.
 *
 * cua-driver runs on macOS, Windows, and Linux, but readiness differs: macOS
 * needs two TCC grants (Accessibility + Screen Recording) that attach to
 * cua-driver's own `com.trycua.driver` identity — not Hermes — and are
 * requested via `cua-driver permissions grant` (dialog attributed to
 * CuaDriver). Windows/Linux have no TCC toggles, so readiness is driver health
 * from `cua-driver doctor`. The backend folds both into one `ready` signal.
 *
 * Binary install/upgrade stays in the cua-driver provider's post-setup runner
 * below this card (the generic ToolsetConfigPanel).
 */
export function ComputerUsePanel({ onConfiguredChange }: ComputerUsePanelProps) {
  const { locale } = useI18n()
  const isVi = locale === 'vi'
  const [status, setStatus] = useState<ComputerUseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState(false)
  const activeRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(await getComputerUseStatus())
    } catch (err) {
      notifyError(err, isVi ? 'Không thể đọc trạng thái Computer Use' : 'Could not read Computer Use status')
    } finally {
      setLoading(false)
    }
  }, [isVi])

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    activeRef.current = true
    void refresh()

    return () => void (activeRef.current = false)
  }, [refresh])

  const grant = useCallback(async () => {
    setGranting(true)

    try {
      const started = await grantComputerUsePermissions()

      if (!started.ok) {
        notifyError(new Error('spawn failed'), isVi ? 'Không thể yêu cầu cấp quyền' : 'Could not request permissions')

        return
      }

      notify({
        kind: 'info',
        title: isVi ? 'Phê duyệt trong Cài đặt hệ thống' : 'Approve in System Settings',
        message: isVi
          ? 'macOS sẽ hiện hộp thoại cấp quyền cho CuaDriver. Hãy phê duyệt rồi quay lại đây.'
          : 'macOS will show a permission dialog attributed to CuaDriver. Approve it, then return here.'
      })

      // The driver waits for the user to flip the switch — poll until it exits.
      for (let attempt = 0; attempt < 150 && activeRef.current; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 1500))

        if (!activeRef.current) {
          break
        }

        const polled = await getActionStatus(started.name, 200)
        upsertDesktopActionTask(polled)

        if (!polled.running) {
          break
        }
      }

      if (activeRef.current) {
        await refresh()
        onConfiguredChange?.()
      }
    } catch (err) {
      if (activeRef.current) {
        notifyError(err, isVi ? 'Không thể yêu cầu cấp quyền' : 'Could not request permissions')
      }
    } finally {
      if (activeRef.current) {
        setGranting(false)
      }
    }
  }, [isVi, onConfiguredChange, refresh])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {isVi ? 'Đang kiểm tra trạng thái Computer Use…' : 'Checking Computer Use status…'}
      </div>
    )
  }

  if (!status) {
    return null
  }

  if (!status.platform_supported) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        {isVi ? 'Computer Use chưa hỗ trợ nền tảng này' : "Computer Use isn't supported on this platform"} (
        {status.platform}).
      </p>
    )
  }

  if (!status.installed) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        {isVi
          ? 'Hãy cài dịch vụ cua-driver bên dưới để điều khiển máy này.'
          : 'Install the cua-driver backend below to drive this machine.'}
        {status.can_grant &&
          (isVi
            ? ' Sau đó cấp quyền Accessibility và Screen Recording tại đây.'
            : ' Then grant Accessibility and Screen Recording here.')}
      </p>
    )
  }

  const failingChecks = status.checks.filter(c => c.status !== 'ok')

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          {status.can_grant ? (
            <p className="text-[0.72rem] text-muted-foreground">
              {isVi
                ? 'Quyền được cấp cho định danh riêng của CuaDriver (com.trycua.driver), nên macOS sẽ ghi tên tiến trình điều khiển máy thay vì Hermes.'
                : "Grants attach to CuaDriver's own identity (com.trycua.driver), not Hermes — so the dialog is attributed to the process that drives your Mac."}
            </p>
          ) : (
            <p className="text-[0.72rem] text-muted-foreground">
              {isVi
                ? status.platform === 'linux'
                  ? 'Điều khiển Desktop qua lớp trợ năng X11/XWayland, không cần hộp thoại cấp quyền.'
                  : status.platform === 'win32'
                    ? 'Lần chạy đầu có thể hiện cảnh báo Windows SmartScreen cho cua-driver UIAccess — hãy cho phép.'
                    : ''
                : (PLATFORM_NOTE[status.platform] ?? '')}
            </p>
          )}
          {status.version && <p className="text-[0.68rem] text-muted-foreground/80">{status.version}</p>}
        </div>
        <Button onClick={() => void refresh()} size="sm" variant="text">
          <RefreshCw className="size-3.5" />
          {isVi ? 'Kiểm tra lại' : 'Recheck'}
        </Button>
      </div>

      {status.can_grant ? (
        <>
          <PermissionRow
            granted={status.accessibility}
            hint={
              isVi
                ? 'Cho phép cua-driver nhấp chuột, gõ phím và đọc cây trợ năng.'
                : 'Lets cua-driver post clicks, keystrokes, and read the accessibility tree.'
            }
            label={isVi ? 'Trợ năng' : 'Accessibility'}
          />
          <PermissionRow
            granted={status.screen_recording}
            hint={
              isVi
                ? 'Cho phép cua-driver chụp màn hình các cửa sổ ứng dụng.'
                : 'Lets cua-driver capture screenshots of app windows.'
            }
            label={isVi ? 'Ghi màn hình' : 'Screen Recording'}
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/55 p-2.5">
          <span className="text-sm font-medium">{isVi ? 'Tình trạng driver' : 'Driver health'}</span>
          <Pill tone={tone(status.ready)}>
            <GrantIcon granted={status.ready} />
            {status.ready === true
              ? isVi
                ? 'Sẵn sàng'
                : 'Ready'
              : status.ready === false
                ? isVi
                  ? 'Chưa sẵn sàng'
                  : 'Not ready'
                : isVi
                  ? 'Chưa rõ'
                  : 'Unknown'}
          </Pill>
        </div>
      )}

      {failingChecks.map(c => (
        <p className="px-1 text-[0.7rem] text-muted-foreground" key={c.label}>
          <AlertTriangle className="mr-1 inline size-3" />
          {c.label}: {c.message}
        </p>
      ))}

      {status.error && (
        <p className="px-1 text-[0.7rem] text-muted-foreground">
          <AlertTriangle className="mr-1 inline size-3" />
          {status.error}
        </p>
      )}

      {status.ready ? (
        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Check className="size-3.5" />
          {isVi
            ? 'Computer Use đã sẵn sàng. Bạn có thể yêu cầu AI agent chụp và thao tác trên ứng dụng.'
            : 'Computer Use is ready. Ask the agent to capture an app and click around.'}
        </div>
      ) : (
        status.can_grant && (
          <Button disabled={granting} onClick={() => void grant()} size="sm">
            {granting ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
            {granting
              ? isVi
                ? 'Đang chờ phê duyệt…'
                : 'Waiting for approval…'
              : isVi
                ? 'Cấp quyền'
                : 'Grant permissions'}
          </Button>
        )
      )}
    </div>
  )
}
