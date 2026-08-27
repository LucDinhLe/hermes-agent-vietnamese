# Kế hoạch candidate `vi-v0.32.1-12`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33066987915` xanh; lifecycle
`33068095243` fail-closed vì pointer click vào **Tất cả dự án** bị hàng dự án
con chặn. Không promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-12`.
- Desktop version: `0.32.1-vi.12`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-11`

`vi-v0.32.1-11` build/stage đúng byte tại run `33064470869`. Lifecycle
`33065542015` vượt điểm khóa database, tạo phiên project-addressable và UI hiển
thị đủ prompt cùng mock reply. Nó dừng vì safety snapshot đọc `state.db` trước
khi mock reply thứ hai flush, nên message count tạm thời là 1 thay vì 2.

Candidate `-12` giữ nguyên yêu cầu tối thiểu hai message nhưng poll database đến
khi cả prompt và reply đã được ghi bền vững rồi mới chụp snapshot. Policy test
khóa persisted-message gate trước snapshot; không dùng sleep mù và không hạ gate.

## Kết quả bất biến

- Exact commit: `477dc6f3f1d73be67482c8fe20a8fb03d797a30b`.
- Installer: 340.633.138 byte; SHA-256
  `91bfc8dc1f398ccf2d205a9c284493a492b1d5d9ef77eb6391e85e76d1923891`.
- Authenticode: `NotSigned`, signer absent.
- Lifecycle evidence: artifact `9645067367`, digest
  `3ac5cf6512ba9f62be15fe299fcdbf6aa8035f8ae2d629b8947120d87e71b407`.
- Fresh install, onboarding, packaged mock runtime và relaunch đều đạt. UI và
  `state.db` xác nhận project-addressable session có đủ prompt/reply trước khi
  thao tác Ẩn/Hiển thị.
- Lifecycle dừng khi pointer click **Tất cả dự án** bị semantic button của hàng
  dự án con chặn. Không có bằng chứng mất, xóa hoặc ẩn dữ liệu. `-12` giữ nguyên,
  không rerun hoặc promotion.

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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-13`.
