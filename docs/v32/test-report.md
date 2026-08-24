# Hermes Vietnamese v32 — Báo cáo kiểm thử

Ngày lập scaffold: 2026-08-24

Implementation tip trước checkpoint test này:
`ffa71a84065f9272bb65df28787fe80470f72558`

Candidate commit: `[PARENT: điền sau khi freeze]`

Kết luận hiện tại: **source evidence đang tích lũy; packaged/public gates chưa đạt**

## Luật ghi nhận

- Python chỉ được tính khi chạy qua `scripts/run_tests.sh` bằng Git Bash.
- Không cộng các nhóm test có thể chồng lấp thành một tổng giả.
- `pass on retry` phải ghi FLAKY, không gộp vào trạng thái xanh im lặng.
- Thiếu optional dependency được ghi là `ENV-BLOCKED`, không ghi `PASSED`.
- Static token estimate không được gọi là provider usage hoặc billing.
- Build, typecheck và unit test không thay thế exact packaged-artifact smoke.
- Không có live provider/network call trong source gate này.

## Môi trường

| Thuộc tính | Giá trị |
| --- | --- |
| Host | Windows `[PARENT: điền edition/build]` |
| Kiến trúc | `[PARENT: x64/ARM64]` |
| Python | `[PARENT: version + executable]` |
| Node/npm | `[PARENT: versions]` |
| Git | `[PARENT: version]` |
| Branch | `feat/v32-token-context-ux` |
| Candidate commit | `[PARENT: exact SHA]` |
| Worktree clean | `[PARENT: true/false ngay trước test]` |
| Network/provider | `Disabled; mocked/offline only` |

## Bằng chứng checkpoint đã quan sát

Các số dưới đây là receipt ở từng checkpoint kỹ thuật. Chúng chưa phải ma trận
acceptance cuối và không được cộng lại vì có test trùng nhau.

| Phạm vi | Receipt checkpoint | Trạng thái cần khóa lại |
| --- | --- | --- |
| Baseline Context | 287 test đạt | Ghi command, log và commit baseline |
| Baseline Desktop UI | 26 test đạt | Ghi command, log và commit baseline |
| Baseline raw-output/Tool Search/cache | 149 test đạt; 4 symlink-security fail do host thiếu quyền tạo symlink; 2 skip | Chạy symlink gate trên host phù hợp |
| Context/recovery v32 | 187/187 đạt | Chạy lại trên exact candidate |
| Context >350k + persistence/relaunch | Canonical group 246/246 đạt; mock/offline | Commit checkpoint rồi chạy lại trên exact candidate |
| Lean Session | 205/205 đạt và 5 targeted checks đạt | Chạy lại trên exact candidate |
| Governor root integration | 15/15 đạt | Gắn command/receipt |
| Hidden compaction và xAI paths | 53/53 đạt | Gắn command/receipt |
| Provider-path matrix | 411 đạt, 6 skip | Không cộng với các nhóm con; gắn danh sách tệp |
| Vertex focused matrix | 194 đạt | Xác nhận có nằm trong provider matrix hay không |
| Final focused provider/governor slice | 84 đạt, 5 skip | Gắn command và lý do skip |
| Desktop unit slice | 105 test đạt | Gắn command/receipt |
| Desktop persistence slice | 11/11 đạt | Gắn command/receipt |
| Desktop pointer E2E | Playwright 1/1 đạt | Gắn trace/video/screenshot của exact candidate source |
| Desktop typecheck/build | Đã đạt ở checkpoint | Chạy lại sau freeze |
| Desktop ESLint | 0 lỗi ở checkpoint | Ghi warnings và command cuối |

`[PARENT: thay mọi receipt tóm tắt bằng command, timestamp, exit code và đường
dẫn log của lượt chạy cuối. Giữ lại checkpoint history nếu cần điều tra.]`

## Ma trận acceptance cuối

