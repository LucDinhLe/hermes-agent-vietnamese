import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AutomationBlueprint, AutomationBlueprintField } from '@/hermes'
import type { Locale } from '@/i18n'

// The blueprint catalog is shared with the dashboard, so its deliver slot
// defaults to "origin" (the chat/home-channel a dashboard or gateway job was
// created from). Desktop has no origin chat, so seed the deliver slot to the
// desktop's native target ("local" = This desktop) instead. The dialog then
// renders that slot with the shared DeliverSelect (backend-sourced targets), so
// the raw "origin" option never reaches the desktop UI.
const DELIVER_FIELD = 'deliver'
const DESKTOP_DELIVER_DEFAULT = 'local'

interface BlueprintTranslation {
  description: string
  title: string
}

// The Python catalog remains the shared semantic source of truth for schedules,
// prompts, field keys and enum values. Desktop localizes only the Vietnamese
// presentation layer so the same blueprint contract continues to work in the
// dashboard, CLI and every existing scheduled job.
const VI_BLUEPRINTS: Readonly<Record<string, BlueprintTranslation>> = {
  'morning-brief': {
    title: 'Bản tin buổi sáng',
    description: 'Bản tin ngắn hằng ngày gồm lịch hôm nay, thời tiết và những việc khẩn cấp đang chờ bạn.'
  },
  'important-mail': {
    title: 'Theo dõi email quan trọng',
    description: 'Kiểm tra hộp thư định kỳ và chỉ báo cho bạn những email thực sự cần chú ý.'
  },
  'weekly-review': {
    title: 'Tổng kết tuần',
    description: 'Tóm tắt những việc đã hoàn thành, những việc còn dang dở và kế hoạch sắp tới.'
  },
  'workday-start': {
    title: 'Nhắc bắt đầu ngày làm việc',
    description: 'Lời nhắc vào ngày làm việc kèm lịch trong ngày và các ưu tiên quan trọng nhất.'
  },
  'custom-reminder': {
    title: 'Lời nhắc tùy chỉnh',
    description: 'Một lời nhắc lặp lại theo nội dung và lịch bạn chọn.'
  },
  'evening-winddown': {
    title: 'Khép lại ngày làm việc',
    description: 'Điểm lại cuối ngày, xem nhanh lịch ngày mai và những việc nên chuẩn bị từ tối nay.'
  },
  'news-digest': {
    title: 'Điểm tin theo chủ đề',
    description: 'Bản tin định kỳ về chủ đề bạn quan tâm, tự loại nội dung đã gửi để chỉ giữ tin thực sự mới.'
  },
  'bill-renewal-watch': {
    title: 'Nhắc hóa đơn và gia hạn',
    description: 'Báo trước khoản thanh toán định kỳ, gói sắp gia hạn hoặc hạn chót để bạn không bị trừ tiền bất ngờ.'
  },
  'price-watch': {
    title: 'Theo dõi giá và tình trạng còn hàng',
    description: 'Theo dõi đúng sản phẩm, chuyến bay, khách sạn hoặc tin đăng và báo khi đạt điều kiện bạn đặt.'
  },
  'competitor-watch': {
    title: 'Theo dõi tin đối thủ',
    description: 'Theo dõi các công ty đã chọn về sản phẩm, giá, gọi vốn và sự kiện quan trọng, kèm nguồn dẫn.'
  },
  'habit-checkin': {
    title: 'Nhắc duy trì thói quen',
    description: 'Lời nhắc định kỳ giúp bạn giữ nhịp thói quen và nhìn lại việc thực hiện.'
  },
  'hydration-move': {
    title: 'Nhắc uống nước và vận động',
    description: 'Nhắc nhẹ trong ngày để uống nước, đứng dậy và giãn cơ.'
  },
  'meal-plan': {
    title: 'Kế hoạch bữa ăn hằng tuần',
    description: 'Lập thực đơn tuần và danh sách mua sắm tổng hợp theo chế độ ăn cùng thời gian nấu của bạn.'
  },
  'learn-daily': {
    title: 'Bài học nhỏ mỗi ngày',
    description: 'Mỗi ngày một bài học ngắn về chủ đề bạn muốn học, được nối tiếp và nâng dần theo thời gian.'
  },
  'gratitude-journal': {
    title: 'Gợi ý biết ơn và suy ngẫm',
    description: 'Một gợi ý nhẹ nhàng vào buổi tối để nhìn lại ngày và ghi nhận điều đã diễn ra tốt đẹp.'
  },
  'on-this-day': {
    title: 'Khám phá ngày này năm xưa',
    description: 'Mỗi ngày một điều đáng tò mò: sự kiện lịch sử, kiến thức hoặc từ ngữ nổi bật.'
  }
}

