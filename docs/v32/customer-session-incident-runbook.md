# Runbook xử lý khách hàng báo mất hoặc ẩn phiên

## Nguyên tắc đầu tiên

Không yêu cầu khách hàng cài lại Hermes, xóa cache, xóa profile hoặc chạy lệnh
sửa ghi trước khi bảo toàn dữ liệu. Một thao tác “dọn cho sạch” có thể biến lỗi
hiển thị có thể khôi phục thành mất dữ liệu thật.

## Phân loại

- **P1 — Không thấy nhưng dữ liệu còn:** session count/token còn; hàng phiên còn
  trong `state.db`; thường do project/profile scope hoặc archived/hidden.
- **P0 — Mất hàng dữ liệu hoặc DB hỏng:** session/message count giảm thật,
  `integrity_check` lỗi, SQLite báo malformed/not a database, hoặc tệp bị rỗng.
- **P2 — Nhiễu Dự án:** kho git tự dò xuất hiện ngoài ý muốn nhưng phiên không
  thay đổi.

P0 chặn phát hành và cần người phụ trách release. P1 vẫn cần hotfix nếu gây hiểu
nhầm mất dữ liệu cho khách hàng. P2 cần sửa mặc định/nhãn và regression.

## Thu thập an toàn

1. Ghi phiên bản, hệ điều hành, thời điểm và thao tác ngay trước sự cố.
2. Thoát Hermes để SQLite đóng WAL sạch khi có thể.
3. Sao chép nguyên bộ `state.db`, `state.db-wal`, `state.db-shm`, `projects.db`,
   `config.yaml` và log vào thư mục timestamp riêng.
4. Chạy kiểm tra chỉ đọc: integrity, foreign keys, session/message counts và
   phân bố `hidden/archived`.
5. Chỉ làm việc trên bản sao cho tới khi phân loại xong.

Không đưa transcript, token đăng nhập hoặc cấu hình bí mật vào issue công khai.

## Khôi phục theo loại

### P1 — Project/profile scope

- Chọn **Tất cả dự án** hoặc khởi động lại bản đã có SS-002.
- Đối chiếu số phiên ngoài dự án với tổng trong `state.db`.
- Không restore DB vì dữ liệu chưa mất.

### P1 — Hidden/archived ngoài ý muốn

- Xác định chính xác ID và nguồn thao tác đã đổi cờ.
- Khôi phục qua API/CLI chính thức trên bản sao thử trước, không sửa SQL live tùy
  tiện.
- Giữ snapshot trước và sau cùng biên nhận session/message counts.

### P0 — DB hỏng hoặc thiếu hàng

- Ngừng mọi ghi vào profile.
- Dùng snapshot trước update hoặc backup do doctor/repair tạo; xác minh hash và
  integrity trước khi thay live DB.
- Nếu cần SQLite recovery, chạy trên bản sao và so session/message counts trước
  khi bàn giao.
- Không xóa DB hỏng: giữ làm bằng chứng và nguồn phục hồi bổ sung.

## Làm hotfix cho khách hàng

1. Freeze scope; bảo toàn artifact/log/profile clone gây lỗi.
2. Viết regression tái hiện trước khi sửa.
3. Sửa nguyên nhân gốc và cập nhật rulebook/runbook.
4. Push một commit sạch, tạo candidate mới; không vá đè asset public.
5. Build một lần trên native runner và ghi version, commit, size, SHA-256.
6. Update một profile clone có dữ liệu đại diện; kiểm session/message counts,
   restart, gateway và rollback trên đúng byte.
7. Stage riêng. Chỉ owner được promotion sau khi đủ bằng chứng.
8. Gửi khách hàng hướng dẫn ngắn: cách bảo toàn dữ liệu, đường update, giới hạn,
   cách rollback và đầu mối hỗ trợ.

## Biên nhận bắt buộc

- Phiên bản lỗi và phiên bản sửa.
- Hash artifact đã cài.
- Session/message counts trước và sau.
- Kết quả integrity/foreign key.
- Trạng thái `hidden/archived`.
- Ảnh trước/sau, log đã redaction.
- Kết quả update, relaunch và rollback.
