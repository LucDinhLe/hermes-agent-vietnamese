# Kế hoạch candidate `vi-v0.32.1-10`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: source đang được kiểm tra; chưa tag/build/stage/public. GitHub Latest
vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-10`.
- Desktop version: `0.32.1-vi.10`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-9`

`vi-v0.32.1-9` build/stage đúng byte tại run `33058450054`. Lifecycle
`33059934813` vượt exact inputs, fresh install, onboarding, packaged runtime và
relaunch. Nó tạo thành công phiên mới trong project scope và ghi nội dung trước
khi dừng ở nút disclosure **Ẩn phiên**: semantic button visible/enabled nhưng
Playwright click vào trung tâm vùng kéo dài và hàng thời gian chặn pointer.

Candidate `-10` dùng `Enter` trên chính semantic disclosure button cho cả Ẩn và
Hiển thị. Không dùng force click, DOM click hoặc bỏ gate. Policy test cấm quay
lại pointer click cho hai thao tác này.

## Gate bắt buộc

- Node release/lifecycle/workflow/public contracts; ba Desktop typecheck.
- Changed-file ESLint, Prettier, Ruff và `git diff --check`.
- Không có tag/release/run trùng trước tag push.
- Build đúng một lần; khóa exact size/SHA-256, manifest, provenance, receipt.
- Lifecycle cô lập đầy đủ: fresh install, onboarding, project/session safety,
  relaunch, update v32→v32.1, repair, uninstall giữ/xóa dữ liệu, rollback vi39,
  no residual processes.
- Promotion riêng khóa staging run, lifecycle run và controller commit; hậu kiểm
  lỗi tự trả v32.1 về draft và khôi phục `vi-v0.32.0-1` làm Latest.

## Quyết định hiện tại

**Source under verification, Release NO-GO** cho tới khi exact `-10` vượt toàn
bộ lifecycle và hậu kiểm promotion.
