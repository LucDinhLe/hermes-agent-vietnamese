# Bàn giao v32 → v32.1: định tuyến Skill, MCP và đa-agent

Ngày ghi: 2026-08-26  
Trạng thái: **source hoàn tất; local candidate đã dựng và xác minh provenance; lifecycle còn NO-GO**
Phạm vi: candidate kế tiếp sau `vi-v0.32.0-1`; không sửa hoặc thay byte v32 đã công bố.

## 1. Mục tiêu

Giữ Hermes mạnh nhưng không đưa toàn bộ Skill và MCP vào mọi lượt gọi. Hermes
cần hiểu mục tiêu công việc, đề xuất một bộ năng lực nhỏ, đóng băng bộ đó cho
từng agent/session và chỉ dùng đa-agent hoặc MCP khi lợi ích lớn hơn chi phí.

Kết quả mong muốn:

- người dùng mới nhận bộ Skill phù hợp thay vì toàn bộ thư viện;
- parent agent giữ Lean Session;
- mỗi subagent chỉ nhận Skill/MCP tối thiểu cho nhiệm vụ được giao;
- MCP không tự cài, tự đăng nhập hoặc tự mở rộng quyền;
- Token Governor tính chung parent, hidden task, subagent và tool call;
- thay đổi năng lực không phá prompt cache của phiên đang chạy.

## 2. Nguồn sự thật hiện tại

### Candidate v32 đang public

- Tag: `vi-v0.32.0-1`.
- Desktop version: `0.32.0-vi.1`.
- Candidate commit: `81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f`.
- Installer: `Hermes-Vietnamese-Windows-x64-Setup.exe`.
- Size: `341176379` byte.
- SHA-256:
  `efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac`.
- Release class: unsigned `community-prerelease`, GitHub Latest.
- Public URL:
  `https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.0-1`.

### Repository và lát cắt đang làm

- Worktree: `projects/hermes-v32`.
- Branch: `feat/v32-token-context-ux`.
- Base handoff commit: `5344db8172c07e64b6bd2f6f09166649573753d9`.
- Capability-profile checkpoint: `244ffd407` (`feat: add deterministic work
profile contract`).
- Remote push: `https://github.com/LucDinhLe/hermes-agent-vietnamese.git`.
- Hai file triển khai đã nằm trong checkpoint:
  `hermes_cli/capability_profile.py` và
  `tests/hermes_cli/test_capability_profile.py`.
- Test đỏ ban đầu bắt được việc module chưa tồn tại. Sau khi thêm contract cục
  bộ, runner chuẩn `scripts/run_tests.sh` đạt 4/4 test.
- Module hiện có local mapping, đề xuất 8–15 Skill đã cài, lưu `allowed`,
  `disabled`, `work_profile` và selection hash. Chưa nối API, UI, session router,
  subagent router hoặc MCP router.

### Baseline fresh profile cô lập

- Đã tạo `HERMES_HOME` mới hoàn toàn, không dùng profile thật.
- Bundled sync chép 82 gói Skill; Windows nhận 72 Skill hợp lệ/phù hợp và bật
  toàn bộ vì config mới chưa có `skills.disabled`.
- Skill index dài 8.797 ký tự, ước tính khoảng 2.199 token theo phép `chars / 4`.
- Fresh profile có 0 MCP server; `mcp.json` không tồn tại.
- Baseline có ba cảnh báo import provider plugin do Windows Application Control
  chặn một DLL Python trong AppData. Cảnh báo này không làm sai số đếm Skill/MCP
  và phải được giữ tách biệt khỏi feature này.
- Profile thật của chủ dự án đã được tối giản riêng thành 9 Skill bật, 66 Skill
  tắt và 0 MCP. Đây là cấu hình vận hành cá nhân, không phải bằng chứng sản phẩm
  hoặc nơi chạy test.

### Cơ chế v32 đã có và phải giữ

- Tool profile `lean|full` được chọn trước model call đầu và bất biến qua resume.
- Lean fixture giữ bốn schema model-facing: `clarify`, `tool_search`,
  `tool_describe`, `tool_call`.
