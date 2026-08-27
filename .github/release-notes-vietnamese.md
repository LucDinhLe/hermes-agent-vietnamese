<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/vi-v0.32.1-18/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese v32.1 — pilot đa nền tảng

Lớp phát hành của artifact: **community-prerelease, chưa phải stable**.

`vi-v0.32.1-18` giữ nguyên phạm vi sản phẩm v32.1 và bổ sung bộ cài native cho
Windows, macOS và Linux. Đây là bản pilot đa nền tảng để lấy phản hồi; bản tải
mặc định/Latest vẫn là `vi-v0.32.1-17` trong thời gian candidate này được kiểm
và công khai riêng. Mọi gate an toàn phiên/dự án của v32.1 tiếp tục bắt buộc.

## Trạng thái bằng chứng theo nền tảng

- **Windows x64: exact-artifact smoke đạt** toàn bộ vòng đời v32.1, gồm cài mới,
  runtime/gateway/onboarding, phiên và Dự án, mở lại, safe tool, cập nhật từ
  v32, repair, hai chế độ gỡ cài đặt, rollback và không còn process dư.
- **Windows ARM64: BUILD-ONLY-PILOT**; build native và kiểm cấu trúc/kiến trúc
  đạt, nhưng chưa có smoke trên máy người dùng.
- **macOS Apple Silicon: BUILD-ONLY-PILOT**; build native đạt, nhưng chưa có
  smoke trên máy người dùng.
- **macOS Intel: BUILD-ONLY-PILOT**; build native đạt, nhưng chưa có smoke trên
  máy người dùng.
- **Linux x64: BUILD-ONLY-PILOT**; build AppImage/DEB/RPM native đạt, nhưng chưa
  có smoke trên máy người dùng.
- **Linux ARM64: BUILD-ONLY-PILOT**; build AppImage/DEB/RPM native đạt, nhưng
  chưa có smoke trên máy người dùng.

Build xanh chỉ chứng minh đúng byte và cấu trúc trên runner native. Năm target
`BUILD-ONLY-PILOT` chưa được mô tả như đã tương thích thực tế; người dùng nên
giữ bản cũ và gửi lỗi kèm hệ điều hành/kiến trúc nếu thử nghiệm.

## Sửa lỗi phiên và Dự án được giữ nguyên

- Dữ liệu phiên/tin nhắn tiếp tục nằm trong `state.db`; Ẩn hoặc Xóa Dự án chỉ
  thay đổi metadata trong `projects.db`.
- Khi mở lại Hermes, giao diện trở về toàn bộ Dự án và phiên; scope của một Dự
  án không được lưu qua lần chạy sau.
- Dự án đang mở vẫn có hàng Dự án, menu và nút xổ xuống; danh sách đầy đủ có
  lối **Tất cả dự án** rõ ràng.
- Tự dò kho mã, tự lưu trữ phiên và tự dọn phiên đều tắt mặc định.
- Hermes không tự tải phiên, Dự án hoặc bản sao lưu lên đám mây Hermes.

## Ký số và giới hạn

- Không dùng SignPath theo quyết định phát hành hiện tại; Windows có
  Authenticode `NotSigned`, chưa ký số và có thể hiện `Publisher: Unknown`,
  SmartScreen hoặc Smart App Control. Không tắt bảo vệ toàn máy để cài.
- Dự án chưa tham gia Apple Developer Program; macOS chưa có Developer ID,
  notarization hoặc stapling và Gatekeeper có thể chặn/cảnh báo.
- Linux dùng SHA-256, chưa có kho APT/RPM riêng hoặc chữ ký GPG của kho.
- Community prerelease chưa ký có `updateFeedEnabled=false`; không có update
  feed tự động và không được gọi là stable/final.
- Mọi tệp phải đối chiếu với `SHA256SUMS.txt` của chính release này. Nếu một
  target lỗi, dừng dùng candidate và quay về `vi-v0.32.1-17`.
