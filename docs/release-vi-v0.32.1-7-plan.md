# Kế hoạch candidate `vi-v0.32.1-7`

Ngày chốt phạm vi: 2026-08-26
Trạng thái lịch sử: candidate đã build/stage xanh tại run `33053462058` nhưng
lifecycle `33054540916` dừng trước thao tác mở dự án do action row chặn pointer
click. Không có thao tác project/session nào được thực thi. Candidate giữ bất
biến, không promotion; kế hoạch hiện hành chuyển sang
`docs/release-vi-v0.32.1-8-plan.md`. GitHub Latest chưa đổi.

Ứng viên `vi-v0.32.1-2` đã dừng ở source gate trước build do một regression cũ
trộn candidate notes với public descriptor. Tag/run `-2` được giữ bất biến làm
bằng chứng. Ứng viên `vi-v0.32.1-3` đã build và stage draft riêng tư nhưng
lifecycle không tìm thấy draft do một lớp mảng thừa từ `--slurp`; tag/draft/run
được giữ bất biến và không promotion. `vi-v0.32.1-4` cũng build/stage thành
công nhưng token lifecycle chỉ có `contents: read`, nên GitHub ẩn draft và job
dừng trước download. `vi-v0.32.1-5` đã build/stage đúng byte; lifecycle vượt
fresh install, onboarding và packaged relaunch rồi dừng ở project/session vì
harness tái dùng một phiên rời hợp lệ có `cwd = null`. Dữ liệu phiên vẫn còn
nguyên; promotion dừng đúng thiết kế. `-5` giữ bất biến và kế hoạch chuyển sang
`-6` với thao tác mở phiên mới qua UI trước gate dự án. Candidate `-6` tiếp tục
chứng minh một bare `Ctrl+N` vẫn tạo phiên detached hợp lệ. Evidence không mất
dữ liệu, nhưng gate cần vào dự án qua UI trước khi tạo phiên; `-6` giữ bất biến
và kế hoạch chuyển sang `-7`.

## Mục tiêu

Candidate này hợp nhất hai lát cắt đã tách từ exact public v32
`vi-v0.32.0-1`:

1. v32.1 adaptive capabilities: onboarding theo mục tiêu, allowlist Skill,
   receipt Skill/MCP theo session/agent, fail-closed restore, Root Token
   Governor và assigned-state UI;
2. hotfix an toàn phiên/dự án: project scope không tồn tại qua relaunch, repo
   discovery mặc định tắt, Ẩn/Xóa dự án không ẩn/archive/xóa phiên, sidebar
   luôn có lối về toàn bộ phiên và hiển thị đầy đủ cây phiên của dự án.

Local candidate `vi-v0.32.1-1` tại commit `5dd1b3dfa` được giữ làm bằng chứng
đóng gói cũ nhưng bị supersede cho mục tiêu phát hành vì chưa chứa hotfix
phiên/dự án. Không rebuild, đổi tag hoặc thay byte candidate đó.

## Danh tính candidate kế nhiệm

- Tag dự kiến: `vi-v0.32.1-7`.
- Desktop version: `0.32.1-vi.7`.
- Release class trước promotion: `community-prerelease`.
- Exact source commit, kích thước và SHA-256 chỉ được ghi sau clean source gate
  và một lượt build duy nhất.
- Public descriptor v32 và `vi-v0.32.0-1` giữ bất biến cho tới promotion riêng.

## Ranh giới tích hợp

- Nhánh tích hợp xuất phát từ `d385de1bf` trên
  `feat/v32-token-context-ux`.
- Chỉ đưa bốn commit chức năng phiên/dự án vào v32.1.
- Không cherry-pick `6ff911685` vì v32.1 đã có hai successor fix
  `2baa74931` và `5dd1b3dfa` cho exact payload closure và isolation khỏi uv
  overrides.
- Worktree v32.1 gốc và `.tmp/` của chủ dự án không bị sửa.
- Không cài candidate lên profile Hermes thật và không tắt Smart App Control.

## Source gate bắt buộc

- Toàn bộ UI suite và targeted giao điểm sidebar/project/Settings/MCP.
- Ba lớp Desktop typecheck, changed-file ESLint, Prettier và
  `git diff --check`.
- Toàn bộ Python test thay đổi từ v32 cho capability profile, Skill/MCP router,
  session restore, delegate, refresh, profile/config/API và project RPC.
- Payload staging policy và Windows lifecycle policy tests.
- Regression chứng minh project lifecycle không thay `hidden`, `archived` hay
  xóa session/message.

## Exact artifact và lifecycle gate

Sau khi source commit sạch được freeze:

