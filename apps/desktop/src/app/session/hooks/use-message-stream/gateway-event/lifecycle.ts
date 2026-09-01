import type { HermesSkin } from '@hermes/shared/skin'

import { rendererDurableKey, rendererRuntimeKey } from '@/lib/session-runtime-key'
import {
  notifyCronChanged,
  notifyPairingChanged,
  notifyPetChanged,
  notifyPlatformsChanged,
  notifySessionsChanged,
  type PetChangeMeta,
  setChangeEventsAvailable
} from '@/store/live-sync'
import { setActiveSessionId } from '@/store/session'
import { dropSessionState, unbindTileRuntime } from '@/store/session-states'
// Leaf import (not the `@/themes` barrel) to avoid pulling the ThemeProvider
// module graph into the gateway event hot path.
import { ingestBackendSkin } from '@/themes/backend-sync'

import { createBackendKey } from '../../../session-binding-registry'

import type { GatewayEventContext } from './types'

/** gateway.ready / skin.changed / change-watcher broadcasts / session.reclaimed. */
export function handleLifecycleEvent(ctx: GatewayEventContext): boolean {
  const { deps, event, payload, fromActiveSource } = ctx

  const eventBackend = () => {
    const profile = event.profile?.trim()

    return profile && typeof event.gatewayEpoch === 'number'
      ? createBackendKey({
          connectionId: event.connectionId?.trim() || null,
          gatewayEpoch: event.gatewayEpoch,
          profile
        })
      : null
  }

  const dropLegacyBinding = (durableSessionId: string, runtimeSessionId: string) => {
    if (deps.runtimeIdByStoredSessionIdRef.current.get(durableSessionId) === runtimeSessionId) {
      deps.runtimeIdByStoredSessionIdRef.current.delete(durableSessionId)
    }
  }

  if (event.type === 'gateway.ready') {
    // A ready frame belongs to a newly opened WebSocket generation. Any live
    // runtime ids remembered for this exact backend predate that socket and
    // must be invalidated before the renderer can submit through them.
    const backend = eventBackend()

    for (const binding of backend
      ? deps.sessionBindingRegistry.invalidateBackendScope(backend, 'gateway-epoch-changed')
      : []) {
      dropLegacyBinding(
        deps.qualifyRuntimeIds
          ? rendererDurableKey(binding.backend, binding.durableSessionId)
          : binding.durableSessionId,
        deps.qualifyRuntimeIds ? binding.rendererRuntimeId : binding.runtimeSessionId
      )

      if (
        deps.activeSessionIdRef.current ===
        (deps.qualifyRuntimeIds ? binding.rendererRuntimeId : binding.runtimeSessionId)
      ) {
        deps.activeSessionIdRef.current = null
        setActiveSessionId(null)
      }
    }

    // Seed the active skin into the desktop theme registry without applying,
    // so a fresh connect never overrides the user's persisted desktop theme.
    ingestBackendSkin((payload as { skin?: HermesSkin } | undefined)?.skin, { apply: false })
    // Backends with the change watcher broadcast pet/cron/sessions change
    // events; consumers demote their legacy polls to slow backstops.
    setChangeEventsAvailable(Boolean((payload as { change_events?: boolean } | undefined)?.change_events))

    return true
  }

  if (event.type === 'skin.changed') {
    // A runtime skin switch (Hermes activating an authored skin, or `/skin`
    // on another surface). Only the active source+profile's change repaints.
    if (fromActiveSource()) {
      ingestBackendSkin(payload as HermesSkin | undefined, { apply: true })
    }

    return true
  }

  if (
    event.type === 'pet.changed' ||
    event.type === 'cron.changed' ||
    event.type === 'sessions.changed' ||
    event.type === 'platforms.changed' ||
    event.type === 'pairing.changed'
  ) {
    // Change-watcher broadcasts (server._broadcast_watched_changes): the
    // backend's on-disk signature moved. Route to the live-sync ticks the
    // former pollers now subscribe to. Only the active source+profile's
    // changes apply — background profile sockets (and other connections'
    // gateways) watch their own homes.
    if (fromActiveSource()) {
      if (event.type === 'pet.changed') {
        notifyPetChanged(payload as PetChangeMeta | undefined)
      } else if (event.type === 'cron.changed') {
        notifyCronChanged()
      } else if (event.type === 'platforms.changed') {
        notifyPlatformsChanged()
      } else if (event.type === 'pairing.changed') {
        notifyPairingChanged()
      } else {
        notifySessionsChanged()
      }
    }

    return true
  }

  if (event.type === 'session.reclaimed') {
    // The backend reclaimed a live session we may still be holding (idle
    // TTL, LRU cap, or the WS-orphan reap). Without this the runtime id
    // stays cached until something fails against it, which reads as the
    // session vanishing rather than being reclaimed. Drop the cached state
    // now — the stored row is untouched, so the sidebar keeps the
    // conversation and reopening it resumes from the DB.
    const reclaimedRuntimeId = String((payload as { session_id?: string } | undefined)?.session_id ?? '')
    const backend = eventBackend()

    if (reclaimedRuntimeId && (backend || !deps.qualifyRuntimeIds)) {
      const rendererRuntimeId = deps.qualifyRuntimeIds
        ? rendererRuntimeKey(backend!, reclaimedRuntimeId)
        : reclaimedRuntimeId

      const binding = backend
        ? deps.sessionBindingRegistry.invalidateRuntime(backend, reclaimedRuntimeId, 'session-reclaimed')
        : null

      if (binding) {
        dropLegacyBinding(
          deps.qualifyRuntimeIds
            ? rendererDurableKey(binding.backend, binding.durableSessionId)
            : binding.durableSessionId,
          rendererRuntimeId
        )
      }

      if (deps.activeSessionIdRef.current === rendererRuntimeId) {
        deps.activeSessionIdRef.current = null
        setActiveSessionId(null)
      }

      dropSessionState(rendererRuntimeId)
      // A tile bound to the reclaimed runtime would otherwise render an
      // empty transcript forever: its view reads $sessionStates[runtime]
      // (just dropped) and its resume effect is gated on !runtimeId, so a
      // bound tile never re-resumes (#82620). Unbind it so the effect
      // refires against the intact stored session — and purge the wiring
      // cache's entry, or resumeTile's warm path would hand the dead
      // runtime straight back instead of cold-resuming a live one.
      unbindTileRuntime(rendererRuntimeId)
      deps.sessionStateByRuntimeIdRef.current.delete(rendererRuntimeId)
    }

    // The row's ended_at moved, so refresh the lists that render it.
    notifySessionsChanged()

    return true
  }

  return false
}
