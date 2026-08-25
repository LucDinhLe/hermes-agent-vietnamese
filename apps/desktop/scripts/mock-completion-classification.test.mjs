import { describe, expect, it } from 'vitest'

import { classifyMockCompletionRequest } from './mock-completion-classification.mjs'

describe('mock completion request classification', () => {
  it('keeps one agent turn distinct from its background title request', () => {
    const userText = 'Explain this simple issue'

    expect(
      classifyMockCompletionRequest({
        messages: [{ role: 'user', content: userText }],
        tools: [{ type: 'function', function: { name: 'todo' } }]
      })
    ).toEqual({ kind: 'agent', userText })

    expect(
      classifyMockCompletionRequest({
        messages: [
          { role: 'system', content: 'You name chat sessions.' },
          { role: 'user', content: userText }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'session_title' }
        }
      })
    ).toEqual({ kind: 'title_generation', userText })
  })

  it('keeps unrecognised side calls visible as auxiliary traffic', () => {
    expect(
      classifyMockCompletionRequest({
        messages: [{ role: 'user', content: 'Summarize the compacted context' }]
      })
    ).toEqual({ kind: 'auxiliary', userText: 'Summarize the compacted context' })
  })
})
