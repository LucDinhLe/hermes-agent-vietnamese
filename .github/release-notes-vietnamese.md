<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/vi-v0.32.0-1/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese v32.0

Lớp phát hành: **community pilot GitHub Latest, chưa phải stable**.

`vi-v0.32.0-1` là **community pilot cho Windows 10/11 x64** và thay v31 làm
GitHub Latest, nhưng chưa phải stable.
Bản này tập trung sửa các lỗi chí mạng của v31 về token, phiên dài và ba luồng
UI/UX chính.

Candidate bất biến vẫn mang provenance `community-prerelease`. GitHub được đặt
`prerelease=false` chỉ để v32 có thể thay bản v31 lỗi nghiêm trọng ở vị trí
Latest; việc này không biến artifact chưa ký thành stable/final.

## Những thay đổi chính

- **Token Governor:** đếm lượt gọi chính, phụ, retry và tool call mà Hermes
  quản lý; cảnh báo sớm và tạm dừng an toàn trước tool-loop không tiến triển.
- **Phiên dài trên 300k:** compaction giữ lịch sử logic, recovery anchors và
  continuation state để phiên có thể tiếp tục sau khi mở lại.
- **Tool output lớn:** chỉ giữ preview có trần trong parent context; phần dư
  được lưu thành artifact có kích thước, SHA-256 và đường đọc lại.
- **Phân loại lỗi:** quota, context overflow và lỗi provider có trạng thái khôi
  phục riêng; composer không còn bị khóa im lặng.
- **UX-001:** nút `+` nhận pointer/click thật và tạo đúng một phiên.
- **UX-002:** trang Nhắn tin có nút quay lại rõ ràng và giữ nguyên draft.
- **UX-003:** meter tách context nền, hội thoại, lịch sử logic, compaction,
  quota, ngân sách lượt và chi phí API-equivalent.

## Windows x64 đã nghiệm thu

- Windows x64: exact-artifact smoke đạt.
- Cài mới, onboarding rỗng, mock runtime, safe tool, relaunch và persistence:
  đạt trong máy ảo Windows dùng một lần.
- Update trực tiếp từ `vi-v0.31.0-7`, repair khôi phục đúng byte, uninstall giữ
  dữ liệu, uninstall xóa dữ liệu và rollback về `vi-v0.20.4-39`: đạt.
- Chưa có smoke trên máy người dùng; toàn bộ nghiệm thu ghi dữ liệu dùng profile
  cô lập và mock provider, không dùng hồ sơ Hermes thật.

| Thuộc tính             | Giá trị                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Tệp                    | `Hermes-Vietnamese-Windows-x64-Setup.exe`                          |
| Version                | `0.32.0-vi.1`                                                      |
| Commit trong candidate | `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`                         |
| Kích thước             | `341176379` byte                                                   |
| SHA-256                | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |

[Tải Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.0-1/Hermes-Vietnamese-Windows-x64-Setup.exe)

## Giới hạn và an toàn cài đặt

- Candidate hiện `NotSigned`. Hồ sơ SignPath chưa cung cấp credential ký cho
  lượt này; Windows có thể hiện `Publisher: Unknown` hoặc SmartScreen.
- Dự án chưa tham gia Apple Developer Program; v32 không quảng cáo artifact
  macOS, Linux hoặc Windows ARM64 khi chưa có exact-byte evidence riêng.
- Đây là community pilot GitHub Latest cho Windows x64, không phải stable/final.
  v31 bị thay khỏi Latest vì các lỗi nghiêm trọng về token, context và UI/UX.
- Chỉ cài tệp có kích thước và SHA-256 khớp bảng trên. Không tắt Microsoft
  Defender hoặc SmartScreen trên toàn máy.
- Rollback đã diễn tập: `vi-v0.20.4-39`.
