<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/vi-v0.32.1-18/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese v32.1 — Windows, macOS và Linux

**Bản tải mặc định/Latest dành cho thử nghiệm cộng đồng. Chưa phải
bản stable.** Windows x64 đã qua nghiệm thu trọn vòng; Windows ARM64,
macOS và Linux đã được dựng trên runner native nhưng chưa có smoke
trên máy người dùng. Windows/macOS chưa ký số hoặc công chứng.

## Chọn đúng bộ cài

| Hệ điều hành  | Loại máy              | Tải về                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 | x64                   | [Bộ cài EXE](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Windows-x64-Setup.exe)                                                                                                                                                                                                                                                              |
| Windows 10/11 | ARM64                 | [Bộ cài EXE](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Windows-arm64-Setup.exe)                                                                                                                                                                                                                                                            |
| macOS 12+     | Apple Silicon, chip M | [DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) · [ZIP](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Apple-Silicon.zip)                                                                                                                           |
| macOS 12+     | Intel x64             | [DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Intel.dmg) · [ZIP](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Intel.zip)                                                                                                                                           |
| Linux         | x64                   | [AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.AppImage) · [DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.deb) · [RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.rpm)       |
| Linux         | ARM64                 | [AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.AppImage) · [DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.deb) · [RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.rpm) |

## An toàn phiên và Dự án

- Khắc phục lỗi phạm vi Dự án làm các phiên cũ trông như biến mất.
- Khi mở lại Hermes, giao diện trở về toàn bộ Dự án và phiên.
- Ẩn hoặc Xóa Dự án chỉ đổi metadata Dự án, không xóa hay ẩn
  phiên và tin nhắn.
- Dữ liệu tiếp tục nằm trên máy hoặc máy ảo mà người dùng đã
  chọn. Hermes không tự tải phiên, Dự án hoặc bản sao lưu lên đám mây.

## Mức độ kiểm chứng

- **Windows x64: PILOT-GO.** Exact artifact đã qua cài mới, runtime,
  Gateway, onboarding, phiên/Dự án, mở lại, cập nhật từ v32, repair,
  hai chế độ gỡ cài đặt và rollback.
- **Windows ARM64, macOS Apple Silicon, macOS Intel, Linux x64 và Linux
  ARM64: BUILD-ONLY-PILOT.** Đã build và kiểm cấu trúc/kiến trúc, chưa
  có smoke trên máy người dùng.
- Bản community pilot có `updateFeedEnabled=false`; việc đặt GitHub
  Latest không tự bật cập nhật trong ứng dụng.

## Kiểm tra và quay lui

Mọi tệp phải đối chiếu với `SHA256SUMS.txt` của release này. Nếu một
nền tảng gặp lỗi, dừng dùng bản đó và quay về
[`vi-v0.32.1-17`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-17).
