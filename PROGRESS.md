# Tiến độ

## Mục tiêu hiện tại

Hợp nhất thiết lập Desktop lần đầu thành ba bước trên Windows, macOS và Linux, đồng thời giữ nguyên giao diện và tính năng lõi Hermes sau khi thiết lập.

## Trạng thái đã xác minh

- Nhánh làm việc ban đầu: `fix/readable-window-controls`, HEAD `492220e5f`.
- Worktree sạch trước thay đổi.
- Baseline đạt 18/18 kiểm thử giao diện cài đặt/onboarding.
- Baseline đạt 20/20 kiểm thử bootstrap Electron.
- Typecheck Desktop đạt.
- `bootstrap-runner.ts` đã có bộ điều khiển `install.ps1` cho Windows và `install.sh` cho macOS/Linux.
- Giao diện vẫn còn nhánh cũ hướng dẫn người dùng macOS/Linux tự mở Terminal; nhánh này cần được loại bỏ khỏi luồng người dùng.

## Quyết định

- Ba bước chỉ là lớp thiết lập lần đầu; Terminal tích hợp và ứng dụng chính không đổi.
- Tái sử dụng luồng nhà cung cấp/model hiện có, không xây một luồng xác thực thứ hai.
- Model cục bộ dùng điểm cuối cục bộ hiện có trong lát cắt đầu; chưa nhúng model nặng vào bộ cài nền.
- Lựa chọn ngôn ngữ phải hoạt động trước khi backend sẵn sàng và được đồng bộ vào cấu hình khi bước 2 bắt đầu.

## Đã hoàn thành trong lát cắt này

- Thêm chỉ báo ba bước dùng chung cho cài đặt cục bộ, kết nối từ xa và onboarding nhà cung cấp/model.
- Cho phép đổi English/Tiếng Việt trước khi backend chạy; lựa chọn được lưu vào cấu hình ở bước 2.
- Loại bỏ hướng dẫn buộc người dùng macOS/Linux mở Terminal khỏi màn hình cài đặt.
- Giữ nguyên Terminal tích hợp và không gian làm việc Hermes sau onboarding.
- Củng cố Windows bootstrap bằng gói `uv` chính thức từ PyPI, kiểm tra SHA-256 trước khi giải nén; vẫn giữ đường cài Astral cũ làm dự phòng.
- Bổ sung gói macOS Intel x64 vào ma trận bên cạnh Apple Silicon, Windows x64/ARM64 và Linux x64/ARM64.
- Cập nhật README, ghi chú phát hành và tài liệu vận hành cộng đồng.

## Xác minh

- 34/34 kiểm thử giao diện trực tiếp cho thiết lập, onboarding và i18n đạt.
- 27/27 kiểm thử Electron bootstrap và ma trận đóng gói đạt.
- 8/8 kiểm thử nguồn cho `install.ps1` đạt.
- Typecheck Desktop và lint trên toàn bộ tệp thay đổi đạt; chỉ còn cảnh báo test có sẵn của dự án.
- Windows `uv` bootstrap đã chạy thật trong thư mục sạch: `uv 0.12.3`, mã băm được xác minh và tiến trình kết thúc thành công.
- Production build Desktop đạt sau khi chạy ngoài giới hạn sandbox.
- Bộ UI đầy đủ bị hết thời gian ở một số bài cũ không thuộc lát cắt này; các bài liên quan trực tiếp đều xanh và lỗi chậm đã được ghi nhận, không bị diễn giải thành kết quả đạt.

## Bước phát hành tiếp theo

Tạo checkpoint Git, đẩy nhánh và chạy workflow pre-release sáu nền tảng. Gói macOS/Linux cần được kiểm tra thêm trên máy thật trước khi bỏ nhãn thử nghiệm cộng đồng.
