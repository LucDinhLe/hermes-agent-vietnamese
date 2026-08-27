# Kế hoạch candidate `vi-v0.32.1-11`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33064470869` xanh; lifecycle
`33065542015` fail-closed vì harness đọc message count trước khi mock reply flush
xuống database. Không promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-11`.
- Desktop version: `0.32.1-vi.11`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-10`

`vi-v0.32.1-10` build/stage đúng byte tại run `33061824984`. Lifecycle
`33063041821` vượt exact inputs, fresh install, onboarding, packaged runtime và
relaunch nhưng dừng trước project fixture với `database is locked`. Harness đã
launch Hermes trước rồi mới ghi `projects.db`, trùng lúc project store khởi tạo.

Candidate `-11` seed fixture trong profile cô lập trước khi Hermes mở database.
Policy test khóa thứ tự seed-before-launch; không dùng retry che lỗi, không bỏ
gate và không sửa dữ liệu Hermes thật.

## Kết quả bất biến

- Exact commit: `92e6810b01b0973b835dbeb2b150e82b01ce146b`.
- Installer: 340.630.734 byte; SHA-256
  `7e98e7254b9596c6e21d64973cdc3a76d27aca42c56dcfea92eccf28fc7cc416`.
- Authenticode: `NotSigned`, signer absent.
- Lifecycle evidence: artifact `9643842344`, digest
  `c321ce027d2f0dc625890891d982f89a9332d97777ad754d799a4a0b2c039266`.
- Fresh install, onboarding, packaged mock runtime và relaunch đều đạt.
- Project/session safety tạo phiên đúng project và UI hiển thị đủ prompt/reply,
  nhưng safety snapshot đọc trước khi reply thứ hai flush xuống `state.db`, nên
  message count tạm thời là 1. Không có bằng chứng mất dữ liệu. `-11` giữ nguyên,
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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-12`.
