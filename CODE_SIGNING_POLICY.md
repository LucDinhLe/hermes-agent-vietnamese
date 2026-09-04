# Code signing policy / Chính sách ký mã

## Trạng thái

Ngày 2026-09-04, bản Latest [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2) chỉ phát hành Windows x64 và có Authenticode `NotSigned`. Dự án đang hoàn thiện tài liệu/quy trình để nộp lại hồ sơ chương trình ký mã nguồn mở. Chưa có xác nhận hồ sơ được chấp thuận hoặc chữ ký mới trong đợt này; việc công khai bản cập nhật không đồng nghĩa đã nộp lại hồ sơ.

Chỉ xem một tệp là đã ký khi trang phát hành ghi rõ và chữ ký thực tế xác minh thành công. Bản macOS cũ chưa đạt yêu cầu ký/công chứng và kiểm tra Gatekeeper cho người dùng thường; đợt 2026.9.2 không cung cấp macOS. Không khuyến nghị vô hiệu hóa bảo vệ để chạy các gói cũ.

Chứng thư ký mã dùng để xác minh nguồn phát hành và tính toàn vẹn của tệp. Đây không phải giấy phép sử dụng phần mềm của Microsoft hoặc Apple. Trạng thái hiện tại cũng không có nghĩa hai công ty này đã từ chối dự án. Windows SmartScreen đánh giá cả chữ ký và uy tín của tệp; macOS Gatekeeper sử dụng Developer ID cùng quy trình notarization riêng của Apple.

Khi hồ sơ được chấp thuận, dự án sẽ ghi nhận chương trình theo tuyên bố chính thức: **Free code signing provided by SignPath.io, certificate by SignPath Foundation**.

## Dự án và giấy phép

- Dự án: [Hermes Agent tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese)
- Kho mã nguồn: [LucDinhLe/hermes-agent-vietnamese](https://github.com/LucDinhLe/hermes-agent-vietnamese)
- Giấy phép: [MIT](LICENSE)
- Bản phát hành: [GitHub Releases](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases)

Đây là dự án cá nhân, độc lập nhằm giúp người Việt gặp rào cản tiếng Anh tiếp cận Hermes Agent thuận tiện hơn. Dự án giữ nguyên giấy phép và ghi công dự án Hermes Agent gốc của Nous Research.

## Phạm vi ký

- Chỉ ký các bộ cài và tệp thực thi do quy trình build công khai của kho này tạo ra từ một commit hoặc tag phát hành xác định.
- Mã nguồn, workflow build và cấu hình đóng gói dùng để tạo tệp ký đều nằm trong kho công khai.
- Tên sản phẩm, phiên bản và metadata của tệp phải khớp với bản phát hành tương ứng.
- Không dùng chứng thư của dự án để ký lại tệp nhị phân có sẵn của dự án hoặc nhà cung cấp khác. Các thành phần phụ thuộc bên ngoài giữ chữ ký và danh tính nhà phát hành của chính họ.
- Mỗi yêu cầu ký phải được người phê duyệt kiểm tra và chấp thuận thủ công.

## Vai trò

- Người duy trì và người có quyền ghi mã: [Lê Đình Lực](https://github.com/LucDinhLe)
- Người rà soát thay đổi từ cộng tác viên: [Lê Đình Lực](https://github.com/LucDinhLe)
- Người phê duyệt yêu cầu ký: [Lê Đình Lực](https://github.com/LucDinhLe)

Mọi thay đổi do người không có quyền ghi trực tiếp gửi lên phải được rà soát trước khi nhập. Tài khoản quản trị kho mã nguồn và dịch vụ ký phải bật xác thực đa yếu tố.

## Quyền riêng tư và kết nối mạng

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Dự án không vận hành máy chủ tập trung để thu thập thông tin đăng nhập của người dùng.

Hermes có thể truyền dữ liệu tới hệ thống mạng khi người dùng hoặc người vận hành chủ động cấu hình hay yêu cầu tính năng tương ứng. Các hệ thống đó có thể gồm nhà cung cấp AI, công cụ web và tìm kiếm, trình duyệt, nền tảng nhắn tin, GitHub và nguồn phụ thuộc công khai. Việc xử lý dữ liệu chịu điều khoản và chính sách quyền riêng tư của từng dịch vụ được người dùng chọn. Chi tiết được trình bày trong [miễn trừ trách nhiệm và phạm vi quyền riêng tư](DISCLAIMER.md).

## Thay đổi hệ thống và gỡ cài đặt

Bộ cài có thể tạo tệp ứng dụng, dữ liệu cấu hình người dùng, lối tắt và môi trường chạy cần thiết. Hướng dẫn cài đặt, sao lưu và gỡ cài đặt được công bố trong [README tiếng Việt](README.vi.md). Dự án không chủ động làm suy yếu hoặc vô hiệu hóa cơ chế bảo mật của hệ điều hành.

## Báo cáo vấn đề

Vấn đề bảo mật cần được gửi theo [SECURITY.md](SECURITY.md). Vấn đề về bản dịch, bộ cài hoặc quy trình phát hành có thể được gửi qua [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues).
