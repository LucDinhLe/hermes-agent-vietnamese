# Hermes Vietnamese v32.1 — quyết định phát hành

Ngày khóa rà soát source: 2026-08-27

## Quyết định

**Technical GO cho promotion community pilot Windows 10/11 x64** của
`vi-v0.32.1-17`. Exact installer đã vượt đủ 20 gate của full lifecycle; không
được gọi là stable/final vì Authenticode vẫn `NotSigned` và chưa có bằng chứng
riêng cho nền tảng khác.

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

`vi-v0.32.1-10` build/stage đúng byte tại run `33061824984`: 340.628.197 byte,
SHA-256 `9dd1077699f64702b387de405c5cc097b0a7c9f9b1d0b7645c7d4eff24d6e14f`,
Authenticode `NotSigned`. Lifecycle `33063041821` dừng trước khi seed project:
harness mở Hermes rồi ghi fixture vào `projects.db`, trùng lúc project store
đang giữ khóa và trả `database is locked`. Screenshot xác nhận UI trống trước
fixture; không có thao tác xóa/ẩn hay dấu hiệu mất dữ liệu. Evidence artifact
`9642809205`, digest
`4b54db37d614023d32630edb16be79563450bc38483cc41ad31182fce3817bf5`.
`-10` giữ bất biến; candidate `-11` seed fixture trước khi Hermes mở database và
policy khóa thứ tự này.

`vi-v0.32.1-11` build/stage đúng byte tại run `33064470869`: 340.630.734 byte,
SHA-256 `7e98e7254b9596c6e21d64973cdc3a76d27aca42c56dcfea92eccf28fc7cc416`,
Authenticode `NotSigned`. Lifecycle `33065542015` vượt điểm khóa database, tạo
project-addressable session và hiển thị cả prompt lẫn mock reply. Nó dừng khi
harness đọc `state.db` ngay sau UI completion: reply thứ hai chưa flush nên đếm
1 thay vì 2. Screenshot xác nhận đủ hai tin nhắn; không có dấu hiệu mất dữ liệu.
Evidence artifact `9643842344`, digest
`c321ce027d2f0dc625890891d982f89a9332d97777ad754d799a4a0b2c039266`.
`-11` giữ bất biến; candidate `-12` chờ database xác nhận đủ hai message trước
khi chụp safety snapshot, không hạ gate nội dung.

`vi-v0.32.1-12` build/stage đúng byte tại run `33066987915`: 340.633.138 byte,
SHA-256 `91bfc8dc1f398ccf2d205a9c284493a492b1d5d9ef77eb6391e85e76d1923891`,
Authenticode `NotSigned`. Lifecycle `33068095243` xác nhận session đúng project
có đủ prompt/reply trong UI và `state.db`, rồi dừng khi pointer click **Tất cả
dự án** bị semantic button của hàng dự án con chặn. Evidence artifact
`9645067367`, digest
`3ac5cf6512ba9f62be15fe299fcdbf6aa8035f8ae2d629b8947120d87e71b407`.
Không có bằng chứng mất hoặc ẩn dữ liệu. `-12` giữ bất biến; candidate `-13`
kích hoạt đúng nút bằng `Enter` và policy cấm pointer click tại bước này.

Tag `vi-v0.32.1-13` đã push tại exact commit
`d0ec7ea78b1af756b00fb0f50ac8afad83415504`. Pre-dispatch phát hiện workflow
build và lifecycle còn khóa lane v32.1 theo tag `-12`; nếu dispatch sẽ mở sai
ma trận sáu nền tảng và bỏ lane lifecycle bắt buộc. `-13` dừng trước run/build/
draft, giữ bất biến và không promotion. Candidate `-14` đồng bộ exact tag trong
cả workflow cùng contract test.