1. build đúng một lần Windows x64 với tag `vi-v0.32.1-7`;
2. kiểm exact embedded provenance, PE x64, schema manifest, update feed và
   SHA-256;
3. ghi nhận trung thực Authenticode `NotSigned`, không có signer certificate và
   cảnh báo Windows có thể hiện Publisher Unknown/SmartScreen;
4. chạy trên Windows guest cô lập: fresh install, offline onboarding, relaunch,
   persistence, update exact public v32 → v32.1, repair, hai chế độ uninstall,
   rollback `vi-v0.20.4-39` và no-residual-process;
5. thêm kiểm thử project/session trên exact installer: tạo/mở/thu gọn dự án,
   ẩn/xóa metadata dự án, relaunch và xác nhận toàn bộ session/message vẫn còn
   và có thể quay về **Tất cả dự án**.

Không dùng cài trực tiếp trên workstation thay cho guest lifecycle.

### Cơ chế fail-closed đã khóa trong source

- `vi-v0.32.1-7` chỉ tạo matrix Windows x64; không dựng thêm artifact chưa được
  nghiệm thu rồi vô tình đưa chúng vào public release.
- Windows x64 giữ lớp `community-prerelease` chưa ký theo quyết định của chủ dự
  án ngày 2026-08-27; signing receipt phải ghi `NotSigned` và không có signer.
- Runtime smoke có lane riêng cho exact tag/commit/hash, exact public v32 làm
  nguồn update và exact `vi-v0.20.4-39` làm rollback.
- Lane project/session đọc `state.db` trong profile guest cô lập, ghi digest và
  số hàng trước/sau Ẩn/Xóa Dự án, relaunch rồi tìm và mở lại đúng phiên.
- Promotion v32.1 dùng validator riêng, kiểm private draft và toàn bộ receipt;
  hậu kiểm lỗi phải đưa v32.1 về draft và khôi phục v32 làm Latest.

## Promotion Latest

Chỉ sau khi mọi gate trên đạt, promotion riêng mới được:

- public đúng tag và đúng byte candidate đã nghiệm thu;
- cập nhật descriptor/download/Latest sang `vi-v0.32.1-7`;
- kiểm lại asset size, digest, trạng thái `NotSigned`, updater manifest và
  public links;
- giữ `vi-v0.32.0-1` làm previous update source và
  `vi-v0.20.4-39` làm rollback target.

Nếu exact lifecycle chưa đạt, quyết định vẫn là **NO-GO Latest**. Việc bỏ
SignPath không được phép bỏ qua hash, provenance, cảnh báo chưa ký, an toàn dữ
liệu hoặc rollback.

## Trạng thái gate ngày 2026-08-27

- Source/UI/Python integration: đạt theo lượt gate hợp nhất ngày 2026-08-26.
- Typecheck Desktop ba cấu hình: đạt.
- Release/lifecycle policy: 18/18 đạt.
- Release validators và product metadata: 38/38 đạt.
- Promotion validator v32.1: 3/3 đạt; tamper và session-hidden đều bị chặn.
- Workflow contract: 16/16 đạt; YAML và PowerShell parse đạt; Prettier và
  `git diff --check` đạt; Desktop lint 0 error.
- Candidate `-5` staging run `33047979498` đạt; installer 340.619.304 byte,
  SHA-256 `22639f293af973f39f81920fd77621cbf93b6d565b39e7b63b46c90b36fd2728`,
  Authenticode `NotSigned`.
- Lifecycle `-5` run `33049189121` vượt tám gate đầu rồi fail-closed ở
  `projectSessionSafety`; evidence artifact `9637160151` chứng minh phiên và
  nội dung còn nguyên nhưng phiên thử là detached `cwd = null`.
- Candidate `-6` staging run `33051008029` đạt; installer 340.620.386 byte,
  SHA-256 `adc49649f80db203c34787b19fd65a2a8c1bb67896dc47f55118f27aecd41e86`,
  Authenticode `NotSigned`.
- Lifecycle `-6` run `33052037180` lại dừng ở `projectSessionSafety`; evidence
  artifact `9638286238` xác nhận bare `Ctrl+N` vẫn detached và toàn bộ dữ liệu
  còn nguyên. Harness `-7` vào project bằng UI trước khi tạo phiên.
- Exact unsigned installer/lifecycle `-7`: chưa chạy; chờ freeze/push exact tag.
- GitHub staging/tag/promotion: tài khoản `LucDinhLe` đã xác thực; chủ dự án đã
  cho phép public khi toàn bộ receipt của `vi-v0.32.1-7` xanh.
