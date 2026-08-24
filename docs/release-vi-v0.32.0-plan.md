# Kế hoạch Hermes Vietnamese v32

## Quyết định hiện tại

- Trạng thái: **candidate only / NO-GO cho staging và phát hành công khai**.
- Nhánh cô lập: `feat/v32-token-context-ux`.
- Baseline công khai đã xác minh: `vi-v0.31.0-7` tại
  `70b2418fdb2b35a714d4a813c6894cdbbec0a370`.
- Baseline `origin/main`: `b360c837f18028aedc228eb429d1035f18e77757`.
- Checkpoint hợp nhất cục bộ: `3cce675cea2bfdfd2fd29352f35a529e827cf46f`.
- Candidate kỹ thuật dự kiến đầu tiên: `0.32.0-vi.1`; chưa tạo tag
  `vi-v0.32.0-1` và chưa có artifact.
- Lớp phát hành tối đa khi chưa ký số: unsigned community prerelease/pilot;
  không gọi stable/final.
- Rollback target: `vi-v0.20.4-39`.
- Không có hành động public nào được phép nếu chưa có phê duyệt mới.

## Nguồn sự thật và bằng chứng nền

- GitHub Latest thật là `vi-v0.31.0-7`; Windows x64 setup có kích thước
  `340302846` byte và SHA-256
  `cca0f3c0255e5e8736676a4d7ccb52c6e1b75eb73b94b8d1c3ca5dc91e57e840`.
- Session read-only `20260824_110237_63c687` có 11 user messages, 184 main
  calls, 24 hidden calls, 235 tool results, 890.063 input mới, 36.898.688
  cache-read và 46.535 output. Cache hit khoảng 97,6%; call-loop và context
  được đọc lại mới là nguồn tiêu hao chính.
- Session vẫn active, 430/430 messages active, không có compaction checkpoint,
  persisted provider error hoặc log chứng minh `context_length_exceeded`.
- Runtime log từng cache Codex `gpt-5.6-sol` ở 272k, trong khi source v31 phải
  resolve metadata này lên 900k và UI có thể dùng published capacity 1,05M.
  Đây là bằng chứng về resolver/runtime/UI skew, chưa phải bằng chứng provider
  đã chạm hard context limit.
- Ảnh UX chỉ là bằng chứng nội bộ. Ảnh Messaging có dữ liệu nhạy cảm đã che một
  phần và không được sao chép thẳng vào release evidence.

## Phạm vi khóa

1. Token Governor theo user turn, phủ main, approval, background review, title,
   compression, advisor và subagent.
2. Raw tool output dưới 10 KiB trong model context, có artifact và recovery
   pointer cho nội dung đầy đủ.
3. Native compaction `auto` cho gpt-5.6 trên Codex/direct OpenAI, local fallback
   trước vùng lỗi quan sát, phân loại context/quota chính xác và recovery bền.
4. Lean Session với tool profile bất biến trong phiên và deferred built-ins qua
   bridge ổn định, không phá prompt cache.
5. UX-001 quay lại phiên; UX-002 pointer/click thật trên `+`; UX-003 tách active
   context, nền hệ thống, logical history, compaction, provider quota và API
   equivalent.

Không thêm provider, Gemini, skill hay tính năng sản phẩm ngoài phạm vi này.

## Quyết định thiết kế

- Đếm **physical outbound model attempt**, kể cả retry/fallback thất bại. Token
  usage là metric riêng của response có usage.
- Cho phép call 1–12 và tool 1–20; cảnh báo một lần tại 6/8; chặn call 13 và
  tool 21 bằng controlled pause không phát sinh thêm LLM call.
- `agent.max_turns`/iteration budget tiếp tục là failsafe cuối, không phải bộ
  bảo vệ chi phí chính.
- Native compaction mục tiêu 190k active input; local fallback mục tiêu quanh
  200k–208k và luôn thấp hơn vùng 272k đã quan sát. Ngưỡng cuối chỉ được khóa
  sau benchmark synthetic 350k+.
- Context error được compact rồi retry provider đúng một lần. Quota/rate limit
  giữ nguyên session, hiển thị reset nếu có và không bị gọi là context full.
- Lean/full tool profile được chọn và persist trước call đầu; system prompt,
  tool bridge schemas và thứ tự tools phải byte-stable suốt phiên và sau resume.
- UX-002 chỉ sửa sau pointer trace. Source exact-tag đã chặn pointerdown khỏi
  drag parent, nên giả thuyết event propagation hiện chưa được chứng minh.

Chi tiết nằm tại:

- `docs/decisions/2026-08-24-token-governor.md`
- `docs/decisions/2026-08-24-context-compaction.md`
- `docs/decisions/2026-08-24-context-meter.md`

## Lát cắt và checkpoint

1. A1: governor thuần + call/tool reservation + turn telemetry.
2. A2: raw output byte cap, artifact pointer và persistence order.
3. B1: resolver/native auto/threshold/downgrade persistence.
4. B2: context-vs-quota classifier, one-retry recovery và restart state.
5. C1: immutable lean profile + deferred built-ins + cache parity.
6. D1: Messaging back + draft/pane/sidebar regression.
7. D2: pointer E2E cho `+`, sửa đúng root cause, focus/error/a11y.
8. D3: backend meter contract + quota RPC + decimal UI.
9. Benchmark, source gates, candidate metadata và exact-artifact smoke.

