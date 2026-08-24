import { atom } from 'nanostores'

import { getActionStatus, restartGateway } from '@/hermes'
import { translateNow } from '@/i18n'
import type { BackendOwner } from '@/store/backend-owner'
import { notifyError } from '@/store/notifications'
import type { ActionResponse, ActionStatusResponse } from '@/types/hermes'

const POLL_ATTEMPTS = 18
const POLL_INTERVAL_MS = 1200
const POLL_TIMEOUT_S = 180

// True while a gateway restart is in flight — drives the statusbar gateway
// indicator (glyph spinner) so the restart shows up where users already look,
// instead of a toast that vanishes or a generic "Agents running" counter.
export const $gatewayRestarting = atom(false)

export class HermesActionTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HermesActionTimeoutError'
  }
}

// Poll a backend action to completion, throwing on a non-zero exit or when the
// bounded window expires while the action is still running.
export async function awaitHermesAction(
  started: ActionResponse,
  owner: BackendOwner | null = null
): Promise<ActionStatusResponse> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const latest = await getActionStatus(started.name, POLL_TIMEOUT_S, owner?.profile, owner?.connectionId)

    if (!latest.running) {
      if (latest.exit_code != null && latest.exit_code !== 0) {
        throw new Error(latest.lines.at(-1)?.trim() || `Action ${started.name} failed`)
      }

      return latest
    }

    if (attempt + 1 < POLL_ATTEMPTS) {
      await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }

  throw new HermesActionTimeoutError(translateNow('shell.gatewayMenu.actionTimedOut'))
}

// Restart the messaging gateway, surfacing progress in the statusbar gateway
// indicator. Self-contained and never rejects, so every trigger — Cmd+K, the
// messaging save/toggle toasts — gets identical feedback from a plain
// `void runGatewayRestart()`, and a failure is the only thing that toasts.
export async function runGatewayRestart(owner: BackendOwner | null = null): Promise<void> {
  $gatewayRestarting.set(true)

  try {
    await awaitHermesAction(await restartGateway(owner?.profile, owner?.connectionId), owner)
  } catch (err) {
    notifyError(err, translateNow('commandCenter.gatewayRestartFailed'))
  } finally {
    $gatewayRestarting.set(false)
  }
}
