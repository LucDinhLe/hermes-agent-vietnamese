# Kế hoạch candidate `vi-v0.32.1-17`

Ngày chốt phạm vi: 2026-08-27
Trạng thái: **đã công khai và hậu kiểm thành công dưới dạng community pilot
Windows x64**. Exact candidate đã vượt đủ 20 gate và trở thành GitHub Latest
qua promotion fail-closed `33093581951`.

## Mục tiêu và audience

Community pilot Windows 10/11 x64 hợp nhất v32.1 với hotfix an toàn phiên/dự án.
Dữ liệu tiếp tục ở máy hoặc máy ảo người dùng đã chọn; không đồng bộ phiên, dự
án hoặc bản sao lưu lên cloud Hermes.

## Danh tính candidate bất biến

- Tag: `vi-v0.32.1-17`.
- Commit sản phẩm: `a6833c9400adf640c01a258f354cf96551550c75`.
- Desktop version: `0.32.1-vi.17`.
- Installer: `Hermes-Vietnamese-Windows-x64-Setup.exe`.
- Size: `340644403` byte.
- SHA-256: `7e3e5870228254fec634140391fe01042e50f1b483d9d53ff171636837d65884`.
- Build/staging run: `33082890636`; private draft release ID `377901416`.
- `SHA256SUMS.txt` asset digest:
  `4842f7125c4e67f12079b455ca8e7a68c43c2899964c5b0469bbcd350268e03a`.
- Candidate provenance asset digest:
  `e2cdb95d551c8b10dc270a0acc7cce89e4a9e84476720733b4a5e705c8afea18`.
- Signing receipt asset digest:
  `4fc79da273e37680adaeb9ab97bc76e8ce68395520b4b902f199e161c61d641c`.
- Authenticode: `NotSigned`, signer absent.
- Release class: `community-prerelease`; chỉ Windows x64, không stable/final.

## Lifecycle attempt đầu tiên

Run `33084347847` dừng sau khi đã đạt fresh install, onboarding, packaged
runtime/relaunch, project/session safety, UX, compaction và safe tool. Gate
`projectSessionSafety` chứng minh sau Ẩn/Xóa metadata dự án và relaunch:

- vẫn còn đúng 1 session, 2 message;
- digest nội dung
  `daec8ddacea0b18aac663ff4ebb4ccf492c1de3fb43b6c3f1c263db8e0a1390e`;
- `sessionHidden=0`, `sessionArchived=0`;
- scope sau relaunch là `all-projects`.

Run dừng ở bước seed public v32 trước update vì guest gọi `seed-v32` nhưng danh
sách action của Playwright chưa khai báo chuỗi này. Bước rollback kế tiếp còn
gọi `seed-v321-rollback` trong khi spec khai báo nhầm `seed-v32-rollback`.
Evidence artifact `9652148218`, digest
`9c1df73290279fda671e6676f93c7759d4291f00f56ebe08793a889eb63c82cd`.
Đây là lỗi hợp đồng harness; không có bằng chứng lỗi sản phẩm hoặc mất/ẩn dữ
liệu.

## Lifecycle attempt thứ hai

Controller `598830c2d1d96774f800d28c067dbeade7b9d2fa` chạy lifecycle
`33087597148`. Candidate tag, commit, size và SHA-256 đều khớp; receipt khóa
đúng candidate commit riêng với harness commit. Fresh install, onboarding,
packaged runtime và relaunch đạt. Run dừng trong `projectSessionSafety` vì
Hermes đang giữ transaction trên `projects.db` đúng lúc kết nối đọc song song
của harness gọi `SELECT archived`; `node:sqlite` ném `database is locked` thay
vì để `expect.poll` chờ lần đọc kế tiếp.

Screenshot cho thấy dự án Ẩn đã rời danh sách, dự án Xóa và session của nó vẫn
hiển thị; không có bằng chứng mất/ẩn session. Evidence artifact `9653267598`,
digest `9e37c79770f5637a3fe08bbe597c6ba9a603cd0626818002833f2278171f448b`.
Candidate `-17` tiếp tục giữ nguyên byte.

## Lifecycle đạt cuối cùng

Controller `42082bb0681ff05d7785f5beda05a50a8bd5365b` chạy lifecycle
`33089128551` trên đúng byte candidate `-17` và hoàn tất sau `40m48s`. Cả 20
gate bắt buộc đều `passed`, gồm cài mới, onboarding, runtime đóng gói, mở lại,
an toàn Dự án/phiên, UX, compaction, safe tool, update v32→v32.1, repair, gỡ
cài đặt giữ dữ liệu, gỡ cài đặt xóa dữ liệu, rollback vi39 và không còn process
dư.

Biên nhận an toàn dữ liệu xác nhận 1 session, 2 message, digest nội dung
`daec8ddacea0b18aac663ff4ebb4ccf492c1de3fb43b6c3f1c263db8e0a1390e`,
`sessionHidden=0`, `sessionArchived=0`; Ẩn/Xóa chỉ đổi metadata Dự án và scope
sau relaunch là `all-projects`. Evidence artifact `9655062453`, digest
`19ff0428d3bdebad2643bbe854138b171932d8d80cd7d98b5d02792dbb82bfa8`;
receipt seal
`435a8c34d0913ca120014f95e9797b50ad7f0f5c80f8ae4f93bf50e04af00238`.

## Quyết định không tạo `-18`

Installer `-17` không đổi một byte. Theo rulebook, chỉ tăng candidate khi mã
sản phẩm, đầu vào đóng gói hoặc artifact thay đổi. Harness/controller được sửa
ở commit riêng, receipt mới phải khóa đồng thời:

- candidate commit/tag/size/SHA-256 bất biến ở trên;
- harness commit đúng `head_sha` của lifecycle run mới.

Mọi run thất bại cũ được giữ nguyên. Không rerun build và không thay asset cùng
tag.

## Sửa controller bắt buộc trước dispatch

- Khai báo và xử lý đúng `seed-v32`, `seed-v321-rollback`.
- Regression tự đối chiếu toàn bộ action guest gọi với `ACTIONS` và mọi
  `switch case` của spec.
- Lifecycle checkout controller commit của lần dispatch, rồi resolve candidate
  commit độc lập từ exact tag `vi-v0.32.1-17`.
- Promotion đối chiếu receipt harness với lifecycle `head_sha`, không ép
  `head_sha` phải bằng candidate commit.
- Kết nối đọc `projects.db` có busy timeout ngắn; chỉ lỗi SQLite
  `BUSY/LOCKED` mới được đổi thành sentinel để `expect.poll` thử lại. Giá trị
  `archived=1` và row bị xóa `null` vẫn là hai điều kiện pass duy nhất.

## Gate còn thiếu

- Không còn gate kỹ thuật hay public postcheck nào thiếu cho community pilot
  Windows x64.
- Stable/final vẫn bị chặn vì installer chưa ký và chưa có bằng chứng riêng cho
  các nền tảng ngoài Windows x64.

## Rollback và public

Rollback public là `vi-v0.32.0-1`; rollback cài đặt lifecycle là
`vi-v0.20.4-39`. Promotion run `33093581951` đã xác minh lại draft, lifecycle,
tag, asset inventory, size, digest và release notes; release ID `377901416` có
`draft=false`, `prerelease=false` và là GitHub Latest. Cờ GitHub này chỉ phục
vụ vị trí Latest, không đổi provenance `community-prerelease` thành stable.
