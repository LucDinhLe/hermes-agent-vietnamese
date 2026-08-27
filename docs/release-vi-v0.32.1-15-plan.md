# Kế hoạch candidate `vi-v0.32.1-15`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33074177455` xanh; lifecycle
`33075652568` fail-closed vì pointer click nút **Ẩn khỏi danh sách dự án** bị
vùng hành động thẻ chặn. Không promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate

- Tag: `vi-v0.32.1-15`.
- Desktop version: `0.32.1-vi.15`.
- Release class: `community-prerelease`.
- Authenticode: phải ghi `NotSigned`, signer absent.
- Chỉ build Windows x64; không quảng cáo stable/final.

## Lý do thay candidate `-14`

`vi-v0.32.1-14` build/stage đúng byte tại run `33071025403`. Lifecycle
`33072409835` vượt các gate trước và trở về **Tất cả dự án**, UI hiển thị đủ
hai dự án cùng session có nội dung. Helper mở trang Dự án sau đó dùng accessible
name chung và khớp cả nút điều hướng lẫn nhãn section, nên strict mode dừng.
Evidence artifact `9646753190`, digest
`e4b13a277d2176bafb5b2eb6ab2f0cc67f0fc17bd8dcf453fa865a7ca5ef2e5d`.

Candidate `-15` khóa helper vào semantic button có
`data-sidebar="menu-button"`, xác minh accessible name rồi kích hoạt bằng
`Enter`. Policy cấm pointer click. Workflow promotion cũng khóa exact tag `-15`
ở cả hai pha kiểm trước/sau publication; contract test bắt buộc hai điểm này.

## Kết quả bất biến

- Exact commit: `22cbcc6c9a8dc20984b3e9bf59d16d944fb9d5e4`.
- Installer: 340.639.925 byte; SHA-256
  `fd33557ba32f92455ce11eeb8082be9c1788ca2564621be09ecaadb804d41a54`.
- SHA256SUMS.txt digest:
  `ee2a0c9a7d6cfac48db1eed8499646d957cc3be4e113ef0294fcf9bcba3c77cb`.
- Authenticode: `NotSigned`, signer absent; signing receipt digest
  `e22d797e2c7528bb8b9a53aa1abeca9bc4ee67bac06286a995ce8a32e67b281f`.
- Lifecycle evidence: artifact `9648140826`, digest
  `e366e082be5442eb12b310367fd51217ffee705cfe525274f04386ea6937524f`.
- Helper điều hướng Dự án và bước **Tất cả dự án** đều đạt. Lifecycle dừng khi
  pointer click nút **Ẩn khỏi danh sách dự án** bị action container của chính
  card chặn. Không có bằng chứng mất, xóa hoặc ẩn session/message.
- `-15` giữ nguyên, không rerun hoặc promotion.

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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-16`.
