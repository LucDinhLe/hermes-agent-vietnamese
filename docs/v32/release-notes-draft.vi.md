# Bản nháp ghi chú phát hành Hermes Vietnamese v32

> **BẢN NHÁP NỘI BỘ — CHƯA DÙNG ĐỂ CÔNG BỐ**
>
> Phiên bản, commit, ma trận hỗ trợ, chữ ký và mã băm bên dưới còn placeholder.

## Thông tin candidate

- Phiên bản: `[CANDIDATE_VERSION]`
- Tag: `[CANDIDATE_TAG]`
- Commit: `[CANDIDATE_COMMIT]`
- Lớp phát hành: `[LOCAL CANDIDATE / COMMUNITY PRERELEASE]`
- Ngày build: `[BUILD_DATE_UTC]`
- Trạng thái ký số: `[WINDOWS_SIGNING]`; `[MACOS_SIGNING_NOTARIZATION]`
- Rollback target: `vi-v0.20.4-39`

## Điểm mới trong v32

### Chủ động dừng một yêu cầu quá dài

Hermes nay theo dõi tổng số lần gọi mô hình và công cụ trong từng yêu cầu của
người dùng, gồm cả các việc phụ và agent chuyên trách mà Hermes quan sát được.
Ứng dụng cảnh báo khi yêu cầu bắt đầu dài bất thường, sau đó tạm dừng an toàn ở
12 lần gọi mô hình hoặc 20 lần gọi công cụ. Người dùng có thể xem số đã dùng và
gửi **tiếp tục** trong một lượt mới.

### Phiên mới nhẹ hơn

Lean Session chỉ đưa một bộ bridge nhỏ, ổn định vào prompt ban đầu. Công cụ đã
được cấp quyền vẫn có thể tìm và gọi khi cần. Cách này giảm đáng kể phần ngữ
cảnh nền mà vẫn giữ prompt cache ổn định qua nhiều lượt và sau khi mở lại phiên.

Người dùng cần hành vi tương thích cũ có thể chọn profile `full` khi bắt đầu
session mới.

### Compaction sớm và phục hồi rõ hơn

V32 tách giới hạn model công bố khỏi giới hạn thực tế của tuyến đang dùng. Với
tuyến GPT-5.6 phù hợp, Hermes chuẩn bị compaction trước vùng lỗi từng quan sát.
Khi provider trả lỗi context, Hermes compact và thử lại đúng một lần. Lỗi quota,
billing hoặc rate limit được giữ thành trạng thái riêng và không làm mất session.

### Output công cụ không còn phình context âm thầm

Tool result lớn được lưu thành artifact có kích thước, SHA-256 và đường đọc lại.
Model chỉ nhận preview có giới hạn. Trần mặc định là 9.500 byte UTF-8 cho một
kết quả văn bản và 38.000 byte cho tổng kết quả trong một turn.

### Context meter dễ hiểu hơn

Panel mới tách:

- active context và effective limit;
- system/background với conversation;
- logical history và số lần compaction;
- quota provider khi có dữ liệu;
- chi phí actual, estimated hoặc API tương đương.

Với gói thuê bao, số tiền tham chiếu được ghi rõ là **API tương đương**, không
phải khoản đang bị tính vào tài khoản.

### Sửa trải nghiệm Desktop

- Trang **Nhắn tin** có đường quay lại phiên rõ ràng.
- Nút `+` trên thanh tab tạo phiên mới bằng thao tác pointer thật.
- Draft, focus, Browser/Terminal pane và thông báo lỗi được giữ qua thao tác.
- Meter theo turn hiển thị model calls, tool calls, input mới, cache-read,
  output và trạng thái gần giới hạn hoặc đã tạm dừng.

## Kết quả benchmark

`[PARENT: chèn bảng before/after đã khóa theo exact candidate commit; ghi rõ đây
là static estimate hay provider-measured usage. Liên kết evidence JSON/Markdown.]`

Mục tiêu nghiệm thu của v32:

- fresh lean dưới 1% của cửa sổ tham chiếu 1,05M;
- prompt giải thích đơn giản chỉ có một main response;
- không tool loop hoặc background review khi không cần;
- logical transcript trên 350k đi vào đúng kế hoạch compaction và giữ recovery
  anchors.

## Giới hạn đã biết

### Meter chưa nhìn xuyên ba runtime agentic bên ngoài

Codex app-server, Claude Code và Copilot ACP chạy qua subprocess hoặc protocol
riêng. Hermes đếm được request ở biên gọi runtime, nhưng chưa thể đếm trước từng
provider request, retry hoặc tool call vật lý bên trong tiến trình đó. Meter có
thể thấp hơn mức dùng thật trên ba tuyến này. Bản phát hành không được tuyên bố
đã phủ toàn bộ physical attempts cho tới khi protocol cung cấp telemetry phù
hợp hoặc các tuyến này fail closed theo chính sách được duyệt.

### Bằng chứng provider và artifact

- Chưa có live provider probe được duyệt.
- `[PARENT: điền trạng thái packaged Windows x64 smoke.]`
- `[PARENT: điền target nào có máy thật; target còn lại phải ghi BUILD-ONLY-PILOT.]`
- `[PARENT: điền trạng thái update, repair, uninstall giữ/xóa dữ liệu và rollback.]`

### Ký số và phạm vi hỗ trợ

`[PARENT: công bố chính xác Authenticode, Developer ID, notarization, stapling
và SmartScreen/Gatekeeper evidence. Nếu chưa có, chỉ được gọi community pilot
chưa ký; không dùng stable/final.]`

## Tải xuống và kiểm tra

Chỉ điền mục này sau khi cùng một bộ byte đã staging và vượt exact-artifact
smoke.

| Nền tảng | Tệp | Byte | SHA-256 | Trạng thái runtime |
| --- | --- | ---: | --- | --- |
| Windows x64 | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/PENDING]` |
| Windows ARM64 | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/BUILD-ONLY]` |
| macOS Apple Silicon | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/BUILD-ONLY]` |
| macOS Intel | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/BUILD-ONLY]` |
| Linux x64 | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/BUILD-ONLY]` |
| Linux ARM64 | `[FILENAME]` | `[SIZE]` | `[SHA256]` | `[VERIFIED/BUILD-ONLY]` |

## Cập nhật và quay lui

- Bản v32 chưa được công bố sẽ không thay đổi GitHub Latest hiện tại.
- Rollback target kỹ thuật của đợt nghiệm thu là `vi-v0.20.4-39`.
- Không tự động đưa state/profile v32 về bản cũ trước khi compatibility và
  rollback đã được diễn tập.
- Không xóa profile hoặc Electron userData trong quá trình quay lui.
- Artifact đã staging giữ bất biến. Mọi sửa mã tạo candidate, tag và digest mới.

## Bằng chứng phát hành

- Test report: `[LINK_OR_PATH_TO_FINAL_TEST_REPORT]`
- Benchmark: `[LINK_OR_PATH_TO_FINAL_BENCHMARK]`
- Candidate manifest: `[LINK_OR_PATH_TO_MANIFEST]`
- Windows smoke: `[LINK_OR_PATH_TO_SMOKE_RECEIPT]`
- Screenshots: `[LINK_OR_PATH_TO_SCREENSHOTS]`
- GO/NO-GO: `[LINK_OR_PATH_TO_SIGNED_DECISION]`
