# Bàn giao v32 → v32.1: định tuyến Skill, MCP và đa-agent

Ngày ghi: 2026-08-26  
Trạng thái: **quyết định sản phẩm đã được chủ dự án đồng ý; chưa triển khai**  
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

### Repository tại thời điểm ghi log

- Worktree: `projects/hermes-v32`.
- Branch: `feat/v32-token-context-ux`.
- HEAD: `89bec778af35e694622835498b6d458e445166e9`.
- Remote push: `https://github.com/LucDinhLe/hermes-agent-vietnamese.git`.
- Worktree sạch trước khi thêm log này.

### Audit hồ sơ đang dùng trên máy chủ dự án

- `skills.disabled: []`.
- Có 83 `SKILL.md` trong hồ sơ đang hoạt động.
- Runtime đóng gói có 77 Skill bundled và 115 Skill optional.
- Danh mục Skill thực tế do `build_skills_system_prompt()` tạo dài 8.924 ký
  tự, ước tính khoảng 2.231 token theo phép `chars / 4`.
- Tổng nội dung của 83 `SKILL.md` là 893.041 byte; nội dung này **không** được
  nạp toàn bộ mặc định, chỉ nạp theo nhu cầu qua `skill_view`.
- `mcp_servers` không có trong `config.yaml`: 0 MCP được cấu hình.
- Có 0 user plugin và 0 desktop plugin trong hồ sơ này.

Giới hạn bằng chứng: đây là hồ sơ thật đã nâng cấp từ v31 lên v32. Nó chứng minh
trạng thái hiện tại của máy chủ dự án, nhưng chưa chứng minh fresh install v32
luôn kích hoạt đúng 83 Skill. Phiên sau phải đo lại trên profile hoàn toàn mới
trước khi gọi đây là lỗi mặc định của installer/onboarding.

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
- Chọn tập Skill nhỏ nhất từ allowlist.
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
- Simple prompt: 1 main response, 0 tool, 0 subagent, 0 background review.
- Skill index của starter profile phải nhỏ hơn baseline 8.924 ký tự; báo cả số
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
- Mức giảm skill-index/token tối thiểu để chặn candidate.
- MCP tool allowlist lưu ở profile, session hay capability receipt riêng.
- Candidate kế tiếp mang version `0.32.1-vi.1` hay chuyển thẳng `0.33.0-vi.1`.

Các câu hỏi này phải được chốt bằng testable contract trước khi tạo candidate;
không cần chốt để chạy baseline A.

## 8. Continuation state

Phiên tiếp theo bắt đầu tại lát cắt **A. Fresh-profile baseline**:

1. Đọc file này, `docs/v32/go-no-go.md`, ba decision log v32 và rulebook.
2. Xác minh worktree/branch/HEAD/remote, bảo toàn mọi thay đổi chưa commit.
3. Tạo profile cô lập; tuyệt đối không dùng hoặc sửa profile thật.
4. Đo fresh default Skill/MCP/tool surface và lưu JSON evidence không chứa
   credential hoặc dữ liệu người dùng.
5. Viết regression test đỏ cho hành vi mặc định cần đổi.
6. Chưa sửa UI/router trước khi baseline phân biệt bundled với migration.

Không cần live provider probe cho lát cắt A. Dùng mock provider khi cần model
path. Mọi build, push, staging, cài lên profile thật hoặc public promotion của
candidate kế tiếp phải tuân theo quyền và release gate riêng.

## 9. Release handoff

```text
Decision: design approved / implementation not started
Candidate: none for v32.1; immutable public base is 81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f, 0.32.0-vi.1, 341176379 bytes, efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac
Audience allowed: documentation/isolated baseline only
Gates passed: v32 technical GO; current-profile Skill/MCP audit recorded
Gates failed or missing: fresh-profile baseline, implementation, regression, benchmark, packaged lifecycle
Evidence: 83 active profile skills; 8,924-char skill index (~2,231 token estimate); 0 configured MCP; 0 user plugins
Residual risks: upgraded profile may not represent fresh defaults; dynamic capability changes can break prompt cache; MCP permissions and multi-agent fan-out need fail-closed contracts
Rollback target: vi-v0.20.4-39
Public actions taken: none
Next smallest step: isolated fresh-profile baseline and failing regression fixture
```
