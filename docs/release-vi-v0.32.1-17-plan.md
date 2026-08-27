# Kế hoạch candidate `vi-v0.32.1-17`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: source đang được kiểm tra; chưa tag/build/stage/public. GitHub Latest
vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-17`.
- Desktop version: `0.32.1-vi.17`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-16`

`vi-v0.32.1-16` build/stage đúng byte tại run `33077676475`. Installer
340.642.164 byte, SHA-256
`b84e3fe29a07cace57b244036d11a1e2907764e8325b0be2e830928add32568d`.
Lifecycle `33079425120` vượt cài mới, onboarding, runtime đóng gói và relaunch.
Sau Ẩn/Xóa metadata dự án, session vẫn hiển thị; harness dừng vì click vào
`span` tiêu đề bị container danh sách chặn pointer event. Evidence artifact
`9649684608`, digest
`c077cf63287a7163e118b0bd1733990c3dd5c40def393cc37a95c4efb95f2df1`.

Candidate `-17` định vị semantic button của hàng phiên bằng accessible name,
xác minh lại tên truy cập rồi kích hoạt bằng `Enter`. Policy khóa toàn bộ đường
rediscovery này và cấm pointer click; không dùng force/synthetic click, không hạ
gate và không sửa dữ liệu Hermes thật.

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

**Source under verification, Release NO-GO** cho tới khi exact `-17` vượt toàn
bộ lifecycle và hậu kiểm promotion.