- Fresh lean benchmark: 5.169 token ước tính, 0,4923% cửa sổ 1,05M; 4 schema
  active trong 59 schema được cấp quyền.
- Tool Search mặc định `auto`, listing tối đa 4.000 token và có tier
  full/names/groups để không gửi toàn bộ MCP/plugin schema.
- Raw tool output tối đa 9.500 byte mỗi result và 38.000 byte mỗi turn; phần dư
  spill sang artifact có size, SHA-256 và recovery pointer.
- Token Governor tổng hợp parent/subagent và các physical model attempt.

## 3. Quyết định chủ dự án đã đồng ý

### 3.1 Onboarding theo mục tiêu

- Không hỏi lại trong mọi lần update, repair hoặc cài đè.
- Chỉ chạy ở lần mở đầu tiên của một profile mới; luôn có lựa chọn bỏ qua.
- Hỏi nhóm công việc và 2–3 nhiệm vụ thường làm, không chỉ hỏi chức danh.
- Phân loại ban đầu chạy local bằng bảng ánh xạ cố định; không cần gửi mô tả
  công việc lên provider và không cần mạng.
- Đề xuất khoảng 8–15 Skill, giải thích ngắn lý do và cho người dùng xác nhận,
  bỏ chọn hoặc thêm Skill.
- Người dùng cũ được giữ nguyên lựa chọn; không migration nào được âm thầm tắt
  Skill của họ.
- Có mục `Thiết lập công việc` trong Settings để chạy lại khi người dùng muốn.

### 3.2 Ba tầng quyền Skill

1. **Kho được phép:** Skill người dùng cho phép Hermes sử dụng.
2. **Bộ của session:** router chọn từ kho, sau đó đóng băng trước call đầu.
3. **Bộ của subagent:** mỗi agent con chỉ nhận tập nhỏ nhất cho nhiệm vụ riêng.

Agent có thể chọn Skill từ kho đã được phép nhưng không được tự cài Skill mới.
Không bật/tắt Skill giữa các lượt của cùng một session vì sẽ phá byte-stable
system prompt và prompt cache. Thay đổi có hiệu lực ở session/agent mới.

### 3.3 Phối hợp đa-agent

- Parent giữ profile Lean và làm điều phối/tổng hợp.
- Subagent nhận mục tiêu hẹp, context tối thiểu và Skill riêng.
- Kết quả trả về parent là summary/artifact đã lọc, không dội raw output lớn.
- Câu hỏi đơn giản phải giữ một main response, không subagent và không tool-loop.
- Chỉ gọi đa-agent khi có nhánh độc lập, chuyên môn khác nhau, nhu cầu phản biện
  hoặc khối lượng đủ lớn để bù chi phí điều phối.
- Fan-out, depth, model attempt và tool call đều nằm trong root Token Governor.

### 3.4 Bốn trạng thái MCP

1. **Có trong catalog:** Hermes biết MCP tồn tại, chưa chạy.
2. **Đã cài:** thành phần có trên máy, chưa có credential/quyền.
3. **Đã kết nối:** người dùng đã đăng nhập và cấp scope cụ thể.
4. **Được giao cho agent:** một agent/session được phép dùng tool cụ thể.

Quy tắc MCP:

- Fresh profile mặc định 0 MCP active.
- Agent chỉ được chọn MCP đã được người dùng cài, kết nối và cho phép trước đó.
- Không tự cài, tự đăng nhập, tự cấp quyền hoặc tự mở rộng scope.
- Subagent không kế thừa toàn bộ MCP của parent; mặc định không kế thừa.
- Mỗi subagent chỉ nhận server/tool tối thiểu, dự kiến 1–2 MCP khi thật sự cần.
- MCP được lazy-start, có health check, timeout, retry hữu hạn và idle shutdown.
- Một MCP lỗi không được khóa composer hoặc làm hỏng toàn bộ gateway.
- Credential không vào prompt, log, evidence hoặc artifact.
- Hành động ghi, xóa, gửi, mua hoặc công khai dữ liệu vẫn cần confirmation tại
  thời điểm hành động.
