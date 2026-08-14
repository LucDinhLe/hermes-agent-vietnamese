## Hermes Vietnamese

Bản cộng đồng đa nền tảng với giao diện tiếng Việt mặc định và nút chuyển nhanh VI/EN. Tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI agent sinh ra được giữ nguyên.

Đây là một dự án cá nhân, độc lập, được thực hiện nhằm hỗ trợ người dùng Việt tiếp cận và sử dụng Hermes Agent thuận tiện hơn. Giấy phép, thuật toán, kiến trúc và các tính năng lõi của Hermes vẫn được giữ theo dự án gốc.

> **Dùng Windows và gặp cảnh báo khi tải/cài?** Xem [hướng dẫn từng bước bằng hình ảnh](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/docs/cai-dat-windows-bang-anh.md). Cảnh báo không tự biến mất khi chờ; hướng dẫn chỉ rõ vị trí **See more → Keep anyway → More info → Run anyway** và cách phân biệt cảnh báo uy tín với cảnh báo phát hiện mối đe dọa thực sự.

### Chọn đúng tệp

| Máy đang dùng           | Tải trực tiếp                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-13/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-13/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-13/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-13/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian           | [Chọn `.deb` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                   |
| Fedora/RHEL             | [Chọn `.rpm` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                   |
| Linux khác              | [Chọn `.AppImage` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                              |

### Kiểm tra máy trước khi tải

- **Windows:** nhấn `Windows + I` → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. `x64-based processor` chọn x64; `ARM-based processor` chọn ARM64.
- **macOS:** mở ** → About This Mac/Giới thiệu về máy Mac**. Máy cần macOS 12 trở lên. Chip `Apple M` chọn Apple Silicon; `Intel` chọn bản Intel.
- **Linux:** mở **Settings → About**. `x86_64`/`amd64` chọn x64; `aarch64`/`arm64` chọn ARM64. Có thể chạy `uname -m` nếu giao diện không hiển thị.

Xem [hướng dẫn kiểm tra máy chi tiết](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

Mỗi người đăng nhập OpenAI Codex hoặc Claude Pro/Max bằng tài khoản của chính mình. Gemini dùng khóa API Google AI Studio của chính người dùng. Bản dựng không chứa tài khoản, mã OAuth, khóa API hoặc dữ liệu trò chuyện của người đóng gói.

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Khi người dùng chủ động gửi yêu cầu tới nhà cung cấp AI, nội dung cần thiết sẽ được nhà cung cấp đã chọn xử lý theo điều khoản và chính sách quyền riêng tư của họ.

### Cải thiện trong bản vá này

- Thêm **Tạo bản sao lưu**, **Mở vị trí bản sao lưu** và **Khôi phục bản sao lưu** ngay tại **Trung tâm chỉ huy → Bảo trì**; người dùng không cần Terminal hoặc tự tìm thư mục dữ liệu.
- Việt hóa các nhãn và mô tả cấu hình còn sót trong phần cài đặt model; vẫn giữ nguyên tên model, nhà cung cấp, giao thức và giá trị kỹ thuật.
- Việt hóa tiêu đề động của các vùng **Phiên**, **Dòng lệnh**, **Hệ thống tệp** và **Thay đổi mã**; sửa nút `Add context` còn sót thành **Đính kèm**.
- Việt hóa tên nhóm kỹ năng ở lớp hiển thị mà không đổi tên kỹ năng, đường dẫn hoặc dữ liệu kỹ thuật bên dưới.
- Nút **Ghi chú phát hành** trong ứng dụng nay mở đúng GitHub Releases của Hermes Vietnamese.
- Sửa đường dẫn mở trực tiếp mục **Bảo trì** trong Trung tâm chỉ huy.
- Trình cài Windows tự chạy một lượt sửa chữa an toàn khi Python đã được Windows ghi nhận nhưng tệp cài đặt thực tế bị thiếu; thông báo lỗi cũng hiển thị đúng phiên bản Python 3.12.
- Sửa lỗi `AIAgent.__init__()` khiến agent không khởi tạo khi vùng xem trước tương tác được bật.
- Khôi phục thanh tab nhiều phiên luôn hiển thị ở vùng giữa; mở Trình duyệt dùng chung trong panel bên phải cạnh tên thư mục để trò chuyện và duyệt web song song. Chuyển giữa **Tệp** và **Trình duyệt** vẫn giữ cây thư mục, lịch sử trang và phiên đăng nhập.
- Các tiêu đề giữ chỗ `NEW SESSION` do bản cũ đã lưu nay hiển thị thành `Phiên mới` khi dùng tiếng Việt, không sửa nội dung do người dùng tự đặt.
- Khi nâng cấp ứng dụng, bản Desktop nay tự đồng bộ lõi Hermes đi kèm đúng một lần; lịch sử, cấu hình và thông tin đăng nhập cục bộ được giữ nguyên.
- Trình cập nhật Windows không còn dừng nhầm chính ứng dụng Hermes trong bước làm mới môi trường chạy.
- Quá trình cập nhật hiện bằng tiếng Việt ngay cả khi dịch vụ nền chưa khởi động, không quay lại màn chọn thiết lập và không cần Terminal.
- Lần mở tiếp theo vào thẳng không gian làm việc, không chạy lại trình cài nếu lõi đã được đồng bộ.
- Màn **Kết nối model** hiện ngay ba lựa chọn phổ biến theo thứ tự: `OpenAI OAuth (ChatGPT)`, `Claude Pro / Max (qua Claude Code)` và `Google Gemini (khóa API)`.
- Toàn bộ kết nối tài khoản, khóa API và endpoint cục bộ được hiện trực tiếp trong danh sách; nhà cung cấp mới từ lõi Hermes sẽ tự xuất hiện.
- Bấm Gemini sẽ mở trực tiếp form khóa API và chọn sẵn Google AI Studio, giúp phân biệt rõ với gói thuê bao Gemini trên web.
- Thiết lập lần đầu được trình bày thành ba bước: cài đặt và chọn ngôn ngữ, kết nối model, bắt đầu giao việc.
- Người dùng không cần mở Terminal, chạy lệnh hoặc sửa tệp cấu hình để hoàn tất thiết lập; Terminal tích hợp trong Hermes vẫn được giữ nguyên.
- macOS Intel x64 có gói riêng bên cạnh Apple Silicon; Windows và Linux tiếp tục có bản x64/ARM64.
- Windows ưu tiên tải `uv` từ wheel PyPI chính thức, kiểm tra SHA-256 trước khi chạy để giảm lỗi Smart App Control trong quá trình bootstrap.
- Trình cài Windows bật hỗ trợ đường dẫn dài chỉ trong tiến trình bootstrap, tránh lỗi `Filename too long` mà không thay đổi cấu hình Git toàn máy.
- Danh mục model luôn hiện nút mở rộng và số model của từng nhà cung cấp, kể cả khi nhóm đang thu gọn.
- Claude Pro/Max hiển thị tên model cụ thể: `claude-sonnet-5`, `claude-fable-5`, `claude-opus-5`, `claude-opus-4-8` và `claude-haiku-4-5`.
- Gemini được ghi rõ là kết nối qua Google AI Studio API key hoặc Google Vertex AI. Hermes không dùng lại OAuth của Gemini CLI vì điều khoản Google không cho phần mềm bên thứ ba dùng luồng đó.

### Bảo mật khi cài

Dự án đã nộp hồ sơ tham gia chương trình ký mã nguồn mở của SignPath Foundation và đang chờ xét duyệt. Trong thời gian chờ, Windows SmartScreen hoặc macOS Gatekeeper có thể cảnh báo vì tệp chưa có chữ ký số xác minh nhà phát hành. Đây không phải kết luận rằng Microsoft hoặc Apple đã từ chối dự án hay phần mềm không được phép cài.

Đối chiếu tệp đã tải với `SHA256SUMS.txt` và chỉ tiếp tục khi mã SHA-256 khớp với tệp từ kho chính thức này. Chứng thư ký mã dùng để xác minh nguồn phát hành; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp.

Xem trạng thái, phạm vi ký và vai trò phê duyệt trong [Code signing policy](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md). Chỉ các bản phát hành ghi rõ trạng thái ký mới được xem là đã ký số.

Xem [hướng dẫn cài đặt và kết nối bằng tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md). Phạm vi miễn trừ đối với hệ thống, thuật toán và giấy phép Hermes được giải thích trong [DISCLAIMER.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md); văn bản có hiệu lực vẫn là `LICENSE`.
