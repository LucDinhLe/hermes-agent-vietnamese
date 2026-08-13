# Quy trình phát hành Hermes tiếng Việt đa nền tảng

## Mục tiêu và tiêu chí đạt

Một commit được phát hành khi cùng mã nguồn tạo được các gói sau và mọi gói đều vượt kiểm tra cấu trúc:

- Windows 10/11 x64 và ARM64: NSIS `.exe`.
- macOS 12+ Apple Silicon và Intel x64: `.dmg` và `.zip`.
- Linux x64 và ARM64: `.AppImage`, `.deb` và `.rpm`.
- Tất cả tệp có tên nhất quán và xuất hiện trong `SHA256SUMS.txt`.
- Bộ cài không chứa tài khoản, OAuth token, API key hoặc dữ liệu người đóng gói.

Chủ dự án quyết định nhãn phát hành, thời điểm công bố và việc mua chứng thư ký số. Workflow quyết định cách build, kiểm tra và gom tệp theo hợp đồng này.

## Kiến trúc phát hành

Workflow `.github/workflows/release-vietnamese.yml` có ba cổng:

1. **Verify:** kiểm toán dependency, kiểm thử routing của bản cộng đồng, ngôn ngữ và kiểu dữ liệu.
2. **Build matrix:** mỗi gói được build trên đúng hệ điều hành và đúng kiến trúc. Native dependency được cài lại trong từng runner; không cross-build module native từ máy Windows.
3. **Release:** chỉ chạy khi cả sáu build đạt, tải toàn bộ artifact, tạo bảng SHA-256 chung rồi tạo GitHub Release mới.

Một nhãn đã phát hành là bất biến. Workflow từ chối ghi đè tệp của nhãn cũ; bản sửa lỗi phải dùng số phát hành mới.

## Ma trận build

| ID              | Runner             | Đầu ra                     |
| --------------- | ------------------ | -------------------------- |
| `windows-x64`   | `windows-2025`     | NSIS x64                   |
| `windows-arm64` | `windows-11-arm`   | NSIS ARM64                 |
| `macos-arm64`   | `macos-15`         | DMG + ZIP Apple Silicon    |
| `macos-x64`     | `macos-15-intel`   | DMG + ZIP Intel x64        |
| `linux-x64`     | `ubuntu-24.04`     | AppImage + DEB + RPM x64   |
| `linux-arm64`   | `ubuntu-24.04-arm` | AppImage + DEB + RPM ARM64 |

Hai runner ARM64 của GitHub hiện thuộc Public Preview. Gói chỉ được coi là đạt khi job build và kiểm tra cấu trúc thực sự xanh; nhãn runner tự nó không phải bằng chứng tương thích trên máy người dùng.

## Ký số và công chứng

Workflow vẫn tạo được bản thử nghiệm chưa ký. Ký và công chứng macOS đã được nối sẵn; bản phát hành rộng cho macOS cần các GitHub Actions secrets sau:

- macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.

macOS phải được ký Developer ID và Apple công chứng để Gatekeeper nhận diện bình thường. Windows cần chứng thư code-signing có timestamp để giảm SmartScreen, nhưng cấu hình Hermes hiện cố ý đặt `signAndEditExecutable: false` nhằm tránh đường tải `winCodeSign` từng làm hỏng build trên Windows không có quyền tạo symlink. Vì vậy workflow này chưa nhận `WIN_CSC_*` và không giả vờ rằng chỉ thêm secret là đã ký. Chữ ký Windows cần một bước ký riêng bằng `signtool` trên runner Windows, kèm chứng thư thật và test xác minh chữ ký, rồi mới được bật cho phát hành rộng. Linux hiện dùng SHA-256; nếu đưa vào kho APT/RPM riêng thì bổ sung GPG signing tại kho, không nhét khóa riêng vào workflow.

## Cách chạy

1. Tạo checkpoint Git sạch và bảo đảm commit cần phát hành đã có trên remote `vietnamese`.
2. Chạy workflow thủ công với nhãn dạng `vi-v0.20.0-4`; giữ **bản thử nghiệm** bật khi chưa có chữ ký hoặc chưa pilot trên máy thật.
3. Tải artifact của từng job và chạy pilot tối thiểu trên một máy đại diện cho mỗi hệ điều hành.
4. Khi đủ bằng chứng, chạy lại bằng nhãn phát hành mới. Không tái sử dụng hoặc ghi đè nhãn cũ.

Push tag `vi-v*` là đường phát hành chính thức. Chỉ dùng sau khi chữ ký, công chứng và pilot đã đạt.

## Nghiệm thu trên máy thật

Mỗi hệ điều hành phải vượt các bước sau:

1. Tải đúng gói và đối chiếu SHA-256.
2. Cài/mở ứng dụng bằng tài khoản người dùng thường.
3. Hoàn tất bootstrap trên thư mục Hermes mới.
4. Chuyển VI/EN, tạo `Phiên mới`, mở Cài đặt và khu vực AI agent phụ.
5. Đăng nhập bằng một tài khoản thử của chính người kiểm tra; không dùng credential của người đóng gói.
6. Gửi một tin nhắn, chạy một công cụ an toàn, đóng/mở lại và xác nhận phiên còn nguyên.
7. Gỡ ứng dụng; xác nhận dữ liệu người dùng không bị xóa ngầm.

## Quay lui

- Giữ nguyên bản phát hành ổn định trước đó và bảng SHA-256 của nó.
- Nếu một hệ điều hành thất bại, đánh dấu bản mới là pre-release, không thay tệp dưới nhãn cũ và hướng người dùng về bản ổn định trước.
- Sửa trên commit mới, tăng hậu tố nhãn phát hành rồi chạy lại toàn bộ ma trận.
- Không xóa `~/.hermes` hoặc `%LOCALAPPDATA%\hermes` trong quá trình quay lui.

## Giới hạn hiện tại

- Native Windows của Hermes vẫn là Early Beta theo tài liệu dự án gốc.
- macOS Intel được đóng gói riêng và cần pilot trên máy thật trước khi bỏ nhãn thử nghiệm.
- Linux Desktop được build đa định dạng, nhưng mức tương thích ngoài Ubuntu/glibc/systemd/FHS cần pilot theo bản phân phối.
- RAM/CPU/dung lượng bắt buộc chưa được Hermes công bố và chưa có benchmark tối thiểu. README chỉ đưa mức khuyến nghị vận hành, không biến ước lượng thành yêu cầu chính thức.
