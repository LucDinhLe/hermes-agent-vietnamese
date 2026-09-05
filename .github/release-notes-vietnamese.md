# Hermes Vietnamese 2026.9.4

<!-- current-release:start -->
> **Latest hiện tại là [2026.9.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.4), dành cho Windows x64, macOS Apple Silicon và Linux x64.** Đây là community pilot chưa phải stable; Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài. Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app`. Trên Linux, cấp quyền chạy cho AppImage (`chmod +x`) hoặc cài gói deb.

| Nền tảng | Tải xuống | Kích thước (byte) | SHA-256 |
| --- | --- | --- | --- |
| Windows x64 | [Hermes-2026.9.4-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-win-x64.exe) | 345852734 | `3cd30aaad47167c439bb6637af3c531ceffc4e2f74d7a808e3a9c105e3938990` |
| macOS Apple Silicon | [Hermes-2026.9.4-mac-arm64.dmg](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-mac-arm64.dmg) | 385594943 | `8ebc605c66c9cc8eeed6fc314b71cbdabeedea6c62c297035296729571284d8c` |
| Linux x64 AppImage | [Hermes-2026.9.4-linux-x86_64.AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-x86_64.AppImage) | 397516248 | `26cfec58e6776f49d5e65cbdd62908119349f7406a4fc549bc417d839134249d` |
| Linux x64 deb | [Hermes-2026.9.4-linux-amd64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-amd64.deb) | 320996796 | `fc513d2a836ee5c6ca9762a627bb14b01d5a2cb4e09b234fd81439b61018e351` |
| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/SHA256SUMS.txt) | | |
<!-- current-release:end -->

## Thay đổi

- Sửa tạo phiên bằng dấu cộng, gửi tin đầu tiên, định tuyến model và ngữ cảnh ảnh Advisor từ dòng d14.
- Đóng kèm Python 3.12.10 và thư viện bắt buộc; không tải install.ps1 để khởi động lõi lần đầu.
- Giữ phạm vi/thư mục cài khi nâng cấp, sửa trình gỡ Windows với các lựa chọn giữ hoặc xóa dữ liệu.
- Đánh số năm.tháng.lần cập nhật trong tháng; tiếp theo có thể là 2026.9.3 hoặc 2026.10.1.

## Bằng chứng và giới hạn

[Nghiệm thu exact installer](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/33798311695) đạt cả currentuser/allusers: cài mới, gateway, ba tab bằng dấu cộng, gửi tin, công cụ mô phỏng, giữ lịch sử khi mở lại, nâng cấp từ vi-v0.32.1-18, repair, gỡ giữ dữ liệu, cài lại, rollback và gỡ toàn bộ dữ liệu đã chọn.

Source bất biến `b51f306eae2370adc774b63f198ab12990bcf063`; harness `d4847fe844b426bfac9ee0b295993e95fbbe80a7`. Bộ cài dựng native Windows x64, kiểm thử trên Windows x64 GitHub. Không nhận đã thử mọi máy Windows hay quyền Luna/Gemini/Claude của mọi tài khoản.

2026.9.2 chưa có macOS, Linux hoặc Windows ARM64. Các gói cũ thuộc bản lịch sử [vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18); macOS cũ chưa đạt yêu cầu ký/công chứng cho người dùng thường.

## Cài đè và quay lui

Sao lưu, kiểm tra bản sao, chờ công việc xong rồi đóng ứng dụng/gateway nền trước khi cài. Cài đè giữ dữ liệu theo thiết kế; không chọn gỡ toàn bộ để nâng cấp. Kiểm tra lịch sử và kết nối sau cài. Bản quay lui Windows x64 là vi-v0.32.1-18; giữ bản sao dữ liệu mới hơn trước mọi lần khôi phục.

Xem [hướng dẫn cài đặt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md) và [sao lưu/khôi phục](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/docs/sao-luu-khoi-phuc.md).

Bản cộng đồng chưa ký số. Không tắt Defender/SmartScreen trên toàn máy; nếu phát hiện mối đe dọa cụ thể, dừng và báo lỗi. Dự án đang hoàn thiện để nộp lại hồ sơ ký số, chưa có chữ ký mới hoặc xác nhận chấp thuận trong đợt này. Không có update feed tự động.
