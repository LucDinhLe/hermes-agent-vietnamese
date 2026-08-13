## Hermes Vietnamese

Bản cộng đồng đa nền tảng với giao diện tiếng Việt mặc định và nút chuyển nhanh VI/EN. Tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI agent sinh ra được giữ nguyên.

Đây là một dự án cá nhân, độc lập, được thực hiện nhằm hỗ trợ người dùng Việt tiếp cận và sử dụng Hermes Agent thuận tiện hơn. Giấy phép, thuật toán, kiến trúc và các tính năng lõi của Hermes vẫn được giữ theo dự án gốc.

### Chọn đúng tệp

| Máy đang dùng           | Tải trực tiếp                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-8/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-8/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-8/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-8/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian           | [Chọn `.deb` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                  |
| Fedora/RHEL             | [Chọn `.rpm` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                  |
| Linux khác              | [Chọn `.AppImage` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                             |

### Kiểm tra máy trước khi tải

- **Windows:** nhấn `Windows + I` → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. `x64-based processor` chọn x64; `ARM-based processor` chọn ARM64.
- **macOS:** mở ** → About This Mac/Giới thiệu về máy Mac**. Máy cần macOS 12 trở lên. Chip `Apple M` chọn Apple Silicon; `Intel` chọn bản Intel.
- **Linux:** mở **Settings → About**. `x86_64`/`amd64` chọn x64; `aarch64`/`arm64` chọn ARM64. Có thể chạy `uname -m` nếu giao diện không hiển thị.

Xem [hướng dẫn kiểm tra máy chi tiết](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

Mỗi người đăng nhập OpenAI Codex hoặc Claude Pro/Max bằng tài khoản của chính mình. Gemini dùng khóa API Google AI Studio của chính người dùng. Bản dựng không chứa tài khoản, mã OAuth, khóa API hoặc dữ liệu trò chuyện của người đóng gói.

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Khi người dùng chủ động gửi yêu cầu tới nhà cung cấp AI, nội dung cần thiết sẽ được nhà cung cấp đã chọn xử lý theo điều khoản và chính sách quyền riêng tư của họ.

### Cải thiện trong bản vá này

- Màn **Kết nối model** hiện ngay ba lựa chọn phổ biến theo thứ tự: `OpenAI OAuth (ChatGPT)`, `Claude Pro / Max (qua Claude Code)` và `Google Gemini (khóa API)`.
- Nous Portal, OpenRouter, Fireworks và các dịch vụ còn lại được chuyển xuống mục **Nhà cung cấp khác**; không còn dẫn người mới vào trang chọn gói Nous trước khi thấy các kết nối đang có.
- Bấm Gemini sẽ mở trực tiếp form khóa API và chọn sẵn Google AI Studio, giúp phân biệt rõ với gói thuê bao Gemini trên web.
- Thiết lập lần đầu được trình bày thành ba bước: cài đặt và chọn ngôn ngữ, kết nối model, bắt đầu giao việc.
- Người dùng không cần mở Terminal, chạy lệnh hoặc sửa tệp cấu hình để hoàn tất thiết lập; Terminal tích hợp trong Hermes vẫn được giữ nguyên.
- macOS Intel x64 có gói riêng bên cạnh Apple Silicon; Windows và Linux tiếp tục có bản x64/ARM64.
- Windows ưu tiên tải `uv` từ wheel PyPI chính thức, kiểm tra SHA-256 trước khi chạy để giảm lỗi Smart App Control trong quá trình bootstrap.
- Trình cài Windows bật hỗ trợ đường dẫn dài chỉ trong tiến trình bootstrap, tránh lỗi `Filename too long` mà không thay đổi cấu hình Git toàn máy.
- Danh mục model luôn hiện nút mở rộng và số model của từng nhà cung cấp, kể cả khi nhóm đang thu gọn.
- Claude Pro/Max hiển thị rõ ba lựa chọn `Sonnet`, `Opus` và `Haiku` sau khi mở rộng.
- Gemini được ghi rõ là kết nối qua `Google AI Studio (API)`, tránh nhầm với gói thuê bao Gemini hoặc OAuth của Gemini CLI.

### Bảo mật khi cài

Đối chiếu tệp đã tải với `SHA256SUMS.txt`. Nếu bản phát hành chưa được ký số, Windows SmartScreen hoặc macOS Gatekeeper có thể cảnh báo. Đây là giới hạn của bản cộng đồng chưa có chứng thư phát hành, không phải bằng chứng rằng cảnh báo nên bị bỏ qua. Chỉ tiếp tục khi mã SHA-256 khớp và tệp được tải từ kho chính thức này.

Xem trạng thái, phạm vi ký và vai trò phê duyệt trong [Code signing policy](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md). Chỉ các bản phát hành ghi rõ trạng thái ký mới được xem là đã ký số.

Xem [hướng dẫn cài đặt và kết nối bằng tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md). Phạm vi miễn trừ đối với hệ thống, thuật toán và giấy phép Hermes được giải thích trong [DISCLAIMER.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md); văn bản có hiệu lực vẫn là `LICENSE`.
