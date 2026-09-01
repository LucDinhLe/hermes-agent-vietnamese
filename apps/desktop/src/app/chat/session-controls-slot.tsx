import { Slot } from '@/contrib/react/slot'
import { useContributions } from '@/contrib/react/use-contributions'

export const SESSION_CONTROLS_AREA = 'chat.sessionControls'

/**
 * Presentation-only seam for the V32 session strip. The host owns its exact
 * position and clipping boundary; the Vietnamese plugin supplies controls
 * through the public SDK and therefore cannot import chat stores or IPC.
 */
export function SessionControlsSlot() {
  const controls = useContributions(SESSION_CONTROLS_AREA)

  if (controls.length === 0) {
    return null
  }

  return (
    <div
      className="@container relative z-20 min-w-0 shrink-0 overflow-hidden border-b border-(--ui-stroke-secondary) bg-(--ui-chat-surface-background)/92 px-2 py-1"
      data-session-control-strip=""
      data-session-controls-slot=""
    >
      <Slot area={SESSION_CONTROLS_AREA} />
    </div>
  )
}
