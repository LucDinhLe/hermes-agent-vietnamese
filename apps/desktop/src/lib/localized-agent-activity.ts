import type { Locale } from '@/i18n'

const THINKING_STATUS =
  /^\s*(?:processing|thinking|reasoning|analyzing|pondering|contemplating|musing|cogitating|ruminating|deliberating|mulling|reflecting|computing|synthesizing|formulating|brainstorming)\.\.\.\s*$/i

const WAITING_WITH_RECONNECT =
  /^(\s*⏳\s*)waiting on (.+?) — (\d+)s with no response yet \(provider may be slow or overloaded; auto-reconnect at (\d+)s\)\s*$/i

const WAITING = /^(\s*⏳\s*)waiting on (.+?) — (\d+)s with no response yet\s*$/i

/** Localize only backend-owned status templates.
 *
 * Goals, model output, tool calls, commands, paths and URLs pass through
 * byte-for-byte. This boundary keeps the interface Vietnamese without
 * "translating" technical evidence or content written by an agent.
 */
export function localizedAgentActivity(text: string, locale: Locale): string {
  if (locale !== 'vi') {
    return text
  }

  if (THINKING_STATUS.test(text)) {
    return 'Đang suy nghĩ…'
  }

  const reconnect = text.match(WAITING_WITH_RECONNECT)

  if (reconnect) {
    const [, glyph, model, elapsed, reconnectAt] = reconnect

    return `${glyph}Đang chờ ${model} — chưa phản hồi sau ${elapsed} giây (nhà cung cấp có thể chậm hoặc quá tải; tự kết nối lại ở giây ${reconnectAt})`
  }

  const waiting = text.match(WAITING)

  if (waiting) {
    const [, glyph, model, elapsed] = waiting

    return `${glyph}Đang chờ ${model} — chưa phản hồi sau ${elapsed} giây`
  }

  return text
}
