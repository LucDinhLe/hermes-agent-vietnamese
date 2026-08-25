# Hermes Vietnamese v32 — Tóm tắt triển khai

Ngày lập hồ sơ: 2026-08-24

Nhánh: `feat/v32-token-context-ux`

Baseline v32: `3cce675cea2bfdfd2fd29352f35a529e827cf46f`

Mốc mã trước checkpoint test hiện tại:
`ffa71a84065f9272bb65df28787fe80470f72558`

Trạng thái cuối trước promotion: **technical GO; private staging hoàn tất;
owner đã duyệt merge và đưa community pilot v32 lên GitHub Latest**.

Candidate bất biến dùng commit
`81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`, version `0.32.0-vi.1`, Windows
x64 installer 341.176.379 byte và SHA-256
`efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac`.
Lượt build ngoại lệ đã được dùng và candidate không bị rebuild.

## Kết quả người dùng nhận được

V32 tập trung vào bốn vấn đề đã quan sát ở v31:

1. Một yêu cầu có thể âm thầm sinh quá nhiều lần gọi mô hình, công cụ, retry và
   việc nền.
2. Ngữ cảnh lớn bị đọc lại nhiều lần dù cache vẫn hoạt động tốt.
3. Tool schema và raw output chiếm phần đáng kể của prompt ngay từ phiên mới.
4. Trang Nhắn tin thiếu đường quay lại rõ ràng, nút `+` chưa có bằng chứng pointer
   thật và context meter dễ làm người dùng hiểu nhầm quota hoặc khoản tiền thực
   trả.

Triển khai hiện tại bổ sung Governor theo từng yêu cầu người dùng, compaction
sớm cho tuyến GPT-5.6 phù hợp, Lean Session, giới hạn output công cụ theo byte và
meter tách context, quota cùng chi phí API tham chiếu.

## 1. Governor theo từng yêu cầu người dùng

`TurnGovernor` là bộ đếm thread-safe dùng chung cho agent chủ trì, agent chuyên
trách và các việc phụ có thể quan sát trong cùng một user turn.

- Cảnh báo một lần khi chạm 6 lần gọi mô hình hoặc 8 lần gọi công cụ.
- Cho phép tối đa 12 lần gọi mô hình và 20 lần gọi công cụ.
- Lần gọi mô hình thứ 13 bị chặn trước I/O. Lần gọi công cụ thứ 21 bị từ chối
  trước dispatch.
- Một batch công cụ chỉ nhận prefix còn an toàn. Mỗi `tool_call_id` bị từ chối
  vẫn nhận kết quả xác định để transcript giữ đúng cặp assistant/tool.
- Attempt thất bại vẫn tăng call count. Token và chi phí chỉ được cộng khi
  response có usage.
- Warning, trạng thái gần giới hạn và pause được phát trực tiếp qua event, lưu ở
  kết quả turn và hiển thị trên TUI/Desktop.
- `max_turns` mặc định được hạ về 50 và chỉ còn là failsafe cuối. Governor 12/20
  là cổng chính theo user turn.

Các đường Hermes quản lý trực tiếp đã có reservation trước I/O hoặc dispatch,
gồm main transport, retry/fallback quan sát được, title, auxiliary/background,
compaction, subagent, Bedrock probe tier và các POST của công cụ xAI.

### Ranh giới runtime opaque và chính sách fail-closed

Codex app-server, Claude Code và Copilot ACP chạy qua subprocess hoặc protocol
agentic bên ngoài và chưa cung cấp callback cho từng provider request, retry hay
tool call vật lý. V32 không ước lượng các attempt ẩn: governed user turn chặn ba
runtime này trước I/O bằng `UnobservableModelRuntimeError`. Codex app-server trả
failure có cấu trúc với `provider_error_kind=unobservable_model_runtime`,
`turn_exit_reason=unobservable_model_runtime_blocked`, `api_calls=0`; không retry,
fallback hoặc switch âm thầm. Chỉ mở lại khi có per-attempt telemetry/reservation
đủ mạnh để Governor chặn trước I/O.

