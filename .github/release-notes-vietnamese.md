# Hermes Vietnamese 2026.9.2

<!-- current-release:start -->
> **Latest hiện tại là [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2), chỉ phát hành Windows x64.** Đây là community pilot chưa ký số, chưa phải stable. Bộ cài đã qua nghiệm thu cả kiểu cài cho một người dùng và toàn máy. Cập nhật bằng bộ cài đầy đủ, không có cập nhật tự động nền.

| Tệp | Tải xuống |
| --- | --- |
| Bộ cài Windows x64 | [Hermes-2026.9.2-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-2026.9.2-win-x64.exe) |
| Cùng bộ cài, tên tương thích đường tải cũ | [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-Vietnamese-Windows-x64-Setup.exe) |
| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/SHA256SUMS.txt) |

Chỉ tải **một** trong hai tệp `.exe`. Cả hai có cùng nội dung, kích thước **252118156 byte** và SHA-256:

```text
1ae55b4a3280e92d4a297f85d81cbb6bcc0a19170da8d9122755d19f40c43015
```
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
