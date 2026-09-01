import type { AutomationBlueprint } from '@/hermes'

const VI_BLUEPRINTS: Record<string, { description: string; title: string }> = {
  'morning-brief': {
    title: 'Bản tin buổi sáng',
    description: 'Tóm tắt lịch hôm nay, thời tiết và những việc khẩn cần chú ý.'
  },
  'important-mail': {
    title: 'Theo dõi email quan trọng',
    description: 'Kiểm tra hộp thư định kỳ và chỉ báo những email thực sự cần Đại ca xử lý.'
  },
  'weekly-review': {
    title: 'Tổng kết tuần',
    description: 'Điểm lại việc đã xong, việc còn mở và kế hoạch sắp tới.'
  },
  'workday-start': {
    title: 'Nhắc bắt đầu ngày làm việc',
    description: 'Nhắc lịch trong ngày và các ưu tiên quan trọng vào mỗi ngày làm việc.'
  },
  'custom-reminder': {
    title: 'Lời nhắc tùy chỉnh',
    description: 'Tạo lời nhắc lặp lại bằng nội dung và lịch của riêng Đại ca.'
  },
  'evening-winddown': {
    title: 'Khép lại ngày làm việc',
    description: 'Xem nhanh lịch ngày mai và những việc nên chuẩn bị từ tối nay.'
  },
  'news-digest': {
    title: 'Bản tin theo chủ đề',
    description: 'Tổng hợp định kỳ các tin mới theo chủ đề, tự loại nội dung đã gửi.'
  },
  'bill-renewal-watch': {
    title: 'Nhắc hóa đơn và gia hạn',
    description: 'Báo trước các khoản thanh toán, gia hạn hoặc ngày đến hạn.'
  },
  'price-watch': {
    title: 'Theo dõi giá và tình trạng còn hàng',
    description: 'Theo dõi sản phẩm, chuyến bay, khách sạn hoặc tin đăng và báo khi đạt điều kiện.'
  },
  'competitor-watch': {
    title: 'Theo dõi tin đối thủ',
    description: 'Theo dõi các công ty đã chọn và tổng hợp tin quan trọng có dẫn nguồn.'
  },
  'habit-checkin': {
    title: 'Theo dõi thói quen',
    description: 'Nhắc duy trì một thói quen và ghi nhận tiến độ định kỳ.'
  },
  'hydration-move': {
    title: 'Nhắc uống nước và vận động',
    description: 'Nhắc uống nước, đứng dậy và vận động nhẹ trong ngày.'
  },
  'meal-plan': {
    title: 'Thực đơn tuần',
    description: 'Lập thực đơn theo tuần kèm danh sách mua sắm tổng hợp.'
  },
  'learn-daily': {
    title: 'Bài học ngắn mỗi ngày',
    description: 'Mỗi ngày nhận một bài học ngắn về chủ đề Đại ca muốn tìm hiểu.'
  },
  'gratitude-journal': {
    title: 'Nhắc biết ơn và chiêm nghiệm',
    description: 'Một câu hỏi nhẹ nhàng vào buổi tối để nhìn lại ngày đã qua.'
  },
  'on-this-day': {
    title: 'Khám phá mỗi ngày',
    description: 'Mỗi ngày nhận một mẩu kiến thức lịch sử, ngôn ngữ hoặc khoa học thú vị.'
  }
}