## 2. Giới hạn raw output và đường phục hồi

Mỗi tool result dạng văn bản được giới hạn ở 9.500 byte UTF-8 trước khi đưa vào
model context. Ngân sách tổng của một turn là 38.000 byte và preview mặc định là
1.024 byte.

Khi vượt ngưỡng, Hermes:

1. ghi nội dung đầy đủ vào vùng tạm của sandbox hoặc vùng tạm riêng trên host;
2. thay payload trong context bằng preview có giới hạn;
3. ghi kích thước ký tự, kích thước byte, SHA-256 và recovery path;
4. cho phép đọc lại từng phần bằng offset/limit.

Không còn tool văn bản nào được miễn trần bằng giá trị vô hạn. Structured vision
content đi qua đường adapter và tóm tắt cơ sở dữ liệu riêng, nên cần evidence
artifact tách biệt trước khi công bố mọi định dạng output đều đã được bao phủ.

## 3. Context resolver, compaction và recovery

V32 tách published capacity khỏi effective route limit. Backend lưu cả giá trị
và nguồn metadata để UI không dùng con số 1,05M như một bảo đảm vận hành.

- GPT-5.6 trên OpenAI Responses trực tiếp hoặc Codex subscription đủ điều kiện
  dùng native compaction ở mục tiêu 190.000 active input token.
- Local fallback được giữ sẵn quanh 208.000 token cho tuyến đủ điều kiện.
- Provider từ chối native compaction sẽ tạo downgrade theo session, không tắt
  toàn cục. Request được thử lại một lần không kèm native compaction.
- Context overflow được phân loại riêng, compact rồi retry provider đúng một
  lần. Lỗi lần hai trả handoff có recovery pointer và giải phóng composer.
- Quota, billing và rate limit không kích hoạt compaction mù. State lưu normalized
  code, reset time nếu có và giữ session để người dùng tiếp tục, compact hoặc
  đổi model sau đó.
- Effective limit/source, logical history, active context, compaction count,
  native downgrade và context-retry marker được persist qua restart.
- Bedrock không tự gửi probe ngữ cảnh cỡ rất lớn. Live probe chỉ chạy khi operator
  chủ động bật `HERMES_BEDROCK_LIVE_CONTEXT_PROBE`; đây là cổng kỹ thuật nội bộ,
  chưa phải tùy chọn người dùng được khuyến nghị.
- Regression runtime tạo transcript logic trên 350k, compact dưới ngưỡng 208k,
  persist/relaunch bằng SQLite và tiếp tục ở agent mới trong mock profile. Toàn
  bộ retention anchors vẫn còn; canonical context group đạt 246/246.

## 4. Lean Session và prompt-cache parity

Profile mặc định của session mới là `lean`. Tool surface được giải quyết và đóng
băng trước call đầu, sau đó giữ nguyên trong toàn bộ session và khi resume.

Lean giữ bốn schema model-facing ổn định trong fixture chuẩn:

- `clarify`
- `tool_search`
- `tool_describe`
- `tool_call`

Các built-in đã được cấp quyền vẫn nằm trong catalog nhưng chỉ hiện qua ba bridge
Tool Search khi cần. Việc describe hoặc gọi một tool deferred không thay đổi
`tools[]` ở request kế tiếp. Người dùng cần tương thích cũ có thể chọn profile
`full` cho session mới.

Lean đồng thời tắt background review mặc định. Với prompt giải thích đơn giản,
hợp đồng mục tiêu là một main response, không tool call và không review nền.

Benchmark offline sơ bộ ở mốc `596d188b2` ước tính fresh active input giảm từ
34.299 xuống 5.169 token và active schema giảm từ 59 xuống 4. Đây là static
estimate, chưa phải tokenizer usage hoặc hóa đơn provider. Bản evidence cuối cần
được khóa theo commit trong
`docs/v32/benchmarks/offline-benchmark-2026-08-24.md`.

