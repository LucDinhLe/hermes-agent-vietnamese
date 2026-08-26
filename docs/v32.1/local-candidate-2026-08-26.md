# Hermes Vietnamese v32.1 — local candidate evidence

Ngày ghi: 2026-08-26

## Quyết định

**Packaged build GO / lifecycle NO-GO.** Ứng viên local Windows x64 đã được
dựng từ clean HEAD và vượt exact embedded-provenance gate. Không cài ứng viên,
không chạy trên profile Hermes thật, không stage/push/merge/public. Vòng đời
fresh install/update/repair/uninstall/rollback chưa được ghi nhận là đạt vì host
không có Windows Sandbox.

## Candidate local

| Thuộc tính      | Giá trị                                                            |
| --------------- | ------------------------------------------------------------------ |
| Tag local       | `vi-v0.32.1-1`                                                     |
| Product version | `v32.1`                                                            |
| Desktop version | `0.32.1-vi.1`                                                      |
| Commit          | `5dd1b3dfae33696dc98d323b9def5148a4482b1d`                         |
| Release class   | `community-prerelease`                                             |
| Local artifact  | `Hermes-0.32.1-vi.1-win-x64.exe`                                   |
| Size            | `341260235` byte                                                   |
| SHA-256         | `2edb6072e8682e147ebee57d2c268631c3aa7a2d94479aaa53ec4052fbd03fe9` |
| Authenticode    | `NotSigned`                                                        |
| Update feed     | `false`                                                            |

Artifact được giữ trong worktree cô lập
`projects/hermes-v32-candidate-5dd1b3dfa/apps/desktop/release/`. Đây không phải
tài sản public và không đủ điều kiện staging hoặc promotion khi lifecycle chưa
đạt.

## Regression và build gate

- Version/release policy checkpoint: `b8b0a5c49720c833377354f570b15febba73b610`.
- Build đầu tiên đỏ tại `uv pip --require-hashes`: resolver kiểm tra lại bare
  transitive requirement `cryptography`. Regression được thêm trước; checkpoint
  `2baa74931f24a0df9c579f10d02300186b287978` dùng closure đầy đủ đã export và
  không resolve dependency lần hai.
- Build thứ hai đỏ vì `uv pip` vẫn đọc `[tool.uv]` override và thay pin/hash
  `cryptography==50.0.0` bằng `50.0.1`. Regression được thêm trước; checkpoint
  `5dd1b3dfae33696dc98d323b9def5148a4482b1d` cô lập install khỏi project config.
- Payload thật sau sửa cài 64 package, gồm đúng `cryptography==50.0.0`; không
  hạ hash gate và không dùng sdist ngoài allowlist theo target.
- Targeted payload tests: 63/63 đạt. Release/purge/provenance policy: 22/22 đạt.
- Build chạy với host Node `v26.7.0`, npm `11.19.0`, `npm ci` và clean HEAD.
- Resident Node trong artifact là `v26.5.1`, SHA-256
  `b48b0224081224cda1f49374e2fc63d143041ade51754f0cc6608fe8510ba29e`.
- Exact NSIS extraction gate xác minh tag, commit, release class, app PE x64,
  resident Node PE x64, schema-2 manifest và update feed bị tắt.
- Sau build, worktree ứng viên vẫn sạch. Repo chính chỉ còn `.tmp/` chưa theo
  dõi như trước; thư mục này không bị đọc để làm input, sửa hoặc xóa.

## Gate còn thiếu

- `C:\Windows\System32\WindowsSandbox.exe` không tồn tại trên host này. Theo
  release rulebook, không được thay bằng cài trực tiếp lên workstation.
- Lifecycle policy đã được nâng test-first để ghim candidate v32.1, exact v32
  public làm nguồn update và gate `v32ToV321Update`; toàn bộ harness test đạt
  22/22. Byte v32 local khớp 341.176.379 byte và SHA-256 public
  `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac`.
- Guest run còn cần exact rollback installer `vi-v0.20.4-39`; không tự tải hoặc
  chạy khi host hiện tại không thể cung cấp isolation boundary.
- Khi có guest phù hợp mới chạy exact packaged fresh install, onboarding offline, mock
  runtime, relaunch/persistence, update, repair, hai chế độ uninstall, rollback
  và no-residual-process trên Windows Sandbox hoặc GitHub-hosted ephemeral VM.

## Handoff

```text
Decision: packaged build GO / lifecycle NO-GO
Candidate: 5dd1b3dfae33696dc98d323b9def5148a4482b1d, 0.32.1-vi.1, Hermes-0.32.1-vi.1-win-x64.exe, 341260235 bytes, 2edb6072e8682e147ebee57d2c268631c3aa7a2d94479aaa53ec4052fbd03fe9
Exact embedded provenance: VERIFIED
Source/targeted release tests: VERIFIED (63/63 + 22/22)
Packaged lifecycle: MISSING — Windows Sandbox unavailable
Profile/live provider: not used
Public actions taken: none
Next smallest step: retrieve the pinned rollback byte and run the prepared v32 → v32.1 harness only on an approved ephemeral Windows guest
```
