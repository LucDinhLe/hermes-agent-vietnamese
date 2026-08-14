import { getRuntimeI18nLocale } from '@/i18n/runtime'

import { prettyName } from '../settings/helpers'

const VI_SKILL_CATEGORY_LABELS: Record<string, string> = {
  autonomousaiagents: 'AI agent tự chủ',
  creative: 'Sáng tạo',
  data: 'Dữ liệu',
  email: 'Email',
  general: 'Chung',
  github: 'GitHub',
  media: 'Truyền thông',
  mlops: 'MLOps',
  notetaking: 'Ghi chú',
  productivity: 'Năng suất',
  research: 'Nghiên cứu',
  smarthome: 'Nhà thông minh',
  softwaredevelopment: 'Phát triển phần mềm',
  utilities: 'Tiện ích'
}

export function skillCategoryLabel(category: string): string {
  if (getRuntimeI18nLocale() !== 'vi') {
    return prettyName(category)
  }

  const key = category.toLowerCase().replace(/[^a-z0-9]/g, '')

  return VI_SKILL_CATEGORY_LABELS[key] ?? prettyName(category)
}
