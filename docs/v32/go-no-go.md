# Hermes Vietnamese v32 — GO/NO-GO, giới hạn và rollback

Ngày đánh giá: 2026-08-24

Implementation tip trước checkpoint test hiện tại:
`ffa71a84065f9272bb65df28787fe80470f72558`

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
| Implementation tip trước docs | `ffa71a84065f9272bb65df28787fe80470f72558` |
| Exact candidate commit | `[PARENT: điền sau freeze]` |
| Version | `0.32.0-vi.1 (dự kiến; chưa build)` |
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
- Runtime opaque không còn được đếm ước lượng: governed turn fail-closed trước
  I/O và trả lỗi có cấu trúc, không retry/fallback/switch âm thầm.
- Canonical context/error group đạt 246/246, gồm continuity logic >350k qua
  compaction, SQLite persistence, relaunch và lượt tiếp theo bằng agent mới.

Chi tiết và trạng thái cần chạy lại nằm tại `docs/v32/test-report.md`. Những
dòng trên chưa đủ thay thế final candidate receipts.

## Gates và blocker còn lại

### 1. Candidate chưa bất biến và chưa thể truy xuất độc lập

Nhánh hiện đi trước `origin/main`, implementation tip còn local-only tại thời
điểm lập hồ sơ. Worktree có test và tài liệu checkpoint đang chờ commit. Release rulebook
cấm build candidate để staging từ commit bẩn, local-only hoặc chưa fetch được.

### 2. Chính sách runtime opaque đã khép kín ở source checkpoint

Codex app-server, Claude Code và Copilot ACP không cung cấp telemetry cho từng
provider request, retry và tool call nội bộ. V32 đã chọn hướng fail-closed:
governed user turn chặn các runtime này trước I/O bằng lỗi có cấu trúc. Codex
app-server ghi `api_calls=0`, exit reason riêng và không retry, fallback hay đổi
runtime âm thầm. Gate còn lại là chạy lại ma trận này trên exact candidate;
không còn cho phép meter undercount các attempt opaque.

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

### 5. Release-surface controls đã triển khai, final gate chưa khóa

- Community prerelease đã fail-closed update feed và từ chối `latest*.yml`.
- Node floor đã thống nhất ở 26 trong build/preflight/healer paths.
- macOS patch gate, POSIX two-stage venv rollback và Windows ARM64
  architecture/limitation gates đã được triển khai.
- Các control này vẫn phải qua release/evidence regression trên exact frozen
  commit trước khi được tính source GO.

### 6. Signing, máy thật và quyền công bố

- Chưa có Authenticode Windows.
- Chưa có Developer ID, notarization và stapling macOS.
- Chưa có runtime smoke cho sáu target được quảng cáo.
- Private draft staging nằm trong quyền của task sau source GO. Tuy nhiên kho
  GitHub là public nên push nhánh sẽ công khai source; bước đó cần xác nhận rõ
  về public source exposure. Thay GitHub Latest v31 vẫn cần owner GO cuối.

## Giới hạn đã biết

1. Static benchmark dùng rough estimator. Nó không đại diện tokenizer-exact
   usage, quota hoặc hóa đơn provider.
2. Live provider behavior chưa được kiểm chứng trong lượt này.
3. Codex app-server, Claude Code và Copilot ACP bị fail-closed trong governed
   turn cho tới khi protocol có per-attempt telemetry/reservation; đây là giới
   hạn tính năng có chủ đích, không phải số meter bị undercount.
4. Codex app-server vẫn sở hữu thread context riêng. V32 không cho runtime opaque
   này thực hiện provider work trong governed turn ở release scope hiện tại.
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

1. Freeze exact commit sạch; push/fetch độc lập sau xác nhận public source
   exposure.
2. Chạy final source matrix cùng benchmark canonical trên exact commit.
3. Đóng release-surface/pre-build gates trong kế hoạch.
4. Dùng đúng một build retry ngoại lệ đã được duyệt trên commit cuối đã sửa và
   khóa manifest/digest; lượt retry hiện chưa dùng.
5. Chạy isolated Windows x64 packaged smoke, update, repair, uninstall và
   rollback bằng mock provider.
6. Ghi signing/support matrix đúng sự thật.
7. Tạo private staging giữ đúng byte đã nghiệm thu; chỉ xin owner GO cho hành
   động public/Latest sau khi mọi gate kỹ thuật đạt.

## Handoff bắt buộc

```text
Decision: NO-GO / candidate only
Candidate: chưa freeze; chưa có artifact hoặc hash
Audience allowed: kỹ thuật nội bộ trong môi trường cô lập, mock/offline
Gates passed: opaque runtime fail-closed; context/error checkpoint 246/246; >350k continuity; benchmark offline sơ bộ
Gates failed or missing: final exact-commit matrix, release gates, artifact smoke, signing disclosure, máy Windows cô lập, rollback proof, owner approval cho Latest
Evidence: docs/v32/implementation-summary.md; docs/v32/test-report.md; docs/v32/benchmarks/
Residual risks: opaque runtimes bị vô hiệu trong governed turn; update/rollback state; unsigned/cross-platform behavior
Rollback target: vi-v0.20.4-39
Public actions taken: none
Next smallest step: commit checkpoint continuity rồi đóng toàn bộ exact source/pre-build gate
```
