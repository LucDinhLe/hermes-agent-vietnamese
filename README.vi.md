# Hermes Agent tiếng Việt

Đây là bản địa hóa cộng đồng của [Hermes Agent](https://github.com/NousResearch/hermes-agent), dành cho người Việt muốn sử dụng AI agent dễ dàng hơn dù không thạo tiếng Anh.

Giao diện Desktop mặc định dùng tiếng Việt và có nút chuyển nhanh **VI/EN**. Người dùng vẫn có thể đổi ngôn ngữ trong phần Cài đặt. Tên model, tên riêng, thương hiệu, giao thức và câu lệnh được giữ nguyên để tránh sai lệch kỹ thuật.

Mã nguồn gốc thuộc Nous Research và được phân phối theo giấy phép MIT. Đây là bản cộng đồng không chính thức, không được Nous Research, OpenAI, Anthropic hoặc Google bảo chứng. Mỗi người dùng đăng nhập bằng tài khoản hoặc khóa API của chính mình; bộ cài không kèm tài khoản AI trả phí.

## Bắt đầu nhanh

1. Mở [bản thử nghiệm đa nền tảng hiện tại](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-4).
2. Chọn tệp đúng hệ điều hành và kiến trúc theo bảng bên dưới.
3. Đối chiếu mã SHA-256 nếu hệ điều hành hiện cảnh báo.
4. Cài ứng dụng, chọn nhà cung cấp mô hình và đăng nhập bằng tài khoản của bạn.

## Chọn đúng bộ cài

| Hệ điều hành             | Kiến trúc     | Tệp nên tải                                       | Trạng thái                                    |
| ------------------------ | ------------- | ------------------------------------------------- | --------------------------------------------- |
| Windows 10/11            | x64           | `Hermes-Vietnamese-Windows-x64-Setup.exe`         | Thử nghiệm cộng đồng                          |
| Windows 10/11            | ARM64         | `Hermes-Vietnamese-Windows-arm64-Setup.exe`       | Thử nghiệm; runner build còn ở Public Preview |
| macOS 12 trở lên         | Apple Silicon | `Hermes-Vietnamese-macOS-Apple-Silicon.dmg`       | Thử nghiệm cộng đồng                          |
| Ubuntu/Linux tương thích | x64           | `.deb`, `.rpm` hoặc `.AppImage` có hậu tố `x64`   | Thử nghiệm cộng đồng                          |
| Ubuntu/Linux tương thích | ARM64         | `.deb`, `.rpm` hoặc `.AppImage` có hậu tố `arm64` | Thử nghiệm; runner build còn ở Public Preview |

Hermes chính thức ưu tiên macOS dùng Apple Silicon. Mac Intel không nằm trong phạm vi hỗ trợ của bản cộng đồng này. Windows 32-bit và Linux ARM 32-bit cũng không được đóng gói.

### Yêu cầu hệ thống

- **Windows:** Windows 10 hoặc 11 bản 64-bit. Vào **Cài đặt → Hệ thống → Giới thiệu → Loại hệ thống** để xem máy dùng x64 hay ARM64.
- **macOS:** macOS 12 trở lên, máy dùng chip Apple M-series.
- **Linux:** ưu tiên Ubuntu 24.04 trở lên. Các bản phân phối có `glibc`, `systemd` và cấu trúc thư mục FHS có khả năng tương thích; cần `git`, `curl`, `xz-utils` và bộ công cụ biên dịch C/C++ cho lần cài môi trường chạy.
- **Kết nối mạng:** bắt buộc ở lần mở đầu tiên để Hermes tải môi trường chạy và để đăng nhập nhà cung cấp AI.

Dự án Hermes gốc chưa công bố ngưỡng RAM, CPU và dung lượng trống bắt buộc. Bản cộng đồng khuyến nghị thực tế **RAM 8 GB, CPU 4 luồng và còn trống 4 GB** để cài môi trường chạy cùng dữ liệu cơ bản. Đây là mức khuyến nghị vận hành, chưa phải cam kết tối thiểu đã được đo kiểm. Nếu chạy model cục bộ, cấu hình phụ thuộc từng model và thường cao hơn đáng kể.

## Cài đặt trên Windows

1. Mở [bản thử nghiệm đa nền tảng hiện tại](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-4).
2. Tải bộ cài `x64` hoặc `arm64` đúng với **Loại hệ thống** của máy.
3. Chạy bộ cài và mở Hermes.
4. Ở lần mở đầu tiên, chờ Hermes tải môi trường chạy. Quá trình này cần Internet và có thể mất vài phút.
5. Chọn nhà cung cấp mô hình rồi đăng nhập bằng tài khoản của chính bạn.

### Cảnh báo SmartScreen

Bộ cài cộng đồng hiện chưa có chứng thư ký số thương mại. Windows có thể hiện cảnh báo SmartScreen. Kiểm tra mã SHA-256 trong tệp **SHA256SUMS.txt** của cùng bản phát hành, sau đó chọn **Thông tin thêm** → **Vẫn chạy** nếu mã khớp.

## Cài đặt trên macOS

1. Tải **Hermes-Vietnamese-macOS-Apple-Silicon.dmg** từ trang Bản phát hành.
2. Mở tệp DMG và kéo Hermes vào thư mục **Applications**.
3. Mở Hermes từ Applications.
4. Nếu Gatekeeper cảnh báo vì bản cộng đồng chưa được ký/công chứng, hãy đối chiếu SHA-256 trước. Sau đó nhấp phải vào Hermes → **Open**, hoặc vào **System Settings → Privacy & Security → Open Anyway**.

Không dùng lệnh xóa thuộc tính bảo mật trên toàn bộ ứng dụng. Cảnh báo Gatekeeper sẽ hết đúng cách khi bản phát hành có chứng thư Apple Developer ID và được Apple công chứng.

## Cài đặt trên Linux

Chọn một trong ba định dạng đúng kiến trúc:

- **Ubuntu/Debian:** `sudo apt install ./Hermes-Vietnamese-Linux-x64.deb`
- **Fedora/RHEL:** `sudo dnf install ./Hermes-Vietnamese-Linux-x64.rpm`
- **AppImage:** cấp quyền chạy cho tệp rồi mở trực tiếp; không cần cài ở cấp hệ thống.

Thay `x64` bằng `arm64` khi dùng máy Linux ARM64. Nếu AppImage không mở, kiểm tra FUSE theo hướng dẫn của bản phân phối hoặc dùng gói `.deb`/`.rpm` thay thế.

## Đăng nhập mô hình

- **OpenAI Codex:** đăng nhập bằng tài khoản ChatGPT của bạn qua luồng mã thiết bị. Một số tài khoản cần bật xác thực mã thiết bị trong phần bảo mật ChatGPT.
- **Claude Pro / Max:** chọn **Claude Pro / Max (qua Claude Code)** rồi đăng nhập bằng cửa sổ chính thức của Claude Code. Hermes không đọc hoặc lưu mã OAuth của Claude. Cầu nối chỉ chạy khi Claude Code xác nhận đang dùng tài khoản Claude chính chủ và Extra Usage đang tắt, nhờ đó tránh vô tình chuyển sang tính phí API ngoài gói.
- **Claude API:** tùy chọn Anthropic API riêng vẫn có sẵn cho người muốn thanh toán theo mức sử dụng; đây là nhà cung cấp khác với Claude Pro / Max.
- **Gemini:** dùng khóa API do chính bạn tạo tại [Google AI Studio](https://aistudio.google.com/apikey). Gói Gemini trên web không tự động cấp quyền API.
- **Nhà cung cấp khác:** Hermes hỗ trợ OpenRouter, Nous Portal và nhiều dịch vụ tương thích khác.

Bộ cài không chứa tài khoản, khóa API hay dữ liệu trò chuyện của người đóng gói. Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của họ.

## Cập nhật

Bản này cài backend và nhận cập nhật từ kho **LucDinhLe/hermes-agent-vietnamese**. Mã mới từ dự án gốc sẽ được xem xét, kiểm thử rồi đồng bộ vào bản cộng đồng để tránh làm mất phần Việt hóa.

Linux không có cơ chế cập nhật Electron tích hợp chung cho mọi bản phân phối. Người dùng Linux nên tải bản mới hoặc cập nhật qua trình quản lý gói tương ứng.

## Gỡ cài đặt và dữ liệu

Gỡ ứng dụng trong **Settings → Apps → Installed apps** của Windows. Hermes còn giữ môi trường chạy và dữ liệu người dùng trong **%LOCALAPPDATA%\hermes** để tránh mất lịch sử ngoài ý muốn. Chỉ xóa thư mục đó khi bạn chắc chắn không cần dữ liệu cũ.

Trên macOS/Linux, dữ liệu mặc định nằm trong `~/.hermes`. Xóa ứng dụng không tự động xóa thư mục này, nên tài khoản, phiên và bộ nhớ không bị mất ngoài ý muốn.

## Phạm vi hỗ trợ

- Bản phát hành: Windows x64/ARM64, macOS Apple Silicon và Linux x64/ARM64.
- Giao diện Desktop đã được Việt hóa; nội dung do mô hình tạo phụ thuộc ngôn ngữ bạn yêu cầu.
- Claude Pro / Max hiện hỗ trợ trò chuyện trực tiếp trong Desktop. Công cụ, agent nền và lịch chạy của Claude Code chưa được chuyển thành công cụ Hermes trong bản đầu tiên.
- Đây là bản cộng đồng không chính thức và không được Nous Research bảo chứng.

## Dành cho người đóng góp

Các thay đổi chính nằm tại:

- **apps/desktop/src/i18n/vi.ts**
- **apps/desktop/src/i18n/languages.ts**
- **scripts/install.ps1** và **scripts/install.sh**
- **.github/workflows/release-vietnamese.yml**
- **docs/community-release.md**

Trước khi phát hành, chạy kiểm thử giao diện, kiểm tra kiểu TypeScript, build trên đúng hệ điều hành/kiến trúc, xác minh cấu trúc gói và quét bí mật trong phần thay đổi.
