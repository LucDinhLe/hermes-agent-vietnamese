import { describe, expect, it } from 'vitest'

import type { AutomationBlueprint } from '@/hermes'

import { blueprintOptionLabel, localizeAutomationBlueprint } from './blueprint-localization'

const fixture: AutomationBlueprint = {
  key: 'morning-brief',
  title: 'Morning briefing',
  description: "A short daily briefing: today's calendar, weather, and anything urgent waiting on you.",
  category: 'daily',
  tags: ['daily'],
  fields: [
    { name: 'time', type: 'time', label: 'What time?', default: '08:00', options: [], optional: false, help: '' },
    {
      name: 'deliver',
      type: 'enum',
      label: 'Where to deliver?',
      default: 'origin',
      options: ['origin', 'local'],
      optional: false,
      help: ''
    }
  ],
  command: '/blueprint morning-brief',
  appUrl: 'hermes://cron/blueprint/morning-brief'
}

describe('Vietnamese automation blueprint localization', () => {
  it('localizes user-visible catalog and field copy without changing backend keys or option values', () => {
    const localized = localizeAutomationBlueprint(fixture, 'vi')

    expect(localized.key).toBe(fixture.key)
    expect(localized.title).toBe('Bản tin buổi sáng')
    expect(localized.description).toContain('lịch hôm nay')
    expect(localized.fields.map(field => field.label)).toEqual(['Mấy giờ?', 'Gửi kết quả đến đâu?'])
    expect(localized.fields[1]?.options).toEqual(['origin', 'local'])
    expect(blueprintOptionLabel('weekdays', 'vi')).toBe('Ngày làm việc')
  })

  it('returns upstream copy unchanged outside Vietnamese locale', () => {
    expect(localizeAutomationBlueprint(fixture, 'en')).toBe(fixture)
    expect(blueprintOptionLabel('weekdays', 'en')).toBe('weekdays')
  })
})
