# Hermes Desktop: thiết lập lần đầu trong 3 bước

## Mục tiêu

Người dùng mới trên Windows, macOS hoặc Linux có thể đi từ bộ cài tới phiên làm việc đầu tiên mà không phải mở Terminal, chạy lệnh hoặc sửa tệp cấu hình.

Luồng thành công có ba bước nhìn thấy được:

1. **Cài đặt**: chọn English hoặc Tiếng Việt, cài Hermes cục bộ hoặc kết nối tới Hermes đã có.
2. **Kết nối model**: dùng luồng OAuth, khóa API hoặc điểm cuối cục bộ tương thích OpenAI đã có của Hermes.
3. **Bắt đầu giao việc**: xác nhận model mặc định và mở phiên làm việc.

## Phạm vi

- Giữ nguyên ứng dụng chính, Terminal tích hợp, phiên, công cụ, Gateway, lịch và các tính năng lõi của Hermes.
- Tái sử dụng `DesktopInstallOverlay`, `DesktopOnboardingOverlay` và luồng chọn model hiện có.
- Hiển thị cùng một chỉ báo ba bước xuyên suốt quá trình cài đặt và kết nối model.
- Cho phép chọn English hoặc Tiếng Việt ngay trong bước đầu. Lựa chọn tạm được giữ cục bộ trong lúc backend chưa sẵn sàng và được lưu vào cấu hình Hermes khi bước kết nối model bắt đầu.
- macOS và Linux dùng trình cài đặt tự động `install.sh`; Windows dùng trình cài đặt tự động `install.ps1`. Giao diện không đưa người dùng sang Terminal khi cài đặt lần đầu.

## Ngoài phạm vi của lát cắt này

- Không nhúng sẵn tệp model nhiều GB vào bộ cài Desktop.
- Không thay đổi cách Hermes chạy lệnh hoặc quyền của Terminal tích hợp.
- Không thay đổi cơ chế xác thực, giấy phép hoặc thuật toán lõi của Hermes.
- Không tuyên bố máy nào cũng chạy tốt model cục bộ. Người dùng có thể kết nối Ollama, LM Studio, llama.cpp hoặc điểm cuối tương thích OpenAI bằng lựa chọn cục bộ hiện có.

## Hành vi khi lỗi

- Cài đặt thất bại giữ nguyên dữ liệu người dùng, hiển thị bước lỗi, nhật ký và hành động thử lại hoặc sửa cài đặt.
- Kết nối model thất bại giữ người dùng ở bước 2 và cho phép chọn nhà cung cấp khác.
- Lựa chọn ngôn ngữ thất bại khi lưu cấu hình vẫn còn trong phiên cài đặt; Hermes thử lưu lại khi backend sẵn sàng.
- Hủy cài đặt dừng tiến trình hiện tại và không đánh dấu bootstrap hoàn tất.

## Nền tảng phát hành

| Hệ điều hành | Kiến trúc | Gói phát hành |
| --- | --- | --- |
| Windows 10/11 | x64, ARM64 | NSIS |
| macOS 12+ | Apple Silicon, Intel | DMG, ZIP |
| Linux | x64, ARM64 | AppImage, DEB, RPM |

Mỗi gói chỉ được phát hành khi build, kiểm thử bootstrap, xác minh nội dung và SHA-256 đạt trên runner đúng hệ điều hành và kiến trúc.

## Tiêu chí nghiệm thu

- Bước 1 có lựa chọn English/Tiếng Việt và không yêu cầu chạy lệnh thủ công.
- Bước 2 dùng đúng danh sách nhà cung cấp, OAuth, khóa API và điểm cuối cục bộ hiện có.
- Bước 3 hiển thị nhà cung cấp, model mặc định và nút bắt đầu.
- Người dùng hoàn tất luồng sẽ vào giao diện Hermes hiện tại; Terminal tích hợp vẫn hoạt động như trước.
- Kiểm thử giao diện, Electron bootstrap, typecheck và ma trận phát hành đa nền tảng đều đạt.
