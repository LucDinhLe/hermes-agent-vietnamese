# Hermes Agent tiếng Việt

Đây là bản Việt hóa cộng đồng của [Hermes Agent](https://github.com/NousResearch/hermes-agent), dành trước hết cho người dùng Windows tại Việt Nam.

Giao diện Desktop mặc định dùng tiếng Việt. Người dùng vẫn có thể đổi sang các ngôn ngữ khác trong phần Cài đặt. Mã nguồn gốc thuộc Nous Research và được phân phối theo giấy phép MIT.

## Cài đặt trên Windows

1. Mở trang [Bản phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest).
2. Tải tệp **Hermes-Vietnamese-Windows-x64-Setup.exe**.
3. Chạy bộ cài và mở Hermes.
4. Ở lần mở đầu tiên, chờ Hermes tải môi trường chạy. Quá trình này cần Internet và có thể mất vài phút.
5. Chọn nhà cung cấp mô hình rồi đăng nhập bằng tài khoản của chính bạn.

### Cảnh báo SmartScreen

Bộ cài cộng đồng hiện chưa có chứng thư ký số thương mại. Windows có thể hiện cảnh báo SmartScreen. Kiểm tra mã SHA-256 trong tệp **SHA256SUMS.txt** của cùng bản phát hành, sau đó chọn **Thông tin thêm** → **Vẫn chạy** nếu mã khớp.

## Đăng nhập mô hình

- **OpenAI Codex:** đăng nhập bằng tài khoản ChatGPT của bạn qua luồng mã thiết bị. Một số tài khoản cần bật xác thực mã thiết bị trong phần bảo mật ChatGPT.
- **Claude:** đăng nhập Claude Code bằng tài khoản của bạn. Anthropic có thể yêu cầu bật Extra Usage cho ứng dụng bên thứ ba.
- **Gemini:** dùng khóa API do chính bạn tạo tại [Google AI Studio](https://aistudio.google.com/apikey). Gói Gemini trên web không tự động cấp quyền API.
- **Nhà cung cấp khác:** Hermes hỗ trợ OpenRouter, Nous Portal và nhiều dịch vụ tương thích khác.

Bộ cài không chứa tài khoản, khóa API hay dữ liệu trò chuyện của người đóng gói. Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của họ.

## Cập nhật

Bản này cài backend và nhận cập nhật từ kho **LucDinhLe/hermes-agent-vietnamese**. Mã mới từ dự án gốc sẽ được xem xét, kiểm thử rồi đồng bộ vào bản cộng đồng để tránh làm mất phần Việt hóa.

## Gỡ cài đặt và dữ liệu

Gỡ ứng dụng trong **Settings → Apps → Installed apps** của Windows. Hermes còn giữ môi trường chạy và dữ liệu người dùng trong **%LOCALAPPDATA%\hermes** để tránh mất lịch sử ngoài ý muốn. Chỉ xóa thư mục đó khi bạn chắc chắn không cần dữ liệu cũ.

## Phạm vi hỗ trợ

- Bản phát hành chính: Windows x64.
- Giao diện Desktop đã được Việt hóa; nội dung do mô hình tạo phụ thuộc ngôn ngữ bạn yêu cầu.
- Đây là bản cộng đồng không chính thức và không được Nous Research bảo chứng.

## Dành cho người đóng góp

Các thay đổi chính nằm tại:

- **apps/desktop/src/i18n/vi.ts**
- **apps/desktop/src/i18n/languages.ts**
- **scripts/install.ps1** và **scripts/install.sh**
- **.github/workflows/release-vietnamese.yml**

Trước khi phát hành, chạy kiểm thử giao diện, kiểm tra kiểu TypeScript, đóng gói Windows và quét bí mật trong phần thay đổi.
