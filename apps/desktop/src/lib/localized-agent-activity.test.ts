import { describe, expect, it } from 'vitest'

import { localizedAgentActivity } from './localized-agent-activity'

describe('localizedAgentActivity', () => {
  it('localizes known Hermes wait and thinking templates in Vietnamese', () => {
    expect(localizedAgentActivity('cogitating...', 'vi')).toBe('Đang suy nghĩ…')
    expect(
      localizedAgentActivity(
        '⏳ waiting on gpt-5.6-sol — 32s with no response yet (provider may be slow or overloaded; auto-reconnect at 203s)',
        'vi'
      )
    ).toBe(
      '⏳ Đang chờ gpt-5.6-sol — chưa phản hồi sau 32 giây (nhà cung cấp có thể chậm hoặc quá tải; tự kết nối lại ở giây 203)'
    )
  })

  it('preserves models, tool calls, paths, URLs, goals and other agent-authored text', () => {
    const evidence = 'Browser_Navigate("https://github.com/NVIDIA/OpenShell")'
    const goal = 'Independent security and logic review of Feature 0.6 current diff'

    expect(localizedAgentActivity(evidence, 'vi')).toBe(evidence)
    expect(localizedAgentActivity(goal, 'vi')).toBe(goal)
    expect(localizedAgentActivity('cogitating...', 'en')).toBe('cogitating...')
  })
})