Mỗi lát cắt phải có test đỏ trước, test xanh sau và checkpoint Git riêng khi
không còn thay đổi chưa xác minh trong lát cắt.

## Gate nguồn bắt buộc

- Python chỉ chạy qua `scripts/run_tests.sh`.
- Token: pure governor, physical retry count, hidden tasks, subagent aggregate,
  hard pause, paired denied tool IDs, raw output UTF-8 và recovery pointer.
- Context: metadata 272k/372k/900k/1,05M; logical transcript >350k; native
  success/rejection; local fallback; context retry once; quota matrix; relaunch.
- Lean/cache: first-request footprint, tool bridge parity, tools/system prompt
  byte hash qua call 1/call 2/resume, Telegram/Desktop lean selection.
- UX: component/a11y plus real Playwright pointer on one/many/scrolled/split
  tabs; Messaging back giữ draft/Browser/Terminal; meter/quota/cost states.
- Desktop typecheck, ESLint, Prettier, production build, release/evidence tests,
  lock/dependency/secret/diff gates.

Baseline đã chạy trước sửa:

- 4 Python files / 287 tests Context đạt.
- 3 UI files / 26 tests đạt.
- 149 tests raw-output/Tool Search/cache đạt; 4 symlink-security tests fail
  trước sửa vì Windows runner không có quyền tạo symlink, 2 skip. Đây là lỗi
  hạ tầng baseline cần gate riêng, không được ghi là regression v32.

## Benchmark bắt buộc

Mỗi benchmark dùng mock provider và fixture/profile cô lập, xuất JSON có commit,
config hash và schema hash:

- Fresh simple session: model/tool calls, active/system/conversation tokens.
- Simple 10-turn session: per-turn và cumulative deltas.
- Tool-heavy session: physical attempts, tool count, raw bytes, spilled bytes.
- Logical transcript >350k: active input trước/sau compact, recall anchors,
  compaction count và recovery state.

Mục tiêu: fresh lean dưới 1% của 1,05M, phấn đấu 5k–10k active input; simple
prompt có một main response, không tool-loop và không background review.

## Candidate và packaged smoke

- Build candidate đúng một lần sau source GO; khóa commit/version/platform/arch,
  filename/size/SHA-256/provenance trước mọi smoke.
- Smoke Windows x64 dùng HERMES_HOME, Electron userData và provider mock riêng:
  fresh install, onboarding, gateway, safe tool, relaunch/persistence, ba UX,
  synthetic compaction, update v31, repair, keep/delete data, uninstall, rollback.
- Live Codex probe là gate riêng: phải báo trước call/token budget và nhận phê
  duyệt. Không live probe trong source/packaged mock gate.
- Không dùng profile thật và không đưa credential/raw provider body/user data vào
  log, screenshot, manifest hay artifact.

## Release-surface gates trước build

Các blocker nguồn đã được đóng theo hướng fail-closed; artifact và máy thật vẫn
phải qua smoke trước mọi staging/promotion:

- Bundled stamp/manifest ghi `releaseClass`, `updateChannel` và
  `updateFeedEnabled`. Community prerelease đặt feed là disabled, updater không
  được gọi và workflow từ chối mọi `latest*.yml`; chỉ stable mới sinh metadata.
- Workflow, package/lock, POSIX, Windows, Python healer và build preflight dùng
  cùng floor Node 26. Chạy script build bằng Node dưới 26 bị chặn trước I/O.
- Patch electron-builder macOS chỉ skip ngoài Darwin; trên Darwin thiếu target
  hoặc sai source shape là lỗi build.
- POSIX dựng `venv.new.*`, giữ `venv.stale.*` cùng marker qua hai stage và chỉ
  xóa backup sau import probe; lỗi hoặc ngắt quãng khôi phục venv cũ trước khi
  dọn replacement lỗi.
- Windows ARM64 không được âm thầm thiếu `get-windows`: stable luôn fail;
  community build-only chỉ được phép với flag workflow tường minh và phải mang
  `limitations-windows-arm64.txt`. PE machine gate phải xác nhận đúng kiến trúc.
- Stable vẫn cần Authenticode/SignPath và Developer ID + notarization + stapling.

Candidate cục bộ đầu tiên không cần tạo tag. Nó vẫn dùng nhãn manifest dự kiến,
nhưng mọi source/asset được build hoặc đóng gói phải khớp đúng full commit của
HEAD sạch hoàn toàn. Cổng preflight từ chối cả thay đổi tracked lẫn file
untracked, kể cả trong `apps/desktop/src`, `public` hoặc `assets`. Local
candidate bắt buộc chạy `npm ci` từ lockfile và kiểm lại provenance sau khi
đóng gói, trước khi báo thành công:

```powershell
$commit = git rev-parse HEAD
& '<digest-pinned-node-26>\node.exe' scripts/build-bundled-desktop.mjs `
  --tag=vi-v0.32.0-1 --release-class=community-prerelease `
  --local-candidate --commit=$commit
```

Đây chỉ là local candidate, không phải bằng chứng tag đã tồn tại. Đường CI/draft
vẫn bắt buộc exact tag trỏ đúng checkout, và source phải fetch được trước staging.

## Promotion boundary

Technical GO chỉ cho phép tạo immutable local candidate. Staging/tag/draft/push
vẫn cần phê duyệt mới. Promotion công khai cần thêm exact-byte smoke, secret
scan, signing disclosure, target-machine evidence và owner GO. Thiếu signing
hoặc máy thật cho target quảng cáo thì không được gọi stable/final.
