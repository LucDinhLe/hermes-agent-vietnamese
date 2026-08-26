# Sự cố hiển thị phiên sau khi mở Dự án trên Hermes v32

Ngày rà soát: 2026-08-26  
Resident build: `vi-v0.32.0-1` (`0.32.0-vi.1`)  
Phạm vi sửa: source candidate, chưa cài đặt hoặc công bố

## Kết luận

Không có bằng chứng phiên bị xóa, ẩn, lưu trữ hoặc cơ sở dữ liệu bị hỏng. Người
dùng bị giữ trong một phạm vi dự án đã lưu bền, nên sidebar chỉ hiển thị các
phiên thuộc dự án đó. Lối thoát sang toàn bộ phiên tồn tại nhưng có độ mờ quá
thấp và nhãn cũ không giải thích rằng các phiên khác vẫn còn.

Các thẻ dự án 0 phiên/0 token xuất hiện thêm là kho git được cơ chế tự dò phát
hiện trong phạm vi quét mặc định của thư mục người dùng. Chúng được lưu riêng
như kết quả khám phá, không phải dự án người dùng vừa tạo và không tác động đến
bảng phiên.

## Bằng chứng dữ liệu

Audit được thực hiện read-only sau khi tạo bản sao thô của các tệp trạng thái.

- `state.db`: 11 phiên, 752 bản ghi tin nhắn, 31 bản ghi mức dùng model.
- Cả 11 phiên đều `hidden=0` và `archived=0`.
- `projects.db`: 2 dự án người dùng tạo và 3 kho git tự dò.
- `projects.db`, `state.db`, `kanban.db`: `PRAGMA integrity_check = ok`.
- Không có lỗi khóa ngoại, tin nhắn mồ côi, nhật ký xóa phiên hoặc lỗi SQLite
  tương ứng thời điểm xảy ra sự cố.
- Thống kê token còn nguyên vì chúng và lịch sử phiên vẫn còn trong `state.db`;
  dự án được lưu trong `projects.db` riêng.

## Nguyên nhân gốc

1. `hermes.desktop.projectScope` lưu ID dự án đang mở trong Local Storage.
2. Khi scope là một ID cụ thể, sidebar chủ ý lọc chỉ còn phiên của dự án đó.
3. Nút quay về toàn bộ dự án dùng `opacity-40`, nên gần như biến mất trong giao
   diện sáng và bị hiểu nhầm là toàn bộ lịch sử đã mất.
4. Quét kho git mặc định được bật. Khi danh sách root cấu hình rỗng, Desktop
   quét giới hạn thư mục người dùng và đưa kết quả vào trang Dự án mà thiếu nhãn
   phân biệt rõ ràng.

Tạo, cập nhật hoặc xóa một dự án chỉ thay đổi kho dự án. Không có đường gọi xóa
phiên trong luồng tạo dự án; xóa dự án cũng để phiên quay về nhóm gần đây.

## Bản sửa

- Bỏ độ mờ khỏi lối quay về và đổi nhãn thành thông điệp rõ rằng các phiên khác
  vẫn còn, kèm số lượng chính xác nằm ngoài dự án đang mở.
- Chuyển project scope thành trạng thái tạm thời; mở lại Hermes luôn trở về toàn
  bộ dự án/phiên thay vì khôi phục bộ lọc của lần chạy trước.
- Gắn nhãn **Tự động tìm thấy** lên kho do cơ chế quét phát hiện.
- Thêm nút **Ẩn khỏi danh sách dự án** ngay trên thẻ kho tự dò.
- Tắt tự dò kho git theo mặc định; người dùng phải chủ động bật trong Cài đặt.
- Giữ `sessions.auto_prune=false` và `sessions.auto_archive=false` làm mặc định.
- Khóa regression backend: tạo, lưu trữ, khôi phục và xóa dự án không được đổi
  `hidden`/`archived` hoặc xóa phiên trong `state.db`.
- Bổ sung regression khóa khả năng nhìn thấy/click lối thoát và khả năng nhận
  diện/ẩn kho tự dò.

## Xác minh

- 15 tệp kiểm thử UI/dự án/cấu hình/i18n: 206/206 đạt.
- Các ca hồi quy mới cho scope tạm thời, số phiên ngoài dự án và discovery
  opt-in: chạy đỏ trước sửa, xanh sau sửa.
- Desktop TypeScript typecheck: đạt.
- ESLint trên toàn bộ tệp thay đổi: đạt.
- Backend safety slice trên Windows: 27/27 đạt, gồm regression chứng minh vòng
  đời dự án không ẩn, archive hoặc xóa phiên.
- Hồ sơ thật không bị dùng để chạy test và không bị sửa trong quá trình audit.

## Trạng thái phát hành

Source fix được tách từ đúng commit của tag `vi-v0.32.0-1`. Bản public hiện tại
không bị vá đè. Cần tạo candidate mới và chạy exact-artifact smoke bằng hồ sơ
cô lập trước khi cân nhắc cài đặt hoặc promotion.
