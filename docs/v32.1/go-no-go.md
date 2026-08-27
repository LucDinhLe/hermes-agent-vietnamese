# Hermes Vietnamese v32.1 — quyết định phát hành

Ngày khóa rà soát source: 2026-08-27

## Quyết định

**Source under verification, Release NO-GO** cho ứng viên kế nhiệm
`vi-v0.32.1-10`.

`vi-v0.32.1-2` đã dừng ở source gate trước khi build vì bài kiểm thử cũ trộn
ghi chú ứng viên với descriptor bản đang công khai. Tag và run được giữ nguyên
làm bằng chứng; không có installer `-2` nào được dựng hoặc phát hành.

`vi-v0.32.1-3` đã build/stage draft riêng tư thành công nhưng lifecycle dừng
trước khi tải installer vì parser `--slurp` không tìm thấy draft. Tag, draft,
hash và hai run được giữ bất biến làm bằng chứng; `-3` không được promotion.

`vi-v0.32.1-4` đã build/stage draft riêng tư thành công; lifecycle dừng trước
download vì token `contents: read` không được GitHub cho thấy draft. Tag/draft/
hash/run giữ bất biến; `-4` không được promotion.

`vi-v0.32.1-5` đã build/stage draft đúng byte. Lifecycle vượt fresh install,
onboarding, mock runtime và packaged relaunch, rồi dừng fail-closed ở gate
project/session vì harness dùng lại một phiên detached hợp lệ có `cwd = null`.
Evidence xác nhận session/message còn nguyên; đây là lỗi giả định của harness,
không phải mất dữ liệu sản phẩm. Tag, draft, hash và run giữ bất biến; `-5`
không được promotion.

`vi-v0.32.1-6` cũng build/stage đúng byte. Lifecycle xác nhận một bare
`Ctrl+N` vẫn tạo phiên detached hợp lệ; dữ liệu tiếp tục còn nguyên nhưng gate
dừng vì chưa vào project trước khi tạo phiên. `-6` giữ bất biến, không promotion.
Harness `-7` seed project cô lập, mở project qua UI rồi mới tạo phiên.

`vi-v0.32.1-7` build/stage đúng byte nhưng lifecycle dừng trước khi mở dự án.
Semantic button **Mở dự án** vẫn visible, enabled và stable; vùng hành động bao
quanh chặn pointer click của Playwright. Không có thao tác project/session nào
được thực thi. Evidence `9639300595` khóa nguyên nhân này là lỗi tương tác của
harness. `-7` giữ bất biến, không promotion. Harness `-8` kích hoạt chính nút
đó bằng phím `Enter` và policy cấm quay lại pointer click ở bước vào dự án.

`vi-v0.32.1-8` vượt source gate và build Windows x64 tại run `33056165931`.
Staging dừng trước download artifact và trước tạo draft vì GitHub trả
`HTTP 429` khi fetch lại immutable tag. Source/installer không phải nguyên nhân;
Latest và người dùng không đổi. `-8` giữ bất biến, không rerun. Candidate `-9`
thêm retry giới hạn 5 lần cho tag refresh nhưng vẫn bắt buộc exact commit.

`vi-v0.32.1-9` build/stage đúng byte tại run `33058450054`. Lifecycle
`33059934813` vượt fresh install, onboarding, packaged runtime/relaunch và tạo
phiên mới có project cwd cùng nội dung. Nó dừng ở disclosure **Ẩn phiên** vì
pointer click trung tâm semantic button bị metadata thời gian của hàng phiên
chặn. Evidence `9641548178` không ghi nhận mất dữ liệu. `-9` giữ bất biến;
candidate `-10` kích hoạt chính semantic button bằng `Enter` và policy khóa cả
hai thao tác Ẩn/Hiển thị.

Phần khắc phục yếu điểm v32 và cổng chống mất/ẩn phiên đã hoàn tất trong source.
Candidate cuối `-10` chưa tag/build/stage hoặc thay GitHub Latest vì chưa có
exact lifecycle receipt.

## Source candidate

| Thuộc tính                | Giá trị                                    |
| ------------------------- | ------------------------------------------ |
| Branch                    | `integration/v32.1-project-session-safety` |
| Source hardening commit   | Chờ freeze exact candidate `-10`           |
| Tag dự kiến               | `vi-v0.32.1-10`                            |
| Desktop version dự kiến   | `0.32.1-vi.10`                             |
| Release class             | `community-prerelease`                     |
| Phạm vi nghiệm thu/public | Windows 10/11 x64                          |

Commit trên là controller source đã kiểm thử, chưa phải exact candidate commit
cuối cùng nếu hồ sơ/descriptor còn cần một commit bổ sung trước khi tag.

