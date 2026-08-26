import { describe, expect, it } from 'vitest'

import { en } from './en'
import { ja } from './ja'
import { vi } from './vi'
import { zh } from './zh'
import { zhHant } from './zh-hant'

describe('Vietnamese community interface', () => {
  it('uses the Hermes Vietnamese product name and factual attribution', () => {
    expect(vi.settings.about.heading).toBe('Hermes Vietnamese')
    expect(vi.settings.about.upstreamPublisherValue).toBe('Hermes Agent · Nous Research')
    expect(vi.settings.about.communityMaintainer).toContain('Nhà phát hành')
    expect(vi.settings.about.communityMaintainerValue).toBe('Lê Đình Lực (LucDinhLe)')
    expect(vi.settings.about.licenseValue).toBe('Giấy phép MIT')
  })

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
    expect(vi.sidebar.nav.cron).toBe('Tác vụ định kỳ')
    expect(vi.preview.diff).toBe('THAY ĐỔI')
  })

  it('describes a follow-up as a request, not a tracking action', () => {
    expect(vi.composer.followUpPlaceholders).toContain('Gửi yêu cầu')
    expect(vi.composer.followUpPlaceholders).not.toContain('Gửi theo dõi')
  })

  it('explains the Advisor plan and final checkpoints in Vietnamese', () => {
    const progress = vi.assistant.thread.workProgress

    expect(progress.advisorPlanAction).toBe('Advisor đang rà soát kế hoạch')
    expect(progress.advisorPlanReason).toContain('mục tiêu')
    expect(progress.advisorFinalAction).toBe('Advisor đang đối chiếu kết quả cuối')
    expect(progress.advisorFinalReason).toContain('mục tiêu ban đầu')
  })

  it('localizes the per-session Gateway lifecycle menu and its safe stop boundary', () => {
    const gateway = vi.shell.gatewayMenu

    expect(gateway.gateway).toBe('Gateway')
    expect(gateway.statusRunning).toBe('Đang chạy')
    expect(gateway.statusStopped).toBe('Đã dừng')
    expect(gateway.pidLabel(20756)).toBe('PID 20756')
    expect(gateway.startGateway).toBe('Khởi động')
    expect(gateway.restartGateway).toBe('Khởi động lại')
    expect(gateway.stopGateway).toBe('Dừng')
    expect(gateway.forceStopGateway).toBe('Dừng cưỡng bức')
    expect(gateway.forceStopUnavailable).toContain('không khả dụng')
    expect(gateway.viewLogs).toBe('Xem nhật ký')
    expect(gateway.runDoctor).toBe('Chạy doctor')
    expect(gateway.checkHealth).toBe('Kiểm tra sức khỏe')
    expect(gateway.stopConfirmBody('lead-agent')).toContain('lead-agent')
    expect(gateway.lifecycleManagedBy('default')).toContain('default')
    expect(gateway.sharedLifecycleWarning).toContain('dùng chung')
    expect(gateway.actionTimedOut).toContain('vẫn đang chạy')
    expect(gateway.logsEmpty).toBe('Chưa có nhật ký cổng.')
  })

  it('keeps the required desktop locales aligned for Gateway lifecycle safety', () => {
    for (const locale of [en, ja, zh, zhHant]) {
      const gateway = locale.shell.gatewayMenu

      expect(gateway.statusRunning).toBeTruthy()
      expect(gateway.lifecycleManagedBy('default')).toContain('default')
      expect(gateway.lifecycleOwnerUnknown).toBeTruthy()
      expect(gateway.sharedLifecycleWarning).toBeTruthy()
      expect(gateway.stopSharedConfirmBody).toBeTruthy()
      expect(gateway.actionTimedOut).toBeTruthy()
    }
  })

  it('keeps project-scoped sessions discoverable with an exact outside count in every locale', () => {
    expect(vi.sidebar.projects.back(7)).toContain('7 phiên khác')

    for (const locale of [en, ja, zh, zhHant]) {
      expect(locale.sidebar.projects.back(7)).toContain('7')
      expect(locale.sidebar.projects.back(0)).toBeTruthy()
    }
  })
})
