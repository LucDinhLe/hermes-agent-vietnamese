# Hermes Vietnamese v32 — báo cáo kiểm thử cuối

Ngày khóa: 2026-08-25

Candidate: `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`, tag
`vi-v0.32.0-1`, version `0.32.0-vi.1`.

Kết luận: **source, exact packaged Windows x64 và isolated lifecycle đều PASS**.

## Source gates

| Gate                      | Receipt cuối                                            |
| ------------------------- | ------------------------------------------------------- |
| Desktop Vitest            | 671 file pass, 1 skip; 6.503 test pass, 12 skip, 0 fail |
| Canonical Python tree     | 3.082 file; 34.863 pass, 368 skip, 0 fail               |
| Desktop typecheck         | PASS                                                    |
| Desktop lint              | 0 error; 169 repository-baseline warning                |
| Renderer production build | 15.058 module transformed; PASS                         |
| Pointer UX E2E            | 1/1 PASS                                                |
| Release workflow contract | 15/15 PASS sau gate archive/promotion cuối              |
| Diff hygiene              | `git diff --check` PASS                                 |

Python product/test/runner tree của candidate byte-identical với canonical-gated
commit `a606d80a4a6a01e4fe91cd3ed373b2c962a7d6f0`. Các commit sau thay Desktop,
release harness và evidence; mỗi surface thay đổi được chạy lại bằng gate native
tương ứng. Chi tiết recovery nằm ở
`docs/v32/evidence/focused-tile-submit-recovery-2026-08-25.md`.

## Token Governor, Lean Session và raw output

| Nghiệm thu                                                | Kết quả  |
| --------------------------------------------------------- | -------- |
| Model warning 6; pause trước attempt 13                   | VERIFIED |
| Tool warning 8; pause trước dispatch 21                   | VERIFIED |
| Root governor dùng chung cho main/subagent                | VERIFIED |
| Retry/fallback và hidden tasks tăng physical attempt      | VERIFIED |
| Opaque runtime không telemetry bị chặn trước provider I/O | VERIFIED |
| Tool result text ≤9.500 byte; aggregate turn ≤38.000 byte | VERIFIED |
| Spill artifact có byte size, SHA-256, recovery pointer    | VERIFIED |
| Incremental persistence và snapshot TUI/Desktop/API       | VERIFIED |
| Fresh simple fixture: 1 main, 0 tool, 0 background        | VERIFIED |

Offline benchmark là deterministic static estimate, không phải billing/provider
usage. Fresh lean giảm từ 34.299 xuống 5.169 token, tương đương từ 3,2666% xuống
0,4923% cửa sổ tham chiếu 1,05M. 59 schema được cấp nhưng chỉ 4 schema active;
active schema bytes giảm từ 117.260 xuống 4.265.

Evidence: `docs/v32/benchmarks/offline-benchmark-2026-08-24.md` và JSON cùng tên.

## Context, compaction và classifier

| Nghiệm thu                                             | Kết quả      |
| ------------------------------------------------------ | ------------ |
| Metadata 272k/372k/900k/1,05M tách published/effective | VERIFIED     |
| Native planning 190k; local fallback khoảng 208k       | VERIFIED     |
| Context overflow compact rồi retry đúng một lần        | VERIFIED     |
| Quota/rate limit không compact hoặc đổi provider mù    | VERIFIED     |
| Provider error mở khóa composer và persist recovery    | VERIFIED     |
| Transcript logic >350k giữ anchors qua SQLite/relaunch | 246/246 PASS |
| Agent mới tiếp tục lượt sau compaction                 | VERIFIED     |
| Bedrock live probe tắt mặc định                        | VERIFIED     |

Canonical continuity group dùng mock/offline, không tiêu hao provider quota.

## Desktop UX

| Gate                                                      | Source pointer E2E | Exact packaged smoke |
| --------------------------------------------------------- | ------------------ | -------------------- |
| UX-001: `+` bằng physical pointer/click, đúng một session | PASS               | PASS                 |
| UX-002: Messaging Back giữ exact tile và unsent draft     | PASS               | PASS                 |
| UX-003: context/quota/turn/API-equivalent tách rõ         | PASS               | PASS                 |
| Relaunch cùng profile giữ transcript/draft                | PASS               | PASS                 |
| `/compress` xong và nhận lượt tiếp theo                   | PASS               | PASS                 |

Exact packaged smoke: 1/1 PASS trong 55,2 giây. Mock inference, `HERMES_HOME`
và Electron user data đều là disposable; host credential bị strip.

## Candidate và Windows lifecycle

| Thuộc tính         | Giá trị                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Installer          | `Hermes-Vietnamese-Windows-x64-Setup.exe`                          |
| Size               | `341176379` byte                                                   |
| SHA-256            | `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac` |
| Authenticode       | `NotSigned`                                                        |
| Lifecycle workflow | `32865922889`                                                      |
| Harness commit     | `08bee81cfa5f55bfc36069b5c9733d9a0d59c8e0`                         |
| Isolation          | GitHub-hosted ephemeral Windows VM; product outbound firewall      |

Required lifecycle gates: 19/19 PASS.

- Exact three installer inputs verified by SHA-256.
- Fresh install and genuine empty onboarding.
- Installed resident mock runtime, safe `todo` tool, relaunch and persistence.
- Physical packaged UX and compaction.
- Full-NSIS in-place update `vi-v0.31.0-7` → `vi-v0.32.0-1`.
- Repair of deliberately quarantined `resources/app.asar`, restored exact bytes.
- Settings > About uninstall giữ dữ liệu; reinstall and recovery verified.
- Settings > About uninstall xóa dữ liệu.
- v32 reinstall then rollback to `vi-v0.20.4-39` on fresh rollback profile.
- Final cleanup: no process, product registry or app residue.

The archive regression requires `include-hidden-files: true`; promotion then
recomputes every receipt manifest entry so an artifact missing Playwright
`.last-run.json` cannot pass.

## Live-provider boundary

No live Codex, Claude, Copilot, Bedrock, Vertex or xAI probe was used. This is
intentional: the release contract requires a separate owner approval for calls
that can consume meaningful quota. Technical GO rests on deterministic source
tests, mock provider integration and exact installed-artifact evidence.

## Kết luận

- Source gate: **PASS**.
- Exact packaged Windows x64: **PASS**.
- Fresh/update/relaunch/persistence/repair/uninstall/rollback: **PASS**.
- Release surface/private staging: **PASS**.
- Public promotion/Latest hậu kiểm: **PASS**, run `32873014588`.
