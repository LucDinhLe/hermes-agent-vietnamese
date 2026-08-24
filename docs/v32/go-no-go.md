# Hermes Vietnamese v32 — GO/NO-GO, giới hạn và rollback

Ngày đánh giá: 2026-08-24

Implementation tip được quan sát: `596d188b2c19ef5ef8f67b87bff7b1c5fa7c8c5e`

## Quyết định

**NO-GO cho staging, community pilot và phát hành công khai.**

V32 hiện là **candidate-only ở mức mã nguồn cục bộ**. Các checkpoint triển khai
và test mục tiêu cho thấy hướng sửa đúng, nhưng release contract còn thiếu
candidate bất biến, final source gate, artifact manifest, exact packaged smoke,
signing disclosure, máy thật theo target, rollback proof và phê duyệt của chủ
dự án.

Đối tượng được phép dùng lúc này: kỹ thuật viên làm việc trong worktree/profile
cô lập bằng mock provider. Người dùng thật, lớp học, cộng đồng và mọi luồng tự
cập nhật chưa nằm trong phạm vi cho phép.

## Candidate

| Thuộc tính | Giá trị hiện tại |
| --- | --- |
| Baseline v32 | `3cce675cea2bfdfd2fd29352f35a529e827cf46f` |
| Implementation tip trước docs | `596d188b2c19ef5ef8f67b87bff7b1c5fa7c8c5e` |
| Exact candidate commit | `[PARENT: điền sau freeze]` |
| Version | `[PARENT: dự kiến 0.32.0-vi.1]` |
| Tag | `[PARENT: chưa tạo]` |
| Artifact | `[PARENT: chưa build]` |
| Platform/architecture | `[PARENT: điền]` |
| Byte size | `[PARENT: điền]` |
| SHA-256 | `[PARENT: điền]` |
| Provenance/manifest | `[PARENT: điền]` |
| Public actions | `Không có` |

## Gate đã có bằng chứng một phần

- Phạm vi và ba decision log đã được khóa trong repo.
- Governor 6/12 model và 8/20 tool đã có test thuần cùng integration mục tiêu.
- Raw tool output dạng văn bản có trần 9.500 byte, aggregate turn 38.000 byte,
  artifact SHA-256 và recovery pointer.
- Context classifier, native/local compaction planning và persisted recovery
  state đã có regression mục tiêu.
- Lean Session đóng băng tool schemas trước call đầu và có full-profile escape.
- Messaging back, tab `+` và context/turn meter đã có unit và pointer E2E ở
  checkpoint source.
- Các đường provider Hermes quản lý trực tiếp đã được mở rộng reservation qua
  retry, fallback, hidden compaction, Bedrock probe tier và xAI POST.
- Benchmark offline sơ bộ đạt mục tiêu fresh dưới 1% theo static estimate.

Chi tiết và trạng thái cần chạy lại nằm tại `docs/v32/test-report.md`. Những
dòng trên chưa đủ thay thế final candidate receipts.

## Blocker bắt buộc

### 1. Candidate chưa bất biến và chưa thể truy xuất độc lập

Nhánh hiện đi trước `origin/main`, implementation tip còn local-only tại thời
điểm lập hồ sơ. Worktree có benchmark files đang chờ commit. Release rulebook
cấm build candidate để staging từ commit bẩn, local-only hoặc chưa fetch được.

### 2. Governor chưa phủ được physical attempts bên trong runtime opaque

Codex app-server, Claude Code và Copilot ACP chạy trong subprocess hoặc protocol
agentic riêng. Hermes reserve được request ở biên gọi runtime, nhưng không nhận
telemetry cho từng provider request, retry và tool call nội bộ. Meter có thể
đếm thiếu; hard pause 12/20 chưa thể chặn trước I/O ở bên trong ba tiến trình.

Giới hạn này chặn mọi tuyên bố “đếm toàn bộ physical attempts”. Cần một trong
hai hướng trước phát hành rộng:

1. protocol cung cấp per-request telemetry/reservation hook; hoặc
2. chính sách fail-closed rõ ràng giới hạn/tắt các tuyến opaque trong phạm vi
   release, có migration và UX được duyệt.

Không được âm thầm đổi model hay runtime của người dùng để né blocker.

### 3. Final source matrix chưa khóa

- Chưa có receipt hợp nhất trên exact candidate commit.
- API server test từng collect fail vì thiếu `aiohttp`.
- Một số streaming paths thiếu optional package `anthropic` trong môi trường
  hiện tại.
- Symlink-security baseline cần host có quyền phù hợp.
- Benchmark harness, JSON và Markdown cần commit cùng canonical regression và
  digest evidence.

### 4. Chưa có artifact hoặc packaged smoke

Chưa có versioned artifact, size, SHA-256, manifest, secret scan, isolated
Windows x64 install, gateway/onboarding, safe-tool mock, persistence, ba UX v32,
synthetic compaction, update v31, repair, hai chế độ uninstall hoặc rollback.

### 5. Release-surface blockers từ kế hoạch chưa đóng

- Payload/feed còn cần chứng minh fail closed khỏi hard-coded `channel=stable`
  cho v32 chưa ký.
