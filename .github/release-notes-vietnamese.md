<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/vi-v0.32.1-10/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese v32.1

Lớp phát hành của artifact: **community-prerelease, chưa phải stable**.

`vi-v0.32.1-10` là bản cập nhật an toàn cho Windows 10/11 x64, kế nhiệm
`vi-v0.32.0-1`. Bản này chỉ được công khai ở vị trí GitHub Latest sau khi đúng
byte Windows x64 vượt toàn bộ cổng cài mới, cập nhật, mở lại, sửa chữa, gỡ cài
đặt, rollback và an toàn phiên/dự án trong máy ảo Windows dùng một lần.

GitHub phải đặt `prerelease=false` để bản cập nhật có thể ở vị trí Latest;
provenance của artifact vẫn là `community-prerelease`. Điều đó không biến bản
này thành stable/final.

## Sửa lỗi phiên và Dự án

- **Không làm phiên biến mất:** dữ liệu phiên/tin nhắn tiếp tục nằm trong
  `state.db`; Ẩn hoặc Xóa Dự án chỉ thay đổi metadata trong `projects.db`.
- **Khôi phục đúng phạm vi:** khi mở lại Hermes, giao diện trở về toàn bộ Dự án
  và phiên; scope của một Dự án không được lưu qua lần chạy sau.
- **Sidebar đồng nhất:** Dự án đang mở vẫn có hàng Dự án, menu và nút xổ xuống;
  danh sách đầy đủ có lối **Tất cả dự án** rõ ràng.
- **Không tự động che lịch sử:** tự dò kho mã, tự lưu trữ phiên và tự dọn phiên
  đều tắt mặc định; chỉ hoạt động khi người dùng chủ động bật.
- **Dữ liệu ở đúng máy đã chọn:** Hermes không tự tải phiên, Dự án hoặc bản sao
  lưu lên đám mây Hermes. Cài trên máy thật thì dữ liệu ở máy thật; cài trên máy
  ảo thì dữ liệu ở máy ảo.

## Hoàn thiện v32.1

- Onboarding theo mục tiêu và allowlist Skill/MCP rõ ràng theo phiên/agent.
- Restore capability fail-closed; trạng thái được gán hiển thị minh bạch.
- Root Token Governor bao phủ main agent, subagent, retry, fallback và tool
  loop trong phạm vi Hermes quản lý.
- Các quyết định bảo vệ dữ liệu được khóa thành regression và release gate,
  không chỉ là quy ước giao diện.

## Cổng Windows x64 bắt buộc

- Installer được phát hành với Authenticode `NotSigned`; manifest phải ghi rõ
  không có chứng thư nhà phát hành và không được gọi bản này là stable/final.
- Windows x64: exact-artifact smoke và provenance phải khớp tag, commit,
  kích thước và SHA-256 của private draft.
- Update trực tiếp từ `vi-v0.32.0-1`, repair, uninstall giữ dữ liệu, uninstall
  xóa dữ liệu và rollback `vi-v0.20.4-39` phải đạt trên cùng exact installer.
- Vòng đời Dự án phải chứng minh Ẩn/Xóa metadata không đổi `hidden`, `archived`,
  số tin nhắn hoặc SHA-256 nội dung phiên; mở lại vẫn tìm và tiếp tục được phiên.
- Không dùng profile Hermes thật hoặc tắt Smart App Control để vượt cổng.

## Giới hạn

- Đây là community pilot Windows x64, chưa phải stable/final.
- Windows có thể hiện `Publisher: Unknown`, SmartScreen hoặc Smart App Control
  cảnh báo/chặn cài đặt. Không tắt bảo vệ toàn máy để cài.
- Chưa có smoke trên máy người dùng; nghiệm thu phát hành dùng profile cô lập,
  mock provider và máy ảo Windows dùng một lần.
- Dự án chưa tham gia Apple Developer Program; v32.1 không quảng cáo macOS,
  Linux hoặc Windows ARM64 khi chưa có exact-byte evidence riêng.
- Nếu hậu kiểm công khai lỗi, quy trình phải đưa v32.1 về draft và khôi phục
  `vi-v0.32.0-1` làm GitHub Latest.
