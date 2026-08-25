# Hermes Vietnamese v32 — release notes staging

Trạng thái: **nội dung public đã khóa, release vẫn là private draft**.

Nguồn body chuẩn để promotion đối chiếu byte-for-byte:
`.github/release-notes-vietnamese.md`.

## Candidate

| Thuộc tính       | Giá trị                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Tag              | `vi-v0.32.0-1`                                                     |
| Version          | `0.32.0-vi.1`                                                      |
| Commit           | `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`                         |
| Release class    | `community-prerelease`                                             |
| Windows x64 file | `Hermes-Vietnamese-Windows-x64-Setup.exe`                          |
| Size             | `341176379` byte                                                   |
| SHA-256          | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |
| Authenticode     | `NotSigned`                                                        |
| Rollback         | `vi-v0.20.4-39`                                                    |
| Staging manifest | `1fb94a77e6b2a7da0622fbdc17e6fbb92dbebd37096ed3e24c7965fd177790f4` |

## Evidence khóa

- Source: Desktop 6.503 pass; Python 34.863 pass; typecheck/lint đạt.
- Fresh lean: 5.169 estimated token, 0,4923% của 1,05M.
- Logical continuity: trên 350k, canonical 246/246.
- Exact packaged Windows smoke: 1/1.
- Hosted Windows lifecycle: run `32865922889`, 19/19 gate.
- Private draft: release ID `376211316`; exact installer asset ID `528808235`.
- Promotion preflight: PASS trên 4/4 asset và 60/60 lifecycle receipt.

## Boundary công bố

- Chỉ Windows x64 được quảng cáo cho v32.
- Chưa có smoke máy người dùng hoặc live provider proof.
- SignPath chưa cung cấp credential ký; dự án chưa tham gia Apple Developer
  Program.
- Public community prerelease và merge `main` chờ owner approval.
- GitHub Latest vẫn là v31 vì GitHub không cho prerelease mang nhãn Latest.