- Node floor giữa workflow/POSIX và Windows installer đang lệch 26 so với 22.
- macOS electron-builder patch có đường skip rồi exit 0; cần gate xác minh patch
  thực sự áp dụng.
- POSIX updater có rủi ro xóa venv trước khi replacement sẵn sàng; chưa có
  rollback proof.
- Windows ARM64 có thể thiếu `read_window_below` khi `get-windows` fail-soft;
  cần binary/architecture gate và disclosure.

### 6. Signing, máy thật và quyền công bố

- Chưa có Authenticode Windows.
- Chưa có Developer ID, notarization và stapling macOS.
- Chưa có runtime smoke cho sáu target được quảng cáo.
- Chưa có owner GO cho tag, push, draft, staging hoặc publication.

## Giới hạn đã biết

1. Static benchmark dùng rough estimator. Nó không đại diện tokenizer-exact
   usage, quota hoặc hóa đơn provider.
2. Live provider behavior chưa được kiểm chứng trong lượt này.
3. Governor có thể undercount trên Codex app-server, Claude Code và Copilot ACP
   do thiếu visibility bên trong subprocess.
4. Codex app-server sở hữu thread context riêng. Hermes có thể trigger outer
   compaction RPC, còn quyết định và provider work nội bộ vẫn opaque.
5. Raw-output trần 9.500 byte áp dụng cho tool result dạng văn bản. Structured
   vision content đi qua adapter/DB summary path riêng.
6. Bedrock live context probe bị tắt mặc định vì một tier thành công có thể xử
   lý khoảng 1,3 triệu input token. Chưa có live proof được duyệt.
7. Chưa có bằng chứng update/rollback rằng state mới của v32 an toàn khi mở lại
   bằng bản cũ.
8. Bản unsigned tối đa chỉ có thể là community prerelease/pilot sau khi các cổng
   còn lại đạt. Nó không đủ điều kiện mang nhãn stable/final.

## Kế hoạch rollback

### Trước staging

- Giữ GitHub Latest và asset công khai hiện tại nguyên vẹn.
- Không tạo, di chuyển hoặc ghi đè tag.
- Nếu source gate thất bại, giữ evidence và sửa trên commit mới. Có thể revert
  từng checkpoint v32 theo thứ tự ngược trên nhánh riêng; không reset hard hoặc
  xóa lịch sử.
- Worktree/profile thử được cách ly. Không đưa dữ liệu thử vào profile thật.

### Khi có local candidate

- Candidate được nhận diện bằng version, commit, platform, architecture, size và
  SHA-256. Byte thay đổi tạo candidate mới.
- Gỡ candidate trong tài khoản smoke và dùng installer rollback đã ghim cho
  `vi-v0.20.4-39`.
- Giữ bản sao profile/userData trước rollback. Không tự động import state v32
  vào v39 cho tới khi compatibility test chứng minh an toàn.
- Xác minh app tree, registry, process, profile và userData bằng snapshot/hash
  trước và sau.

### Nếu staging hoặc pilot tương lai gặp lỗi

- Giữ artifact, manifest, log, screenshot và digest của bản lỗi.
- Dừng promotion. Draft/tag đã tạo giữ bất biến; không vá asset cùng tag.
- Chuyển đường tải/Latest về bản đã được chủ dự án chọn theo đúng public
  contract. Mục tiêu kỹ thuật đang ghi trong kế hoạch v32 là
  `vi-v0.20.4-39`.
- Công bố rõ target bị ảnh hưởng, dữ liệu có bị tác động hay không và cách người
  thử quay lại.
- Sửa nguyên nhân, thêm regression gate và tăng candidate suffix.

Rollback hiện là kế hoạch, chưa phải bằng chứng đã diễn tập cho v32.

## Điều kiện nhỏ nhất để đổi quyết định

1. Freeze exact commit sạch, đã push và fetch độc lập.
2. Chốt chính sách cho ba runtime opaque hoặc thêm telemetry đủ chặn trước I/O.
3. Chạy final source matrix cùng benchmark canonical trên exact commit.
4. Đóng năm release-surface blocker trong kế hoạch.
5. Build local candidate đúng một lần và khóa manifest/digest.
6. Chạy isolated Windows x64 packaged smoke, update, repair, uninstall và
   rollback bằng mock provider.
7. Ghi signing/support matrix đúng sự thật.
8. Chỉ sau đó mới xin phê duyệt mới cho tag, push hoặc staging kín.

## Handoff bắt buộc

```text
Decision: NO-GO / candidate only
Candidate: chưa freeze; chưa có artifact hoặc hash
Audience allowed: kỹ thuật nội bộ trong môi trường cô lập, mock/offline
Gates passed: checkpoint source tests và benchmark offline sơ bộ
Gates failed or missing: opaque runtime accounting, final matrix, release blockers, artifact smoke, signing, máy thật, rollback proof, owner approval
Evidence: docs/v32/implementation-summary.md; docs/v32/test-report.md; docs/v32/benchmarks/
Residual risks: undercount physical attempts; update/rollback state; unsigned/cross-platform behavior
Rollback target: vi-v0.20.4-39
Public actions taken: none
Next smallest step: khóa exact source gate và quyết định fail-closed/telemetry cho ba runtime opaque
```