- MCP mới bật chỉ có hiệu lực ở agent/session mới. Tool Search bridge giữ
  `tools[]` model-facing ổn định.

### 3.5 Dò Skill ngoài bộ hiện hành với ngân sách token tối thiểu

- Khi nhiệm vụ không khớp bộ Skill hiện hành, Hermes tự dò metadata trong toàn
  bộ kho Skill đã cài bằng mã cục bộ. Việc dò không gọi model/provider, không
  cần mạng và không được tính thành một model attempt.
- Không đưa toàn bộ catalog hoặc toàn bộ nội dung `SKILL.md` vào system prompt.
  Catalog đầy đủ nằm ngoài model context; phiên chỉ nhận mô tả của tập Skill
  nhỏ nhất cần cho nhiệm vụ.
- Skill đã nằm trong **Kho được phép** có thể được chọn tự động cho session/agent
  mới. Parent đang chạy vẫn giữ prompt byte-stable; nếu cần, parent giao nhánh
  hẹp cho subagent mới với đúng Skill đó.
- Skill đã cài nhưng chưa được người dùng cho phép chỉ được **đề xuất**. UI nêu
  tên Skill, lý do, phạm vi và ảnh hưởng dự kiến; người dùng xác nhận một lần
  trước khi Skill được thêm vào Kho được phép.
- Không bật/tắt Skill giữa các lượt của parent session. Thay đổi áp dụng cho
  session/agent mới, nhờ đó giữ prompt cache và tránh tính lại prefix lớn.
- Mục tiêu định tuyến mỗi nhiệm vụ là khoảng 3–8 Skill; starter profile lúc khai
  sinh vẫn có thể chứa 8–15 Skill được người dùng duyệt.
- Câu hỏi đơn giản dùng năng lực chung phải có 0 model call phân loại, 0
  subagent và 0 tool-loop.
- Mọi model attempt, tool call và token của subagent sau định tuyến vẫn được
  cộng vào root Token Governor và hiển thị tách parent/child.
- MCP không dùng cơ chế tự bật này. MCP luôn cần trạng thái đã cài, đã kết nối,
  đúng scope và đã được người dùng cho phép.

## 4. Điều không làm

- Không sửa artifact/tag/asset `vi-v0.32.0-1` đã công bố.
- Không thêm provider, Gemini hoặc Skill mới trong lát cắt này.
- Không auto-enable toàn bộ Skill dựa trên một câu trả lời tự do.
- Không dùng LLM/provider để hoàn thành onboarding offline.
- Không cho agent tự lấy credential hay tự chấp thuận quyền MCP.
- Không biến Capability Router thành một model call nền cho câu hỏi đơn giản.
- Không refactor core ngoài phần cần thiết cho hợp đồng routing/persistence.

## 5. Lát cắt triển khai đề xuất

### A. Fresh-profile baseline

- Tạo profile và Electron userData cô lập.
- Đo Skill active, skill-index chars/token estimate, tool schema và startup MCP.
- Phân biệt chính xác dữ liệu bundled, migrated và user-created.
- Viết regression fixture tái hiện trạng thái mặc định thực tế trước khi sửa.

### B. Capability profile contract

- Định nghĩa starter packs và schema persistence theo profile.
- Tách `allowed`, `session_selected`, `subagent_selected`.
- Hash/persist selection trước call đầu; resume phải khớp byte.
- Upgrade profile cũ giữ nguyên lựa chọn.

### C. First-run UX

- Hỏi mục tiêu/nhiệm vụ, local mapping, preview và confirmation.
- Skip, Back, retry và `Thiết lập công việc` trong Settings.
- Không lấy focus hoặc reset draft/session ngoài onboarding mới.

### D. Agent/subagent router

