/**
 * Classify a mock-provider request without treating background title creation
 * as another agent turn. Main agent requests carry the tool contract, while
 * title generation has its own strict response schema. Everything else stays
 * visible as auxiliary traffic instead of being silently folded into either.
 */
export function classifyMockCompletionRequest(value) {
  const body = value && typeof value === 'object' ? value : {}
  const messages = Array.isArray(body.messages) ? body.messages : []
  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message && typeof message === 'object' && message.role === 'user')
  const userText = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : ''
  const schemaName = body.response_format?.json_schema?.name

  if (schemaName === 'session_title') {
    return { kind: 'title_generation', userText }
  }
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    return { kind: 'agent', userText }
  }
  return { kind: 'auxiliary', userText }
}
