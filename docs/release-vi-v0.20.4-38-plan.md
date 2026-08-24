# Kế hoạch candidate Hermes Vietnamese v31

## Candidate và quyết định phát hành

- Tag dự kiến: `vi-v0.20.4-38`.
- Lớp: `community-prerelease`, chỉ staging ở draft để kiểm chứng.
- Nền lõi: Hermes Agent 0.20.4, giấy phép MIT.
- Tên sản phẩm công khai: **Hermes Vietnamese**.
- Public Latest hiện tại không thay đổi trong vòng candidate này.
- Rollback kỹ thuật gần nhất: `vi-v0.20.4-37`; mốc công khai đã diễn tập vẫn
  là `vi-v0.20.0-14`.

## Phạm vi hoàn thành

- Giữ toàn bộ năng lực V30 gồm runtime resident, updater cộng đồng, Advisor
  theo phiên, Dự án, Thống kê sử dụng, panel phải và tiến trình công việc.
- Hiển thị cửa sổ ngữ cảnh theo từng phiên, đối chiếu giới hạn do nhà cung cấp
  model công bố và ngưỡng rút gọn thực tế của Hermes.
- Ước tính chi phí API tương đương bằng USD theo model, token vào, token ra và
  cache; tách chi phí model làm việc và Advisor.
- Đổi tên hiển thị ứng dụng, cửa sổ, shortcut, trình gỡ cài đặt, DMG, desktop
  metadata và Windows version resource thành Hermes Vietnamese.
- Hiển thị rõ dự án gốc và nhà phát hành Nous Research, nhà phát hành/duy trì
  bản Hermes Vietnamese là Lê Đình Lực (LucDinhLe), cùng giấy phép MIT.

## Hợp đồng giữ dữ liệu và cập nhật

Các định danh sau phải giữ nguyên và được regression test bảo vệ:

- app ID và Windows AppUserModelID: `com.nousresearch.hermes`;
- package product name và executable nội bộ: `Hermes` / `Hermes.exe`;
- protocol: `hermes`;
- updater: `LucDinhLe/hermes-agent-vietnamese`;
- Windows HERMES_HOME: `%LOCALAPPDATA%\hermes`;
- POSIX HERMES_HOME: `~/.hermes`.

Việc giữ các định danh kỹ thuật giúp bộ cài nhận đây là bản nâng cấp của cùng
ứng dụng, dùng lại cấu hình, cuộc trò chuyện, dự án và trạng thái onboarding.
Tên người dùng nhìn thấy được đổi mà không tạo một hồ sơ dữ liệu mới.

## Ma trận dựng và phạm vi kiểm chứng

Workflow dựng đúng một lần trên sáu target native:

1. Windows x64;
2. Windows ARM64;
3. macOS Apple Silicon;
4. macOS Intel;
5. Linux x64;
6. Linux ARM64.

Artifact Linux gồm AppImage, DEB và RPM. Mọi artifact phải có byte size,
SHA-256, provenance, trạng thái ký/công chứng và update metadata tương ứng.

## Cổng bắt buộc trước tag

- Worktree sạch; commit đã push; tag mới, bất biến và fetch được độc lập.
- Dependency/lockfile audit, secret scan, workflow contract và distribution
  contract đạt.
- Typecheck, ESLint, Ruff, Prettier và `git diff --check` đạt.
- Test Advisor, dự án, panel phải, tiến trình, context meter, pricing, updater,
  bootstrap marker cũ, uninstall và release workflow đạt.
- Candidate build phải thất bại nếu Windows executable không được đóng dấu
  đúng metadata Hermes Vietnamese.

## Cổng artifact

- Staging chỉ tạo GitHub draft, không promotion và không thay Latest.
- Tải lại artifact từ draft rồi đối chiếu SHA-256 với byte đã dựng.
- Windows x64 exact-artifact smoke trong hồ sơ cô lập phải kiểm fresh install,
  update từ bản đã cài, relaunch, dữ liệu cũ, Advisor, context/cost, dự án,
  panel phải, uninstall giữ dữ liệu và rollback.
- Mỗi target còn lại cần smoke trên hệ điều hành/kiến trúc thật trước khi được
  mở rộng audience. Build xanh một mình chỉ cho phép nhãn `BUILD-ONLY-PILOT`.

## Signing và giới hạn công khai

- Windows community candidate chưa có Authenticode thật và có thể hiện
  `Unknown Publisher`; metadata nhà duy trì không thay thế chữ ký số.
- macOS community candidate chưa có Developer ID/notarization.
- Linux dùng SHA-256; chưa có kho APT/RPM ký GPG riêng.
- Một cổng thiếu hoặc thất bại làm audience tương ứng `NO-GO`. Bản sửa phải
  dùng tag mới; không thay byte của `vi-v0.20.4-38`.
