import { afterEach, describe, expect, it } from 'vitest'

import { setRuntimeI18nLocale } from '@/i18n/runtime'

import { skillCategoryLabel } from './skill-category'

afterEach(() => setRuntimeI18nLocale('en'))

describe('skillCategoryLabel', () => {
  it('localizes user-facing skill categories in Vietnamese', () => {
    setRuntimeI18nLocale('vi')

    expect(skillCategoryLabel('Autonomous-Ai-Agents')).toBe('AI agent tự chủ')
    expect(skillCategoryLabel('Software-Development')).toBe('Phát triển phần mềm')
    expect(skillCategoryLabel('Productivity')).toBe('Năng suất')
    expect(skillCategoryLabel('Github')).toBe('GitHub')
  })

  it('keeps the ordinary English presentation outside Vietnamese', () => {
    setRuntimeI18nLocale('en')

    expect(skillCategoryLabel('Software-Development')).toBe('Software-Development')
  })
})
