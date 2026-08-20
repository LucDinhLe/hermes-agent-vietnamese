import { describe, expect, it } from 'vitest'

import type { AutomationBlueprint } from '@/hermes'

import { blueprintOptionLabel, initialBlueprintValues, localizeAutomationBlueprint } from './blueprints'

function blueprint(fields: AutomationBlueprint['fields']): AutomationBlueprint {
  return {
    key: 'test',
    title: 'Test',
    description: '',
    category: 'general',
    tags: [],
    command: '',
    appUrl: '',
    fields
  }
}

describe('initialBlueprintValues', () => {
  it('seeds each field from its default', () => {
    const values = initialBlueprintValues(
      blueprint([
        { name: 'time', type: 'time', label: 'Time', default: '08:00', options: [], optional: false, help: '' },
        {
          name: 'topic',
          type: 'enum',
          label: 'Topic',
          default: 'news',
          options: ['news', 'sports'],
          optional: false,
          help: ''
        }
      ])
    )

    expect(values).toEqual({ time: '08:00', topic: 'news' })
  })

  it('falls back to an empty string when a field has no default', () => {
    const values = initialBlueprintValues(
      blueprint([{ name: 'topic', type: 'text', label: 'Topic', default: null, options: [], optional: true, help: '' }])
    )

    expect(values).toEqual({ topic: '' })
  })

  it('returns an empty object for a blueprint with no fields', () => {
    expect(initialBlueprintValues(blueprint([]))).toEqual({})
  })

  it("seeds the deliver slot to 'local' when its default is the dashboard-only 'origin'", () => {
    const values = initialBlueprintValues(
      blueprint([
        {
          name: 'deliver',
          type: 'enum',
          label: 'Deliver',
          default: 'origin',
          options: ['origin', 'local', 'telegram'],
          optional: false,
          help: ''
        }
      ])
    )

    expect(values).toEqual({ deliver: 'local' })
  })

  it("seeds the deliver slot to 'local' when it has no default", () => {
    const values = initialBlueprintValues(
      blueprint([
        {
          name: 'deliver',
          type: 'enum',
          label: 'Deliver',
          default: null,
          options: ['origin', 'local'],
          optional: false,
          help: ''
        }
      ])
    )

    expect(values).toEqual({ deliver: 'local' })
  })

  it('leaves a non-origin deliver default untouched', () => {
    const values = initialBlueprintValues(
      blueprint([
        {
          name: 'deliver',
          type: 'enum',
          label: 'Deliver',
          default: 'telegram',
          options: ['origin', 'local', 'telegram'],
          optional: false,
          help: ''
        }
      ])
    )

    expect(values).toEqual({ deliver: 'telegram' })
  })
})

describe('Vietnamese automation blueprint presentation', () => {
  it.each([
    ['morning-brief', 'Bản tin buổi sáng'],
    ['important-mail', 'Theo dõi email quan trọng'],
    ['weekly-review', 'Tổng kết tuần'],
    ['workday-start', 'Nhắc bắt đầu ngày làm việc'],
    ['custom-reminder', 'Lời nhắc tùy chỉnh'],
    ['evening-winddown', 'Khép lại ngày làm việc'],
    ['news-digest', 'Điểm tin theo chủ đề'],
    ['bill-renewal-watch', 'Nhắc hóa đơn và gia hạn'],
    ['price-watch', 'Theo dõi giá và tình trạng còn hàng'],
    ['competitor-watch', 'Theo dõi tin đối thủ'],
    ['habit-checkin', 'Nhắc duy trì thói quen'],
    ['hydration-move', 'Nhắc uống nước và vận động'],
    ['meal-plan', 'Kế hoạch bữa ăn hằng tuần'],
    ['learn-daily', 'Bài học nhỏ mỗi ngày'],
    ['gratitude-journal', 'Gợi ý biết ơn và suy ngẫm'],
    ['on-this-day', 'Khám phá ngày này năm xưa']
  ])('localizes the %s catalog title', (key, title) => {
    const source = blueprint([])

    source.key = key
    expect(localizeAutomationBlueprint(source, 'vi').title).toBe(title)
  })

  it('localizes a known blueprint without changing its technical identity or enum values', () => {
    const source = blueprint([
      {
        name: 'recurrence',
        type: 'weekdays',
        label: 'Repeat on',
        default: 'weekdays',
        options: ['everyday', 'weekdays', 'weekends'],
        optional: false,
        help: ''
      }
    ])

    source.key = 'custom-reminder'
    source.title = 'Custom reminder'
    source.description = 'A recurring reminder in your own words, on your schedule.'

    const localized = localizeAutomationBlueprint(source, 'vi')

    expect(localized.key).toBe('custom-reminder')
    expect(localized.title).toBe('Lời nhắc tùy chỉnh')
    expect(localized.description).toContain('lịch bạn chọn')
    expect(localized.fields[0].label).toBe('Lặp lại vào')
    expect(localized.fields[0].default).toBe('weekdays')
    expect(localized.fields[0].options).toEqual(['everyday', 'weekdays', 'weekends'])
    expect(source.title).toBe('Custom reminder')
  })

  it('localizes free-text defaults but preserves unknown future blueprints', () => {
    const known = blueprint([
      {
        name: 'what',
        type: 'text',
        label: 'Remind me to…',
        default: 'take a break and stretch',
        options: [],
        optional: false,
        help: ''
      }
    ])

    known.key = 'custom-reminder'

    expect(localizeAutomationBlueprint(known, 'vi').fields[0].default).toBe('nghỉ giải lao và giãn cơ')

    const future = blueprint([])
    future.key = 'future-template'
    future.title = 'Future template'
    expect(localizeAutomationBlueprint(future, 'vi')).toEqual(future)
  })

  it('shows Vietnamese option labels while retaining raw values for submission', () => {
    expect(blueprintOptionLabel('weekdays', 'vi')).toBe('Các ngày trong tuần')
    expect(blueprintOptionLabel('high-protein', 'vi')).toBe('Giàu đạm')
    expect(blueprintOptionLabel('5', 'vi')).toBe('5')
    expect(blueprintOptionLabel('weekdays', 'en')).toBe('weekdays')
  })
})
