# Kế hoạch candidate `vi-v0.32.1-16`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-16`.
- Desktop version: `0.32.1-vi.16`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-15`

`vi-v0.32.1-15` build/stage đúng byte tại run `33074177455`. Lifecycle
`33075652568` vượt helper điều hướng Dự án và bước **Tất cả dự án**, rồi dừng vì
pointer click nút **Ẩn khỏi danh sách dự án** bị action container của card chặn.
Evidence artifact `9648140826`, digest
`e366e082be5442eb12b310367fd51217ffee705cfe525274f04386ea6937524f`.

Candidate `-16` kích hoạt bằng `Enter` cho cả **Ẩn khỏi danh sách dự án**, nút
**Xóa** trên card và nút xác nhận **Xóa** trong dialog. Policy khóa ba đường bàn
phím và cấm pointer click ở bước Ẩn; không dùng force/synthetic click, không hạ
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

`vi-v0.32.1-16` được khóa tại commit
`9cf2cdb2c92cbfb907bf771707ed5c8bfee2d6b9`. Build/staging `33077676475` xanh;
installer 340.642.164 byte, SHA-256
`b84e3fe29a07cace57b244036d11a1e2907764e8325b0be2e830928add32568d`,
Authenticode `NotSigned`.

Lifecycle `33079425120` vượt cài mới, onboarding, runtime đóng gói và relaunch.
Sau Ẩn/Xóa metadata dự án, session vẫn hiện trong sidebar và dữ liệu không có
dấu hiệu mất/ẩn. Harness dừng khi click vào `span` tiêu đề phiên bị container
danh sách chặn pointer event. Evidence artifact `9649684608`, digest
`c077cf63287a7163e118b0bd1733990c3dd5c40def393cc37a95c4efb95f2df1`.

**HISTORICAL NO-GO**. `-16` giữ bất biến, không rerun/promotion. Candidate kế
nhiệm là `vi-v0.32.1-17`.
