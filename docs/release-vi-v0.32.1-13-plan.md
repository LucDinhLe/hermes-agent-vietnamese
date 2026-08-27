# Kế hoạch candidate `vi-v0.32.1-13`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO trước build**. Tag đã push nhưng pre-dispatch
phát hiện workflow Windows x64/lifecycle còn khóa tag `-12`. Không có run,
installer, draft hoặc promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-13`.
- Desktop version: `0.32.1-vi.13`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-12`

`vi-v0.32.1-12` build/stage đúng byte tại run `33066987915`. Lifecycle
`33068095243` xác nhận project-addressable session có đủ prompt/reply trong UI
và database, rồi dừng vì pointer click vào **Tất cả dự án** bị hàng dự án con
chặn. Evidence artifact `9645067367`, digest
`3ac5cf6512ba9f62be15fe299fcdbf6aa8035f8ae2d629b8947120d87e71b407`.

Candidate `-13` kích hoạt đúng semantic button **Tất cả dự án** bằng `Enter`.
Policy test cấm quay lại pointer click tại bước này; không dùng force/synthetic
click, không hạ gate và không sửa dữ liệu Hermes thật.

## Kết quả bất biến

- Exact commit/tag: `d0ec7ea78b1af756b00fb0f50ac8afad83415504` /
  `vi-v0.32.1-13`.
- Pre-dispatch kiểm tra remote xác nhận tag đúng commit và không có release/run
  trùng.
- Workflow build chỉ thu hẹp Windows x64 khi tag bằng `vi-v0.32.1-12`; workflow
  lifecycle cũng chỉ chuyển sang lane v32.1 tại tag `-12`. Dispatch `-13` sẽ mở
  sai ma trận sáu nền tảng và bỏ lane lifecycle bắt buộc, nên bị dừng trước build.
- Không có installer, draft, lifecycle receipt hoặc thay đổi người dùng. `-13`
  giữ bất biến, không retag, không build và không promotion.

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

**HISTORICAL NO-GO trước build**. Candidate kế nhiệm là `vi-v0.32.1-14`.