const VI_FIELD_LABELS: Record<string, string> = {
  'What time?': 'Mấy giờ?',
  'Where to deliver?': 'Gửi kết quả đến đâu?',
  'How often?': 'Bao lâu một lần?',
  'Only notify me if the mail…': 'Chỉ báo khi email…',
  'Which day?': 'Vào ngày nào?',
  'Remind me to…': 'Nhắc tôi…',
  'Repeat on': 'Lặp vào',
  'What topic?': 'Chủ đề nào?',
  'How many bullets?': 'Bao nhiêu ý?',
  "What's due?": 'Khoản nào sắp đến hạn?',
  'What exactly to watch?': 'Theo dõi chính xác nội dung nào?',
  'Alert me when…': 'Báo cho tôi khi…',
  'Which companies?': 'Những công ty nào?',
  'Which events matter?': 'Những sự kiện nào quan trọng?',
  'Which habit?': 'Thói quen nào?',
  'Start hour': 'Bắt đầu lúc',
  'End hour': 'Kết thúc lúc',
  'Diet?': 'Chế độ ăn?',
  'Meals per day?': 'Số bữa mỗi ngày?',
  'Cooking effort?': 'Mức độ nấu nướng?',
  'Learn about…': 'Học về…',
  'What kind?': 'Loại nội dung nào?'
}

const VI_DEFAULTS: Record<string, Record<string, string>> = {
  'important-mail': {
    criteria: 'cần trả lời trong hôm nay, đến từ quản lý hoặc gia đình, hay có nhắc tới thời hạn'
  },
  'custom-reminder': { what: 'nghỉ giải lao và vận động nhẹ' },
  'news-digest': { topic: 'AI và công nghệ' },
  'bill-renewal-watch': { what: 'gói dịch vụ trực tuyến của tôi sắp gia hạn' },
  'price-watch': {
    item: 'URL sản phẩm hoặc mô tả chính xác chuyến bay, khách sạn hay tin đăng',
    condition: 'tổng giá giảm xuống dưới mức mục tiêu của tôi'
  },
  'competitor-watch': {
    companies: 'tên các công ty, phân cách bằng dấu phẩy',
    categories: 'ra mắt sản phẩm, giá, gọi vốn, hồ sơ pháp lý'
  },
  'habit-checkin': { habit: 'thói quen tôi muốn duy trì' },
  'learn-daily': { topic: 'một chủ đề tôi muốn hiểu sâu hơn' }
}

const VI_OPTIONS: Record<string, string> = {
  origin: 'Cuộc trò chuyện nguồn',
  local: 'Máy tính này',
  everyday: 'Mỗi ngày',
  weekdays: 'Ngày làm việc',
  weekends: 'Cuối tuần',
  sunday: 'Chủ nhật',
  monday: 'Thứ Hai',
  friday: 'Thứ Sáu',
  saturday: 'Thứ Bảy',
  'no restrictions': 'Không giới hạn',
  vegetarian: 'Ăn chay có trứng/sữa',
  vegan: 'Thuần chay',
  'dinner only': 'Chỉ bữa tối',
  'lunch and dinner': 'Bữa trưa và tối',
  'all three': 'Cả ba bữa',
  quick: 'Nhanh gọn',
  medium: 'Vừa phải',
  ambitious: 'Cầu kỳ',
  'on this day in history': 'Ngày này trong lịch sử',
  'word of the day': 'Từ mới mỗi ngày'
}

export function blueprintOptionLabel(option: string, locale: string): string {
  return locale === 'vi' ? (VI_OPTIONS[option] ?? option) : option
}

export function localizeAutomationBlueprint(blueprint: AutomationBlueprint, locale: string): AutomationBlueprint {
  if (locale !== 'vi') {
    return blueprint
  }

  const copy = VI_BLUEPRINTS[blueprint.key]
  const defaults = VI_DEFAULTS[blueprint.key] ?? {}

  return {
    ...blueprint,
    title: copy?.title ?? blueprint.title,
    description: copy?.description ?? blueprint.description,
    fields: blueprint.fields.map(field => ({
      ...field,
      label: VI_FIELD_LABELS[field.label] ?? field.label,
      default: defaults[field.name] ?? field.default
    }))
  }
}

export function localizeAutomationBlueprints(
  blueprints: readonly AutomationBlueprint[],
  locale: string
): AutomationBlueprint[] {
  return blueprints.map(blueprint => localizeAutomationBlueprint(blueprint, locale))
}