const VI_FIELD_LABELS: Readonly<Record<string, string>> = {
  'What time?': 'Mấy giờ?',
  'Where to deliver?': 'Gửi kết quả đến đâu?',
  'How often?': 'Bao lâu một lần?',
  'Only notify me if the mail…': 'Chỉ báo cho tôi khi email…',
  'Which day?': 'Chọn ngày nào?',
  'Remind me to…': 'Nhắc tôi…',
  'Repeat on': 'Lặp lại vào',
  'What topic?': 'Chủ đề nào?',
  'How many bullets?': 'Bao nhiêu ý chính?',
  "What's due?": 'Khoản nào sắp đến hạn?',
  'What exactly to watch?': 'Cần theo dõi chính xác mục nào?',
  'Alert me when…': 'Báo cho tôi khi…',
  'Which companies?': 'Những công ty nào?',
  'Which events matter?': 'Những sự kiện nào quan trọng?',
  'Which habit?': 'Thói quen nào?',
  'Start hour': 'Giờ bắt đầu',
  'End hour': 'Giờ kết thúc',
  'Diet?': 'Chế độ ăn?',
  'Meals per day?': 'Số bữa mỗi ngày?',
  'Cooking effort?': 'Mức công sức nấu ăn?',
  'Learn about…': 'Học về…',
  'What kind?': 'Loại nội dung nào?'
}

const VI_FIELD_HELP: Readonly<Record<string, string>> = {
  '24h local time, e.g. 08:00': 'Giờ địa phương theo định dạng 24 giờ, ví dụ 08:00',
  'minutes between checks': 'Số phút giữa mỗi lần kiểm tra',
  'a subject, product, person, or search phrase': 'Một chủ đề, sản phẩm, nhân vật hoặc cụm từ tìm kiếm',
  'URL or precise description — variant, dates, seller': 'URL hoặc mô tả chính xác về phiên bản, ngày và người bán',
  'threshold price (state the currency), availability, or terms change':
    'Ngưỡng giá (ghi rõ tiền tệ), tình trạng còn hàng hoặc thay đổi điều kiện',
  'hours between checks — be gentle with rate limits': 'Số giờ giữa mỗi lần kiểm tra để tránh vượt giới hạn truy cập',
  'canonical names and domains; aliases help dedup': 'Tên chính thức và tên miền; bí danh giúp loại nội dung trùng',
  'hours between nudges': 'Số giờ giữa mỗi lần nhắc',
  'first hour of the active window (24h)': 'Giờ đầu tiên của khoảng hoạt động (24 giờ)',
  'last hour of the active window (24h)': 'Giờ cuối cùng của khoảng hoạt động (24 giờ)'
}

const VI_TEXT_DEFAULTS: Readonly<Record<string, string>> = {
  'needs a reply today, is from my manager or family, or mentions a deadline':
    'cần trả lời trong hôm nay, đến từ quản lý hoặc gia đình, hay có nhắc tới hạn chót',
  'take a break and stretch': 'nghỉ giải lao và giãn cơ',
  'AI and technology': 'AI và công nghệ',
  'my streaming subscription renews soon': 'gói xem trực tuyến của tôi sắp gia hạn',
  'a product URL or exact flight/hotel/listing description':
    'URL sản phẩm hoặc mô tả chính xác chuyến bay, khách sạn hay tin đăng',
  'the all-in price drops below my target': 'tổng giá giảm xuống dưới mức mục tiêu của tôi',
  'two or three competitors, by canonical name': 'hai hoặc ba đối thủ theo tên chính thức',
  'product launches, pricing changes, funding, partnerships, executive moves, incidents':
    'ra mắt sản phẩm, thay đổi giá, gọi vốn, hợp tác, thay đổi lãnh đạo và sự cố',
  '20 minutes of reading': 'đọc sách 20 phút',
  'Spanish vocabulary': 'từ vựng tiếng Tây Ban Nha'
}

