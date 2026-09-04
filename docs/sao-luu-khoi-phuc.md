# Sao lưu và khôi phục Hermes Vietnamese

Hướng dẫn cho Latest 2026.9.2 Windows x64. Cài đè giữ dữ liệu theo thiết kế, nhưng vẫn cần bản sao trước khi nâng cấp dữ liệu thật. Không coi việc bấm nút sao lưu là đã có bản sao dùng được.

## Tạo bản sao lưu trong Hermes

1. Mở **Trung tâm chỉ huy → Bảo trì**, chọn **Tạo bản sao lưu** nếu mục này khả dụng.
2. Chờ tác vụ kết thúc thành công và đọc nhật ký kết quả để tìm đường dẫn tệp ZIP.
3. Mở đường dẫn đó trong File Explorer, kiểm tra tệp tồn tại và đọc được. Nếu không có đường dẫn hoặc tác vụ lỗi, dùng cách sao lưu thủ công bên dưới.
4. Sao chép ZIP sang nơi an toàn. Bản sao có thể chứa cấu hình, lịch sử, kỹ năng và thông tin xác thực; không gửi lên Issues công khai.

Bản 2026.9.2 có tác vụ tạo sao lưu và nhật ký trong Bảo trì. Không mặc định có nút **Mở vị trí bản sao lưu** hoặc **Khôi phục từ bản sao lưu** như một số tài liệu của dòng cũ từng mô tả. ZIP hồ sơ cũng không thay thế bản sao đầy đủ dữ liệu giao diện Desktop.

## Sao lưu thủ công trên Windows

1. Chờ công việc kết thúc, đóng Hermes và tạm dừng gateway/bot theo cách đang vận hành. Đóng cửa sổ không bảo đảm gateway nền đã dừng.
2. Mở File Explorer, sao chép nguyên thư mục `%LOCALAPPDATA%\hermes` và `%APPDATA%\Hermes` sang một thư mục sao lưu mới có ngày giờ. Nếu dùng hồ sơ hoặc `HERMES_HOME` riêng, sao lưu cả đường dẫn riêng đó.
3. Dùng **Sao chép**, không di chuyển hoặc xóa thư mục gốc. Giữ các tệp ẩn, database và tệp đi kèm; không chỉ chép một `state.db` khi ứng dụng đang ghi dữ liệu.
4. Kiểm tra số tệp/kích thước và mở thử bản sao ở nơi an toàn. Với dữ liệu quan trọng, thử khôi phục trong hồ sơ cô lập trước khi dựa vào bản sao để quay lui.
5. Giữ bộ cài cũ và bản sao riêng tư. Không tải lên Issues vì có thể chứa thông tin xác thực hoặc hội thoại.

## Khôi phục

Bản sao thư mục thủ công khác ZIP do tác vụ sao lưu tạo ra. Không mặc định nhập hai loại này bằng cùng một cách.

- **Bản sao thư mục:** đóng mọi tiến trình Hermes/gateway liên quan, sao lưu thêm dữ liệu hiện tại vào nơi khác, rồi khôi phục về đúng đường dẫn/hồ sơ đã sao chép. Không trộn database của hai thời điểm hoặc hai người dùng.
- **ZIP do Hermes tạo:** lõi có lệnh `hermes import`. Chỉ dùng khi bạn xác định đúng runtime/hồ sơ và đã đọc trợ giúp của phiên bản đó; không giải nén đè tùy tiện lên dữ liệu đang sử dụng. Nếu không quen dòng lệnh, nhờ hỗ trợ riêng với thông tin đã che bí mật.
- Sau khôi phục, mở lại và kiểm tra lịch sử, model, kỹ năng và quyền. Một số dịch vụ có thể yêu cầu đăng nhập lại.
- Không khôi phục đè nếu chưa giữ lại dữ liệu mới hơn. Không coi mã băm/tệp ZIP tồn tại là thay thế cho thử phục hồi.

## Cập nhật và gỡ cài đặt

Cập nhật 2026.9.2 dùng bộ cài đầy đủ từ [Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest), chưa có tự cập nhật nền.

- Cài đè giữ dữ liệu theo thiết kế và đã qua kiểm thử trên hồ sơ cô lập.
- Trình gỡ Windows hoặc lựa chọn **giữ dữ liệu** không chủ động xóa lịch sử.
- **Gỡ toàn bộ** trong Hermes xóa cả dữ liệu đã chọn. Đây không phải cách nâng cấp.
- Bản quay lui Windows x64 là [vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18). Giữ bản sao và bộ cài đã xác minh trước khi quay lui.

Không có thao tác trên dữ liệu thật nào được thực hiện chỉ vì bạn đọc hoặc mở hướng dẫn này.
