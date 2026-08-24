# Kế hoạch candidate Hermes Vietnamese v30

## Candidate và phạm vi

- Tag dự kiến: `vi-v0.20.4-37`.
- Lớp: `community-prerelease`, chưa phải stable.
- Nền lõi: Hermes Agent 0.20.4, giấy phép MIT.
- Đối tượng: người dùng Windows x64 muốn thử Hermes Desktop tiếng Việt với
  không gian làm việc theo phiên và dự án, chấp nhận trạng thái chưa ký số.
- Rollback kỹ thuật: `vi-v0.20.4-34` nếu đường nâng cấp resident thất bại;
  không tự động phục hồi hoặc di chuyển dữ liệu người dùng.

## Năng lực nằm trong candidate

- Toàn bộ năng lực v29: runtime resident, updater cộng đồng, Advisor theo phiên,
  project pin, Browser/Tệp/Terminal và dữ liệu tại chỗ.
- Menu model Advisor ngay trong phiên, lấy đủ model từ các nhà cung cấp đã kết
  nối; Cài đặt không lặp lại điều khiển này.
- Trang Dự án và Thống kê sử dụng trong panel giữa, gồm token theo dự án/model.
- Panel phải mặc định hiện cho hồ sơ mới và migration một lần cho trạng thái
  đóng do bản lỗi; lựa chọn sau migration vẫn thuộc người dùng.
- Tiến trình công việc theo phiên hiển thị hành động và lý do vận hành, tự biến
  mất khi lượt làm việc kết thúc; không hiển thị chain-of-thought ẩn.
- Sự kiện Advisor cho checkpoint kế hoạch, phục hồi và kết quả cuối.
- Tương thích marker bootstrap schema 1 thiếu `desktopVersion`: gói resident
  mở thẳng runtime tích hợp, không quay lại thiết lập hoặc gọi `uv` trong
  AppData. Checkout có `installMode: source` vẫn được tôn trọng.

## Ngoài phạm vi

- Không đổi thương hiệu Hermes, MIT license, app identity, data root, updater
  feed hoặc signing identity.
- Không đưa edition AI for Boss, license thương mại hay overlay riêng vào gói.
- Không promotion, thay Public Latest hoặc mô tả candidate như stable.

## Cổng nguồn

- Lockfile, dependency audit, secret scan và workflow contract phải đạt trước
  khi tạo tag.
- Python Advisor/gateway, Electron runtime/updater/bootstrap và toàn bộ UI V30
  được gọi đích danh trong workflow candidate.
- Desktop typecheck, lint, Ruff, Prettier và `git diff --check` đạt.
- Worktree sạch; commit đã push và tag có thể fetch độc lập.

## Cổng artifact Windows x64

- Dựng một lần trên runner Windows x64 với payload resident đầy đủ.
- Ghi filename, byte size, SHA-256, Authenticode và provenance.
- Tải lại đúng byte từ draft rồi cài vào hồ sơ cô lập.
- Fresh launch, gateway, onboarding, phiên, Advisor, tiến trình, Dự án, Thống kê
  sử dụng, panel phải và persistence đạt.
- Update fixture giữ marker cũ thiếu `desktopVersion`; không hiện wizard và
  không chạy AppData `uv.exe`.
- Không cài đè hoặc đọc hồ sơ Hermes thật của chủ dự án.

## Quyết định sau smoke

Một cổng thất bại làm candidate `NO-GO`. Bản sửa phải tăng tag; không upload đè
asset `vi-v0.20.4-37`.
