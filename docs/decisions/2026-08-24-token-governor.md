# Decision log — Token Governor và Lean Session

## Trạng thái

Accepted and implemented; candidate-only cho tới khi packaged smoke và Windows
lifecycle đạt.

## Bối cảnh

Session bằng chứng có 11 user messages nhưng 208 API calls và 235 tool results.
Cache hit cao không ngăn chi phí vì retry, tool-loop, hidden tasks và raw output
vẫn làm prompt lớn lặp lại. `IterationBudget` hiện đếm outer loop, hoàn quota
cho `execute_code` và không aggregate parent/subagent.

## Quyết định

- Thêm `TurnGovernor` thread-safe theo `turn_id` và root session; không thay
  `IterationBudget`.
- Reserve trước từng physical outbound attempt và trước từng tool dispatch.
- Mặc định model warn/hard = 6/12; tool warn/hard = 8/20.
- Warning single-fire; hard limit tạo deterministic pause/event, không gọi LLM
  hay Smart Approval để xin phép.
- Hidden task và subagent dùng chung root governor; meter giữ breakdown theo
  `main/approval/background_review/title/compression/advisor/subagent/...`.
- Persist normalized per-turn usage; failed outbound attempt vẫn tăng call count,
  còn token/cost chỉ cộng khi response có usage.
- Simple explanation không tool khi không cần dữ liệu hiện hành, một main
  response và background review mặc định tắt trong lean profile.
- Raw output đưa vào model context tối đa 9.500 byte UTF-8; nội dung đầy đủ được
  spill an toàn với size, SHA-256 và recovery pointer.
- Tool profile `lean|full` được đóng băng trước call đầu. Lean giữ bridge schema
  ổn định và defer built-ins; `tool_describe` không mutate `tools[]` call sau.
- Runtime agent bên ngoài chỉ được chạy trong governed user turn khi Hermes có
  thể reserve trước từng physical model attempt. `codex app-server`, Claude
  Code CLI và GitHub Copilot ACP hiện không xuất telemetry đủ chi tiết nên v32
  chặn fail-closed trước subprocess/provider I/O, trả một lỗi có cấu trúc và
  không tự đổi model/provider. Direct OpenAI/Codex Responses vẫn hoạt động và
  được đếm bình thường.

## Hệ quả

- Không thể tiếp tục âm thầm tới hàng trăm calls.
- Retry/fallback sẽ hiển thị đúng chi phí attempt thay vì logical loop count.
- Paused turn cần đường consent/resume rõ ràng trong gateway/Desktop.
- Không còn đường app-server/CLI “một logical call đại diện nhiều physical
  calls” trong governed turn; các transport dormant vẫn có test contract riêng
  nhưng không thể vượt policy dispatch của v32.
- Cache regression bắt buộc so byte/hash của system prompt và tool schemas qua
  turn và restart.

## Phương án loại

- Chỉ giảm `max_turns`: không phủ hidden/subagent và quá muộn.
- Tính call từ usage rows: bỏ sót attempt thất bại.
- Thay tool schemas động mỗi turn: phá prompt cache và session parity.
- Truncate không artifact: mất recovery path.
- Đếm mỗi subprocess agent là một model call: số liệu sai và hard cap có thể bị
  outrun bởi retry/tool-loop nội bộ không quan sát được.
