# Kế hoạch candidate `vi-v0.32.1-10`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33061824984` xanh; lifecycle
`33063041821` fail-closed vì harness ghi fixture sau khi app đã mở database.
Không promotion; GitHub Latest vẫn là `vi-v0.32.0-1`.

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

## Kết quả bất biến

- Exact commit: `b36d994072eb26bf75f5723aa2a08e50970dfa8f`.
- Installer: 340.628.197 byte; SHA-256
  `9dd1077699f64702b387de405c5cc097b0a7c9f9b1d0b7645c7d4eff24d6e14f`.
- Authenticode: `NotSigned`, signer absent.
- Lifecycle evidence: artifact `9642809205`, digest
  `4b54db37d614023d32630edb16be79563450bc38483cc41ad31182fce3817bf5`.
- Fresh install, onboarding, packaged mock runtime và relaunch đều đạt.
- Project/session safety dừng trước fixture với `database is locked`: harness
  đã mở Hermes trước khi ghi `projects.db`. Không có thao tác xóa/ẩn hay bằng
  chứng mất dữ liệu. `-10` giữ nguyên, không rerun hoặc promotion.

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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-11`.
