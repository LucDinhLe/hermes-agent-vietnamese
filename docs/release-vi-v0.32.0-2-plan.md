# Hermes Vietnamese `vi-v0.32.0-2` — kế hoạch hotfix an toàn phiên

Ngày khóa phạm vi: 2026-08-26

Loại phát hành: community prerelease hotfix, Windows x64 trước
Rollback: `vi-v0.20.4-39`

## Quyết định phạm vi

Candidate này chỉ sửa sự cố Dự án làm người dùng tưởng lịch sử phiên đã mất:

1. project scope không tồn tại qua lần khởi động tiếp theo;
2. lối về toàn bộ phiên luôn rõ và báo đúng số phiên bên ngoài;
3. tự dò kho mã mặc định tắt;
4. thẻ dự án có nút **Ẩn** và **Xóa**;
5. Ẩn/Xóa chỉ đổi `projects.db`, giữ phiên đang mở và không ghi vòng đời phiên;
6. dữ liệu tiếp tục ở đúng `HERMES_HOME` của máy thật hoặc máy ảo, không cloud.

Không nhập các thay đổi v32.1 đang dang dở về prompt, agent, tool routing hoặc
Skill vào hotfix này.

## Candidate contract

- Tag dự kiến: `vi-v0.32.0-2`.
- Version hiển thị: `0.32.0-vi.2`.
- Exact commit chỉ được ghi từ HEAD sạch sau final source gate.
- Build đúng một lần từ commit đã push/fetch được; artifact được khóa bằng tên,
  byte size, SHA-256 và install stamp trước smoke.
- Không vá đè tag hoặc asset `vi-v0.32.0-1`.

## Gate chặn cài vào hồ sơ thật

- UI/project/i18n, TypeScript, ESLint, Prettier và backend safety đều xanh.
- Hiding/deleting a project keeps its current session open and every session id
  present in the rebuilt project tree.
- Hồ sơ cô lập có phiên cũ được nâng từ `vi-v0.32.0-1`; mở lại phải vào toàn bộ
  phiên và giữ nguyên session/message count.
- Exact installer phải qua provenance, secret scan, install, relaunch,
  persistence và rollback smoke.
- Hồ sơ thật có snapshot cục bộ đã xác minh trước khi cài.

## Biên công bố

Build/cài nội bộ không đồng nghĩa phát hành công khai. Push lên repository công
khai, tạo tag, upload asset hoặc đổi GitHub Latest cần quyền công bố riêng của
chủ dự án.
