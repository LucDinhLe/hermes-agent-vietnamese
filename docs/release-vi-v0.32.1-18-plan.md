# Kế hoạch candidate `vi-v0.32.1-18`

Ngày chốt phạm vi: 2026-08-28
Trạng thái: **đã tag; build run đầu xác định lỗi harness trước staging; chưa
public**.

## Mục tiêu và audience

Community prerelease đa nền tảng của đúng phạm vi sản phẩm v32.1 hiện tại.
Candidate bổ sung bộ cài native cho Windows x64/ARM64, macOS Apple
Silicon/Intel và Linux x64/ARM64; không thêm tính năng v33, không đổi nơi lưu dữ
liệu và không bật Hermes cloud backup.

## Quyết định phát hành

- `vi-v0.32.1-17` giữ nguyên tag, asset, hash và vai trò GitHub Latest trong khi
  candidate đa nền tảng được nghiệm thu.
- Tạo successor `vi-v0.32.1-18` vì artifact của năm target mới và Windows x64
  mang SemVer mới là byte mới; không thêm asset vào release `-17` đã bất biến.
- Windows x64 phải chạy lại full lifecycle trên exact installer `-18`.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 chỉ được công bố
  là `BUILD-ONLY-PILOT` cho tới khi có smoke riêng trên máy người dùng.
- Candidate chưa ký, không có update feed tự động, không phải stable/final và
  không thay GitHub Latest bằng workflow promotion pilot.

## Ma trận artifact

| Target              | Runner native      | Artifact công bố            | Phạm vi tối đa                |
| ------------------- | ------------------ | --------------------------- | ----------------------------- |
| Windows x64         | `windows-2025`     | NSIS `.exe`                 | `PILOT-GO` sau full lifecycle |
| Windows ARM64       | `windows-11-arm`   | NSIS `.exe`                 | `BUILD-ONLY-PILOT`            |
| macOS Apple Silicon | `macos-15`         | `.dmg`, `.zip`              | `BUILD-ONLY-PILOT`            |
| macOS Intel         | `macos-15-intel`   | `.dmg`, `.zip`              | `BUILD-ONLY-PILOT`            |
| Linux x64           | `ubuntu-24.04`     | `.AppImage`, `.deb`, `.rpm` | `BUILD-ONLY-PILOT`            |
| Linux ARM64         | `ubuntu-24.04-arm` | `.AppImage`, `.deb`, `.rpm` | `BUILD-ONLY-PILOT`            |

## Cổng source

- Release workflow chỉ thu hẹp `vi-v0.32.1-17`; `-18` phải tạo đủ sáu build
  leg native.
- Lifecycle v32.1 nhận exact successor tag nhưng vẫn khóa candidate commit,
  harness commit, size và SHA-256 độc lập.
- Build validation cũng khóa product commit và harness commit độc lập. Verifier
  controller chỉ được overlay sau khi artifact đã dựng; DMG/AppImage phải được
  mount/extract rồi đối chiếu provenance ngay trong exact artifact.
- Biên nhận pilot được sinh từ `lifecycle-result.json` đã sealed; Windows x64
  phải khớp byte trong `SHA256SUMS.txt`, năm target còn lại phải khai báo
  `realMachineSmoke=false`.
- README, README.vi, release notes và `.github/public-release.json` phải chứa
  đủ link của 12 artifact phân phối và phân biệt rõ Latest `-17` với pilot
  `-18`.

## Chuỗi công khai

1. Chạy source gates, commit sạch và push.
2. Tạo annotated tag `vi-v0.32.1-18` tại exact source commit.
3. Build/stage một lần đủ sáu target; tải lại và kiểm manifest.
4. Chạy full lifecycle Windows x64 từ đúng draft; sinh và upload biên nhận
   pilot sau khi receipt xanh.
5. Chạy promotion pilot để công khai cùng byte staging. Không đặt Latest.
6. Hậu kiểm đủ asset, URL HTTP, digest GitHub và `SHA256SUMS.txt`.

## Rollback

- Nếu source/build/lifecycle/promotion lỗi, giữ `-18` ở draft và giữ
  `vi-v0.32.1-17` làm Latest.
- Nếu lỗi chỉ thuộc controller/hạ tầng trước staging, giữ nguyên product tag và
  sửa controller; không tạo candidate mới. Khi byte đã staging, lifecycle sửa
  harness phải dùng lại đúng byte, không rebuild.
- Nếu product source, input đóng gói hoặc artifact đổi byte, tạo candidate kế
  tiếp; không thay asset cùng tag.
