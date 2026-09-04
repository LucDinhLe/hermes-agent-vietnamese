# Sổ ghi patch lõi — Hermes Vietnamese vs upstream v2026.8.31
- Ngày lập: 04/09/2026
- Merge-base fork/upstream: `e624e9fde561e1add9388384012b295fde669ade`
- Lõi ghim tại tag upstream: `v2026.8.31`
- Tổng số tệp lõi đã sửa/thêm/xoá so với merge-base: 300
- Phân loại: GREEN 67 · YELLOW 212 · RED 21

## Cách đọc sổ này
- **GREEN** — bỏ, dùng thẳng bản upstream `v2026.8.31`: upstream đã có tương đương/đã tự sửa, hoặc đây là thay đổi cosmetic (đổi tên kho, dịch docs, bump lockfile), hoặc là test đi kèm một thay đổi GREEN/YELLOW.
- **YELLOW** — bỏ khỏi lõi ở lần ghim này, đóng gói lại thành **plugin ở bản thử nghiệm 2**: giao diện desktop của fork, Advisor (`agent/advisor.py`), hồ sơ năng lực (`capability_*`), gợi ý kỹ năng theo công việc (`work-profile`, `/api/skills/discover`, `/api/mcp/assignments`), ngân sách lượt (`turn_budget`/token governor/context meter), và provider `claude-code` riêng của fork (bản 2 dùng cầu Claude Code chuẩn của upstream).
- **RED** — hành vi lõi thật, upstream `v2026.8.31` KHÔNG có, không thuộc 4 tính năng YELLOW ở trên. **Luc phải quyết giữ hay bỏ từng mục.**

## Nhóm RED cần Luc quyết
Có 21 tệp (12 tệp nguồn + 9 tệp test đi kèm), gom thành 11 thay đổi hành vi độc lập. Với mỗi mục: sửa gì, upstream 8.31 đã có chưa (đã kiểm bằng `git log`/`git grep` trên tag), rủi ro nếu bỏ, test đi kèm.

**1. Retry khi SQLite báo BUSY/locked**
- Tệp: `hermes_cli/sqlite_util.py`
- Sửa gì: Thêm retry có jitter (tối đa 5 lần, 20–150ms) quanh `BEGIN IMMEDIATE`/`COMMIT` khi SQLite trả lỗi `database is locked`/`database is busy`. Chỉ retry ranh giới transaction (idempotent), không retry phần thân để tránh ghi lặp.
- Upstream 8.31: **Chưa.** `git log e624e9f..v2026.8.31 -- hermes_cli/sqlite_util.py` rỗng; `git grep -n BUSY_MAX_RETRIES v2026.8.31` không ra gì — upstream vẫn `conn.execute("BEGIN IMMEDIATE")` không retry.
- Rủi ro nếu bỏ: Nếu bỏ: một trong nhiều tiến trình Hermes ghi đồng thời (nhiều phiên CLI/gateway/cron cùng lúc) sẽ crash ngay với `sqlite3.OperationalError: database is locked` thay vì tự phục hồi — dễ gặp hơn trên máy người dùng phổ thông chạy nhiều tab/cron so với môi trường CI của upstream.
- Test đi kèm: `tests/hermes_cli/test_sqlite_util_busy_retry.py`

**2. Khoá ghi + xử lý busy timeout cho observability metrics**
- Tệp: `hermes_cli/observability/shared_metrics.py`
- Sửa gì: Thêm writer lock trước UPSERT và xử lý SQLite busy timeout khi nhiều tiến trình cùng ghi metrics.
- Upstream 8.31: **Chưa** kiểm thấy tương đương trên `v2026.8.31` (`git log` rỗng cho tệp này).
- Rủi ro nếu bỏ: Nếu bỏ: có thể mất/ghi đè metric hoặc crash khi hai tiến trình ghi cùng lúc dưới tải cao — mức độ thấp hơn mục #1 vì chỉ ảnh hưởng observability, không ảnh hưởng transcript.
- Test đi kèm: Không có test riêng biệt trong danh sách 300 tệp (đi kèm test chung của module observability, không đổi).