- Parent Lean; simple task không router LLM và không subagent.
- Dò catalog cục bộ khi allowlist hiện hành không đủ; 0 provider/network call.
- Chọn tập Skill nhỏ nhất từ allowlist, mục tiêu 3–8 Skill mỗi nhiệm vụ.
- Skill ngoài Kho được phép chỉ được đề xuất; không silent-enable.
- Child context và capability không rò sang parent/sibling.
- Aggregate Governor và telemetry hiển thị breakdown parent/child.

### E. MCP permission router

- Hiển thị rõ catalog/install/connected/assigned.
- Không configured server thì không startup/network/process.
- Exact server/tool allowlist cho từng agent.
- Lazy lifecycle, timeout, circuit breaker và action-time confirmation.

### F. Benchmark, lifecycle và candidate mới

- So sánh fresh/simple/tool-heavy/multi-agent trước và sau.
- Source, integration và UI E2E.
- Exact packaged fresh install, update v32 → candidate mới, relaunch,
  persistence, repair, uninstall và rollback trên profile cô lập.
- Chỉ build sau khi source gates xanh; candidate mới có commit/version/hash mới.

## 6. Regression/acceptance bắt buộc

- Fresh profile không cần mạng để hoàn tất onboarding hoặc chọn Skip.
- Fresh profile có 0 MCP active và không mở MCP I/O.
- User upgrade giữ nguyên Skill, MCP, draft, session và credential scope.
- Dò Skill trong catalog tạo 0 model attempt, 0 provider token và 0 network I/O.
- Catalog 72 Skill của baseline không được nhét vào mọi model call; benchmark
  phải báo exact index token của parent, session set và child set.
- Skill đã được phép có thể được chọn cho agent/session mới mà không đổi system
  prompt của parent đang chạy.
- Skill chưa được phép phải dừng ở recommendation + confirmation; config không
  được silent-mutate.
- Skill mới xuất hiện sau bundled sync mặc định ở trạng thái chưa được phép nếu
  profile đã có allowlist.
- Simple prompt: 1 main response, 0 tool, 0 subagent, 0 background review.
- Skill index của starter profile phải nhỏ hơn baseline 8.797 ký tự; báo cả số
  token thực tế/estimate, không chỉ phần trăm.
- Skill/tool profile hash giữ nguyên qua call 1, call 2 và resume.
- Child chỉ thấy Skill/MCP được giao; sibling và parent không nhận schema/content.
- Unauthorized/unconnected MCP không thể được tìm, describe hoặc call.
- Authorized MCP chỉ lộ đúng tool/scope đã cấp.
- MCP timeout/failure trả lỗi phân loại, mở khóa composer và không retry vô hạn.
- Root Governor đếm mọi attempt và tool call của parent/child.
- Raw MCP/skill output lớn vẫn spill artifact, không phình parent context.
- UI giải thích được vì sao một Skill/MCP được đề xuất và cách tắt lại.

## 7. Câu hỏi còn mở cho phiên triển khai

- Tên product-facing của starter packs và số pack tối thiểu.
- Ngưỡng deterministic để quyết định single-agent hay multi-agent.
- Mức giảm skill-index/token tối thiểu để chặn candidate. Tối thiểu bắt buộc là
  thấp hơn baseline fresh 8.797 ký tự (~2.199 token), đồng thời phải báo số đo
  exact thay vì chỉ báo phần trăm.
- MCP tool allowlist lưu ở profile, session hay capability receipt riêng.
- Candidate kế tiếp mang version `0.32.1-vi.1` hay chuyển thẳng `0.33.0-vi.1`.

Các câu hỏi này phải được chốt bằng testable contract trước khi tạo candidate;
không cần chốt để chạy baseline A.

## 8. Continuation state

Các checkpoint đã hoàn thành trên `feat/v32-token-context-ux`:

- `244ffd407`: hợp đồng work profile deterministic.
- `c3ea14789`: bundled sync fail-closed và local discovery 0 provider/network.
- `853af78fe`: manual Skill toggle giữ `skills.allowed` đồng bộ.
- `5d87c54e4`: API capability profile-scoped dùng config writer/lock hiện hữu.
- `901face97`: Desktop client/Settings/first-run work setup profile-scoped.
- `1f633dfe1`: đủ locale và gate UI cho lát cắt Desktop.
- `e02c0ae31`: marker khai sinh bền vững chỉ tại fresh default
  install và fresh named-profile create. Clone giữ config nguồn; update/repair
  và legacy profile không được backfill. Desktop chỉ nhắc khi API trả marker
  tường minh; Save/Skip xóa trạng thái pending bằng completion receipt.
- `b8b0a5c49`: nâng metadata local candidate lên v32.1 và giữ descriptor public
  v32 bất biến.
- `2baa74931`: payload install dùng đúng closure đã export, không resolve lại
  bare transitive dependency dưới hash mode.
- `5dd1b3dfa`: payload install không đọc project override làm thay exact
  pin/hash từ requirements đã export.
- Router đã nối local discovery vào session root mới và delegate child.
  Exact receipt chỉ chứa Skill đã allow, recommendation không cấp quyền, và
  mọi đường `skill_view`/`skills_list`/Tool Search/execute_code đều giữ scope.
  Receipt có hash được persist trước call đầu và restore fail-closed; prompt
  parent/call 2/resume không bị dựng lại hoặc toggle giữa phiên. Child reuse
  Root Token Governor và trả breakdown/receipt về parent.
- Benchmark capability offline đã khóa production renderer bằng profile cô lập:
  full 72 Skill = 8.797 chars/2.204 token ước tính; parent/session 6 Skill =
  2.257 chars/565 token cùng hash; child 4 Skill = 2.098 chars/525 token. Simple
  prompt dùng mock responder đạt 1 main, 0 tool/subagent/background review và
  0 live provider/network/process.
- MCP permission router đã khóa exact server/tool receipt cho root/session và
  child. Chỉ schema đã kết nối trong snapshot cục bộ mới được chọn; child chỉ
  thu hẹp parent. Receipt được persist trước prompt đầu và restore kiểm tra hash,
  prefix, duplicate, thứ tự và server component, sai thì về 0 MCP.
- Direct dispatch, Tool Search listing/search/describe/call, `execute_code`,
  late refresh/reload và delegate đều dùng cùng exact scope. Profile không có
  server enabled, chỉ có server disabled hoặc config không đọc được thì không
  tạo discovery thread/import runtime/network/process. Không có đường tự cài,
  đăng nhập, cấp quyền hoặc ghi cấu hình trong router.
- API chỉ-đọc `/api/mcp/assignments` trả exact receipt đã validate theo
  `session_id + profile`. Default/named profile dùng đúng state.db riêng kể cả
  khi trùng session ID; receipt sai mapping/hash trả trạng thái chưa gán. API
  không mở MCP I/O và không sửa config/session.
- Desktop client ghim assigned-state read theo session/profile/backend; MCP tab
  chỉ gắn nhãn assigned cho server trong receipt phiên hiện hành. Nhãn này
  không thay đổi installed/enabled/connected và không có mutation path. Copy
  đã có en/vi/ja/zh/zh-hant/ar; client test 29/29 và typecheck xanh.
- Component/integration regression đạt 1/1, gate Desktop gộp 30/30: đổi
  session sang receipt rỗng xóa nhãn, đổi profile chuyển nhãn đúng server,
  source/profile args được giữ exact và không có config mutation.

Gate gần nhất:

- Canonical Python gate hiện tại: 61/61 cho capability profile, bundled sync,
  Skill toggles và backend API; config template 56/56; named create/clone 2/2.
- Desktop marker/onboarding/profile scope: 26/26.
- Router source gate: 278/278, 1 skip trên 13 file cho local receipt, session
  init/resume, prompt cache, delegate, Tool Search, model dispatch và Governor.
- Gate tổng hợp sau benchmark: 210/210, 1 skip trên 13 file cho benchmark,
  capability profile, router/session, delegate, Tool Search và Governor.