`vi-v0.32.1-14` build/stage đúng byte tại run `33071025403`: 340.636.957 byte,
SHA-256 `16dfd43d512a6d79744f482306f2596d9183240d9b6f78e9d25a09c0b855d345`,
Authenticode `NotSigned`. Lifecycle `33072409835` vượt các gate trước và trở về
**Tất cả dự án**; UI hiển thị đủ hai dự án cùng session có nội dung. Helper mở
trang Dự án sau đó khớp hai nút cùng accessible name nên strict mode dừng.
Không có bằng chứng mất hoặc ẩn dữ liệu. Evidence artifact `9646753190`, digest
`e4b13a277d2176bafb5b2eb6ab2f0cc67f0fc17bd8dcf453fa865a7ca5ef2e5d`.
`-14` giữ bất biến; candidate `-15` khóa exact nút điều hướng sidebar và dùng
`Enter`. Promotion cũng được sửa từ tag cũ `-9` sang exact `-15` ở cả hai pha.

`vi-v0.32.1-15` build/stage đúng byte tại run `33074177455`: 340.639.925 byte,
SHA-256 `fd33557ba32f92455ce11eeb8082be9c1788ca2564621be09ecaadb804d41a54`,
Authenticode `NotSigned`. Lifecycle `33075652568` vượt helper điều hướng Dự án
và **Tất cả dự án**, rồi dừng khi pointer click **Ẩn khỏi danh sách dự án** bị
action container của card chặn. Evidence artifact `9648140826`, digest
`e366e082be5442eb12b310367fd51217ffee705cfe525274f04386ea6937524f`.
Không có bằng chứng mất hoặc ẩn session/message. `-15` giữ bất biến; candidate
`-16` dùng `Enter` cho cả Ẩn, Xóa trên card và xác nhận Xóa trong dialog.

`vi-v0.32.1-16` build/stage đúng byte tại run `33077676475`: 340.642.164 byte,
SHA-256 `b84e3fe29a07cace57b244036d11a1e2907764e8325b0be2e830928add32568d`,
Authenticode `NotSigned`. Lifecycle `33079425120` vượt cài mới, onboarding,
runtime đóng gói và relaunch. Sau Ẩn/Xóa metadata dự án, session vẫn hiện trong
sidebar; harness dừng khi click vào `span` tiêu đề phiên bị container danh sách
chặn pointer event. Không có bằng chứng mất hoặc ẩn dữ liệu. Evidence artifact
`9649684608`, digest
`c077cf63287a7163e118b0bd1733990c3dd5c40def393cc37a95c4efb95f2df1`.
`-16` giữ bất biến; candidate `-17` khóa semantic button của hàng phiên, xác
minh accessible name và dùng `Enter`.

`vi-v0.32.1-17` build/stage đúng byte tại run `33082890636`: 340.644.403 byte,
SHA-256 `7e3e5870228254fec634140391fe01042e50f1b483d9d53ff171636837d65884`,
Authenticode `NotSigned`. Lifecycle `33084347847` vượt toàn bộ
`projectSessionSafety`: còn đúng 1 session, 2 message, digest nội dung không
đổi, `sessionHidden=0`, `sessionArchived=0` sau Ẩn/Xóa dự án và relaunch. Run
dừng sau đó vì guest gọi `seed-v32` nhưng spec chưa khai báo; action rollback
`seed-v321-rollback` cũng bị khai báo sai tên. Evidence artifact `9652148218`,
digest `9c1df73290279fda671e6676f93c7759d4291f00f56ebe08793a889eb63c82cd`.
Đây là lỗi hợp đồng harness, không phải lỗi sản phẩm hay mất dữ liệu.

Candidate `-17` được giữ nguyên. Controller nghiệm thu được sửa ở commit riêng;
receipt mới khóa cả candidate commit bất biến và `harnessCommit` của run. Không
tạo `-18` khi installer không đổi byte.

Controller `598830c2d1d96774f800d28c067dbeade7b9d2fa` chạy lifecycle lần hai
`33087597148`. Fresh install, onboarding và packaged runtime/relaunch đạt. Run
dừng trong `projectSessionSafety` khi harness đọc `projects.db` song song với
transaction của Hermes và nhận `database is locked`. Screenshot cho thấy dự án
Ẩn đã rời danh sách, dự án còn lại cùng session vẫn hiển thị. Evidence artifact
`9653267598`, digest
`9e37c79770f5637a3fe08bbe597c6ba9a603cd0626818002833f2278171f448b`.
Đây tiếp tục là lỗi đồng bộ đọc của harness. Controller kế tiếp chỉ retry lỗi
SQLite `BUSY/LOCKED` trong `expect.poll`; điều kiện pass dữ liệu không đổi.

