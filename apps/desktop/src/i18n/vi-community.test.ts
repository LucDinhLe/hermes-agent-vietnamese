import { describe, expect, it } from 'vitest'

import { vi } from './vi'

describe('Vietnamese community interface', () => {
  it('localizes the settings copy that appears on the model page', () => {
    expect(vi.settings.fieldLabels.modelContextLength).toBe('Cửa sổ ngữ cảnh')
    expect(vi.settings.fieldLabels.fallbackProviders).toBe('Model dự phòng')
    expect(vi.settings.fieldDescriptions.modelContextLength).toContain('Để 0')
    expect(vi.settings.fieldDescriptions.fallbackProviders).toContain('model mặc định')
  })

  it('localizes the remaining main-workspace controls', () => {
    expect(vi.composer.attachLabel).toBe('Đính kèm')
    expect(vi.rightSidebar.terminal).toBe('Dòng lệnh')
    expect(vi.rightSidebar.files).toBe('Hệ thống tệp')
    expect(vi.preview.diff).toBe('THAY ĐỔI')
  })
})