**3. `hermes doctor` phát hiện SQLite WAL-reset bug**
- Tệp: `hermes_cli/doctor.py`
- Sửa gì: Thêm bước chẩn đoán: liệt kê từng DB do Hermes quản lý cùng `journal_mode`, cảnh báo DB đang ở WAL mà bản SQLite liên kết dính lỗi WAL-reset (sqlite.org/wal.html#walresetbug). Đọc header file trực tiếp, không mở qua engine (mở kể cả read-only cũng tạo file `-wal`/`-shm` phụ).
- Upstream 8.31: **Chưa.** `git log`/`git grep WAL-reset` trên `v2026.8.31 -- hermes_cli/doctor.py` không ra kết quả.
- Rủi ro nếu bỏ: Nếu bỏ: mất công cụ chẩn đoán sớm một lỗi âm thầm gây hỏng dữ liệu transcript trên các bản SQLite cũ đóng gói sẵn trong một số bản Linux — người dùng chỉ phát hiện khi DB đã hỏng.
- Test đi kèm: `tests/hermes_cli/test_doctor_journal_modes.py`

**4. MCP startup mặc định *fail-closed* thay vì *fail-open***
- Tệp: `hermes_cli/mcp_startup.py`
- Sửa gì: Khi đọc cấu hình MCP lỗi, trước đây mặc định vẫn cho phép discovery chạy nền (`return True`); giờ mặc định từ chối (`return False`) — không tự ý spawn tiến trình/mở kết nối mạng nếu không chứng minh được có server đã cấu hình. Cũng tôn trọng cờ `enabled: false` trên từng MCP server (trước đây bỏ qua).
- Upstream 8.31: **Chưa.** `git grep "Permission boundary" v2026.8.31 -- hermes_cli/mcp_startup.py` không ra; logic upstream vẫn fail-open.
- Rủi ro nếu bỏ: Nếu bỏ: quay lại fail-open — một lỗi đọc config nhỏ có thể khiến Hermes tự ý spawn tiến trình MCP ngoài ý muốn (rủi ro bảo mật/quyền riêng tư nhẹ, không phải crash).
- Test đi kèm: `tests/hermes_cli/test_mcp_startup.py`

**5. Tắt mặc định dò context-window Bedrock bằng request thật**
- Tệp: `agent/model_metadata.py`
- Sửa gì: `probe_bedrock_context_length()` gửi payload cực lớn để Bedrock từ chối và đọc "maximum" trong lỗi — nhưng một số tier có thể bị chấp nhận và xử lý thật ~1.3M token đầu vào (tốn tiền oan). Fork tắt mặc định, chỉ bật khi đặt `HERMES_BEDROCK_LIVE_CONTEXT_PROBE=1`.
- Upstream 8.31: **Chưa.** `git grep HERMES_BEDROCK_LIVE_CONTEXT_PROBE v2026.8.31` không ra; upstream vẫn probe sống mặc định.
- Rủi ro nếu bỏ: Nếu bỏ: người dùng Bedrock có thể bị tính phí bất ngờ (~1.3M token) chỉ vì Hermes tự dò context window lúc khởi tạo model — rủi ro tài chính thật, không chỉ lý thuyết.
- Test đi kèm: `tests/agent/test_model_metadata.py` (tệp này cũng test phần context-meter YELLOW, không tách dòng được).

**6. Hạ ngưỡng nén ngữ cảnh để tránh vượt trần route Codex**
- Tệp: `agent/native_compaction.py`, `cli-config.yaml.example`
- Sửa gì: `DEFAULT_COMPACT_THRESHOLD` 200K→190K, thêm `DEFAULT_LOCAL_FALLBACK_THRESHOLD`=208K áp riêng cho route OpenAI/Codex trực tiếp (trần thật quan sát được là 272K) và chế độ `codex_responses_native: auto`.
- Upstream 8.31: **Chưa.** Upstream 8.31 vẫn giữ `DEFAULT_COMPACT_THRESHOLD = 200_000` và `codex_responses_native: False`.
- Rủi ro nếu bỏ: Nếu bỏ: phiên hội thoại dài trên route Codex/OpenAI trực tiếp có thể vượt trần ngữ cảnh 272K thật trước khi nén cục bộ kịp kích hoạt → lỗi 400/mất phản hồi giữa chừng.
- Test đi kèm: `tests/run_agent/test_native_compaction.py`

**7. Bảng giá + hệ số 'long-context' của OpenAI**
- Tệp: `agent/usage_pricing.py`
- Sửa gì: Thêm giá GPT-5.5/5.6 mới nhất và Claude Sonnet 5 (huỷ tăng giá tháng 9 theo Anthropic công bố), thêm hệ số nhân 2x input/1.5x output khi prompt > 272K token trên các route GPT-5.5/5.6 trực tiếp (đúng chính sách giá OpenAI công bố).
- Upstream 8.31: **Chưa.** `git grep long_context v2026.8.31 -- agent/usage_pricing.py` không ra; bảng giá upstream cũ hơn và thiếu hệ số nhân.
- Rủi ro nếu bỏ: Nếu bỏ: hiển thị sai chi phí (thấp hơn thực tế) cho phiên dài trên GPT-5.5/5.6 — không crash, nhưng sai số liệu billing hiển thị cho người dùng.
- Test đi kèm: `tests/agent/test_usage_pricing.py`

**8. Nâng target Node.js quản lý từ 22 lên 26**
- Tệp: `hermes_constants.py`, `nix/nixosModules.nix`, `nix/sandbox.nix`
- Sửa gì: `_HERMES_NODE_TARGET_MAJOR` mặc định 22→26; các gói Nix (`nodejs_22`→`nodejs_26`) và sentinel provisioning trong `nixosModules.nix` đổi theo.
- Upstream 8.31: **Chưa.** `git show v2026.8.31:hermes_constants.py` vẫn giữ mặc định `"22"`.
- Rủi ro nếu bỏ: Nếu bỏ: quay lại Node 22 — có thể *an toàn hơn* để giữ đồng bộ với upstream (ít lệch nhánh hơn) trừ khi có lý do cụ thể cần Node 26 (ví dụ một dependency JS mới). Cần Luc xác nhận có phụ thuộc nào bắt buộc Node ≥26 không.
- Test đi kèm: `tests/test_release_node_floor_contract.py`

**9. Mặc định tiếng Việt cho CLI**
- Tệp: `hermes_cli/config_defaults.py`
- Sửa gì: `DEFAULT_CONFIG["display"]["language"]` đổi từ `"en"` sang `"vi"` cho bản cài mới — đúng mục tiêu bản địa hoá của fork "Hermes Vietnamese". (Tệp này cũng chứa cấu hình mặc định cho advisor/turn-budget thuộc nhóm YELLOW, không tách được theo dòng — xem cột Lý do trong bảng.)
- Upstream 8.31: **Chưa và sẽ không bao giờ có** — đây là lựa chọn bản địa hoá riêng của fork, không phải thứ upstream sẽ tự sửa. Not applicable theo nghĩa "upstream sẽ vá", nhưng chắc chắn không có trong core upstream.
- Rủi ro nếu bỏ: Nếu bỏ: mất đặc tính cốt lõi của bản "Hermes Vietnamese" — người dùng mới sẽ thấy giao diện tiếng Anh mặc định, ngược lại mục tiêu của fork. **Khuyến nghị giữ** trừ khi Luc muốn chuyển việc này thành cấu hình onboarding riêng (plugin) thay vì default cứng.
- Test đi kèm: `tests/hermes_cli/test_vietnamese_defaults.py`

**10. Sửa test cron hay treo/flake khi dọn dẹp phiên**
- Tệp: `tests/cron/test_cleanup_timeout.py`
- Sửa gì: Thay đo thời gian bằng chạy trong luồng watchdog daemon có timeout — test cũ dùng `time.monotonic()` để khẳng định teardown xong dưới 0.5s, dễ flake trên máy chậm/CI tải cao; cách mới chờ có giới hạn và raise lỗi gốc nếu treo thật.
- Upstream 8.31: Không áp dụng trực tiếp (đây là sửa test, không phải sửa `cron/scheduler.py` — file đó không nằm trong 300 tệp lõi bị fork sửa, nghĩa là logic cron chính chưa đổi). Nhưng cách test mới lộ ra khả năng cron teardown có thể treo thật trên hệ thống chậm mà test cũ (dựa vào ngưỡng thời gian) có thể bỏ sót.
- Rủi ro nếu bỏ: Nếu bỏ: quay lại test cũ dễ flake (assert `elapsed < 0.5`) — rủi ro chủ yếu là CI đỏ giả, không phải rủi ro runtime; mức ưu tiên thấp hơn các mục trên, có thể xếp lại GREEN nếu Luc muốn tối giản.
- Test đi kèm: Chính nó là test.

**11. `gateway/run.py`: đẩy `goal_blocks_loop_tick`/`_goal_still_active_for_session` sang executor + await**
- Tệp: `gateway/run.py` (một phần trong tệp; phần còn lại thuộc YELLOW turn_budget)
- Sửa gì: Vòng quét cron loop gọi `goal_blocks_loop_tick(sid)` (đụng SQLite) trực tiếp trên event loop async; fork đổi sang chạy qua `_run_in_executor_with_context` và `await` hoá `_goal_still_active_for_session`, tránh block event loop khi SQLite chậm/khoá. Đây có thể là điều gần nhất với 'khoá cwd cron' được nhắc trong đề bài — không tìm thấy tệp nào khác trong 300 tệp thực sự khoá `cwd` cho cron.
- Upstream 8.31: **Chưa** kiểm thấy tương đương trên `v2026.8.31` cho hai hàm này.
- Rủi ro nếu bỏ: Nếu bỏ: vòng lặp gateway có thể bị treo/giật khi DB SQLite bận trong lúc quét job cron đến hạn, ảnh hưởng toàn bộ phiên đang chạy trên cùng event loop, không chỉ riêng cron.
- Test đi kèm: `tests/cron/test_cleanup_timeout.py` (gián tiếp); không có test async trực tiếp riêng cho đoạn này trong danh sách 300 tệp.

> Lưu ý: mục #10 và #11 không khớp hoàn toàn với ví dụ "khoá cwd cron" nêu trong đề bài — đã rà toàn bộ 300 tệp bằng từ khoá `cwd`, `os.chdir`, `working directory` và không thấy tệp nào khoá cwd cho cron rõ ràng hơn hai mục trên. Có thể ví dụ đó đã được giải quyết ở một tệp ngoài phạm vi 300 tệp lõi (ví dụ `cron/scheduler.py`, không nằm trong danh sách fork sửa), cần Luc xác nhận lại.

## Quyết định của Luc (04/09/2026)

Bỏ toàn bộ 21 tệp nhóm RED ở bản thử nghiệm 1, dùng lõi upstream v2026.8.31 nguyên bản. Lý do: mục tiêu bản 1 là chứng minh giao diện chạy trên lõi nguyên bản; mỗi vá lõi giữ lại sẽ phải vá lại ở mỗi lần nâng. Việc kế thừa:

- Mục 9 (mặc định `display.language = "vi"`) chuyển sang vỏ desktop: ghi vào cấu hình người dùng ở lần chạy đầu, không chạm lõi (làm ở bước 3).
- Mục 1, 2, 3 (SQLite busy retry, khoá ghi metrics, doctor phát hiện WAL reset) sẽ gửi upstream dưới dạng pull request sau khi bản thử nghiệm đứng được; kho hưởng lại qua lần nâng lõi kế tiếp.
- Mục 5, 6 (Bedrock probe, ngưỡng nén Codex) ghi vào ghi chú phát hành như hạn chế đã biết.
- Mục 7 (bảng giá) upstream tự cập nhật.

Nhóm RED sau quyết định: 0 tệp còn hiệu lực trong lõi.

## Nhóm YELLOW (đưa về plugin ở bản thử nghiệm 2)

**Advisor (giám sát/khuyên nền, đọc-chỉ)**

`agent/advisor.py` (mới) + móc nối trong `agent/agent_init.py`, `agent/conversation_loop.py`, `agent/turn_context.py`(?), cấu hình `advisor` trong `config_defaults.py`, và các test `test_advisor*.py`. Tắt mặc định (`enabled: False`) nên an toàn khi bỏ.

**Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP**

`agent/capability_router.py` (mới, 592 dòng), `hermes_cli/capability_benchmark.py`, `hermes_cli/capability_profile.py`, móc nối trong `tools/skills_tool.py`, `tools/mcp_tool.py`, `model_tools.py`, `tools/delegate_tool.py`, `agent/system_prompt.py`, `agent/prompt_builder.py` (tham số `skill_names`), `agent/turn_context.py`.

**Gợi ý kỹ năng theo công việc + hồ sơ công việc**

`hermes_cli/web_routers/skills.py` (route `/api/skills/work-profile*`, `/api/skills/discover`), `hermes_cli/web_routers/mcp.py` (route `/api/mcp/assignments`), `hermes_cli/profiles.py`, `hermes_cli/skills_config.py`, `hermes_cli/web_models.py` (các model Pydantic WorkProfile*/TaskSkillDiscovery).

**Ngân sách lượt: turn_budget / token governor / context meter**

Cụm lớn nhất: `agent/turn_budget.py` (mới, 657 dòng — TurnGovernor), `agent/aux_accounting.py`, `agent/auxiliary_client.py`, `agent/chat_completion_helpers.py`, `agent/codex_runtime.py`, `agent/turn_finalizer.py`, `agent/tool_executor.py`, `agent/conversation_loop.py`, `agent/agent_init.py`, `agent/iteration_budget.py` (max_turns 500→50 mặc định), `hermes_state.py` (context-state persistence, hiện chưa gọi từ nơi khác — scaffold chưa nối dây xong), `agent/context_breakdown.py`/`agent/error_classifier.py` (context meter), `cli.py`, `run_agent.py`, `gateway/*.py`, `tui_gateway/server.py` (78 chỗ nhắc 'advisor', 15 chỗ 'turn_budget'), `tools/budget_config.py` + `tools/tool_result_storage.py` (đổi ngân sách kết quả tool từ ký tự sang byte, 100K/200K → 9.5K/38K — đây là phần v32 turn-budget, gồm cả hàm `normalize_tool_result_content` chống crash khi tool trả JSON thay vì string — cân nhắc giữ riêng hàm này nếu tách plugin). Toàn bộ cụm ẩn sau `advisor.enabled=False`/TurnGovernor chưa publish ra UI, an toàn khi gỡ khỏi lõi.

**Provider plugin `claude-code` riêng của fork**

`agent/claude_code_client.py` (mới), `plugins/model-providers/claude-code/*` (mới), móc nối trong `hermes_cli/auth.py`, `hermes_cli/providers.py`, `hermes_cli/runtime_provider.py`, `hermes_cli/model_switch.py`, `agent/agent_runtime_helpers.py`, `hermes_cli/web_server.py`. Bản 2 sẽ thay bằng cầu Claude Code chuẩn của upstream — **kiểm tra kỹ trước khi gỡ**: test `test_web_oauth_dispatch.py` cho thấy fork đã sửa hành vi đăng xuất claude-code để KHÔNG xoá trực tiếp file credential (`~/.claude/.credentials.json`) mà gọi `claude auth logout` — nếu bản 2 tự viết lại cầu Claude Code, hãy giữ nguyên tắc an toàn này.

**Giao diện & vòng đời ứng dụng Desktop**

`ui-tui/src/components/branding.tsx`, `ui-tui/src/types.ts`, `hermes_cli/gui_uninstall.py`, `hermes_cli/uninstall.py` (đường dẫn packaged-app), `hermes_cli/update_cmd.py`/`subcommands/update.py` (chế độ bundled install + `--eject`), `hermes_cli/install_manifest.py`, `hermes_cli/version_info.py` (thay `hermes_cli/build_info.py` bị xoá), `hermes_cli/dump.py` (đổi sang dùng version_info), `scripts/write_install_stamp.py`, `scripts/build-bundled-desktop.mjs`, toàn bộ `scripts/windows-lifecycle-acceptance/*`, các script `validate-*-promotion*.mjs`/`*-release-evidence*.mjs`/`bundled-release-policy.mjs` (quy trình phát hành desktop đa nền tảng), `tools/interact_preview_tool.py` ("Interact with the live in-app Browser pane in Hermes Desktop"), `nix/desktop.nix`, `nix/hermes-agent.nix`, `nix/packages.nix`, `Dockerfile` (install-stamp), `website/docs/user-guide/desktop.md`, `multi-connection-desktop.md`, `desktop-plugin-sdk.md`, và các test tương ứng.

**Ngoài phạm vi 4 tính năng gốc, còn 1 mục nhỏ xếp YELLOW vì lý do khác:** `tools/tool_search.py` (+ test `test_lean_session_init.py`, `test_lean_session_profile.py`) thêm hồ sơ tool `"lean"` để ẩn bớt tool ít dùng khỏi schema gửi model — nhưng upstream 8.31 **đã có sẵn** cơ chế 'tiered disclosure' tương đương (`is_deferrable_tool_name`/`classify_tools` không tham số `profile`). Khuyến nghị dùng lại cơ chế upstream thay vì giữ lớp `profile` riêng của fork.

## Nhóm GREEN

**Rebrand/cosmetic** — Đổi tên kho, URL, homepage sang `LucDinhLe/hermes-agent-vietnamese`: `package.json`, `SECURITY.md`, `hermes_cli/uninstall.py`(một phần, đã tính YELLOW vì phần lớn nội dung là desktop uninstall — xem bảng), thông báo trong `hermes_cli/main.py`.

**Xoá/thay build_info.py** — `hermes_cli/build_info.py` bị xoá, `tests/hermes_cli/test_build_info.py` bị xoá theo — thay bằng `hermes_cli/version_info.py` (đã xếp YELLOW vì gắn với install-stamp/desktop).

**Lockfile/dependency bump** — `package-lock.json`, `uv.lock`, `website/package-lock.json`, `website/package.json` (nanoid patch), `pyproject.toml` — bump thường lệ, không mang chủ đích fork.

**Script cài đặt/nâng cấp nền tảng chung** — `scripts/install.sh`, `install.ps1`, `install.cmd`, `lib/node-bootstrap.sh`, `lib/venv-transaction.sh`, `sandbox/pick-release-tags.sh`, `stage2-run.sh`, `dev-sandbox.sh` và các test `test_install_*` — cải thiện độ bền cài đặt nói chung (không riêng cho bản Việt hoá), hợp lý để dùng bản upstream/hoặc merge riêng sau, không phải phạm vi ghim lõi lần này.

**Test không đổi hành vi lõi** — Các test còn lại khớp 1-1 với một thay đổi GREEN khác, hoặc chỉ cập nhật để chạy được theo API mới nhưng không xác nhận hành vi lõi mới nào (`test_fuzzy_match.py`, `test_threat_patterns.py`, `test_termux_api_detection.py`, `test_voice_mode.py`, v.v.).

**Xoá tệp không còn liên quan** — `contributors/emails/agent@Agents-Mac-mini.local` bị xoá — dọn dẹp danh sách contributor, không phải hành vi.

## Bảng đầy đủ 300 tệp

| Trạng thái A/M/D | Đường dẫn | Nhóm | +/− | Lý do một dòng |
|---|---|---|---|---|
| M | `.gitignore` | YELLOW | +8/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `Dockerfile` | YELLOW | +25/-23 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `SECURITY.md` | GREEN | +2/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `agent/advisor.py` | YELLOW | +355/-0 | Tính năng Advisor (giám sát/khuyên trong nền) — agent/advisor.py + móc nối trong conversation_loop/agent_init. |
| M | `agent/agent_init.py` | YELLOW | +134/-24 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/agent_runtime_helpers.py` | YELLOW | +46/-2 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `agent/anthropic_adapter.py` | YELLOW | +10/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/aux_accounting.py` | YELLOW | +161/-23 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/auxiliary_client.py` | YELLOW | +45/-4 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/bedrock_adapter.py` | YELLOW | +55/-9 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `agent/capability_router.py` | YELLOW | +592/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `agent/chat_completion_helpers.py` | YELLOW | +54/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `agent/claude_code_client.py` | YELLOW | +486/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `agent/codex_runtime.py` | YELLOW | +104/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/context_breakdown.py` | YELLOW | +66/-2 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/conversation_compression.py` | YELLOW | +6/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/conversation_loop.py` | YELLOW | +477/-13 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/copilot_acp_client.py` | YELLOW | +3/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/error_classifier.py` | YELLOW | +184/-4 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/iteration_budget.py` | YELLOW | +4/-4 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/model_metadata.py` | RED | +85/-11 | Tắt mặc định việc tự dò context window Bedrock bằng request thật (có thể vô tình được provider CHẤP NHẬN và xử lý ~1.3M token, gây tốn tiền); giờ phải bật qua HERMES_BEDROCK_LIVE_CONTEXT_PROBE=1. (Phần get_published_model_context_window đi kèm chỉ phục vụ context-meter YELLOW, không tách được theo dòng.) |
| M | `agent/native_compaction.py` | RED | +63/-1 | Hạ ngưỡng nén ngữ cảnh mặc định (200K->190K) và thêm trần fallback cục bộ (208K) để không vượt trần ngữ cảnh 272K của route Codex; thêm chế độ 'auto' cho codex_responses_native. |
| M | `agent/oneshot.py` | YELLOW | +24/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/prompt_builder.py` | YELLOW | +27/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/system_prompt.py` | YELLOW | +9/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/title_generator.py` | YELLOW | +14/-5 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/tool_executor.py` | YELLOW | +188/-39 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `agent/turn_budget.py` | YELLOW | +657/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/turn_context.py` | YELLOW | +5/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `agent/turn_finalizer.py` | YELLOW | +39/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `agent/usage_pricing.py` | RED | +106/-27 | Cập nhật bảng giá GPT-5.5/5.6 và Claude Sonnet 5, thêm hệ số nhân giá 'long-context' của OpenAI khi prompt >272K token (tránh hiển thị sai chi phí). |
| M | `cli-config.yaml.example` | RED | +41/-8 | Đổi mẫu cấu hình cho khớp ngưỡng nén mới (codex_responses_native: auto, threshold 190000) — đi cùng native_compaction.py. |
| M | `cli.py` | YELLOW | +10/-8 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| D | `contributors/emails/agent@Agents-Mac-mini.local` | GREEN | +0/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `gateway/platforms/api_server.py` | YELLOW | +4/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `gateway/run.py` | YELLOW | +36/-10 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `gateway/slash_commands.py` | YELLOW | +8/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `hermes_cli/_parser.py` | YELLOW | +1/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `hermes_cli/auth.py` | YELLOW | +46/-3 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `hermes_cli/banner.py` | GREEN | +3/-3 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| D | `hermes_cli/build_info.py` | YELLOW | +0/-51 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `hermes_cli/capability_benchmark.py` | YELLOW | +183/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| A | `hermes_cli/capability_profile.py` | YELLOW | +493/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `hermes_cli/config_defaults.py` | RED | +76/-14 | Đặt display.language mặc định = 'vi' cho bản cộng đồng (tính năng CLI tiếng Việt mặc định, không phải cosmetic); file này cũng chứa cấu hình mặc định cho advisor/turn-budget (YELLOW) không tách được theo dòng. |
| M | `hermes_cli/doctor.py` | RED | +129/-13 | Thêm chẩn đoán 'hermes doctor': phát hiện DB đang ở journal_mode=WAL dính lỗi WAL-reset bug của SQLite, đọc header file thay vì mở qua engine để không tạo -wal/-shm phụ. |
| M | `hermes_cli/dump.py` | YELLOW | +17/-40 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/gateway.py` | YELLOW | +8/-4 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/gui_uninstall.py` | YELLOW | +21/-9 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `hermes_cli/install_manifest.py` | YELLOW | +219/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/main.py` | YELLOW | +33/-2 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/mcp_startup.py` | RED | +15/-6 | Đổi mặc định 'fail-open' (lỗi đọc config -> vẫn cho phép discovery) sang 'fail-closed' (lỗi đọc config -> không tự ý spawn tiến trình/mở mạng); cũng tôn trọng cờ enabled:false trên từng MCP server. |
| M | `hermes_cli/model_switch.py` | YELLOW | +18/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `hermes_cli/observability/shared_metrics.py` | RED | +12/-7 | Khoá ghi (writer lock) trước UPSERT + xử lý SQLite busy timeout khi nhiều tiến trình cùng ghi metrics. |
| M | `hermes_cli/profiles.py` | YELLOW | +22/-0 | Gợi ý kỹ năng theo công việc /api/skills/work-profile*, /api/skills/discover + hồ sơ công việc (work_profile). |
| M | `hermes_cli/providers.py` | YELLOW | +9/-1 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `hermes_cli/runtime_provider.py` | YELLOW | +2/-2 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `hermes_cli/setup.py` | YELLOW | +7/-6 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `hermes_cli/skills_config.py` | YELLOW | +22/-1 | Gợi ý kỹ năng theo công việc /api/skills/work-profile*, /api/skills/discover + hồ sơ công việc (work_profile). |
| M | `hermes_cli/sqlite_util.py` | RED | +39/-2 | Thêm retry+jitter khi SQLite báo BUSY/locked ở ranh giới transaction (BEGIN IMMEDIATE/COMMIT); tránh crash khi nhiều tiến trình ghi đồng thời. |
| M | `hermes_cli/subcommands/update.py` | YELLOW | +25/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/tips.py` | GREEN | +2/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `hermes_cli/uninstall.py` | YELLOW | +20/-7 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/update_cmd.py` | YELLOW | +414/-19 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `hermes_cli/version_info.py` | YELLOW | +225/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `hermes_cli/web_models.py` | YELLOW | +23/-2 | Gợi ý kỹ năng theo công việc /api/skills/work-profile*, /api/skills/discover + hồ sơ công việc (work_profile). |
| M | `hermes_cli/web_routers/cron.py` | YELLOW | +6/-0 | API /api/mcp/assignments (mcp.py) và tuỳ biến tên job hiển thị cho GUI desktop (cron.py). |
| M | `hermes_cli/web_routers/mcp.py` | YELLOW | +66/-0 | API /api/mcp/assignments (mcp.py) và tuỳ biến tên job hiển thị cho GUI desktop (cron.py). |
| M | `hermes_cli/web_routers/skills.py` | YELLOW | +130/-0 | Gợi ý kỹ năng theo công việc /api/skills/work-profile*, /api/skills/discover + hồ sơ công việc (work_profile). |
| M | `hermes_cli/web_server.py` | YELLOW | +546/-94 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `hermes_constants.py` | RED | +1/-1 | Nâng target Node.js quản lý từ major 22 lên 26 (ảnh hưởng cài đặt/nâng cấp Node thật trên máy người dùng). |
| M | `hermes_state.py` | YELLOW | +279/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `hermes_state_common.py` | GREEN | +10/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `model_tools.py` | YELLOW | +122/-28 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `nix/desktop.nix` | YELLOW | +29/-1 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `nix/hermes-agent.nix` | YELLOW | +31/-13 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `nix/nixosModules.nix` | RED | +13/-6 | Nâng Node 22->26 trong provisioning apt/sentinel, khớp hermes_constants.py. |
| M | `nix/packages.nix` | YELLOW | +14/-4 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `nix/sandbox.nix` | RED | +3/-3 | Đổi gói nodejs_22 -> nodejs_26 trong sandbox Nix, khớp hermes_constants.py. |
| M | `package-lock.json` | GREEN | +186/-140 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `package.json` | GREEN | +6/-6 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `plugins/model-providers/anthropic/__init__.py` | GREEN | +1/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `plugins/model-providers/claude-code/__init__.py` | YELLOW | +21/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| A | `plugins/model-providers/claude-code/plugin.yaml` | YELLOW | +5/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `plugins/model-providers/gemini/__init__.py` | GREEN | +1/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `plugins/web/xai/provider.py` | GREEN | +7/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `pyproject.toml` | GREEN | +1/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `run_agent.py` | YELLOW | +191/-23 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `scripts/benchmark_lean_session_schema.py` | YELLOW | +118/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `scripts/benchmark_v32_1_capabilities.py` | YELLOW | +66/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `scripts/benchmark_v32_offline.py` | YELLOW | +1258/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `scripts/build-bundled-desktop.mjs` | YELLOW | +343/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/bundled-release-policy.mjs` | YELLOW | +157/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/bundled-release-policy.test.mjs` | YELLOW | +200/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/check-public-docs.mjs` | YELLOW | +72/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/check-public-docs.test.mjs` | YELLOW | +41/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/create-v321-pilot-evidence.mjs` | YELLOW | +130/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/create-v321-pilot-evidence.test.mjs` | YELLOW | +132/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `scripts/dev-sandbox.sh` | GREEN | +12/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `scripts/install.cmd` | GREEN | +4/-4 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `scripts/install.ps1` | GREEN | +481/-47 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `scripts/install.sh` | GREEN | +216/-71 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `scripts/lib/node-bootstrap.sh` | GREEN | +4/-4 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `scripts/lib/venv-transaction.sh` | GREEN | +534/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `scripts/local-candidate-derived-outputs.mjs` | YELLOW | +39/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/local-candidate-derived-outputs.test.mjs` | YELLOW | +45/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/prepare-agent-browser-native.mjs` | YELLOW | +150/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/prepare-agent-browser-native.test.mjs` | YELLOW | +55/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/release-asset-inventory.mjs` | YELLOW | +67/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `scripts/sandbox/pick-release-tags.sh` | GREEN | +61/-7 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `scripts/sandbox/stage2-run.sh` | GREEN | +16/-4 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `scripts/test_benchmark_v32_offline.py` | YELLOW | +113/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `scripts/validate-pilot-release-evidence.mjs` | YELLOW | +179/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-pilot-release-evidence.test.mjs` | YELLOW | +180/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-public-release-contract.mjs` | YELLOW | +175/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-public-release-contract.test.mjs` | YELLOW | +119/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-release-evidence.mjs` | YELLOW | +182/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-release-evidence.test.mjs` | YELLOW | +194/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-v32-promotion.mjs` | YELLOW | +302/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-v321-promotion.mjs` | YELLOW | +352/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/validate-v321-promotion.test.mjs` | YELLOW | +267/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/vietnamese-release.mjs` | YELLOW | +196/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/vietnamese-release.test.mjs` | YELLOW | +234/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/guest.ps1` | YELLOW | +880/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/host-boundary.mjs` | YELLOW | +57/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/host-boundary.test.mjs` | YELLOW | +55/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/policy.mjs` | YELLOW | +419/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/policy.test.mjs` | YELLOW | +594/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/run.mjs` | YELLOW | +561/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/tracked-snapshot.mjs` | YELLOW | +139/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/windows-lifecycle-acceptance/tracked-snapshot.test.mjs` | YELLOW | +118/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `scripts/write_install_stamp.py` | YELLOW | +275/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/agent/test_advisor.py` | YELLOW | +119/-0 | Tính năng Advisor (giám sát/khuyên trong nền) — agent/advisor.py + móc nối trong conversation_loop/agent_init. |
| A | `tests/agent/test_claude_code_client.py` | YELLOW | +231/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `tests/agent/test_codex_app_server_persist.py` | YELLOW | +6/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_context_breakdown.py` | YELLOW | +86/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_error_classifier.py` | YELLOW | +82/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/agent/test_lean_session_init.py` | YELLOW | +141/-0 | Hồ sơ tool 'lean' (ẩn bớt tool ít dùng) tự thêm trên nền tiered-disclosure đã có sẵn ở upstream 8.31 (is_deferrable_tool_name/classify_tools) — không mang lại khác biệt cốt lõi, có thể dùng lại cơ chế upstream. |
| M | `tests/agent/test_model_metadata.py` | RED | +88/-1 | Test đi kèm model_metadata.py (bedrock probe opt-in + context window). |
| M | `tests/agent/test_oneshot.py` | YELLOW | +12/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/agent/test_provider_turn_governor_gaps.py` | YELLOW | +495/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_sequential_tool_interrupt.py` | YELLOW | +30/-28 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_skip_background_review.py` | YELLOW | +29/-20 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_subagent_lifecycle.py` | YELLOW | +6/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_system_prompt_restore.py` | YELLOW | +38/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_title_generator.py` | YELLOW | +39/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/agent/test_turn_budget.py` | YELLOW | +447/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/agent/test_usage_pricing.py` | RED | +37/-0 | Test đi kèm bảng giá/hệ số long-context trong usage_pricing.py. |
| M | `tests/cli/test_cli_init.py` | GREEN | +1/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/cron/test_cleanup_timeout.py` | RED | +30/-9 | Sửa test cron teardown hay bị flake (dùng watchdog thread thay vì đo thời gian) — lộ vấn đề treo (hang) thật khi dọn dẹp agent cron. |
| M | `tests/docker/test_dump_build_sha.py` | YELLOW | +43/-40 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/gateway/test_api_server_runs.py` | YELLOW | +10/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_goal_continuation_drain.py` | YELLOW | +6/-2 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_goal_max_turns_config.py` | YELLOW | +19/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_goal_verdict_send.py` | YELLOW | +10/-7 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_loop_command.py` | YELLOW | +9/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_multiplex_lifecycle.py` | YELLOW | +37/-2 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_session_api.py` | YELLOW | +1/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_session_hygiene.py` | YELLOW | +15/-9 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_turn_lease.py` | YELLOW | +4/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/gateway/test_update_command.py` | YELLOW | +7/-6 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/gateway/test_update_streaming.py` | YELLOW | +4/-3 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| D | `tests/hermes_cli/test_build_info.py` | YELLOW | +0/-35 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/hermes_cli/test_capability_benchmark.py` | YELLOW | +135/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| A | `tests/hermes_cli/test_capability_profile.py` | YELLOW | +235/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| A | `tests/hermes_cli/test_claude_code_provider.py` | YELLOW | +54/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `tests/hermes_cli/test_cmd_update.py` | YELLOW | +11/-2 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_config_read_guard.py` | GREEN | +93/-6 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_cron_dashboard_off_loop.py` | YELLOW | +11/-2 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_desktop_repo_discovery_config.py` | YELLOW | +9/-2 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_doctor_journal_modes.py` | RED | +116/-2 | Test đi kèm chẩn đoán WAL-reset bug trong doctor.py. |
| M | `tests/hermes_cli/test_dump_git_commit.py` | YELLOW | +79/-31 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_gateway_service.py` | YELLOW | +14/-2 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_gemini_provider.py` | GREEN | +3/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_gui_uninstall.py` | YELLOW | +36/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/hermes_cli/test_install_manifest.py` | YELLOW | +207/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_mcp_startup.py` | RED | +64/-0 | Test đi kèm hành vi fail-closed của mcp_startup.py. |
| M | `tests/hermes_cli/test_model_validation.py` | GREEN | +0/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_profiles.py` | GREEN | +11/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_prompt_size.py` | YELLOW | +13/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/hermes_cli/test_setup_agent_settings.py` | GREEN | +12/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_setup_blank_slate.py` | GREEN | +1/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/hermes_cli/test_skills_config.py` | GREEN | +31/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/hermes_cli/test_sqlite_util_busy_retry.py` | RED | +61/-0 | Test đi kèm sqlite_util.py busy-retry. |
| A | `tests/hermes_cli/test_update_channel_stable.py` | YELLOW | +229/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_update_check.py` | YELLOW | +5/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/hermes_cli/test_update_eject.py` | YELLOW | +262/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_update_parked_branch_guard.py` | YELLOW | +6/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/hermes_cli/test_update_yes_flag.py` | YELLOW | +15/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/hermes_cli/test_version_info.py` | YELLOW | +189/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/hermes_cli/test_vietnamese_defaults.py` | RED | +7/-0 | Test khẳng định DEFAULT_CONFIG.display.language == 'vi'. |
| M | `tests/hermes_cli/test_web_oauth_dispatch.py` | YELLOW | +19/-6 | Test luồng OAuth cho provider claude-code (đăng xuất qua CLI thay vì xoá file credential) — gắn với plugin claude-code. |
| M | `tests/hermes_cli/test_web_server.py` | YELLOW | +84/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/hermes_cli/test_web_server_profile_unification.py` | YELLOW | +592/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/hermes_cli/test_web_server_skills_profiles.py` | YELLOW | +133/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/hermes_state/test_session_context_state.py` | YELLOW | +148/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/install/install-update-e2e.sh` | GREEN | +11/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/plugins/memory/test_hindsight_provider.py` | GREEN | +22/-3 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/plugins/platforms/photon/test_spectrum_patch.py` | GREEN | +5/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/plugins/platforms/photon/test_url_send_path.py` | GREEN | +6/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/plugins/platforms/photon/test_zombie_stream_watchdog.py` | GREEN | +3/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/run_agent/test_413_compression.py` | YELLOW | +29/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/run_agent/test_advisor_checkpoints.py` | YELLOW | +279/-0 | Tính năng Advisor (giám sát/khuyên trong nền) — agent/advisor.py + móc nối trong conversation_loop/agent_init. |
| A | `tests/run_agent/test_claude_code_abort.py` | YELLOW | +23/-0 | Plugin provider claude-code riêng của fork — bản thử nghiệm 2 sẽ thay bằng cầu Claude Code chuẩn của upstream. |
| M | `tests/run_agent/test_codex_app_server_compaction.py` | YELLOW | +35/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_codex_app_server_integration.py` | YELLOW | +24/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_compression_boundary_hook.py` | YELLOW | +22/-29 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_compression_budget_refund.py` | YELLOW | +16/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_compression_persistence.py` | YELLOW | +20/-4 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_in_place_compaction.py` | YELLOW | +9/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_moa_loop_mode.py` | YELLOW | +10/-14 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_native_compaction.py` | RED | +82/-4 | Test đi kèm ngưỡng nén mới trong native_compaction.py. |
| M | `tests/run_agent/test_plugin_context_engine_init.py` | YELLOW | +6/-2 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_post_tool_compression_attempt_cap.py` | YELLOW | +1/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_proactive_prune_loop_wiring.py` | YELLOW | +1/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_provider_parity.py` | YELLOW | +4/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_run_agent.py` | YELLOW | +36/-9 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_run_agent_codex_responses.py` | YELLOW | +21/-5 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_tool_batch_segmentation.py` | YELLOW | +9/-3 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_tool_call_guardrail_runtime.py` | YELLOW | +3/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/run_agent/test_tool_call_incremental_persistence.py` | YELLOW | +87/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/run_agent/test_turn_governor_integration.py` | YELLOW | +170/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/run_agent/test_v32_long_context_continuity.py` | YELLOW | +210/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/scripts/test_windows_footguns_full_repo_scan.py` | GREEN | +5/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/scripts/test_write_install_stamp.py` | YELLOW | +74/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/state/test_session_git_metadata_generation.py` | GREEN | +1/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_engines_satisfiable.py` | GREEN | +8/-17 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_hermes_state.py` | GREEN | +8/-4 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_e2e_release_tags.py` | YELLOW | +187/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/test_install_lockfile_churn.py` | GREEN | +1/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_install_ps1_node_path_for_npm.py` | GREEN | +5/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_ps1_node_version_behavior.py` | GREEN | +66/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_ps1_trusted_windows_python.py` | GREEN | +79/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_install_ps1_uv_install_fallback.py` | GREEN | +5/-3 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_ps1_windows_longpaths.py` | GREEN | +20/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_public_https_remote.py` | GREEN | +192/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_install_sh_node_deps_failure.py` | GREEN | +71/-6 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_install_sh_venv_transaction.py` | GREEN | +401/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_install_unmerged_index.py` | GREEN | +4/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/test_node_security_locks.py` | GREEN | +45/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/test_packaging_metadata.py` | YELLOW | +64/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/test_preview_callback_wiring.py` | YELLOW | +29/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/test_public_release_downloads.py` | YELLOW | +127/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| A | `tests/test_release_node_floor_contract.py` | RED | +96/-0 | Test hợp đồng version-floor Node mới (26) — đi cùng hermes_constants.py. |
| M | `tests/test_tui_gateway_server.py` | GREEN | +194/-5 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_budget_config.py` | YELLOW | +16/-18 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/tools/test_delegate_capability_routing.py` | YELLOW | +339/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `tests/tools/test_fuzzy_match.py` | GREEN | +22/-8 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tests/tools/test_interact_preview_tool.py` | YELLOW | +65/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tests/tools/test_interrupt.py` | YELLOW | +4/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/tools/test_lean_session_profile.py` | YELLOW | +267/-0 | Hồ sơ tool 'lean' (ẩn bớt tool ít dùng) tự thêm trên nền tiered-disclosure đã có sẵn ở upstream 8.31 (is_deferrable_tool_name/classify_tools) — không mang lại khác biệt cốt lõi, có thể dùng lại cơ chế upstream. |
| A | `tests/tools/test_mcp_capability_routing.py` | YELLOW | +250/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `tests/tools/test_refresh_agent_mcp_tools.py` | YELLOW | +21/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tools/test_search_auto_multiline.py` | GREEN | +69/-3 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_search_zero_match_and_multipath.py` | GREEN | +6/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_skills_sync.py` | GREEN | +122/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_spill_safety.py` | YELLOW | +8/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tools/test_termux_api_detection.py` | GREEN | +2/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_threat_patterns.py` | GREEN | +4/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_tool_result_storage.py` | YELLOW | +71/-4 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tools/test_transcription_tools.py` | GREEN | +7/-4 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_voice_mode.py` | GREEN | +9/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_web_providers_xai.py` | GREEN | +35/-0 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_x_search_tool.py` | GREEN | +45/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tests/tools/test_zombie_process_cleanup.py` | YELLOW | +36/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/tui_gateway/test_advisor_session_scope.py` | YELLOW | +216/-0 | Tính năng Advisor (giám sát/khuyên trong nền) — agent/advisor.py + móc nối trong conversation_loop/agent_init. |
| M | `tests/tui_gateway/test_gui_surface_toolsets.py` | YELLOW | +1/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| A | `tests/tui_gateway/test_profiles_create_credentials.py` | YELLOW | +275/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tui_gateway/test_projects_rpc.py` | YELLOW | +85/-7 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tui_gateway/test_protocol.py` | YELLOW | +53/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tests/tui_gateway/test_slash_worker_mcp_discovery.py` | YELLOW | +14/-2 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tools/budget_config.py` | YELLOW | +35/-35 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tools/delegate_tool.py` | YELLOW | +70/-0 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `tools/file_operations.py` | GREEN | +69/-12 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| A | `tools/interact_preview_tool.py` | YELLOW | +108/-0 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `tools/mcp_tool.py` | YELLOW | +52/-1 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `tools/read_preview_tool.py` | GREEN | +4/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tools/skills_sync.py` | GREEN | +13/-2 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tools/skills_tool.py` | YELLOW | +21/-2 | Hồ sơ năng lực (capability_*) + định tuyến kỹ năng/MCP theo capability_router. |
| M | `tools/tool_result_storage.py` | YELLOW | +116/-23 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tools/tool_search.py` | YELLOW | +155/-34 | Hồ sơ tool 'lean' (ẩn bớt tool ít dùng) tự thêm trên nền tiered-disclosure đã có sẵn ở upstream 8.31 (is_deferrable_tool_name/classify_tools) — không mang lại khác biệt cốt lõi, có thể dùng lại cơ chế upstream. |
| M | `tools/transcription_tools.py` | GREEN | +6/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tools/voice_mode.py` | GREEN | +19/-23 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tools/x_search_tool.py` | YELLOW | +14/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `toolsets.py` | GREEN | +1/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `tui_gateway/compute_host.py` | YELLOW | +11/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tui_gateway/methods_profiles.py` | YELLOW | +133/-15 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tui_gateway/methods_prompt.py` | YELLOW | +6/-0 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tui_gateway/methods_session.py` | YELLOW | +115/-5 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tui_gateway/methods_tools.py` | YELLOW | +1/-1 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `tui_gateway/server.py` | YELLOW | +307/-10 | Ngân sách lượt (turn_budget/TurnGovernor), aux accounting, context-meter, budget hội thoại kiểu v32 — cả cụm nên đưa về plugin. |
| M | `ui-tui/src/components/branding.tsx` | YELLOW | +3/-1 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `ui-tui/src/types.ts` | YELLOW | +6/-1 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `uv.lock` | GREEN | +13/-9 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `website/docs/developer-guide/desktop-plugin-sdk.md` | YELLOW | +2/-4 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `website/docs/user-guide/bot-mode.md` | YELLOW | +76/-98 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `website/docs/user-guide/desktop.md` | YELLOW | +14/-58 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `website/docs/user-guide/features/cron.md` | YELLOW | +1/-1 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `website/docs/user-guide/multi-connection-desktop.md` | YELLOW | +3/-3 | Bản đóng gói/cập nhật/gỡ cài đặt cho ứng dụng desktop (bundled install, eject, build-stamp, phát hành đa nền tảng) — thuộc giao diện desktop của fork. |
| M | `website/package-lock.json` | GREEN | +18/-18 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |
| M | `website/package.json` | GREEN | +1/-1 | Cosmetic/đổi tên kho, dịch/rebrand, bump lockfile, hoặc test không đổi hành vi lõi. |

Tổng: 300 tệp = G 67 + Y 212 + R 21
