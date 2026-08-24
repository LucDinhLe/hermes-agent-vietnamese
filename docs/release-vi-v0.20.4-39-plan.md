# Kế hoạch candidate Hermes Vietnamese v31.1

## Candidate và quyết định phát hành

- Tag dự kiến: `vi-v0.20.4-39`.
- Lớp: `community-prerelease`, chỉ staging ở draft để kiểm chứng.
- Nền lõi: Hermes Agent 0.20.4, giấy phép MIT.
- Tên sản phẩm công khai: **Hermes Vietnamese**.
- `vi-v0.20.4-38` là candidate bất biến; bản sửa dùng tag mới.
- Public Latest chỉ thay đổi sau khi exact-artifact gate và phê duyệt promotion
  đạt. Rollback candidate gần nhất là `vi-v0.20.4-38`.

## Phạm vi hoàn thành

- Giữ toàn bộ năng lực v31: runtime resident, cập nhật trong ứng dụng, Advisor
  theo phiên, tiến trình công việc, cửa sổ ngữ cảnh, chi phí USD, Dự án, Thống kê
  sử dụng, panel phải và nhận diện Hermes Vietnamese.
- Việt hóa đầy đủ 16 mẫu trong **Tác vụ định kỳ**: tên, mô tả, nhãn trường,
  gợi ý, lựa chọn và giá trị văn bản mặc định.
- Giữ nguyên key, enum value, lịch và prompt contract của catalog dùng chung;
  chỉ lớp trình bày Desktop được dịch.
- Tác vụ tạo từ giao diện tiếng Việt lưu tên hiển thị tiếng Việt, trong khi CLI
  và client cũ không gửi tên vẫn dùng tên catalog chuẩn.
- Kiểm tra lại luồng cập nhật: ứng dụng chỉ chọn release đã công khai, bỏ qua
  draft, yêu cầu đúng manifest của nền tảng, tải trọn artifact đã nghiệm thu,
  xác minh hash, cài yên lặng và mở lại.

## Hợp đồng giữ dữ liệu và cập nhật

Các định danh kỹ thuật vẫn giữ nguyên: app ID `com.nousresearch.hermes`, package
product/executable `Hermes` / `Hermes.exe`, protocol `hermes`, updater
`LucDinhLe/hermes-agent-vietnamese`, `%LOCALAPPDATA%\hermes` trên Windows và
`~/.hermes` trên POSIX. Cài đè hoặc cập nhật trong ứng dụng phải giữ cấu hình,
cuộc trò chuyện, dự án, tác vụ định kỳ, bí mật và trạng thái onboarding.

Candidate nháp không được cung cấp qua nút **Cập nhật ngay**. Sau promotion,
phiên bản cũ đủ điều kiện sẽ phát hiện `vi-v0.20.4-39` trong **Cài đặt → Giới
thiệu**, tải manifest tương ứng và cài mà không chạy lại trợ lý cài đặt lần đầu.

## Cổng bắt buộc

- Typecheck, ESLint, kiểm thử UI tác vụ định kỳ, kiểm thử API tạo blueprint,
  updater contract, build Desktop và `git diff --check` đạt.
- Workflow dựng native sáu target đạt và tạo đủ bốn update manifest.
- Tải lại artifact từ draft, đối chiếu SHA-256 và chạy exact-artifact smoke
  Windows x64 cho fresh install, update từ bản trước, relaunch và giữ dữ liệu.
- Target chưa smoke trên máy thật chỉ được gắn `BUILD-ONLY-PILOT`.
- Windows chưa Authenticode và macOS chưa Developer ID/notarization; không được
  mô tả candidate là stable hoặc đã ký.
