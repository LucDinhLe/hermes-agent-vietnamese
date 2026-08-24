<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/vi-v0.32.0-1/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese v32.0

Nhãn candidate: `vi-v0.32.0-1`

Phiên bản Desktop: `0.32.0-vi.1`

Lớp phát hành: **community prerelease, chưa phải stable**

v32 tập trung sửa các lỗi chí mạng của v31 trong ba vùng: kiểm soát token,
khả năng tiếp tục phiên dài và thao tác giao diện. Candidate chỉ được chuyển
sang phát hành công khai sau khi đúng byte Windows x64 vượt toàn bộ vòng đời
cài mới, cập nhật, mở lại, giữ dữ liệu, repair, uninstall và rollback trong
profile cô lập.

## Những thay đổi chính

- **Token Governor:** tính cả lượt gọi chính và phụ, áp ngân sách theo từng
  lượt, chặn tool-loop không tiến triển và hiển thị API-equivalent riêng.
- **Phiên dài trên 300k:** compaction giữ lịch sử logic và continuation state,
  nhờ đó phiên tiếp tục thay vì khóa im lặng khi parent context đầy.
- **Tool output lớn:** lọc, rút gọn và spill phần dư ra artifact có tham chiếu,
  không tiếp tục bơm toàn bộ output vào parent context.
- **Phân loại lỗi:** tách quota, context overflow và lỗi provider; trạng thái
  phiên vẫn có hướng phục hồi rõ ràng.
- **UX-001:** nút `+` nhận pointer/click thật và tạo phiên đúng một lần.
- **UX-002:** trang Nhắn tin có đường quay lại rõ ràng và giữ nguyên draft.
- **UX-003:** meter tách context nền, hội thoại, lịch sử logic, compaction,
  quota provider, ngân sách lượt và API-equivalent.

## Phạm vi candidate

Windows x64 là artifact nghiệm thu bắt buộc. Các đường dẫn còn lại được giữ
đúng tên chuẩn của release family để manifest và quy trình phát hành có thể
kiểm tra nhất quán; chúng không được xem là đã nghiệm thu nếu chưa có evidence
riêng cho đúng nền tảng.

| Nền tảng | Tệp candidate |
| --- | --- |
| Windows 10/11 x64 | [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Windows-x64-Setup.exe) |
| Windows ARM64 | [Hermes-Vietnamese-Windows-arm64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Windows-arm64-Setup.exe) |
| macOS Apple Silicon | [Hermes-Vietnamese-macOS-Apple-Silicon.dmg](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| macOS Intel | [Hermes-Vietnamese-macOS-Intel.dmg](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-macOS-Intel.dmg) |
| Debian/Ubuntu x64 | [Hermes-Vietnamese-Linux-x64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-x64.deb) |
| Debian/Ubuntu ARM64 | [Hermes-Vietnamese-Linux-arm64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-arm64.deb) |
| Fedora/RHEL x64 | [Hermes-Vietnamese-Linux-x64.rpm](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-x64.rpm) |
| Fedora/RHEL ARM64 | [Hermes-Vietnamese-Linux-arm64.rpm](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-arm64.rpm) |
| Linux x64 AppImage | [Hermes-Vietnamese-Linux-x64.AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-x64.AppImage) |
| Linux ARM64 AppImage | [Hermes-Vietnamese-Linux-arm64.AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Linux-arm64.AppImage) |

## An toàn cài đặt

- Candidate cộng đồng hiện chưa có Authenticode; Windows có thể hiển thị
  `Publisher: Unknown` hoặc SmartScreen.
- Chỉ dùng artifact có tên, kích thước và SHA-256 khớp evidence phát hành.
- Không tắt Microsoft Defender, SmartScreen hoặc cơ chế bảo vệ toàn máy.
- Mốc rollback đã diễn tập vẫn là `vi-v0.20.4-39`.

Commit, kích thước và SHA-256 chính xác của Windows x64 sẽ được khóa vào ghi
nhận candidate sau khi build bất biến và kiểm thử vòng đời hoàn tất.