### A. Governor và raw tool output

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| Warning model tại 6, hard pause trước attempt 13 | `[PENDING]` | `[COMMAND/LOG]` |
| Warning tool tại 8, hard pause trước dispatch 21 | `[PENDING]` | `[COMMAND/LOG]` |
| Parent và subagent dùng chung root governor | `[PENDING]` | `[COMMAND/LOG]` |
| Retry/fallback thất bại vẫn tăng physical attempt | `[PENDING]` | `[COMMAND/LOG]` |
| Hidden title/review/compaction/advisor được đếm | `[PENDING]` | `[COMMAND/LOG]` |
| Batch bị chặn vẫn pair đủ `tool_call_id` | `[PENDING]` | `[COMMAND/LOG]` |
| Tool result văn bản dưới 10 KiB theo UTF-8 | `[PENDING]` | `[COMMAND/LOG]` |
| Artifact có byte size, SHA-256 và recovery pointer | `[PENDING]` | `[COMMAND/LOG]` |
| Incremental persistence an toàn khi Governor pause | `[PENDING]` | `[COMMAND/LOG]` |
| TUI/Desktop/API nhận cùng turn snapshot | `[PENDING]` | `[COMMAND/LOG]` |

### B. Context, classifier và persistence

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| Metadata 272k/372k/900k/1,05M không bị nhập nhằng | `[PENDING]` | `[COMMAND/LOG]` |
| Native eligible gate ở 190k | `[PENDING]` | `[COMMAND/LOG]` |
| Local fallback planning quanh 208k | `[PENDING]` | `[COMMAND/LOG]` |
| Native rejection tạo session downgrade | `[PENDING]` | `[COMMAND/LOG]` |
| Context overflow compact và retry đúng một lần | `[PENDING]` | `[COMMAND/LOG]` |
| Quota/rate limit không compact mù | `[PENDING]` | `[COMMAND/LOG]` |
| Relaunch giữ normalized recovery state | `[PENDING]` | `[COMMAND/LOG]` |
| Bedrock live context probe tắt mặc định | `[PENDING]` | `[COMMAND/LOG]` |
| Bedrock/Vertex SDK không tự retry ngoài Governor | `[PENDING]` | `[COMMAND/LOG]` |

### C. Lean Session và benchmark

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| Fresh profile mặc định `lean` | `[PENDING]` | `[COMMAND/LOG]` |
| Tool schemas byte-stable qua call 1/call 2/resume | `[PENDING]` | `[COMMAND/LOG]` |
| Full profile escape hoạt động ở session mới | `[PENDING]` | `[COMMAND/LOG]` |
| Simple prompt có 1 main response, 0 tool, 0 background | `[PENDING]` | `[COMMAND/LOG]` |
| Fresh active input dưới 1% của 1,05M | `[PENDING FINAL LOCK]` | `docs/v32/benchmarks/offline-benchmark-2026-08-24.*` |
| 10-turn cumulative delta | `[PENDING FINAL LOCK]` | `[JSON PATH/HASH]` |
| Tool-heavy raw/spilled bytes | `[PENDING FINAL LOCK]` | `[JSON PATH/HASH]` |
| Logical transcript trên 350k giữ recall anchors | `[VERIFIED CHECKPOINT; FINAL LOCK PENDING]` | `tests/run_agent/test_v32_long_context_continuity.py`; canonical 10-file group 246/246 |

Benchmark offline sơ bộ tại `596d188b2` báo:

- fresh 5.169 token ước tính, tương đương 0,4923% của 1,05M;
- 10-turn 5.947 token ước tính;
- 4 active schema trên 59 tool được cấp, 4.265 schema byte;
- fixture 350k đánh dấu cả native 190k và local fallback 208k đã đến hạn.

Đây là deterministic planning/static estimate. Harness không gọi provider,
không thực thi tool handler và không đánh giá chất lượng summary sau compaction.

Runtime integration tách biệt đã đóng phần summary/continuity còn thiếu của
benchmark tĩnh: transcript logic trên 350k được compact, persist qua SQLite,
relaunch bằng agent mới và tiếp tục thêm một lượt mà vẫn giữ toàn bộ retention
anchors. Lượt checkpoint canonical 10 tệp đạt 246/246 trong 79,1 giây, exit 0:

```text
scripts/run_tests.sh
  tests/run_agent/test_v32_long_context_continuity.py
  tests/run_agent/test_native_compaction.py
  tests/run_agent/test_codex_app_server_compaction.py
  tests/run_agent/test_413_compression.py
  tests/run_agent/test_in_place_compaction.py
  tests/run_agent/test_preflight_compression_cap_e2e.py
  tests/run_agent/test_compression_persistence.py
  tests/agent/test_context_compressor_summary_continuity.py
  tests/agent/test_error_classifier.py
  scripts/test_benchmark_v32_offline.py -q
```

