# Quyết định an toàn phiên cho Hermes v32.1

Ngày chốt: 2026-08-26  
Phạm vi: dự án, hiển thị phiên, lưu trữ phiên và phát hành hotfix

## Mục tiêu

Hermes không được làm người dùng tin rằng phiên đã mất chỉ vì đang ở một phạm
vi giao diện. Mọi tự động hóa có thể làm phiên biến mất khỏi danh sách mặc định
phải tắt mặc định. Thao tác trên Dự án không được quyền thay đổi vòng đời phiên.

Không hệ thống nào có thể hứa tuyệt đối trước hỏng ổ đĩa, người dùng chủ động
xóa hoặc phần mềm ngoài sửa tệp. Hợp đồng ở đây là bảo đảm hành vi của Hermes
và khả năng khôi phục có bằng chứng.

## Các quyết định bắt buộc

### SS-001 — Tách tuyệt đối dữ liệu Dự án và vòng đời phiên

- Dự án nằm trong `projects.db`; phiên và tin nhắn nằm trong `state.db`.
- `projects.create/update/archive/restore/delete` không được ghi vào `state.db`.
- Xóa dự án chỉ xóa cấu trúc dự án. Phiên liên quan trở về toàn bộ phiên/Home.
- Regression phải chụp hàng phiên trước và sau toàn chuỗi vòng đời dự án.

### SS-002 — Scope dự án chỉ tồn tại trong lần chạy hiện tại

- Project scope không lưu vào Local Storage hoặc hồ sơ người dùng.
- Mở lại Hermes luôn bắt đầu tại toàn bộ dự án/phiên.
- Khi đang xem một dự án, lối quay về luôn hiện và báo số phiên nằm ngoài dự án.
- Không dùng độ mờ, nhãn mơ hồ hoặc trạng thái rỗng để ngụ ý lịch sử không còn.

### SS-003 — Tự dò kho mã là opt-in

- `desktop.repo_scan_enabled=false` theo mặc định.
- Chỉ quét khi người dùng chủ động bật trong Cài đặt.
- Kết quả tự dò phải mang nhãn nguồn và có thao tác ẩn.
- Thay đổi chính sách sang tắt phải dọn cache kết quả quét 0 phiên; phiên thật
  phát sinh trong kho vẫn được nhóm từ dữ liệu phiên, không bị xóa.

### SS-004 — Không tự ẩn hoặc tự xóa lịch sử

- `sessions.auto_archive=false` và `sessions.auto_prune=false` theo mặc định.
- Bật một trong hai phải là lựa chọn rõ ràng của người dùng.
- Session delete là thao tác phá hủy riêng, không được gọi từ Dự án.

### SS-005 — Khôi phục trước, sửa sau

- Khi có báo cáo mất phiên, không cài lại, dọn cache hoặc chạy sửa ghi ngay.
- Bảo toàn `state.db`, `state.db-wal`, `state.db-shm`, `projects.db` và log trước.
- Phân loại “bị lọc”, “hidden/archived” và “mất hàng dữ liệu” bằng kiểm tra chỉ
  đọc trước khi chọn cách khôi phục.
- Update/hotfix phải dùng snapshot trước cập nhật và hồ sơ clone để smoke.

### SS-006 — Cổng phát hành chặn promotion

Candidate không được GO nếu thiếu một trong các bằng chứng:

1. tạo/mở dự án trên hồ sơ có phiên cũ;
2. số phiên ngoài dự án hiển thị đúng;
3. restart trở về toàn bộ phiên;
4. vòng đời dự án không đổi `state.db`;
5. update giữ nguyên session count/message count;
6. snapshot và rollback đã thử trên đúng artifact.

## Áp dụng cho v32.1

Các quyết định này là release blocker, không phải việc cải thiện sau phát hành.
Commit sửa phải được nhập vào nhánh v32.1 trước khi đóng băng candidate. Bản
`vi-v0.32.0-1` không bị vá đè; customer fix đi qua candidate mới, staging và
exact-artifact smoke.