## Gate đã đạt

- Hợp nhất UI adaptive capabilities và hotfix project/session trên cùng nhánh.
- Ẩn/Xóa Dự án chỉ tác động `projects.db`; regression source bảo vệ
  `state.db`, session rows và message rows.
- Project scope không tồn tại qua relaunch; có lối **Tất cả dự án**; dự án đang
  mở giữ hàng Dự án và nút xổ xuống hiển thị đủ cây phiên.
- Repo scan, auto archive và auto prune tắt mặc định.
- Exact lifecycle harness thêm gate `projectSessionSafety`: hash nội dung và số
  hàng trước/sau Ẩn/Xóa, relaunch, tìm và tiếp tục phiên.
- `vi-v0.32.1-10` chỉ dựng Windows x64; Authenticode được ghi rõ `NotSigned`,
  không có signer certificate và không được quảng cáo stable/final.
- Promotion riêng kiểm tag/commit/size/SHA-256, private draft, staging run,
  lifecycle run, evidence seal và tự rollback về v32 nếu hậu kiểm lỗi.
- Gate hiện tại: policy 18/18; release/metadata 38/38; promotion validator 3/3;
  workflow contract 17/17; typecheck, lint 0 error, Prettier, YAML, PowerShell và
  diff check đều đạt.

## Gate còn thiếu

1. Commit/push exact source branch và tạo tag bất biến `vi-v0.32.1-10`.
2. Một lượt build duy nhất của Windows x64 từ exact tag.
3. Ghi size/SHA-256, xác minh trạng thái `NotSigned` và private draft đúng byte.
4. Exact lifecycle trên GitHub-hosted Windows VM dùng một lần, gồm update
   v32→v32.1, project/session safety, repair, uninstall và rollback vi39.
5. Controller commit cập nhật `.github/public-release.json` bằng exact
   size/hash; promotion chỉ chạy sau khi mọi receipt đạt. Chủ dự án đã cho phép
   hành động public ngày 2026-08-27.

## Dữ liệu và an toàn người dùng

- Không cài candidate lên profile Hermes thật.
- Không sửa, di chuyển hay dọn `%LOCALAPPDATA%\hermes` của Đại ca.
- Không tải phiên, dự án hoặc bản sao lưu lên cloud Hermes.
- Mọi nghiệm thu ghi dữ liệu chỉ chạy trong profile/máy ảo dùng một lần.

## Rủi ro còn lại

1. Installer chưa ký có thể bị SmartScreen hoặc Smart App Control cảnh báo/chặn;
   người dùng phải được báo rõ và không được hướng dẫn tắt bảo vệ toàn máy.
2. Candidate `-5` và `-6` chứng minh phiên detached vẫn còn nguyên. Candidate
   `-7` dừng trước thao tác mở dự án vì pointer interception. Candidate `-10`
   phải tạo phiên project-addressable qua UI và vượt toàn bộ chuỗi trước khi
   tuyên bố installer cuối cùng đạt.
3. GitHub Actions từng trả lỗi dịch vụ 429/500/502; mọi retry phải kiểm trước để
   không tạo run trùng hoặc vô tình build lại cùng candidate.
4. v32 public hiện vẫn unsigned; giữ nguyên làm previous/rollback publication
   cho tới khi v32.1 vượt đủ gate.

## Rollback

- Nếu promotion v32.1 hậu kiểm lỗi: trả `vi-v0.32.1-10` về draft/prerelease và
  khôi phục `vi-v0.32.0-1` làm GitHub Latest.
- Rollback cài đặt đã khóa cho lifecycle: `vi-v0.20.4-39`, commit
  `d270974d2651e72f169fffe34c955eeae7977458`, SHA-256
  `e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31`.

## Hành động public

Đã push/tag candidate bất biến `-2` đến `-8`; draft riêng tư đạt tới `-7`.
Không candidate nào được công bố và GitHub Latest vẫn là `vi-v0.32.0-1`.
Staging/lifecycle `-6` là run `33051008029` / `33052037180`; evidence artifact
`9638286238`. Staging/lifecycle `-7` là `33053462058` / `33054540916`;
evidence artifact `9639300595`.

Build/staging `-8` là run `33056165931`; staging dừng do GitHub `HTTP 429`
trước khi tạo draft. Build/staging `-9` là `33058450054`; lifecycle `33059934813`
và evidence `9641548178`.

## Bước nhỏ nhất tiếp theo

Freeze exact tag `vi-v0.32.1-10`, build đúng một lần, chạy lifecycle và chỉ
promotion khi mọi receipt đều xanh.
