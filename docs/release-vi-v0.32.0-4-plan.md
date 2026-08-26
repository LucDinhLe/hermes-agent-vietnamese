# Hermes Vietnamese `vi-v0.32.0-4` — kế hoạch đồng bộ Dự án/phiên

Ngày khóa phạm vi: 2026-08-26

Loại phát hành: community prerelease hotfix, Windows x64 trước
Rollback: `vi-v0.20.4-39`

## Quyết định phạm vi

Candidate này thay thế candidate nội bộ `vi-v0.32.0-3` chưa được công bố. Nó
giữ toàn bộ hợp đồng an toàn phiên của `-3` và bổ sung đúng khoảng trống giao
diện được phát hiện trước promotion:

1. project scope không tồn tại qua lần khởi động tiếp theo;
2. lối về toàn bộ phiên luôn rõ và báo đúng số phiên bên ngoài;
3. tự dò kho mã mặc định tắt;
4. thẻ dự án có nút **Ẩn** và **Xóa**, chỉ đổi metadata dự án;
5. phần sidebar luôn mang tên **Dự án** ở cả tổng quan và khi đã mở dự án;
6. dự án đang mở vẫn là một hàng có nút xổ xuống và hiển thị đầy đủ phiên;
7. tổng quan xem trước tối đa ba phiên nhưng phải báo đúng số phiên còn lại và
   có lối **Hiển thị thêm N phiên**;
8. dữ liệu tiếp tục ở đúng `HERMES_HOME` của máy thật hoặc máy ảo, không cloud;
9. payload cài đúng cây dependency đã xuất từ `uv.lock`, không phân giải lại.

Không nhập các thay đổi v32.1 đang dang dở về prompt, agent, tool routing, token
UX hoặc Skill vào hotfix này.

## Candidate contract

- Tag dự kiến: `vi-v0.32.0-4`.
- Version hiển thị: `0.32.0-vi.4`.
- `vi-v0.32.0-3` và artifact của nó là immutable, không sửa hoặc tái sử dụng.
- Exact commit chỉ được ghi từ HEAD sạch sau final source gate.
- Build từ commit đã push/fetch được; artifact được khóa bằng tên, byte size,
  SHA-256, chữ ký và install stamp trước smoke.

## Gate chặn cài vào hồ sơ thật

- UI/project/i18n, TypeScript, ESLint, Prettier và backend safety đều xanh.
- Tổng quan và entered-project dùng cùng cấu trúc hàng Dự án/xổ xuống; phần xem
  trước báo đúng số phiên còn thiếu và full view hiển thị đủ.
- Ẩn/Xóa dự án giữ phiên đang mở và mọi session id trong project tree.
- Hồ sơ cô lập có phiên cũ được nâng cấp, đóng/mở lại và giữ nguyên số
  phiên/tin nhắn.
- Exact installer phải qua provenance, secret scan, install, relaunch,
  persistence và rollback smoke.
- Installer cài vào hồ sơ thật phải có chữ ký hợp lệ được Windows chấp nhận;
  bản unsigned bị Smart App Control chặn là **NO-GO**, không lách bảo vệ.

## Biên công bố

Build/cài nội bộ không đồng nghĩa phát hành công khai. Tạo tag, upload asset
hoặc đổi GitHub Latest cần quyết định GO riêng sau exact-artifact smoke.
