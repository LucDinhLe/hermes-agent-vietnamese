## Hermes Vietnamese vi-v0.20.0-25

Bản pilot cộng đồng đa nền tảng với giao diện tiếng Việt mặc định và nút chuyển nhanh VI/EN. Tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI agent sinh ra được giữ nguyên.

> Đây là bản thử nghiệm cộng đồng **chưa ký số**. Chỉ tải bản public sau khi SHA-256 và kiểm thử cài đặt trên đúng artifact đều đạt. Windows SmartScreen/Application Control và macOS Gatekeeper có thể cảnh báo hoặc chặn; không tắt cơ chế bảo vệ hệ điều hành để cài.

### Tình trạng nghiệm thu

- **Windows x64: exact-artifact smoke đạt** trên máy Windows 11 vật lý: cài mới với hồ sơ sạch, runtime đóng gói, gateway/onboarding, tạo và đổi tên phiên, tab phiên/trình duyệt, panel phải, restart giữ dữ liệu, repair và gỡ cài đặt giữ/xóa dữ liệu.
- Windows x64 chưa chạy một tool bằng provider thật và chưa kiểm chứng desktop updater từ v14 bằng chính artifact này; hai mục được công khai là giới hạn pilot, không được ghi nhận GO.
- **Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 chưa có smoke trên máy người dùng.** Các gói đã build trên runner native và khớp SHA-256 nhưng vẫn là build-only pilot. Nếu thử nghiệm, hãy sao lưu dữ liệu và gửi hệ điều hành/kiến trúc, bước tái hiện cùng log không chứa khóa hoặc dữ liệu riêng khi gặp lỗi.
- Bản ổn định/Latest vẫn là `vi-v0.20.0-14`; v25 không tự thay thế bản ổn định.

### Chọn đúng tệp

| Máy đang dùng           | Tải trực tiếp                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian           | [Chọn `.deb` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                   |
| Fedora/RHEL             | [Chọn `.rpm` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                                   |
| Linux khác              | [Chọn `.AppImage` x64 hoặc ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#chọn-đúng-bộ-cài)                              |

### Sửa lỗi và cải thiện

- Tên phiên do Hermes sinh tự động được đồng bộ sang danh sách bên trái; đổi tên phiên không còn trả lỗi 500.
- Thanh tab phiên có nút `+` để mở tab mới và `×` để đóng từng tab. Đóng tab không xóa phiên khỏi lịch sử.
- Panel phải có thể kéo rộng; trình duyệt tự fit theo vùng hiển thị hẹp và giữ trạng thái khi chuyển qua lại với vùng tệp.
- Tiêu đề chữ **Hệ thống tệp** được bỏ khỏi panel vì đã có biểu tượng tệp với nhãn trợ năng.
- Bộ cài mang sẵn Python, Node.js, `uv`, dependency Python và source snapshot; lần chạy đầu không cần Git, npm hay công cụ lập trình.
- Sửa bootstrap bị treo ở bước Repository do `git fetch`; runtime dùng đúng commit/tag bất biến trong artifact.
- Trình cập nhật đọc đúng release `vi-v*` của fork và giữ lịch sử, cấu hình, đăng nhập sau khi cập nhật/khởi động lại.
- Gỡ cài đặt giữ dữ liệu hoặc xóa toàn bộ trên Windows dùng Python đã đóng gói ngoài venv; người dùng không cần cài Python hệ thống và uninstaller không tự khóa tệp đang xóa.
- Sửa script gỡ Windows có thể kẹt vĩnh viễn tại pipeline `tasklist | findstr`; hai lệnh giờ trao đổi qua tệp tạm có giới hạn và regression test cấm khôi phục pipeline lỗi.
- Chuyển thư mục làm việc của script cleanup ra ngoài cây ứng dụng trước khi xóa, tránh để lại các thư mục runtime rỗng sau gỡ toàn phần.
- Nâng `cryptography` lên `50.0.0`, đóng CVE-2026-69247, CVE-2026-69248 và CVE-2026-69249 trong runtime.
- Windows ARM64 có `agent-browser` ARM64 build từ source upstream đã khóa commit và SHA-256; không dùng helper x64 giả native.
- Sửa đóng gói `agent-browser` trên macOS/Linux: bộ dựng tạo launcher xác định từ package thay vì sao chép liên kết `.bin` phụ thuộc npm/Node; exact-artifact gate bắt buộc launcher là tệp chạy được.
- Sửa đóng gói candidate chưa ký trên cả ba hệ điều hành: Git nhận biểu thức tag an toàn trên Windows, biến chứng thư rỗng không lọt vào electron-builder trên macOS và builder không còn tự publish khi chạy từ tag.
- Sửa cổng kiểm tra DMG nhận đúng phiên bản release override `0.20.0-vi.N`; verifier không còn tưởng thiếu artifact rồi dựng lại lần hai bằng payload tạm đã được dọn.
- Quy trình build/staging tách khỏi public promotion. Promotion chỉ chạy sau khi đúng byte đã qua smoke và có bằng chứng trên đủ sáu nền tảng.

### Bảo mật, chữ ký và dữ liệu

- Bản `vi-v0.20.0-25` được phát hành theo lớp **community prerelease pilot**: Windows chưa có Authenticode; macOS chưa có Developer ID, notarization hoặc stapling. Workflow bắt buộc giữ nhãn prerelease, ghi nhận đúng phạm vi đã/chưa kiểm thử và không cho phép quảng cáo bản này là stable/final.
- Dự án đã nộp hồ sơ SignPath và đang chờ SignPath xét duyệt để ký bản Windows. Dự án chưa tham gia Apple Developer Program, vì vậy bản macOS chưa được Apple notarize; trạng thái này sẽ được cập nhật sau khi hoàn tất đăng ký và kiểm tra ký mã.
- Đối chiếu tệp tải về với `SHA256SUMS.txt`. Không dùng artifact nếu SHA-256 không khớp.
- Bản dựng không chứa tài khoản, OAuth token, khóa API, lịch sử trò chuyện hoặc hồ sơ vận hành của người đóng gói.
- Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của họ. Nội dung chỉ được gửi tới nhà cung cấp AI/công cụ mà người dùng chủ động cấu hình và sử dụng.

Xem [hướng dẫn cài đặt tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md), [chính sách ký mã](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md) và [phạm vi miễn trừ](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md).

Rollback: quay lại [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14) theo hướng dẫn sao lưu/khôi phục trong ứng dụng. Các candidate v15–v24 không được công khai; v21 bị chặn bởi lỗi workflow tải draft, v22 bị loại vì gỡ `lite/full` trên Windows có thể phụ thuộc Python hệ thống, v23 bị loại vì pipeline chờ PID của uninstaller có thể kẹt vĩnh viễn, còn v24 bị exact-artifact smoke loại vì script cleanup đứng trong chính cây thư mục app nên không thể xóa hết các thư mục rỗng. Các nguyên nhân đã được sửa và khóa bằng regression test trong v25.