Controller `42082bb0681ff05d7785f5beda05a50a8bd5365b` chạy lifecycle lần ba
`33089128551` trên đúng candidate commit/size/SHA-256 và đạt toàn bộ 20 gate
sau `40m48s`. Project/session receipt xác nhận 1 session, 2 message, digest
`daec8ddacea0b18aac663ff4ebb4ccf492c1de3fb43b6c3f1c263db8e0a1390e`,
`sessionHidden=0`, `sessionArchived=0`; Ẩn/Xóa metadata Dự án không làm đổi nội
dung phiên và relaunch trở về `all-projects`. Evidence artifact `9655062453`,
digest `19ff0428d3bdebad2643bbe854138b171932d8d80cd7d98b5d02792dbb82bfa8`;
receipt seal
`435a8c34d0913ca120014f95e9797b50ad7f0f5c80f8ae4f93bf50e04af00238`.

## Source candidate

| Thuộc tính                | Giá trị                                    |
| ------------------------- | ------------------------------------------ |
| Branch                    | `integration/v32.1-project-session-safety` |
| Candidate commit          | `a6833c9400adf640c01a258f354cf96551550c75` |
| Tag bất biến              | `vi-v0.32.1-17`                            |
| Desktop version           | `0.32.1-vi.17`                             |
| Release class             | `community-prerelease`                     |
| Phạm vi nghiệm thu/public | Windows 10/11 x64                          |

Controller lifecycle có commit riêng và không làm thay đổi tag, provenance,
size hoặc SHA-256 của candidate trên.

## Gate đã đạt

- Hợp nhất UI adaptive capabilities và hotfix project/session trên cùng nhánh.
- Ẩn/Xóa Dự án chỉ tác động `projects.db`; regression source bảo vệ
  `state.db`, session rows và message rows.
- Project scope không tồn tại qua relaunch; có lối **Tất cả dự án**; dự án đang
  mở giữ hàng Dự án và nút xổ xuống hiển thị đủ cây phiên.
- Repo scan, auto archive và auto prune tắt mặc định.
- Exact lifecycle harness thêm gate `projectSessionSafety`: hash nội dung và số
  hàng trước/sau Ẩn/Xóa, relaunch, tìm và tiếp tục phiên.
- `vi-v0.32.1-17` chỉ dựng Windows x64; Authenticode được ghi rõ `NotSigned`,
  không có signer certificate và không được quảng cáo stable/final.
- Promotion riêng kiểm tag/commit/size/SHA-256, private draft, staging run,
  lifecycle run, evidence seal và tự rollback về v32 nếu hậu kiểm lỗi.
- Regression mới đối chiếu toàn bộ action guest/spec. Local controller gates:
  release/lifecycle Node 66/66; Desktop script Vitest 149 pass, 1 skip; Desktop
  script Node 17/17; Python release 27/27; ba lớp typecheck, ESLint, Prettier,
  YAML và diff check đều đạt.

## Gate còn thiếu

1. Không còn gate kỹ thuật nào thiếu cho community pilot Windows x64.
2. Còn promotion fail-closed và hậu kiểm GitHub công khai bằng exact descriptor,
   release notes, tag, asset inventory, size, digest và Latest.
3. Stable/final vẫn bị chặn bởi chữ ký số và bằng chứng các nền tảng còn lại.

## Dữ liệu và an toàn người dùng

- Không cài candidate lên profile Hermes thật.
- Không sửa, di chuyển hay dọn `%LOCALAPPDATA%\hermes` của Đại ca.
- Không tải phiên, dự án hoặc bản sao lưu lên cloud Hermes.
- Mọi nghiệm thu ghi dữ liệu chỉ chạy trong profile/máy ảo dùng một lần.

## Rủi ro còn lại

