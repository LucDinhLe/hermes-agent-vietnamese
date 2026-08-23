# Kế hoạch phát hành Hermes Vietnamese `vi-v0.31.0-7`

## Quyết định hiện tại

- `vi-v0.31.0-6` là **NO-GO** và phải giữ riêng tư, bất biến.
- Successor dự kiến: `vi-v0.31.0-7`.
- Phiên bản kỹ thuật: `0.31.0-vi.7`.
- Lớp phát hành: community prerelease; không được gắn stable/Latest.
- Audience trước promotion: owner/reviewer được ủy quyền và smoke account.

## Lý do successor

Exact Windows x64 candidate `-6` đã cài đúng per-user và hiện đúng
`0.31.0-vi.6`, nhưng biên nhận registry thật cho thấy electron-builder dùng
khóa NSIS `48ae4bdc-0f8d-5252-af1e-bf7c0a8c3649`. Cleanup `-6` dùng nhầm
`0a5f5eba-85bf-50cc-a4b2-3c1cbe76f61a`, nên không thể xóa đúng mục đăng ký.
Gate dừng trước nút gỡ cuối và hủy thao tác; không có dữ liệu nào bị xóa.

## Thay đổi tối thiểu

1. Dùng đúng khóa NSIS UUID v5 do electron-builder sinh từ
   `build.appId=com.nousresearch.hermes`.
2. Giữ guard `InstallLocation == exact running app path` trước khi xóa hai khóa
   HKCU.
3. Không đọc hoặc xóa HKLM; bản all-users/sibling không thuộc phạm vi.
4. Thêm regression tự tính UUID v5 với namespace electron-builder để khóa quan
   hệ giữa package appId và cleanup identity.
5. Tăng candidate metadata/updater ordering lên `-7`; không sửa tag/draft cũ.

## Source gates bắt buộc

- Targeted Desktop uninstall và app updater tests.
- Toàn bộ Electron release/runtime, plugin và UI suites.
- Toàn bộ Python release suites, đặc biệt GUI uninstall và
  `--skip-packaged-apps`.
- Desktop typecheck, lint, format/diff check.
- Release/evidence/public-contract tests.
- Dependency, lockfile, JSON/YAML và secret-pattern gates.

## Exact-artifact Windows x64 gates

Mỗi lane phải dùng byte tải lại từ private draft, đối chiếu SHA-256 với Actions,
draft asset, `SHA256SUMS.txt` và provenance.

### Keep-data lane

- Trước: app per-user, cả hai khóa HKCU thật, profile/userData mục tiêu và bản
  all-users đối chứng đều có snapshot hash/value.
- Sau: app per-user và cả hai khóa HKCU thật biến mất.
- Profile và Electron userData được giữ nguyên byte-for-byte.
- Bản all-users tree và HKLM registry không đổi; không còn process lane.

### Delete-data lane

- Cài lại exact `-7` per-user và tạo fixture riêng.
- Sau: app, hai khóa HKCU, profile và Electron userData mục tiêu đều biến mất.
- Bản all-users tree/HKLM vẫn không đổi; không còn process lane.

### Repair, upgrade và rollback

- Repair exact candidate không làm mất dữ liệu.
- Upgrade từ `vi-v0.20.4-39` giữ profile/session/project/group/routine/onboarding.
- Rollback target giữ nguyên `vi-v0.20.4-39`; Latest/default giữ nguyên
  `vi-v0.20.0-25`.

## Promotion boundary

- Build workflow chỉ được tạo draft private/prerelease sau khi commit/tag được
  owner cho phép và tag peel đúng commit đã duyệt.
- Không publish/promote nếu chưa có GO riêng sau exact-artifact smoke.
- Signing/notarization còn thiếu thì phải công bố rõ unsigned community
  prerelease; không được gọi stable.

## Bằng chứng nền

- Candidate `-6`: private draft run `32639973804`, Windows x64 SHA-256
  `8ad3c476d1bfa157d86ecf55d5a611381d8ce818db0cb6f2a5c0722aadf0388d`.
- Before receipt: `exact6-keep-before-receipt.json`.
- Registry receipts: `exact6-registry-before-diagnostic-v2.json` và
  `exact6-actual-registry-diagnostic.json`.
- Residual risk: exact `-7` chưa được build/smoke; `-6` không promotable.
