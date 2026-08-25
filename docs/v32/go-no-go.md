# Hermes Vietnamese v32 — quyết định phát hành

Ngày khóa hồ sơ: 2026-08-25

## Quyết định

**Technical GO** cho Windows 10/11 x64 dưới dạng community pilot GitHub Latest;
artifact bất biến giữ provenance `community-prerelease` và chưa phải stable.

Candidate đã vượt source gates, exact packaged smoke và toàn bộ vòng đời trên
máy ảo Windows dùng một lần. Private staging giữ đúng installer đã nghiệm thu.
V32 đã thay v31 ở vị trí GitHub Latest sau promotion run `32873014588`.

## Candidate bất biến

| Thuộc tính             | Giá trị                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Tag                    | `vi-v0.32.0-1`                                                     |
| Product version        | `v32.0`                                                            |
| Desktop version        | `0.32.0-vi.1`                                                      |
| Commit trong candidate | `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`                         |
| Platform               | Windows 10/11 x64                                                  |
| Artifact public name   | `Hermes-Vietnamese-Windows-x64-Setup.exe`                          |
| Local build name       | `Hermes-0.32.0-vi.1-win-x64.exe`                                   |
| Size                   | `341176379` byte                                                   |
| SHA-256                | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |
| Authenticode           | `NotSigned`                                                        |
| Release class          | `community-prerelease`                                             |

Tag công khai trỏ trực tiếp tới exact candidate commit. Candidate byte không bị
rebuild hoặc thay sau khi freeze.

## Gate kỹ thuật

- Token Governor tính main/subagent, retry, fallback, hidden task và tool call
  trên mọi đường provider Hermes quản lý; runtime opaque bị chặn trước I/O nếu
  không thể reserve từng attempt.
- Simple fixture có một main response, không tool/background loop; fresh lean
  estimate là 5.169 token, bằng 0,4923% cửa sổ tham chiếu 1,05M.
- Tool result văn bản có trần 9.500 byte; tổng turn 38.000 byte; phần dư spill
  sang artifact có size, SHA-256 và recovery pointer.
- Transcript logic trên 350k đã compact, persist SQLite, relaunch bằng agent mới
  và tiếp tục lượt sau trong canonical group 246/246.
- Quota, context overflow và provider error được phân loại riêng; composer mở
  khóa và recovery state được persist.
- UX-001, UX-002 và UX-003 đạt ở source pointer E2E và exact packaged smoke.
- Desktop: 6.503 pass, 12 skip, 0 fail. Python: 34.863 pass, 368 skip, 0 fail.
  Typecheck đạt; lint 0 error với 169 baseline warning.
- Exact packaged smoke đạt 1/1; installer provenance, version, commit, size và
  SHA-256 khớp.
- Lifecycle run `32865922889` khóa fresh install, empty onboarding, mock runtime,
  safe tool, relaunch/persistence, update v31→v32, repair, uninstall giữ dữ liệu,
  reinstall, uninstall xóa dữ liệu, rollback vi39 và cleanup không còn process.

## Private staging và promotion hoàn tất

- Release ID: `376211316`; tag `vi-v0.32.0-1`; sau promotion có `draft=false`,
  `prerelease=false` và là GitHub Latest.
- Installer asset ID: `528808235`; size/digest khớp exact candidate.
- Manifest SHA-256:
  `1fb94a77e6b2a7da0622fbdc17e6fbb92dbebd37096ed3e24c7965fd177790f4`.
- Promotion preflight đã tải lại 4/4 draft asset và 60/60 lifecycle receipt;
  kết quả `passed` cho release ID `376211316` và run `32865922889`.
- Local private staging và GitHub draft cùng giữ SHA-256
  `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac`.
- Workflow `promote-v32-vietnamese.yml` tải lại draft và lifecycle artifact,
  hash lại mọi receipt, đưa v32 lên Latest, hậu kiểm rồi tự trả v32 về draft và
  khôi phục v31 làm Latest nếu lỗi.
- Promotion run `32873014588`, job `97884293185`, controller commit
  `684ce63912f9177bff1f737dc0a99b88d79fcaf2`: **success**.
- Public URL:
  `https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.0-1`.

## Residual risks và giới hạn công bố

1. Windows x64 chưa ký; SmartScreen có thể hiện `Publisher: Unknown`. Không gọi
   bản này stable/final.
2. Nghiệm thu ghi dữ liệu chạy trong VM/profile cô lập, chưa phải máy người dùng.
3. Không có live provider probe; source/package gates dùng mock provider để
   không tiêu hao quota thật.
4. Windows ARM64, macOS và Linux không được quảng cáo như artifact v32 đã nghiệm
   thu.
5. GitHub không cho release mang cờ prerelease làm `Latest`; vì vậy cờ GitHub
   của v32 được đặt `prerelease=false` để thay v31 lỗi nghiêm trọng. Provenance
   artifact vẫn là `community-prerelease`; không gọi stable/final.

## Rollback

Rollback target đã diễn tập là `vi-v0.20.4-39` tại commit
`d270974d2651e72f169fffe34c955eeae7977458`, installer 340.105.286 byte,
SHA-256 `e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31`.
Profile v32 được đóng và giữ nguyên; vi39 mở bằng profile rollback mới.

## Handoff

```text
Decision: technical GO
Candidate: 81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f, 0.32.0-vi.1, Hermes-Vietnamese-Windows-x64-Setup.exe, 341176379 bytes, efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac
Token Governor: VERIFIED
Context >300k continuity: VERIFIED
Quota/context error classification: VERIFIED
UX-001: VERIFIED
UX-002: VERIFIED
UX-003: VERIFIED
Source tests: VERIFIED
Packaged Windows smoke: VERIFIED
Update/relaunch/repair/uninstall/rollback: VERIFIED
Private staging: VERIFIED (4/4 assets; manifest 1fb94a77e6b2a7da0622fbdc17e6fbb92dbebd37096ed3e24c7965fd177790f4)
Public promotion: completed — https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.0-1
Residual risks: unsigned Windows community pilot; no user-machine/live-provider proof; only Windows x64 is a verified v32 artifact
Rollback target: vi-v0.20.4-39
```