1. Installer chưa ký có thể bị SmartScreen hoặc Smart App Control cảnh báo/chặn;
   người dùng phải được báo rõ và không được hướng dẫn tắt bảo vệ toàn máy.
2. Nghiệm thu dùng máy ảo GitHub một lần và mock provider, chưa thay thế smoke
   trên mọi cấu hình máy người dùng thực tế.
3. GitHub Actions từng trả lỗi dịch vụ 429/500/502; mọi retry phải kiểm trước để
   không tạo run trùng hoặc vô tình build lại cùng candidate.
4. V32 public giữ vai trò previous/rollback publication nếu hậu kiểm v32.1 lỗi.

## Rollback

- Nếu promotion v32.1 hậu kiểm lỗi: trả `vi-v0.32.1-17` về draft/prerelease và
  khôi phục `vi-v0.32.0-1` làm GitHub Latest.
- Rollback cài đặt đã khóa cho lifecycle: `vi-v0.20.4-39`, commit
  `d270974d2651e72f169fffe34c955eeae7977458`, SHA-256
  `e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31`.

## Hành động public

Đã push/tag candidate bất biến `-2` đến `-17`; draft riêng tư đạt tới `-17`.
Không candidate nào được công bố và GitHub Latest vẫn là `vi-v0.32.0-1`.
Staging/lifecycle `-6` là run `33051008029` / `33052037180`; evidence artifact
`9638286238`. Staging/lifecycle `-7` là `33053462058` / `33054540916`;
evidence artifact `9639300595`.

Build/staging `-8` là run `33056165931`; staging dừng do GitHub `HTTP 429`
trước khi tạo draft. Build/staging `-9` là `33058450054`; lifecycle `33059934813`
và evidence `9641548178`.

Build/staging `-10` là `33061824984`; lifecycle `33063041821`; evidence artifact
`9642809205`, digest
`4b54db37d614023d32630edb16be79563450bc38483cc41ad31182fce3817bf5`.

Build/staging `-11` là `33064470869`; lifecycle `33065542015`; evidence artifact
`9643842344`, digest
`c321ce027d2f0dc625890891d982f89a9332d97777ad754d799a4a0b2c039266`.

Build/staging `-12` là `33066987915`; lifecycle `33068095243`; evidence artifact
`9645067367`, digest
`3ac5cf6512ba9f62be15fe299fcdbf6aa8035f8ae2d629b8947120d87e71b407`.

Candidate `-13` dừng ở pre-dispatch sau tag push; không có run, build, draft hay
artifact. Exact commit `d0ec7ea78b1af756b00fb0f50ac8afad83415504`.

Build/staging `-14` là `33071025403`; lifecycle `33072409835`; evidence artifact
`9646753190`, digest
`e4b13a277d2176bafb5b2eb6ab2f0cc67f0fc17bd8dcf453fa865a7ca5ef2e5d`.

Build/staging `-15` là `33074177455`; lifecycle `33075652568`; evidence artifact
`9648140826`, digest
`e366e082be5442eb12b310367fd51217ffee705cfe525274f04386ea6937524f`.

Build/staging `-16` là `33077676475`; lifecycle `33079425120`; evidence artifact
`9649684608`, digest
`c077cf63287a7163e118b0bd1733990c3dd5c40def393cc37a95c4efb95f2df1`.

Build/staging `-17` là `33082890636`; lifecycle attempt đầu là `33084347847`;
evidence artifact `9652148218`, digest
`9c1df73290279fda671e6676f93c7759d4291f00f56ebe08793a889eb63c82cd`.

Lifecycle attempt hai là `33087597148`; evidence artifact `9653267598`, digest
`9e37c79770f5637a3fe08bbe597c6ba9a603cd0626818002833f2278171f448b`.

Lifecycle đạt cuối cùng là `33089128551`; evidence artifact `9655062453`,
digest `19ff0428d3bdebad2643bbe854138b171932d8d80cd7d98b5d02792dbb82bfa8`.

## Bước nhỏ nhất tiếp theo

Commit public descriptor/docs, chạy promotion đúng một lần với lifecycle
`33089128551`, rồi hậu kiểm Latest và toàn bộ asset công khai.