## 5. Desktop và meter minh bạch

- Trang **Nhắn tin** có nút quay lại phiên làm việc và giữ draft cùng trạng thái
  pane đang dùng.
- Nút `+` trên thanh tab phiên xử lý pointer thật, tạo phiên/tab mới và giữ hành
  vi focus, trợ năng cùng thông báo lỗi.
- Headline context dùng active context chia effective limit và hiển thị một chữ
  số thập phân.
- Panel tách system/background, conversation, logical history, compaction count,
  effective limit, published reference và metadata source.
- Quota không được suy từ context. Khi backend chưa có dữ liệu, UI hiển thị
  “Chưa có dữ liệu”.
- Subscription route ghi rõ chi phí là **API tương đương**, không phải khoản đang
  bị tính. API-billed route dùng nhãn actual hoặc estimated phù hợp.
- Meter theo turn hiển thị model calls, tool calls, input mới, cache-read, output,
  API-equivalent cùng trạng thái bình thường, gần giới hạn hoặc đã tạm dừng.

## Checkpoint triển khai

| Commit | Phạm vi |
| --- | --- |
| `139e58e5d` | Khóa kế hoạch v32 và ba decision log |
| `25d2c6e8d` | Giới hạn raw output theo byte, artifact pointer và persistence |
| `d3b462471` | Lõi `TurnGovernor` và test thuần |
| `fa75aad0b` | Context compaction, classifier và recovery state |
| `9f9df0b4e` | Messaging back, tab `+` và context UX |
| `0c9f2fa78` | Tool profile lean/full bất biến trong session |
| `06fc7e2c6` | Governor tổng hợp parent/subagent và live meter |
| `8834a52fd` | Reservation cho hidden compaction cùng xAI paths |
| `fc16ae445` | Reservation cho provider fallback và Bedrock probe paths |
| `c84a4adee` | Hạ failsafe mặc định, tắt Bedrock live probe tự động |
| `596d188b2` | Giữ đúng binding của exception Governor qua cleanup |
| `44aa3e18b` | Harness vòng đời Windows x64 cô lập và evidence contract |
| `4ce6fc812` | Truyền đúng local candidate tag vào payload provenance |
| `ffa71a840` | Fail-closed runtime opaque và khóa aggregate Governor |
| `[checkpoint kế tiếp]` | Continuity >350k qua compaction, persistence và relaunch |

## Thành phần chính bị ảnh hưởng

| Lớp | Thành phần chính |
| --- | --- |
| Governor | `agent/turn_budget.py`, conversation loop, transports, auxiliary accounting |
| Context | model metadata, native/local compaction, error classifier, session state |
| Tool output | budget config, tool-result storage, incremental persistence |
| Lean Session | agent init, model tool assembly, Tool Search bridges |
| Gateway/API | per-turn event, usage response, persistence và resume |
| Desktop | Messaging route, session actions, context meter, context usage panel, i18n |

## Bằng chứng và cổng cuối

- Báo cáo test hợp nhất: `docs/v32/test-report.md`.
- Benchmark offline: `docs/v32/benchmarks/offline-benchmark-2026-08-24.md`.
- Bản nháp release notes: `docs/v32/release-notes-draft.vi.md`.
- Quyết định phát hành và rollback: `docs/v32/go-no-go.md`.

Source matrix, exact packaged smoke, hosted isolated lifecycle và private
staging đều đạt. Lifecycle receipt khóa 19/19 gate tại run `32865922889`;
chi tiết nằm trong `docs/v32/evidence/` và `docs/v32/go-no-go.md`.

Không có live provider proof vì chưa được duyệt quota; không có Authenticode.
Hai giới hạn này được công bố rõ cho community pilot chưa stable. Công việc kỹ
thuật đã hoàn tất; promotion khóa exact byte, tự hậu kiểm và tự khôi phục v31
nếu bất kỳ cổng công khai nào thất bại.
