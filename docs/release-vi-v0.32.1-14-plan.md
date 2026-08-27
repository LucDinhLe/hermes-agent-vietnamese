# Kế hoạch candidate `vi-v0.32.1-14`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33071025403` xanh; lifecycle
`33072409835` fail-closed vì helper mở trang Dự án khớp hai nút cùng tên.
Không promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-14`.
- Desktop version: `0.32.1-vi.14`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-13`

Tag `vi-v0.32.1-13` đã được push tại commit
`d0ec7ea78b1af756b00fb0f50ac8afad83415504`, nhưng pre-dispatch phát hiện
workflow build và lifecycle còn khóa lane v32.1 theo tag `-12`. Dispatch sẽ mở
sai ma trận sáu nền tảng và không chạy exact v32.1 lifecycle, nên dừng trước khi
tạo run, installer hoặc draft.

Candidate `-14` khóa cùng một tag trong workflow build Windows x64, hai lane
legacy bị loại và lane lifecycle v32.1. Contract test xác minh bốn điểm dùng cùng
exact tag; không hạ gate và không sửa dữ liệu Hermes thật.

## Kết quả bất biến

- Exact commit: `50c0523ff3370c811d6934dc1def1ada5e2ea1d7`.
- Installer: 340.636.957 byte; SHA-256
  `16dfd43d512a6d79744f482306f2596d9183240d9b6f78e9d25a09c0b855d345`.
- SHA256SUMS.txt digest:
  `e9e83eeda41995cb2c216327dc6f5a79dc703b6f6df72095eff79b3257dac38e`.
- Authenticode: `NotSigned`, signer absent; signing receipt digest
  `fc15561902d711e17c3603b41b577516859baad21031cbbbc2ea05af1f8a47c4`.
- Lifecycle evidence: artifact `9646753190`, digest
  `e4b13a277d2176bafb5b2eb6ab2f0cc67f0fc17bd8dcf453fa865a7ca5ef2e5d`.
- Fresh install, onboarding, packaged runtime/relaunch và project session đều
  đạt đến sau bước **Tất cả dự án**. UI hiển thị đủ hai dự án và session có nội
  dung. Helper tiếp theo khớp cả nút điều hướng Dự án lẫn nhãn section Dự án nên
  Playwright strict mode dừng. Không có bằng chứng mất hoặc ẩn dữ liệu.
- `-14` giữ nguyên, không rerun hoặc promotion.

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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-15`.
