# Tiến độ

## Cập nhật 2026-08-13 — mở đầy đủ kết nối và tên model Claude

- Màn **Kết nối model** hiển thị trực tiếp toàn bộ luồng đăng nhập tài khoản mà backend cung cấp và toàn bộ nhà cung cấp có thể thiết lập bằng khóa API; không còn giấu danh mục khóa sau nút phụ.
- Danh mục khóa được sinh từ nguồn nhà cung cấp lõi, tự nhận thêm nhà cung cấp mới và loại đúng các luồng OAuth, tiến trình ngoài hoặc cấu hình thiếu biến xác thực.
- AWS Bedrock và Google Vertex AI tiếp tục được cấu hình tại **Cài đặt → Nhà cung cấp → API** vì cần nhiều trường cấu hình chuyên biệt.
- Claude Code dùng tên model cụ thể: Sonnet 5, Fable 5, Opus 5, Opus 4.8 và Haiku 4.5; quyền sử dụng thực tế vẫn do tài khoản Claude quyết định.
- Tài liệu giải thích rõ Gemini dùng Google AI Studio API key hoặc Vertex AI. Không tích hợp lại OAuth của Gemini CLI vì điều khoản của Google cấm phần mềm bên thứ ba dùng luồng đó.
- Xác minh: 7/7 kiểm thử onboarding đạt, 4/4 kiểm thử Claude Code provider đạt, Desktop typecheck đạt.

## Cập nhật 2026-08-13 — viết lại tài liệu công khai

- Chuyển thông tin độc lập của dự án sang cách diễn đạt trung tính, tránh dùng cụm “không được bảo chứng” ở phần mở đầu.
- Ghi đúng trạng thái ký số: hồ sơ SignPath Foundation đã nộp và đang chờ xét duyệt; ký số là xác minh nhà phát hành, không phải giấy phép sử dụng của Microsoft hoặc Apple.
- Chuẩn hóa tên hiển thị thành **Hermes Vietnamese**, bỏ biểu tượng trang trí sau tên.
- Thêm link tải trực tiếp cho từng hệ điều hành và kiến trúc, cùng hướng dẫn kiểm tra phiên bản hệ điều hành, chip x64/ARM64, Apple Silicon/Intel trước khi tải.
- Viết lại README trang chủ theo hành trình ba bước: tải và cài, kết nối model, bắt đầu giao việc.
- Cập nhật toàn bộ liên kết tải sang `vi-v0.20.0-8` và bảng chọn đúng bộ cài cho sáu nền tảng.
- Viết lại hướng dẫn tiếng Việt chi tiết cho Windows, macOS, Linux; ChatGPT OAuth; Claude Pro/Max qua Claude Code; Gemini bằng khóa Google AI Studio; nhà cung cấp khác và model cục bộ.
- Bổ sung bảng phân biệt tài khoản/gói thuê bao/API, xử lý lỗi thường gặp, cảnh báo chưa ký số, cập nhật, sao lưu và gỡ cài đặt.
- Giữ rõ cam kết: **Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.**
- Cập nhật mẫu ghi chú phát hành theo luồng kết nối mới. Các liên kết nội bộ đã được kiểm tra, Prettier và `git diff --check` đều đạt.

## Cập nhật 2026-08-13 — ưu tiên kết nối tài khoản sẵn có

- Nhánh: `fix/provider-first-onboarding`, bắt đầu từ `origin/main` tại `5bfbbc2ad`.
- Màn **Kết nối model** hiện trực tiếp theo thứ tự: ChatGPT OAuth, Claude Pro/Max, Google Gemini bằng khóa API; Nous Portal và các dịch vụ khác nằm dưới **Nhà cung cấp khác**.
- Bỏ nhãn **Đề xuất** và cơ chế ẩn các nhà cung cấp phía sau Nous Portal.
- Gemini được ghi rõ là luồng Google AI Studio/API key trong toàn bộ locale; bấm vào sẽ mở form khóa API với Gemini được chọn sẵn.
- Xác minh: 32/32 kiểm thử onboarding+i18n đạt; 7/7 kiểm thử onboarding trực tiếp đạt; typecheck đạt; lint không có lỗi (chỉ còn cảnh báo có sẵn ở tệp khác).
- Bản Windows unpacked đã đóng gói thành công. Smoke test trực tiếp trên bản dev tách biệt xác nhận đúng thứ tự, đúng tiếng Việt và đúng hành vi bấm Gemini.
- Cửa sổ thử dùng `HERMES_HOME` và user-data riêng, không đọc hoặc sửa hồ sơ Hermes chính.

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
