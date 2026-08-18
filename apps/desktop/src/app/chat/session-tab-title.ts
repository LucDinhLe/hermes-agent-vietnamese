import { translateNow } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import type { SessionInfo } from '@/types/hermes'

/** Display title shared by every session tab. Older Hermes runtimes persisted
 *  the English draft placeholder as a real title, so tab surfaces must pass
 *  the active locale explicitly instead of exposing that stored placeholder. */
export function sessionTabTitle(session: SessionInfo): string {
  return sessionTitle(session, translateNow('commandCenter.nav.newChat.title'))
}