const VI_OPTION_LABELS: Readonly<Record<string, string>> = {
  everyday: 'Hằng ngày',
  weekdays: 'Các ngày trong tuần',
  weekends: 'Cuối tuần',
  sunday: 'Chủ nhật',
  monday: 'Thứ Hai',
  friday: 'Thứ Sáu',
  saturday: 'Thứ Bảy',
  'no restrictions': 'Không hạn chế',
  vegetarian: 'Ăn chay có trứng/sữa',
  vegan: 'Thuần chay',
  'high-protein': 'Giàu đạm',
  'low-carb': 'Ít tinh bột',
  'dinner only': 'Chỉ bữa tối',
  'lunch and dinner': 'Bữa trưa và bữa tối',
  'all three': 'Cả ba bữa',
  quick: 'Nhanh gọn',
  medium: 'Vừa phải',
  ambitious: 'Cầu kỳ',
  'on this day in history': 'Ngày này trong lịch sử',
  'word of the day': 'Từ ngữ trong ngày',
  'science fact': 'Kiến thức khoa học',
  'quote of the day': 'Câu nói trong ngày'
}

export function localizeAutomationBlueprint(blueprint: AutomationBlueprint, locale: Locale): AutomationBlueprint {
  const translation = locale === 'vi' ? VI_BLUEPRINTS[blueprint.key] : undefined

  if (!translation) {
    return blueprint
  }

  return {
    ...blueprint,
    ...translation,
    fields: blueprint.fields.map(field => ({
      ...field,
      label: VI_FIELD_LABELS[field.label] ?? field.label,
      help: VI_FIELD_HELP[field.help] ?? field.help,
      default:
        field.type === 'text' && field.default !== null
          ? (VI_TEXT_DEFAULTS[field.default] ?? field.default)
          : field.default
    }))
  }
}

export function blueprintOptionLabel(option: string, locale: Locale): string {
  return locale === 'vi' ? (VI_OPTION_LABELS[option] ?? option) : option
}

function isDeliverField(field: AutomationBlueprintField): boolean {
  return field.name === DELIVER_FIELD
}

// Initial form state for a blueprint = each field's default (or ''). Pure so the
// suite can assert the form seeds correctly without mounting React. The deliver
// slot is special-cased: an "origin" default (or empty) becomes "local" so a
// desktop-created job delivers to This desktop instead of nowhere.
export function initialBlueprintValues(blueprint: AutomationBlueprint): Record<string, string> {
  const out: Record<string, string> = {}

  for (const field of blueprint.fields) {
    const seeded = field.default ?? ''
    out[field.name] = isDeliverField(field) && (seeded === '' || seeded === 'origin') ? DESKTOP_DELIVER_DEFAULT : seeded
  }

  return out
}

// A slot-level validation error from the backend arrives as "422: <message>"
// (or "<code>: <message>"); strip the leading numeric code for inline display.
export function cleanBlueprintFieldError(message: string): string {
  return message.replace(/^\d+:\s*/, '')
}

// Help text to show under a slot control. The backend deliver help is
// origin/dashboard-centric and even contradicts desktop semantics ("local =
// save only" vs. This desktop), and the DeliverSelect is self-explanatory —
// skip it for the deliver slot.
export function blueprintSlotHelp(field: AutomationBlueprintField): string | undefined {
  return field.help && field.type !== 'text' && !isDeliverField(field) ? field.help : undefined
}

// Renders one blueprint slot's control (enum/weekdays → Select, time → time
// input, else text). The deliver slot is handled separately by the dialog's
// shared DeliverSelect, so it's not rendered here.
export function BlueprintSlotControl({
  field,
  id,
  onChange,
  optionLabel,
  value
}: {
  field: AutomationBlueprintField
  id: string
  onChange: (next: string) => void
  optionLabel?: (option: string) => string
  value: string
}) {
  if (field.type === 'enum' || field.type === 'weekdays') {
    return (
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="h-9 rounded-md" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(option => (
            <SelectItem key={option} value={option}>
              {optionLabel?.(option) ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'time') {
    return <Input id={id} onChange={event => onChange(event.target.value)} type="time" value={value} />
  }

  return (
    <Input
      id={id}
      onChange={event => onChange(event.target.value)}
      placeholder={field.help || field.label}
      type="text"
      value={value}
    />
  )
}
