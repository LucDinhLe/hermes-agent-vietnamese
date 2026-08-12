import type { Locale } from '@/i18n'

import type { BillingRefusal } from './api'

export interface BillingRefusalPresentation {
  action: { type: 'none' } | { type: 'portal'; url?: string } | { type: 'retry' } | { type: 'step_up' }
  message: string
  title: string
}

const portalAction = (url?: string): BillingRefusalPresentation['action'] => ({ type: 'portal', url })

const retryMessage = (refusal: BillingRefusal, isVi: boolean): string => {
  const mins = refusal.retryAfter
    ? isVi
      ? ` (thử lại sau khoảng ${Math.max(1, Math.round(refusal.retryAfter / 60))} phút)`
      : ` (try again in ~${Math.max(1, Math.round(refusal.retryAfter / 60))} min)`
    : ''

  return isVi
    ? `🟡 Hiện có quá nhiều giao dịch${mins}. Đây chưa phải lỗi thanh toán.`
    : `🟡 Too many charges right now${mins}. This isn't a payment failure.`
}

const stripeRetryMessage = (refusal: BillingRefusal, isVi: boolean): string => {
  const mins = refusal.retryAfter
    ? isVi
      ? ` (thử lại sau khoảng ${Math.max(1, Math.round(refusal.retryAfter / 60))} phút)`
      : ` (try again in ~${Math.max(1, Math.round(refusal.retryAfter / 60))} min)`
    : ''

  return isVi ? `Stripe đang gặp sự cố — hãy thử lại sau${mins}` : `Stripe is having trouble — try again shortly${mins}`
}