- Desktop typecheck xanh; changed-file lint xanh; `git diff --check` xanh.
- MCP source gate: 298/298 trên 13 file khi loại một assertion case-fold biến
  môi trường Windows có sẵn ngoài lát cắt; MCP exact receipt riêng 8/8. Ruff,
  bytecode compile và `git diff --check` xanh.
- Không live probe, không provider/model call, không dùng profile thật; `.tmp/`
  vẫn được giữ nguyên. Network chỉ được dùng trong release-authorized local
  build để tải dependency/payload đã khóa; không có hành động public.

Việc còn lại:

1. Source implementation và targeted integration/UI E2E đã hoàn tất.
2. Local candidate Windows x64 đã build và exact provenance đạt tại commit
   `5dd1b3dfae33696dc98d323b9def5148a4482b1d`.
3. Lifecycle policy đã ghim candidate v32.1, exact v32 public làm previous và
   gate update v32 → v32.1; harness test đạt 22/22. Packaged lifecycle chưa
   chạy vì host không có Windows Sandbox. Không được thay bằng cài trực tiếp.

Không cần live provider probe cho các lát cắt trên. Dùng mock provider và profile
cô lập. Không sửa profile Hermes thật. Mọi build, push, staging, cài candidate
hoặc public promotion của candidate kế tiếp phải tuân theo release gate riêng.

## 9. Release handoff

```text
Decision: source complete / packaged build GO / lifecycle NO-GO
Candidate: local only — 5dd1b3dfae33696dc98d323b9def5148a4482b1d, 0.32.1-vi.1, 341260235 bytes, 2edb6072e8682e147ebee57d2c268631c3aa7a2d94479aaa53ec4052fbd03fe9
Audience allowed: source implementation, isolated tests and local artifact inspection only
Gates passed: v32 technical GO; isolated fresh baseline; fail-closed allowlist/local discovery; profile-scoped backend API; Desktop client/Settings/first-run UI; durable fresh-profile-only marker; session/subagent exact Skill and MCP receipts; prompt byte stability across call 2/resume; fail-closed receipt hash/server restore; scoped Skill/MCP direct tools/Tool Search/execute_code/refresh; shared Root Governor parent/child breakdown; exact offline full/parent/session/child capability benchmark; simple prompt 1/0/0/0 contract; MCP source gate 298/298 with one unrelated Windows assertion excluded; MCP assigned-state backend 1/1 and Desktop client/component 30/30; post-benchmark source gate 210/210 with 1 skip; earlier router source gate 278/278 with 1 skip; Python 61/61 plus template 56/56 and named-profile 2/2; earlier Desktop targeted 26/26; all three typechecks, Prettier and changed-file lint
Gates failed or missing: packaged lifecycle; Windows Sandbox unavailable
Evidence: fresh bundled sync 82 packages; 72 active relevant skills; full index 8,797 chars/8,829 bytes/2,204 Hermes-estimated tokens; parent/session 6 Skills at 2,257 chars/565 tokens with identical receipt hash; child 4 Skills at 2,098 chars/525 tokens; simple prompt produces 1 main response and 0 tool/subagent/background review with 0 live provider/network/process; 0 configured MCP means 0 discovery thread/runtime import/network/process; task routing reports 0 model/provider/network and does not mutate profile config; unallowed Skill is recommendation-only; MCP selection is exact to connected local schemas and child narrows parent; both receipts persist before first call and restore fail-closed; child attempts charge the Root Governor
Residual risks: installer execution/update/repair/uninstall/rollback remains untested for v32.1; three unrelated POSIX-path assertions fail on Windows in broader non-gate probes, one existing environment-variable case-fold assertion is excluded from the MCP source gate, and the full profile suite retains six unrelated POSIX-on-Windows failures
Rollback target: vi-v0.20.4-39
Public actions taken: none
Next smallest step: retrieve the pinned vi-v0.20.4-39 rollback byte, then run the prepared v32 → v32.1 lifecycle only on an approved Windows Sandbox or GitHub-hosted ephemeral VM; do not infer staging/public permission
```
