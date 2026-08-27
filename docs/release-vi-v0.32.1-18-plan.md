# Kế hoạch candidate `vi-v0.32.1-18`

Ngày chốt phạm vi: 2026-08-28
Trạng thái: **đã công khai và được chọn làm GitHub Latest theo xác nhận của chủ dự án; vẫn là community pilot, không phải stable**.

## Kết quả thực tế

- URL công khai:
  <https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18>.
- Product commit bất biến:
  `2594eb396f0c5720802fc608a01a64d96d5629b2`.
- Build/staging run: `33101754226`; sáu target native dựng thành công và đủ 27
  asset trước smoke. Lỗi duy nhất là GitHub HTTP 500 khi tải lại RPM ở postcheck
  sau upload; promotion đã tải lại và đối chiếu toàn bộ byte thành công.
- Lifecycle run đạt: `33109790978`, harness commit
  `d26d2bec81be1c104ab2dbc75cfe9b08a7e96553`, đủ 20/20 gate và 67 file bằng
  chứng. Evidence artifact `9663716312`, digest
  `5ee84361a2baaf5d73175297a44ea9115671f9eb42ca95550242f31064179f25`.
- Run gắn biên nhận từ lifecycle đã sealed: `33114738368`. Pilot evidence
  SHA-256:
  `7ce8c2bfbb8089669430a8dd838a1d943499c17719dc339b6780b61fe5bb0633`.
- Promotion/postcheck run: `33114927801`, controller
  `6ba341b5a28a88bf31eb15087727c260b981f87c`; kết quả thành công,
  `draft=false`, `prerelease=true`, đủ 28 asset và 12 artifact phân phối.
- Manifest SHA-256:
  `e13a09aa1f30cb19e1fb8ab6ed636b5cec605fd9402fbb6f32d6daf1391d4128`.
  Windows x64 SHA-256:
  `565e1313162505999238b9c3b4f1422ec37256a1da153bae5149b5795c83c5ac`.
- `vi-v0.32.1-18` là GitHub Latest theo quyết định ngày 2026-08-28 của
  chủ dự án. Thay đổi chỉ thuộc metadata, không đổi asset, hash hay
  update feed; bản này không được gọi là stable/final.

## Mục tiêu và audience

Community prerelease đa nền tảng của đúng phạm vi sản phẩm v32.1 hiện tại.
Candidate bổ sung bộ cài native cho Windows x64/ARM64, macOS Apple
Silicon/Intel và Linux x64/ARM64; không thêm tính năng v33, không đổi nơi lưu dữ
liệu và không bật Hermes cloud backup.

## Quyết định phát hành

- `vi-v0.32.1-17` giữ nguyên tag, asset và hash, trở thành bản trước để
  quay lui sau khi `-18` được chọn làm GitHub Latest.
- Tạo successor `vi-v0.32.1-18` vì artifact của năm target mới và Windows x64
  mang SemVer mới là byte mới; không thêm asset vào release `-17` đã bất biến.
- Windows x64 phải chạy lại full lifecycle trên exact installer `-18`.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 chỉ được công bố
  là `BUILD-ONLY-PILOT` cho tới khi có smoke riêng trên máy người dùng.
- Candidate chưa ký, không có update feed tự động và không phải
  stable/final. Workflow promotion pilot ban đầu không đặt Latest; bước
  metadata sau đó chỉ đặt Latest khi chủ dự án xác nhận rõ phạm vi.

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
  đủ link của 12 artifact phân phối, cùng trỏ Latest `-18` và ghi rõ
  năm target ngoài Windows x64 chỉ là `BUILD-ONLY-PILOT`.

## Chuỗi công khai

1. Chạy source gates, commit sạch và push.
2. Tạo annotated tag `vi-v0.32.1-18` tại exact source commit.
3. Build/stage một lần đủ sáu target; tải lại và kiểm manifest.
4. Chạy full lifecycle Windows x64 từ đúng draft; sinh và upload biên nhận
   pilot sau khi receipt xanh.
5. Chạy promotion pilot để công khai cùng byte staging.
6. Sau xác nhận riêng của chủ dự án, đổi metadata thành Latest,
   giữ nguyên lớp community pilot, cảnh báo và toàn bộ asset.
7. Hậu kiểm đủ asset, URL HTTP, digest GitHub, `SHA256SUMS.txt`,
   tên hiển thị và endpoint GitHub Latest.

## Rollback

- Nếu bước metadata hoặc hậu kiểm Latest lỗi, chuyển `-18` về
  prerelease và khôi phục `vi-v0.32.1-17` làm Latest.
- Nếu lỗi chỉ thuộc controller/hạ tầng trước staging, giữ nguyên product tag và
  sửa controller; không tạo candidate mới. Khi byte đã staging, lifecycle sửa
  harness phải dùng lại đúng byte, không rebuild.
- Nếu product source, input đóng gói hoặc artifact đổi byte, tạo candidate kế
  tiếp; không thay asset cùng tag.