export const resolveRefusal = (refusal: BillingRefusal, locale: Locale = 'en'): BillingRefusalPresentation => {
  const isVi = locale === 'vi'

  switch (refusal.kind) {
    case 'consent_required':
      return {
        action: portalAction(refusal.portalUrl),
        message: isVi
          ? 'Xác nhận thẻ này cho các giao dịch từ Hermes trong Nous Portal'
          : 'Confirm this card for terminal charges in the portal',
        title: isVi ? 'Cần xác nhận thẻ' : 'Card confirmation needed'
      }

    case 'insufficient_scope':
      return {
        action: { type: 'step_up' },
        message: isVi
          ? 'Thao tác này cần bật Remote Spending. Hãy bắt đầu một lần nạp tín dụng để cấp quyền rồi thử lại.'
          : 'This needs Remote Spending allowed. Start a top-up to allow it, then retry.',
        title: isVi ? 'Remote Spending cần được phê duyệt' : 'Remote Spending needs approval'
      }
    case 'remote_spending_revoked': {
      const who =
        refusal.actor === 'admin'
          ? isVi
            ? 'Quản trị viên đã tắt Remote Spending cho máy này.'
            : 'An admin stopped remote spending for this terminal.'
          : isVi
            ? 'Bạn đã tắt Remote Spending cho máy này.'
            : 'You stopped remote spending for this terminal.'

      return {
        action: portalAction(refusal.portalUrl),
        message: `${who} ${isVi ? 'Kết nối lại tại Cài đặt → Gateway để cấp lại quyền cho thiết bị.' : 'Reconnect from Settings → Gateway to re-authorize this device.'}`,
        title: isVi ? 'Remote Spending đã bị tắt' : 'Remote spending was stopped'
      }
    }

    case 'session_revoked':
      return {
        action: portalAction(refusal.portalUrl),
        message: isVi
          ? 'Phiên đăng nhập đã hết. Hãy đăng nhập lại tại Cài đặt → Gateway.'
          : 'Your session was logged out. Sign in again from Settings → Gateway.',
        title: isVi ? 'Phiên đã đăng xuất' : 'Session logged out'
      }

    case 'cli_billing_disabled':

    case 'remote_spending_disabled':
      return {
        action: portalAction(refusal.portalUrl),
        message: isVi
          ? 'Remote Spending đang tắt cho tài khoản này — quản trị viên thanh toán có thể bật trong trang Hermes Agent của Nous Portal.'
          : "Remote spending is off for this account — a billing admin can turn it on from the portal's Hermes Agent page.",
        title: isVi ? 'Remote Spending đang tắt' : 'Remote spending is off'
      }

    case 'role_required':
      return {
        action: portalAction(refusal.portalUrl),
        message: isVi
          ? 'Nạp tiền cần quyền quản trị viên/chủ tổ chức. Hãy nhờ quản trị viên hoặc thao tác trong Nous Portal.'
          : 'Adding funds needs an org admin/owner. Ask an admin, or manage on the portal.',
        title: isVi ? 'Cần quyền quản trị viên' : 'Admin role required'
      }

    case 'idempotency_conflict':
      return {
        action: { type: 'none' },
        message: isVi
          ? '🔴 Mã giao dịch này đã được dùng cho số tiền khác. Hãy tạo lần nạp mới.'
          : '🔴 That charge key was already used for a different amount. Start a fresh top-up.',
        title: isVi ? 'Tạo lần nạp mới' : 'Start a fresh top-up'
      }

    case 'no_payment_method':
      return {
        action: portalAction(refusal.portalUrl),
        message: isVi
          ? '💳 Chưa có thẻ đã lưu cho giao dịch từ Hermes. Hãy thiết lập trong Nous Portal (mua tín dụng một lần không lưu thẻ để tái sử dụng).'
          : '💳 No saved card for terminal charges yet. Set one up on the portal ' +
            "(one-time credit buys don't save a reusable card).",
        title: isVi ? 'Chưa có thẻ đã lưu' : 'No saved card'
      }

    case 'org_access_denied':
      return {
        action: { type: 'none' },
        message: isVi
          ? 'Token này không gắn với tổ chức mà bạn có quyền quản lý'
          : "This token isn't bound to an org you can manage",
        title: isVi ? 'Không có quyền truy cập tổ chức' : 'Org access denied'
      }
    case 'monthly_cap_exceeded': {
      const remaining = refusal.payload?.remainingUsd

      return {
        action: portalAction(refusal.portalUrl),
        message:
          remaining != null
            ? isVi
              ? `🔴 Đã đạt hạn mức chi tiêu tháng — còn $${remaining} khả dụng.`
              : `🔴 Monthly spend cap reached — $${remaining} headroom left.`
            : isVi
              ? '🔴 Đã đạt hạn mức chi tiêu tháng.'
              : '🔴 Monthly spend cap reached.',
        title: isVi ? 'Đã đạt hạn mức chi tiêu tháng' : 'Monthly spend cap reached'
      }
    }

    case 'rate_limited':

    case 'temporarily_unavailable':
      return {
        action: { type: 'retry' },
        message: retryMessage(refusal, isVi),
        title: isVi ? 'Hiện có quá nhiều giao dịch' : 'Too many charges right now'
      }

    case 'stripe_unavailable':
      return {
        action: { type: 'retry' },
        message: stripeRetryMessage(refusal, isVi),
        title: isVi ? 'Stripe đang gặp sự cố' : 'Stripe is having trouble'
      }

    case 'upgrade_cap_exceeded':
      return {
        action: { type: 'none' },
        message: isVi
          ? 'Đã đạt giới hạn đổi gói trong ngày — hãy thử lại vào ngày mai'
          : 'Daily plan-change limit reached — try again tomorrow',
        title: isVi ? 'Đã đạt giới hạn đổi gói trong ngày' : 'Daily plan-change limit reached'
      }

    case 'endpoint_unavailable':
      return {
        action: { type: 'retry' },
        message:
          refusal.message ||
          (isVi
            ? 'Endpoint thanh toán trả về dữ liệu không phải JSON (có thể chưa được hỗ trợ trong bản triển khai này).'
            : 'Billing endpoint returned a non-JSON response (it may not be available on this deployment).'),
        title: isVi ? 'Endpoint thanh toán không khả dụng' : 'Billing endpoint unavailable'
      }

    case 'timeout':
      return {
        action: { type: 'retry' },
        message: refusal.message || (isVi ? 'Yêu cầu thanh toán đã hết thời gian chờ.' : 'Billing request timed out.'),
        title: isVi ? 'Yêu cầu thanh toán hết thời gian chờ' : 'Billing request timed out'
      }

    case 'transport':
      return {
        action: { type: 'retry' },
        message:
          refusal.message ||
          (isVi
            ? 'Yêu cầu thanh toán thất bại trước khi tới Gateway.'
            : 'Billing request failed before reaching the gateway.'),
        title: isVi ? 'Kết nối thanh toán thất bại' : 'Billing connection failed'
      }

    default:
      return {
        action: { type: 'none' },
        message: refusal.message || (isVi ? 'Yêu cầu thanh toán thất bại.' : 'Billing request failed.'),
        title: isVi ? 'Yêu cầu thanh toán thất bại' : 'Billing request failed'
      }
  }
}
