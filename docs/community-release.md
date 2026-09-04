# Quy trình phát hành Hermes Vietnamese

## Bản hiện hành 2026.9.2

Latest hiện là [v2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2),
community pilot **chỉ Windows x64**, chưa ký số và không có automatic update feed.
Hợp đồng hiện hành nằm ở `.github/public-release.json`; xem
[bằng chứng và kế hoạch đồng bộ](release-2026.9.2-public-sync.md).

Ngoại lệ Windows-only được chủ dự án duyệt cho đợt này. Không dùng mô tả ma trận
sáu target bên dưới làm bằng chứng có sáu bộ cài 2026.9.2. Native build một lần,
staging draft, nghiệm thu đúng byte cả currentuser/allusers rồi mới promote.
Source sản phẩm nằm ở tag v2026.9.2; workflow nghiệm thu calendar nằm ở commit
harness ghi trong descriptor. Không chạy workflow legacy để rebuild tag này.

Từ đợt này dùng `YYYY.M.N`, với N là số cập nhật trong tháng, không phải ngày.
Tag tương ứng `vYYYY.M.N`. Giữ tag `vi-v*` cũ cho lịch sử và rollback.

Sau mỗi promotion, bắt buộc đồng bộ main/README, hướng dẫn, release notes,
descriptor và mô tả kho; chạy `node scripts/check-public-docs.mjs --live`.
Chỉ sửa tài liệu thì giữ nguyên mọi asset ID, size, digest, tag và source commit.
Windows/macOS/Linux ngoài phạm vi đã nghiệm thu phải ghi giới hạn riêng.

## Quy trình legacy và mục tiêu đa nền tảng

Các phần dưới mô tả dòng phát hành `vi-v*` trước calendar và mục tiêu stable;
không phải hướng dẫn cập nhật tự động cho pilot 2026.9.2. Pilot hiện dùng bộ cài
đầy đủ; không có `latest*.yml`. Chữ ký và nghiệm thu từng target vẫn bắt buộc
trước khi mở phạm vi stable tương ứng.

## Hồ sơ vận hành hiện tại

- [Quy tắc phát hành bắt buộc](release-engineering-rulebook.md)
- [Hồi cứu vi-v0.20.0-25](release-vi-v0.20.0-25-retrospective.md)
- [Bàn giao từ v25 sang v26](handoff-vi-v0.20.0-26.md)

Ba tài liệu trên là điểm bắt đầu bắt buộc cho mọi phiên chuẩn bị candidate mới.
Khi thông tin cũ mâu thuẫn với public release hoặc rulebook hiện tại, phải kiểm
tra GitHub/repository và ghi lại xung đột thay vì tự suy diễn.

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

## Cập nhật thuận tiện trong ứng dụng

Sau khi sáu target được gom về staging, workflow tạo bốn manifest cập nhật từ
đúng byte đã dựng: `latest.yml`, `latest-mac.yml`, `latest-linux.yml` và
`latest-linux-arm64.yml`. Từng mục ghi tên tệp chuẩn hóa, kích thước và SHA-512;
bốn manifest tiếp tục được đưa vào `SHA256SUMS.txt` trước khi upload draft.

Hermes Vietnamese đóng gói đọc danh sách GitHub Releases công khai, bỏ qua draft và release
không có manifest dành cho nền tảng đang chạy, rồi ghim bộ cập nhật vào URL của
release bất biến đã chọn. Windows tải trọn bộ cài đã nghiệm thu, xác minh hash,
đóng ứng dụng, cài yên lặng và mở lại. `appId`, package product name, executable,
protocol và vùng dữ liệu kỹ thuật được giữ nguyên. Tên cửa sổ, shortcut và tên
trình gỡ cài đặt được đổi thành Hermes Vietnamese mà cấu hình, bí mật, cuộc trò
chuyện, lịch định kỳ và trạng thái onboarding không bị chuyển sang vùng dữ liệu
mới.

Exact-artifact update phải giữ cả marker bootstrap do bản cũ tạo. Với gói
resident đầy đủ, marker schema 1 hợp lệ vẫn là bằng chứng cài đặt dù chưa có
`desktopVersion`; Hermes phải mở thẳng runtime tích hợp và không được đưa người
dùng về bootstrap hoặc tải/chạy `uv` trong AppData.

`vi-v0.20.4-34` chưa mang các manifest này và code updater trong bản đó chưa đọc
được nhãn cộng đồng. Vì vậy người dùng v28 cần cài thủ công bản sửa đầu tiên một
lần; từ bản sửa đó trở đi dùng **Cài đặt → Giới thiệu → Cập nhật ngay**. Đường
chuyển tiếp này phải được kiểm thử exact-artifact từ v28 trước khi promotion.

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

## Pilot cộng đồng lấy phản hồi

Chủ dự án có thể công khai một **community prerelease** đa nền tảng để lấy phản hồi trước khi đủ máy nghiệm thu, nhưng chỉ qua workflow `promote-pilot-vietnamese.yml` và phải thỏa tất cả điều kiện sau:

- Cả sáu artifact được build một lần trên đúng runner native, staging dưới dạng draft và vượt đối chiếu SHA-256.
- Windows x64 phải vượt exact-artifact smoke trên máy vật lý: cài mới không cần công cụ lập trình, runtime/gateway/onboarding, tạo và đổi tên phiên, tab phiên/trình duyệt, resize panel, restart giữ dữ liệu, repair và cả hai chế độ uninstall.
- Mọi cổng chưa chạy như provider/tool thật hoặc update desktop từ bản trước phải ghi `false` trong evidence và nêu rõ trong release notes; không được chuyển thành kết quả GO.
- Năm target chưa có máy thật phải mang trạng thái `BUILD-ONLY-PILOT`, ghi rõ chưa có smoke trên máy người dùng và mời báo lỗi. Thành công của runner không được gọi là bằng chứng tương thích thực tế.
- Pilot chưa được gọi là stable/final. Chủ dự án có thể cho pilot làm bản tải mặc định/Latest sau khi Windows x64 vượt exact-artifact smoke và chấp thuận rõ phạm vi lấy phản hồi cộng đồng; tài liệu và release notes phải ghi nổi bật target nào chỉ mới build, tình trạng ký số và bản rollback. Không được suy diễn trạng thái Latest thành bằng chứng stable.
- Promotion tải lại toàn bộ draft, kiểm manifest/provenance/evidence và công khai đúng byte đã staging. Không được sửa hoặc thay artifact sau promotion.

Stable vẫn bắt buộc đủ toàn bộ runtime gate, máy thật, signing/notarization và workflow `promote-vietnamese.yml`; phản hồi cộng đồng không thay thế các cổng đó.

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
