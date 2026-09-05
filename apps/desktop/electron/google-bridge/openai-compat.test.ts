import assert from 'node:assert/strict'

import { test } from 'vitest'

import { sanitizeSchema, StreamTranslator, toGeminiRequest, toOpenAiCompletion } from './openai-compat'

test('toGeminiRequest: system → systemInstruction, user/assistant → contents, gộp lượt cùng vai', () => {
  const g = toGeminiRequest({
    model: 'gemini-2.5-pro',
    messages: [
      { role: 'system', content: 'Bạn là trợ lý.' },
      { role: 'user', content: 'xin chào' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'ảnh này' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }
        ]
      },
      { role: 'assistant', content: 'chào bạn' }
    ],
    temperature: 0.2,
    max_tokens: 100,
    stop: ['END']
  })

  assert.deepEqual(g.systemInstruction, { role: 'user', parts: [{ text: 'Bạn là trợ lý.' }] })
  assert.equal(g.contents.length, 2)
  assert.equal(g.contents[0].role, 'user')
  assert.deepEqual(g.contents[0].parts, [
    { text: 'xin chào' },
    { text: 'ảnh này' },
    { inlineData: { mimeType: 'image/png', data: 'QUJD' } }
  ])
  assert.deepEqual(g.contents[1], { role: 'model', parts: [{ text: 'chào bạn' }] })
  assert.deepEqual(g.generationConfig, { temperature: 0.2, maxOutputTokens: 100, stopSequences: ['END'] })
})

test('toGeminiRequest: tools → functionDeclarations, tool_calls → functionCall, role tool → functionResponse với đúng tên', () => {
  const g = toGeminiRequest({
    model: 'm',
    messages: [
      { role: 'user', content: 'thời tiết Đà Lạt?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'weather', arguments: '{"city":"Da Lat"}' } }]
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"temp":18}' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'weather',
          description: 'x',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: { city: { type: 'string', default: '' } }
          }
        }
      }
    ],
    tool_choice: 'required'
  })

  assert.deepEqual(g.tools, [
    {
      functionDeclarations: [
        { name: 'weather', description: 'x', parameters: { type: 'object', properties: { city: { type: 'string' } } } }
      ]
    }
  ])
  assert.deepEqual(g.toolConfig, { functionCallingConfig: { mode: 'ANY' } })
  assert.deepEqual(g.contents[1], {
    role: 'model',
    parts: [{ functionCall: { id: 'call_1', name: 'weather', args: { city: 'Da Lat' } } }]
  })
  assert.deepEqual(g.contents[2], {
    role: 'user',
    parts: [{ functionResponse: { id: 'call_1', name: 'weather', response: { temp: 18 } } }]
  })
})

test('toGeminiRequest: lượt đầu là assistant → chèn user giả; tool result không phải JSON → {result}', () => {
  const g = toGeminiRequest({
    model: 'm',
    messages: [
      {
        role: 'assistant',
        content: 'a',
        tool_calls: [{ id: 'c', type: 'function', function: { name: 'f', arguments: 'not json' } }]
      },
      { role: 'tool', tool_call_id: 'c', content: 'plain text' }
    ]
  })

  assert.equal(g.contents[0].role, 'user')
  assert.deepEqual(g.contents[1].parts[1], { functionCall: { id: 'c', name: 'f', args: { raw: 'not json' } } })
  assert.deepEqual(g.contents[2].parts[0], {
    functionResponse: { id: 'c', name: 'f', response: { result: 'plain text' } }
  })
})

test('sanitizeSchema: bỏ additionalProperties/$schema/default ở mọi tầng', () => {
  assert.deepEqual(
    sanitizeSchema({
      $schema: 'x',
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: 'array', items: { type: 'string', default: 'z' } } }
    }),
    { type: 'object', properties: { a: { type: 'array', items: { type: 'string' } } } }
  )
})

test('StreamTranslator: text + functionCall + finish → chunk OpenAI với tool_calls index và usage', () => {
  const t = new StreamTranslator('chatcmpl-abcdefgh', 'gemini-2.5-pro')
  const a = t.translate({
    candidates: [{ content: { parts: [{ text: 'Xin ' }, { thought: true, text: 'suy nghĩ' }] } }]
  })
  assert.equal(a.length, 1)
  assert.deepEqual((a[0] as { choices: { delta: unknown }[] }).choices[0].delta, { content: 'Xin ' })

  const b = t.translate({
    candidates: [
      { content: { parts: [{ functionCall: { name: 'weather', args: { city: 'Da Lat' } } }] }, finishReason: 'STOP' }
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2, totalTokenCount: 17 }
  })

  assert.equal(b.length, 2)
  const delta = (
    b[0] as {
      choices: {
        delta: { tool_calls: { index: number; id: string; function: { name: string; arguments: string } }[] }
      }[]
    }
  ).choices[0].delta
  assert.equal(delta.tool_calls[0].index, 0)
  assert.match(delta.tool_calls[0].id, /^call_/)
  assert.deepEqual(delta.tool_calls[0].function, { name: 'weather', arguments: '{"city":"Da Lat"}' })
  const fin = b[1] as {
    choices: { finish_reason: string }[]
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }
  assert.equal(fin.choices[0].finish_reason, 'tool_calls')
  assert.deepEqual(fin.usage, { prompt_tokens: 10, completion_tokens: 7, total_tokens: 17 })
})

test('toOpenAiCompletion: gộp chunk thành một completion; MAX_TOKENS → length', () => {
  const c = toOpenAiCompletion('chatcmpl-1', 'm', [
    { candidates: [{ content: { parts: [{ text: 'Một ' }] } }] },
    {
      candidates: [{ content: { parts: [{ text: 'hai' }] }, finishReason: 'MAX_TOKENS' }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 }
    }
  ]) as { choices: { message: { content: string }; finish_reason: string }[]; usage: { total_tokens: number } }

  assert.equal(c.choices[0].message.content, 'Một hai')
  assert.equal(c.choices[0].finish_reason, 'length')
  assert.equal(c.usage.total_tokens, 3)
})
