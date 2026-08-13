## Hermes Agent tiếng Việt

Bản cộng đồng đa nền tảng với giao diện tiếng Việt mặc định và nút chuyển nhanh VI/EN. Tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI agent sinh ra được giữ nguyên.

Đây là một dự án cá nhân, độc lập, được thực hiện nhằm hỗ trợ người dùng Việt tiếp cận và sử dụng Hermes Agent thuận tiện hơn. Giấy phép, thuật toán, kiến trúc và các tính năng lõi của Hermes vẫn được giữ theo dự án gốc.

### Chọn đúng tệp

- **Windows x64:** `Hermes-Vietnamese-Windows-x64-Setup.exe`
- **Windows ARM64:** `Hermes-Vietnamese-Windows-arm64-Setup.exe`
- **Mac dùng chip Apple:** `Hermes-Vietnamese-macOS-Apple-Silicon.dmg`
- **Linux:** chọn `x64` hoặc `arm64`; ưu tiên `.deb` cho Ubuntu/Debian, `.rpm` cho Fedora/RHEL và `.AppImage` khi cần bản chạy độc lập.

Mỗi người đăng nhập OpenAI Codex hoặc Claude Pro/Max bằng tài khoản của chính mình. Gemini dùng khóa API Google AI Studio của chính người dùng. Bản dựng không chứa tài khoản, mã OAuth, khóa API hoặc dữ liệu trò chuyện của người đóng gói.

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Khi người dùng chủ động gửi yêu cầu tới nhà cung cấp AI, nội dung cần thiết sẽ được nhà cung cấp đã chọn xử lý theo điều khoản và chính sách quyền riêng tư của họ.

### Cải thiện trong bản vá này

- Danh mục model luôn hiện nút mở rộng và số model của từng nhà cung cấp, kể cả khi nhóm đang thu gọn.
- Claude Pro/Max hiển thị rõ ba lựa chọn `Sonnet`, `Opus` và `Haiku` sau khi mở rộng.
- Gemini được ghi rõ là kết nối qua `Google AI Studio (API)`, tránh nhầm với gói thuê bao Gemini hoặc OAuth của Gemini CLI.

### Bảo mật khi cài

Đối chiếu tệp đã tải với `SHA256SUMS.txt`. Nếu bản phát hành chưa được ký số, Windows SmartScreen hoặc macOS Gatekeeper có thể cảnh báo. Đây là giới hạn của bản cộng đồng chưa có chứng thư phát hành, không phải bằng chứng rằng cảnh báo nên bị bỏ qua. Chỉ tiếp tục khi mã SHA-256 khớp và tệp được tải từ kho chính thức này.

Xem yêu cầu hệ thống, hướng dẫn cài đặt và giới hạn hỗ trợ trong `README.vi.md`. Phạm vi miễn trừ đối với hệ thống, thuật toán và giấy phép Hermes được giải thích bằng tiếng Việt trong `DISCLAIMER.md`; văn bản có hiệu lực vẫn là `LICENSE`.
