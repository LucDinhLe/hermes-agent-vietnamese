# Kế hoạch phát hành Hermes Vietnamese v29

## Candidate và phạm vi

- Tag dự kiến: `vi-v0.20.4-35`.
- Tên sản phẩm: Hermes Vietnamese v29.
- Lớp: `community-prerelease`, không phải stable.
- Đối tượng: người dùng cộng đồng muốn một bản Hermes Desktop tiếng Việt có
  đường cài sẵn, làm việc nhiều phiên/dự án và chấp nhận cảnh báo unsigned.
- Nền lõi: Hermes Agent 0.20.4.
- Candidate chỉ được tạo từ commit sạch, đã push và có thể fetch độc lập.

## Năng lực công khai

- Desktop/runtime resident cùng onboarding VI/EN và kết nối model trong app.
- Nhiều phiên/panel, Browser nhiều tab ở panel phải và Tệp/Terminal tích hợp.
- Hermes Connector chính chủ cho Chrome/Edge với consent theo domain, pairing
  một lần, import/revoke cô lập và log redaction.
- Tóm tắt reasoning công khai bằng tiếng Việt, mặc định tắt và giữ nguyên bản
  gốc.
- Advisor chỉ đọc ở checkpoint kế hoạch/phục hồi/kết quả cuối; model riêng,
  giới hạn revision và công tắc theo từng phiên nằm trong panel giữa.
- Dự án đã ghim ở panel trái, kéo thả sắp xếp và cô lập theo kết nối.
- Trình cập nhật cộng đồng dùng manifest của release bất biến; Windows cài yên
  lặng rồi mở lại và giữ nguyên vùng dữ liệu.

## Cổng source

- `uv lock --check`, dependency audit và secret scan phù hợp đạt.
- Release/Electron, UI Advisor/project pins, backend session-scoped Advisor,
  Desktop typecheck/lint và Python release tests đạt.
- Worktree sạch; release notes mô tả sản phẩm/lợi ích, không dùng changelog giữa
  các bản làm phần giới thiệu.

## Cổng candidate và artifact

- Sáu target build đúng runner native và staging đúng một lần.
- Bốn manifest cập nhật, `SHA256SUMS.txt`, provenance và mọi asset khớp byte.
- Không thay hoặc upload đè asset dưới cùng tag.

## Cổng Windows x64 trước khi công khai

- Tải lại đúng installer từ draft, kiểm SHA-256 và Authenticode status.
- Fresh install bằng hồ sơ cô lập; runtime, gateway, onboarding, phiên, Browser,
  panel phải, safe tool và persistence đạt.
- Advisor off/on, model riêng, trạng thái theo phiên và biên panel đạt.
- Project pin/unpin/reorder và persistence đạt.
- Cài đè từ exact v28 giữ cấu hình, phiên, lịch, bí mật và onboarding; xác nhận
  lần chuyển tiếp thủ công v28 → v29.
- Từ v29, thử đường **Cập nhật ngay** trên fixture release kế tiếp hoặc bằng cơ
  chế feed/update đã khóa; không tuyên bố nếu chưa có bằng chứng.
- Repair, uninstall giữ dữ liệu, uninstall xóa dữ liệu và rollback đạt.

## Giới hạn bắt buộc công khai

- Windows chưa Authenticode; macOS chưa Developer ID/notarization.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 là
  `BUILD-ONLY-PILOT` nếu chưa có smoke máy thật.
- v29 là community prerelease, không tự nhận là stable/final.

## Quay lui

- Mốc rollback đã diễn tập: `vi-v0.20.0-14`.
- Giữ nguyên v28 và mọi candidate cũ làm bằng chứng; không di chuyển tag.
- Nếu một cổng exact-artifact thất bại hoặc byte thay đổi, dùng candidate số mới.