Receipt này được tạo trên implementation tip `ffa71a840...` cùng thay đổi test
chưa commit, nên được ghi là checkpoint chứ chưa phải final candidate lock.
Chi tiết môi trường và behavioral proof nằm tại
`docs/v32/evidence/source-context-checkpoint-2026-08-24.md`.

`[PARENT: sau khi commit benchmark harness, chạy canonical focused regression,
điền exact candidate commit, SHA-256 của JSON/Markdown và đổi trạng thái.]`

### D. Desktop UX

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| Messaging back giữ draft và pane state | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Pointer thật trên `+` tạo đúng một session/tab | `[PENDING FINAL RUN]` | `[TRACE/VIDEO]` |
| One/many/scrolled/split tab state | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Focus, error và a11y | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Meter tách active/effective/logical/compaction | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Quota unavailable hiển thị “Chưa có dữ liệu” | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Subscription cost ghi API-equivalent | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Turn meter normal/near-limit/paused | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |
| Production build/typecheck/lint | `[PENDING FINAL RUN]` | `[COMMAND/LOG]` |

## Environment blockers đã biết

- Một lượt collect API server bị chặn vì môi trường thiếu optional dependency
  `aiohttp`. Chưa có bằng chứng code regression từ lỗi collect này.
- Một số streaming test từng thiếu optional package `anthropic`. Các test đó
  phải chạy trên môi trường acceptance có dependency tương ứng hoặc được ghi
  `ENV-BLOCKED`; không được đổi thành pass.
- Bốn symlink-security test baseline không tạo được symlink trên Windows hiện
  tại. Cần Windows có Developer Mode/quyền phù hợp hoặc runner POSIX chính tắc.

## Packaged-artifact acceptance

| Gate | Trạng thái | Evidence cần điền |
| --- | --- | --- |
| Candidate manifest khóa version/commit/platform/arch/size/SHA-256 | `PENDING` | `[MANIFEST PATH + HASH]` |
| Fresh install Windows x64 cô lập | `PENDING` | `[RECEIPT]` |
| Runtime/bootstrap/gateway/onboarding | `PENDING` | `[LOG + SCREENSHOT]` |
| Safe tool qua mock provider | `PENDING` | `[RECEIPT]` |
| Relaunch và persistence | `PENDING` | `[RECEIPT]` |
| Ba UX v32 trên packaged bytes | `PENDING` | `[SCREENSHOTS/TRACE]` |
| Synthetic compaction trên packaged bytes | `PENDING` | `[RECEIPT]` |
| Update từ v31 | `PENDING` | `[RECEIPT]` |
| Repair | `PENDING` | `[RECEIPT]` |
| Uninstall giữ dữ liệu | `PENDING` | `[RECEIPT]` |
| Uninstall xóa dữ liệu | `PENDING` | `[RECEIPT]` |
| Rollback về `vi-v0.20.4-39` | `PENDING` | `[RECEIPT]` |
| Secret/profile/userData scan | `PENDING` | `[REPORT]` |

## Live-provider boundary

Không có live Codex, Claude, Copilot, Bedrock, Vertex hoặc xAI proof trong báo
cáo này. Mọi live probe phải khai báo trước call/token budget và được chủ dự án
phê duyệt riêng.

Codex app-server, Claude Code và Copilot ACP chưa cung cấp telemetry cho từng
provider request nội bộ. V32 vì vậy fail-closed các runtime opaque này trong
governed user turn, trước khi tiến trình có thể tạo provider work không quan sát
được. Source test chứng minh lỗi có cấu trúc, `api_calls=0`, không fallback/switch
và composer không bị khóa im lặng. Các runtime chỉ được mở lại trong phạm vi
Governor khi protocol cung cấp per-attempt reservation/telemetry đủ chặn trước
I/O.

## Kết luận test

`[PARENT: PASS / FAIL / ENV-BLOCKED cho source gate]`

`[PARENT: PASS / FAIL cho packaged Windows x64 gate]`

`[PARENT: PASS / FAIL cho release-surface gate]`

Khi còn một dòng `PENDING`, `ENV-BLOCKED` hoặc placeholder thuộc phạm vi quảng
cáo, kết luận phát hành tương ứng vẫn là NO-GO.
