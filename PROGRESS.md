# Tiến độ

## Cập nhật 2026-09-04: tài liệu Latest 2026.9.2

- Theo phản hồi chủ dự án, phần giới thiệu được viết lại cho người dùng, bỏ
  so sánh d14 và chi tiết nghiệm thu khỏi luồng đọc chính. Ghi chú phát hành và
  hồ sơ kỹ thuật giữ lịch sử riêng; không đổi quy tắc nghiệm thu hoặc bộ cài.

- Latest thực tế là v2026.9.2, community pilot chỉ Windows x64, chưa ký số.
  Source b51f306eae2370adc774b63f198ab12990bcf063; lifecycle33798311695 đạt cả
  currentuser/allusers. Xem [hồ sơ hiện hành](docs/release-2026.9.2-public-sync.md).
- Đã đồng bộ README/README.vi/hướng dẫn Windows, descriptor, release notes,
  ký số và sao lưu. Các mục v32.1 bên dưới là lịch sử, không phải Latest hiện tại.
- Chỉ sửa tài liệu/kiểm tra điều hướng, không rebuild hoặc sửa tag/asset,
  không cài lên hồ sơ thật, không nộp hồ sơ ký số. Mã nguồn main legacy chưa
  hợp nhất toàn bộ sản phẩm calendar; build đúng sản phẩm phải dùng source tag.
- Commit đồng bộ6d1cac8b8 đã vào main; CI33824194652 và33824280661 đạt.
  Hậu kiểm tám tệp qua API, release body, description và identity asset đạt;
  không đổi byte/tag/source của bộ cài. Hồ sơ liên kết phía trên ghi bằng chứng.

## Cập nhật 2026-08-28 — v32.1-18 là GitHub Latest đa nền tảng

- **Đã công khai thành công** community prerelease `vi-v0.32.1-18` tại
  <https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18>.
  Promotion run `33114927801` đạt; release có đủ 28 asset và 12
  artifact phân phối. Ngày 2026-08-28, chủ dự án xác nhận đặt
  `vi-v0.32.1-18` làm GitHub Latest. Đây là thay đổi metadata; tag,
  target commit, 28 asset, kích thước và digest giữ nguyên.
- Product tag giữ nguyên commit
  `2594eb396f0c5720802fc608a01a64d96d5629b2`. Manifest SHA-256 là
  `e13a09aa1f30cb19e1fb8ab6ed636b5cec605fd9402fbb6f32d6daf1391d4128`;
  Windows x64 installer SHA-256 là
  `565e1313162505999238b9c3b4f1422ec37256a1da153bae5149b5795c83c5ac`.
- Lifecycle run `33109790978` dùng harness commit
  `d26d2bec81be1c104ab2dbc75cfe9b08a7e96553` và đạt đủ 20/20 gate, 0 gate
  lỗi, 67 file bằng chứng. Evidence artifact `9663716312`, digest
  `5ee84361a2baaf5d73175297a44ea9115671f9eb42ca95550242f31064179f25`.
  Biên nhận pilot được tái dùng an toàn và gắn vào draft bởi run
  `33114738368`; asset biên nhận có SHA-256
  `7ce8c2bfbb8089669430a8dd838a1d943499c17719dc339b6780b61fe5bb0633`.
- Hai harness failure trước lifecycle xanh không tạo candidate mới: run
  `33105633511` dừng vì harness ghi `state.db` khi SQLite đang khóa; run
  `33106816267` vượt 14 gate rồi dừng vì Playwright tiếp tục tìm nút sau khi
  ứng dụng đã tự đóng lúc gỡ sạch. Hai đường này đã có regression lâu dài.
- Windows x64 được phép `PILOT-GO`. Windows ARM64, macOS Apple Silicon/Intel và
  Linux x64/ARM64 giữ đúng nhãn `BUILD-ONLY-PILOT`,
  `realMachineSmoke=false`; tất cả đều chưa ký/công chứng và không có update
  feed tự động.

- Tag `vi-v0.32.1-18` đã khóa product commit
  `2594eb396f0c5720802fc608a01a64d96d5629b2`; build run đầu
  `33097339026` đạt source gate và Windows x64 exact artifact. Hai macOS và hai
  Linux đều dựng xong nhưng harness cũ chủ động fail ở bước payload vì chưa có
  exact embedded provenance verifier cho các nền tảng này; đây không phải lỗi
  đóng gói sản phẩm và draft chưa được tạo.
- Harness mới mount DMG hoặc extract AppImage rồi đối chiếu `install-stamp.json`
  và resident manifest ngay trong đúng artifact. Workflow tách product commit
  khỏi validation harness commit; overlay chỉ diễn ra sau build nên không đổi
  byte ứng viên và không cần tạo candidate `-19` cho lỗi harness này.
- Controller rerun đầu tiên phát hiện `write_install_stamp.py` ưu tiên
  `GITHUB_SHA` của workflow controller, khiến exact artifact bị đóng dấu harness
  commit dù checkout là product tag. Build step hiện pin `GITHUB_SHA` của mọi
  child process về product commit; controller commit tiếp tục được lưu riêng
  trong signing/evidence metadata.
- Run `33101754226` sau đó dựng xanh cả sáu target và upload đủ 27 asset vào
  draft. Hậu kiểm tải lại gặp HTTP 500 từ GitHub ở asset RPM sau khi upload;
  manifest/provenance nhỏ đã tải lại được và khớp. Promotion gate chỉ cho phép
  ngoại lệ này khi API chứng minh tám job nguồn/harness/build đều success,
  draft creation success và đúng một failed step là postcheck tải lại; promotion
  vẫn tự tải, đối chiếu inventory, kích thước, API digest và SHA-256 trước public.
- Chốt successor `vi-v0.32.1-18`; không sửa asset/tag `-17` đã public và không
  đưa tính năng v33 vào phạm vi.
- Release workflow hiện có sẽ dựng đủ sáu target native cho `-18`. README và
  README.vi đã chuẩn bị đủ 12 link artifact Windows/macOS/Linux; Latest vẫn là
  `vi-v0.32.1-17` trong thời gian nghiệm thu.
- Lifecycle v32.1 được tổng quát hóa cho successor tag, vẫn khóa candidate và
  harness commit độc lập. Biên nhận pilot mới chỉ được sinh từ receipt full
  lifecycle đã sealed và phải khớp Windows x64 trong manifest.
- Năm target ngoài Windows x64 bị khóa nhãn `BUILD-ONLY-PILOT`,
  `realMachineSmoke=false`; release notes nêu rõ chưa ký/công chứng và không có
  update feed.
- Source gate liên quan đã đạt: Node release/lifecycle/evidence 37/37, workflow
  contract Vitest 17/17 và Python public-download 9/9. `git diff --check` sạch.
- Bước tiếp theo: theo dõi phản hồi community pilot; chỉ nâng audience
  cho từng target sau khi có smoke riêng trên máy thật. Không sửa byte/tag
  `-18`; v33 là phạm vi riêng.

## Cập nhật 2026-08-27 — v32.1 đã là GitHub Latest

- Promotion fail-closed `33093581951` đạt trong `37s` từ controller
  `6789469ea1337b64679d4c6605698e475766936b`; rollback tự động không bị kích
  hoạt.
- Release ID `377901416`, tag `vi-v0.32.1-17`, `draft=false`,
  `prerelease=false`, đúng 5 asset và là GitHub Latest. Đây vẫn là community
  pilot Windows x64, không phải stable/final.
- Installer công khai: 340.644.403 byte, SHA-256
  `7e3e5870228254fec634140391fe01042e50f1b483d9d53ff171636837d65884`;
  Authenticode `NotSigned`.
- Tag tiếp tục trỏ đúng product commit
  `a6833c9400adf640c01a258f354cf96551550c75`. V32
  `vi-v0.32.0-1` giữ vai trò previous/public rollback; `vi-v0.20.4-39` giữ vai
  trò rollback cài đặt đã nghiệm thu.

## Cập nhật 2026-08-27 — full lifecycle `-17` đạt, sẵn sàng promotion

- Controller `42082bb0681ff05d7785f5beda05a50a8bd5365b` chạy lifecycle
  `33089128551` trên đúng installer bất biến `vi-v0.32.1-17` và đạt sau
  `40m48s`; không rebuild, không tạo `-18`.
- Cả 20 gate bắt buộc đều đạt: cài mới, onboarding, runtime/relaunch, an toàn
  Dự án/phiên, UX, compaction, safe tool, update v32→v32.1, repair, hai chế độ
  uninstall, rollback vi39 và không còn process dư.
- Safety receipt xác nhận 1 session, 2 message, digest nội dung
  `daec8ddacea0b18aac663ff4ebb4ccf492c1de3fb43b6c3f1c263db8e0a1390e`,
  `sessionHidden=0`, `sessionArchived=0`; relaunch trở về `all-projects`.
- Evidence artifact `9655062453`, digest
  `19ff0428d3bdebad2643bbe854138b171932d8d80cd7d98b5d02792dbb82bfa8`;
  receipt seal
  `435a8c34d0913ca120014f95e9797b50ad7f0f5c80f8ae4f93bf50e04af00238`.
- Quyết định: Technical GO cho promotion community pilot Windows x64; stable
  vẫn bị chặn vì Authenticode `NotSigned` và chưa có exact-byte evidence cho
  các nền tảng khác.

## Cập nhật 2026-08-27 — lifecycle `-17` chờ khóa SQLite thay vì fail giả

- Controller `598830c2d1d96774f800d28c067dbeade7b9d2fa` đã chạy lifecycle
  `33087597148` trên đúng installer `-17`; candidate và harness commit được khóa
  độc lập đúng thiết kế.
- Fresh install, onboarding, packaged runtime/relaunch đạt. Run dừng trong
  `projectSessionSafety` khi harness đọc `projects.db` song song với transaction
  của Hermes và nhận `database is locked`. Screenshot cho thấy dự án Ẩn đã rời
  danh sách, dự án còn lại cùng session vẫn hiển thị; chưa có bằng chứng lỗi sản
  phẩm hay mất/ẩn session.
- Harness thêm busy timeout và sentinel chỉ cho SQLite `BUSY/LOCKED` để
  `expect.poll` chờ đúng trạng thái `archived=1` hoặc row bị xóa. Policy 19/19
  và ba lớp typecheck đạt; installer/tag `-17` không đổi.
- Evidence artifact `9653267598`, digest
  `9e37c79770f5637a3fe08bbe597c6ba9a603cd0626818002833f2278171f448b`.

## Cập nhật 2026-08-27 — tách candidate `-17` khỏi controller nghiệm thu

- `vi-v0.32.1-17` đã build/stage đúng một lần tại run `33082890636`, commit
  `a6833c9400adf640c01a258f354cf96551550c75`, installer 340.644.403 byte,
  SHA-256 `7e3e5870228254fec634140391fe01042e50f1b483d9d53ff171636837d65884`,
  Authenticode `NotSigned`.
- Lifecycle `33084347847` đã đạt toàn bộ gate project/session safety: 1 session,
  2 message, digest nội dung không đổi, `hidden=0`, `archived=0` sau Ẩn/Xóa dự
  án và relaunch. Run dừng sau đó vì hợp đồng harness thiếu `seed-v32`; action
  rollback `seed-v321-rollback` cũng bị khai báo sai tên.
- Candidate `-17` được giữ nguyên byte. Controller mới khai báo đủ action, thêm
  regression đối chiếu toàn bộ guest/spec và tách `harnessCommit` khỏi
  `candidate.commit`. Lỗi harness/hạ tầng từ nay tạo lifecycle run mới, không
  tự động dựng candidate mới.
- Evidence thất bại: artifact `9652148218`, digest
  `9c1df73290279fda671e6676f93c7759d4291f00f56ebe08793a889eb63c82cd`.
  Latest vẫn là `vi-v0.32.0-1`.
- Controller local gates đạt: release/lifecycle Node 66/66; Desktop script
  Vitest 149 pass, 1 skip; Desktop script Node 17/17; Python release 27/27;
  typecheck, lint, format, YAML và diff check đều xanh.

## Cập nhật 2026-08-27 — candidate v32.1-17 kích hoạt đúng hàng phiên

- `vi-v0.32.1-16` build/stage xanh tại run `33077676475`; installer 340.642.164
  byte, SHA-256 `b84e3fe29a07cace57b244036d11a1e2907764e8325b0be2e830928add32568d`,
  Authenticode `NotSigned`.
- Lifecycle `33079425120` vượt cài mới, onboarding, runtime đóng gói và relaunch.
  Sau Ẩn/Xóa metadata dự án, session vẫn hiện trong sidebar. Harness dừng vì
  click vào `span` tiêu đề bị container danh sách chặn pointer event; chưa có
  bằng chứng mất hoặc ẩn dữ liệu. Evidence artifact `9649684608`, digest
  `c077cf63287a7163e118b0bd1733990c3dd5c40def393cc37a95c4efb95f2df1`.
- Candidate `-17` khóa semantic button của hàng phiên, xác minh accessible name,
  dùng `Enter` và policy cấm pointer click. `-16` giữ bất biến, không rerun.
- Kế hoạch hiện hành: `docs/release-vi-v0.32.1-17-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-16 kích hoạt action dự án bằng bàn phím

- `vi-v0.32.1-15` build/stage xanh tại run `33074177455`; installer 340.639.925
  byte, SHA-256 `fd33557ba32f92455ce11eeb8082be9c1788ca2564621be09ecaadb804d41a54`,
  Authenticode `NotSigned`.
- Lifecycle `33075652568` vượt helper điều hướng Dự án và **Tất cả dự án**, rồi
  dừng khi pointer click **Ẩn khỏi danh sách dự án** bị action container của card
  chặn. Không có bằng chứng mất hoặc ẩn session/message. Evidence artifact
  `9648140826`, digest
  `e366e082be5442eb12b310367fd51217ffee705cfe525274f04386ea6937524f`.
- Candidate `-16` dùng `Enter` cho Ẩn, Xóa trên card và xác nhận Xóa; policy khóa
  các đường này. `-15` giữ bất biến, không rerun/promotion.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-16-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-15 khóa đúng nút điều hướng Dự án

- `vi-v0.32.1-14` build/stage xanh tại run `33071025403`; installer 340.636.957
  byte, SHA-256 `16dfd43d512a6d79744f482306f2596d9183240d9b6f78e9d25a09c0b855d345`,
  Authenticode `NotSigned`.
- Lifecycle `33072409835` trở về **Tất cả dự án** và UI hiển thị đủ hai dự án
  cùng session có nội dung. Helper mở trang Dự án khớp hai nút cùng tên nên
  strict mode dừng; không có bằng chứng mất hoặc ẩn dữ liệu. Evidence artifact
  `9646753190`, digest
  `e4b13a277d2176bafb5b2eb6ab2f0cc67f0fc17bd8dcf453fa865a7ca5ef2e5d`.
- Candidate `-15` khóa semantic button điều hướng sidebar, xác minh accessible
  name và dùng `Enter`; policy cấm pointer click. Đồng thời promotion khóa exact
  tag `-15` ở cả hai pha.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-15-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-14 khóa đúng lane Windows x64

- Tag `vi-v0.32.1-13` đã push tại commit
  `d0ec7ea78b1af756b00fb0f50ac8afad83415504`, nhưng pre-dispatch phát hiện
  workflow build/lifecycle còn khóa v32.1 theo tag `-12`.
- Không dispatch, không build, không draft và không promotion `-13`; người dùng
  và Latest không đổi. Tag/commit `-13` giữ bất biến làm bằng chứng NO-GO.
- Candidate `-14` đồng bộ exact tag giữa ma trận Windows x64, lane lifecycle và
  contract test. Kế hoạch lịch sử: `docs/release-vi-v0.32.1-14-plan.md`.

## Cập nhật 2026-08-27 — candidate v32.1-13 kích hoạt Tất cả dự án bằng bàn phím

- `vi-v0.32.1-12` build/stage xanh tại run `33066987915`; installer 340.633.138
  byte, SHA-256 `91bfc8dc1f398ccf2d205a9c284493a492b1d5d9ef77eb6391e85e76d1923891`,
  Authenticode `NotSigned`.
- Lifecycle `33068095243` xác nhận project-addressable session có đủ prompt/reply
  trong UI và database. Nó dừng khi pointer click **Tất cả dự án** bị semantic
  button của hàng dự án con chặn; không có bằng chứng mất hoặc ẩn dữ liệu.
  Evidence artifact `9645067367`, digest
  `3ac5cf6512ba9f62be15fe299fcdbf6aa8035f8ae2d629b8947120d87e71b407`.
- Candidate `-13` dùng `Enter` trên đúng semantic button và policy cấm pointer
  click tại bước này. `-12` giữ bất biến, không rerun/promotion.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-13-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-12 chờ message flush xuống database

- `vi-v0.32.1-11` build/stage xanh tại run `33064470869`; installer 340.630.734
  byte, SHA-256 `7e98e7254b9596c6e21d64973cdc3a76d27aca42c56dcfea92eccf28fc7cc416`,
  Authenticode `NotSigned`.
- Lifecycle `33065542015` vượt lỗi khóa database, tạo session đúng project và UI
  hiển thị đủ prompt cùng mock reply. Harness đọc safety snapshot trước khi reply
  thứ hai flush nên tạm đếm 1 message thay vì 2. Không có bằng chứng mất dữ liệu.
  Evidence artifact `9643842344`, digest
  `c321ce027d2f0dc625890891d982f89a9332d97777ad754d799a4a0b2c039266`.
- Candidate `-12` poll `state.db` đến khi đủ hai message rồi mới chụp snapshot;
  policy khóa thứ tự này. `-11` giữ bất biến, không rerun/promotion.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-12-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-11 seed fixture trước khi mở database

- `vi-v0.32.1-10` build/stage xanh tại run `33061824984`; installer 340.628.197
  byte, SHA-256 `9dd1077699f64702b387de405c5cc097b0a7c9f9b1d0b7645c7d4eff24d6e14f`,
  Authenticode `NotSigned`.
- Lifecycle `33063041821` dừng trước fixture với `database is locked`: harness
  đã mở Hermes rồi mới ghi `projects.db`, trùng lúc project store giữ khóa.
  Screenshot xác nhận UI trống trước fixture; không có thao tác xóa/ẩn hoặc mất
  dữ liệu. Evidence artifact `9642809205`, digest
  `4b54db37d614023d32630edb16be79563450bc38483cc41ad31182fce3817bf5`.
- Candidate `-11` seed project fixture trước khi launch Hermes; policy bắt buộc
  thứ tự này. `-10` giữ bất biến, không rerun/promotion.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-11-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-10 kích hoạt disclosure theo ngữ nghĩa

- `vi-v0.32.1-9` build/stage xanh tại run `33058450054`; installer 340.626.053
  byte, SHA-256 `31812e2539c288e3f0e380ed721a260f0800601110f19dad8d3fb09cfbb7b5be`,
  Authenticode `NotSigned`.
- Lifecycle `33059934813` vượt fresh install, onboarding, packaged runtime,
  relaunch và tạo phiên/nội dung trong project scope. Nó dừng khi pointer click
  trung tâm nút **Ẩn phiên** bị mốc thời gian của hàng phiên chặn. Evidence
  artifact `9641548178`, digest
  `09ce7a5fdd92ed4f8910f9cbbc4d0f1a07f4441b13d23eb25effcd574319b6f4`.
- Candidate `-10` dùng `Enter` trên đúng semantic button cho cả Ẩn/Hiển thị;
  policy cấm pointer click tại hai bước. `-9` giữ bất biến, không rerun/promotion.
- Kế hoạch lịch sử: `docs/release-vi-v0.32.1-10-plan.md`. Latest vẫn là
  `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-9 retry giới hạn khi khóa tag

- `vi-v0.32.1-8` vượt toàn bộ source gate và build Windows x64 tại run
  `33056165931`; SignPath được bỏ qua đúng phạm vi, provenance/checksum và
  receipt `NotSigned` đều đạt.
- Job staging dừng trước download artifact và trước tạo draft vì GitHub trả
  `HTTP 429` khi fetch lại immutable tag. Không có release/draft mới, người dùng
  và Latest không thay đổi; `-8` giữ bất biến, không rerun.
- Candidate `-9` thêm retry giới hạn 5 lần, cách nhau 15 giây cho cả source và
  staging tag refresh. Sau retry vẫn phải so exact tag/checkout/verified commit;
  không khớp tiếp tục fail-closed.
- Kế hoạch hiện hành: `docs/release-vi-v0.32.1-9-plan.md`.

## Cập nhật 2026-08-27 — candidate v32.1-8 dùng kích hoạt bàn phím

- `vi-v0.32.1-7` build/stage xanh tại run `33053462058`; installer
  340.620.814 byte, SHA-256
  `5da162d3918fc6a94390cba75484ba838289c9e24d63ec04bc0429a1c0739f78`,
  Authenticode `NotSigned`.
- Lifecycle `33054540916` dừng trước khi mở dự án: nút **Mở dự án** hiển thị,
  enabled và ổn định nhưng hàng hành động bao quanh chặn pointer. Không có thao
  tác project/session nào được thực thi. Evidence artifact `9639300595`, digest
  `bf4cf2c657839d5dc4a9d69318e743ca96430758d478bbc6e34fa31b5bde1add`.
- Harness `-8` kích hoạt chính semantic button bằng phím `Enter`, là đường nhập
  người dùng thật và không dùng force/synthetic click. Policy khóa cấm quay lại
  pointer click ở bước vào dự án.
- `-7` giữ bất biến, không retry hay promotion. Latest vẫn là
  `vi-v0.32.0-1` cho tới khi toàn bộ lifecycle và hậu kiểm `-8` đạt.

## Cập nhật 2026-08-27 — candidate v32.1-7 vào project trước khi tạo phiên

- `vi-v0.32.1-6` build/stage xanh tại run `33051008029`; installer 340.620.386
  byte, SHA-256
  `adc49649f80db203c34787b19fd65a2a8c1bb67896dc47f55118f27aecd41e86`,
  Authenticode `NotSigned`.
- Lifecycle `33052037180` vượt tám gate đầu rồi dừng ở `projectSessionSafety`.
  Evidence artifact `9638286238` cho thấy bare `Ctrl+N` vẫn tạo phiên detached
  `cwd = null`; session/message còn nguyên và promotion dừng đúng thiết kế.
- Harness `-7` tạo project fixture cô lập, mở project qua đúng UI, xác nhận scope
  rồi mới tạo phiên. Candidate kế nhiệm là `vi-v0.32.1-7` / `0.32.1-vi.7`;
  `-6` giữ bất biến, không retry hay promotion.
- Latest vẫn là `vi-v0.32.0-1`.

## Cập nhật 2026-08-27 — candidate v32.1-6 sửa giả định phiên detached

- `vi-v0.32.1-5` build/stage thành công tại run `33047979498`; exact installer
  340.619.304 byte, SHA-256
  `22639f293af973f39f81920fd77621cbf93b6d565b39e7b63b46c90b36fd2728`,
  Authenticode `NotSigned`.
- Lifecycle run `33049189121` vượt fresh install, onboarding, mock runtime và
  packaged relaunch rồi dừng fail-closed ở `projectSessionSafety`. Evidence
  artifact `9637160151` cho thấy phiên và nội dung còn nguyên nhưng phiên thử
  là detached hợp lệ với `cwd = null`; không có mất dữ liệu sản phẩm.
- Harness kế nhiệm mở phiên mới bằng phím tắt người dùng thật trước khi kiểm
  liên kết dự án, không ép sửa một phiên detached hiện hữu. Candidate mới là
  `vi-v0.32.1-6` / `0.32.1-vi.6`; `-5` giữ bất biến, không promotion.
- Latest vẫn là `vi-v0.32.0-1`. Chỉ public `-6` nếu toàn bộ exact lifecycle và
  hậu kiểm promotion đạt.

## Cập nhật 2026-08-27 — candidate v32.1-5 sửa quyền đọc draft

- Candidate `vi-v0.32.1-4` đã stage đúng byte nhưng lifecycle dừng trước tải vì
  GitHub không hiển thị draft riêng tư cho token chỉ có `contents: read`; không
  có thao tác cài đặt hoặc ghi dữ liệu nào bắt đầu.
- Lane v32.1 kế nhiệm dùng `contents: write` tối thiểu để nhìn/tải draft nhưng
  không có lệnh sửa release. Contract test khóa quyền này, tra tag local, retry
  có giới hạn và cấm parser `--slurp` đã gây lỗi ở candidate `-3`.
- Candidate được nâng bất biến sang `vi-v0.32.1-5` / `0.32.1-vi.5`; `-4` và
  draft/run liên quan được giữ nguyên làm bằng chứng, không rebuild hay promotion.
- Gate cục bộ hiện đạt workflow contract 16/16, lifecycle/promotion 31/31,
  public metadata 8/8; ba workflow YAML và đoạn PowerShell tải draft parse đạt.
- GitHub CLI đã xác thực tài khoản `LucDinhLe`. Chủ dự án cho phép push/tag,
  dựng, nghiệm thu và promotion public khi toàn bộ receipt xanh; Latest hiện vẫn
  là `vi-v0.32.0-1`.

## Cập nhật 2026-08-26 — hợp nhất v32.1 với hotfix an toàn phiên/dự án

- Tạo worktree/branch riêng `integration/v32.1-project-session-safety` từ
  `d385de1bf`; không sửa worktree v32.1 gốc hoặc `.tmp/` của chủ dự án.
- Đưa bốn commit chức năng project/session vào v32.1. Giữ hai payload fix mới
  hơn `2baa74931` + `5dd1b3dfa`, không cherry-pick payload fix `6ff911685` của
  nhánh hotfix.
- Gate giao điểm đạt UI 151/151, backend project/config 27/27 và lifecycle
  policy 17/17; ba lớp Desktop typecheck đạt.
- Full UI ban đầu đạt 4.968/4.969; ca duy nhất đỏ là test About còn kỳ vọng
  nhãn v32.0 trong khi product source đã là v32.1. Sau khi sửa kỳ vọng thành
  v32.1, lượt full UI sạch đạt 553/553 tệp và 4.969/4.969 test.
- Python release slice sạch đạt 304 passed, 4 skipped, 0 failed. Lượt rộng hơn
  xác nhận sáu lỗi `test_profiles.py` là giới hạn POSIX trên Windows đã biết;
  `test_mcp_startup.py` đạt 6/6 trong process sạch.
- Candidate `vi-v0.32.1-2` dừng ở source gate trước build do test cũ trộn
  candidate notes với public descriptor; tag/run giữ nguyên làm bằng chứng.
- Candidate `vi-v0.32.1-3` đã build/stage draft riêng tư; lifecycle dừng trước
  download do parser `--slurp` không tìm thấy draft. Tag/draft/run giữ bất biến,
  không promotion.
- Candidate `vi-v0.32.1-4` đã build/stage draft riêng tư; lifecycle dừng trước
  download vì token `contents: read` không thấy draft. Tag/draft/run giữ bất biến,
  không promotion.
- Candidate kế nhiệm được đặt là `vi-v0.32.1-5` / `0.32.1-vi.5`; local
  `vi-v0.32.1-1` cũ giữ bất biến và bị supersede cho mục tiêu release vì chưa
  có hotfix. Chưa build/tag/push/stage/public/đổi Latest.
- Release plan hiện hành: `docs/release-vi-v0.32.1-9-plan.md`. Latest tiếp tục NO-GO cho
  tới khi exact artifact chứng minh Authenticode `NotSigned`, không có signer và
  vòng đời trên Windows guest cô lập đạt, gồm update v32 → v32.1 và persistence
  project/session.

## Cập nhật 2026-08-26 — candidate local v32.1 và provenance đóng gói

- Nâng metadata candidate lên `v32.1` / `0.32.1-vi.1` mà không sửa descriptor
  Latest bất biến của v32. Local candidate dùng tag `vi-v0.32.1-1` và clean
  HEAD `5dd1b3dfae33696dc98d323b9def5148a4482b1d`.
- Hai lượt build đỏ đã phát hiện resolver payload resolve lại dependency trần
  và đọc project override làm lệch pin/hash `cryptography`. Mỗi lỗi đều có
  regression đỏ trước khi sửa. Gate payload đạt 63/63; release policy đạt
  22/22; payload thật cài đủ 64 package với `cryptography==50.0.0`.
- Windows x64 installer local dựng thành công: 341.260.235 byte, SHA-256
  `2edb6072e8682e147ebee57d2c268631c3aa7a2d94479aaa53ec4052fbd03fe9`,
  Authenticode `NotSigned`. Exact NSIS extraction xác minh tag/commit/class,
  app và resident Node x64, schema-2 manifest và `updateFeedEnabled=false`.
- Lifecycle contract đã nâng test-first sang candidate v32.1 và exact đường
  update v32 → v32.1; toàn bộ harness test đạt 22/22. Packaged lifecycle vẫn
  **NO-GO** vì host không có Windows Sandbox. Không cài trực tiếp, không dùng profile thật,
  không live provider, stage, push, merge hay public. Evidence chi tiết tại
  `docs/v32.1/local-candidate-2026-08-26.md`.

## Cập nhật 2026-08-26 — MCP exact permission receipt fail-closed

- Backend có endpoint chỉ-đọc `/api/mcp/assignments` lấy receipt theo đúng
  `session_id + profile`, dùng SessionDB profile scope hiện hữu và cùng validator
  fail-closed với resume. API chỉ trả exact tools/server/reasons đã gán, không
  connect, reload, mutate config hay cấp quyền. Regression chứng minh default và
  named profile có cùng session ID không rò sang nhau; mapping giả mạo trả rỗng.
- Desktop client ghim request theo `session + profile + backend`. MCP tab hiển
  nhãn `assigned` chỉ trên server có trong receipt của phiên hiện hành;
  catalog/install/enabled/connected vẫn là các trạng thái riêng và nhãn
  không tạo config write hay cấp quyền. Copy đã đủ en/vi/ja/zh/zh-hant/ar.
- Desktop client gate đạt 29/29; ba cấu hình TypeScript, Prettier và
  changed-file ESLint đều xanh.
- Component regression đạt 1/1 và gate Desktop gộp đạt 30/30: nhãn
  assigned bám đúng session/profile/backend, biến mất khi receipt rỗng,
  chuyển đúng server khi profile đổi và không gọi config writer.
- Session root mới chỉ gán đúng MCP tool đã kết nối và khớp nhiệm vụ từ catalog
  schema cục bộ; bước định tuyến báo 0 model/provider/network call, không cài,
  đăng nhập, cấp quyền hay ghi cấu hình. Child chỉ được thu hẹp receipt của
  parent, không thể mở rộng sang server/tool khác.
- Receipt lưu exact tool, server mapping, lý do và hash trước prompt đầu. Resume
  kiểm tra hash, tool prefix, thứ tự, duplicate và server component; dữ liệu
  sai hoặc bị sửa fail-closed về 0 MCP. Skill receipt và system prompt parent
  giữ nguyên hợp đồng byte-stable hiện hữu.
- Scope được giữ đồng nhất qua direct dispatch, Tool Search listing/search/
  describe/call, `execute_code`, late refresh/reload và delegate. Tool chưa gán
  không thể lộ schema hay gọi; mọi call của child vẫn qua Root Token Governor.
- Startup MCP không tạo thread hoặc import runtime khi profile không có server
  enabled, chỉ có server disabled, hay không đọc được config. Fresh profile vì
  vậy giữ 0 MCP I/O; server chưa kết nối không có schema nên không thể được gán.
- Regression đều được ghi đỏ trước khi sửa. Canonical source gate đạt 298/298
  trên 13 file (loại đúng một assertion case-fold biến môi trường Windows có
  sẵn, không thuộc lát cắt); kiểm tra MCP riêng đạt 8/8. Ruff, bytecode compile
  và `git diff --check` đạt. Không live probe, provider/network/process call,
  build candidate, profile Hermes thật, push hay hành động public.
- Phạm vi source v32.1 đã hoàn tất. Bước còn lại chỉ là packaged
  lifecycle/candidate gate, phải được cho phép riêng; lát cắt này không build,
  cài, live probe, push, merge hay public.

## Cập nhật 2026-08-26 — benchmark exact capability receipt offline

- Thêm harness offline chỉ nhận `skills/` của profile cô lập, render đúng Skill
  index production và chặn fail-closed mọi network/process attempt. Script từ
  chối profile Hermes thật; không dựng agent hay dò provider/model.
- Baseline 72 Skill đo exact 8.797 ký tự, 8.829 byte, 2.204 token ước tính.
  Parent/session receipt 6 Skill cùng hash: 2.257 ký tự, 2.269 byte, 565 token;
  child 4 Skill: 2.098 ký tự, 2.110 byte, 525 token. Parent giảm 74,34% so với
  full catalog và session persist byte/hash-stable.
- Simple prompt dùng mock responder: đúng 1 main response, 0 tool, 0 subagent,
  0 background review; 0 live provider/network/process call.
- Regression được ghi đỏ trước khi thêm module. Gate tổng hợp benchmark +
  router/session/delegate/Tool Search/Governor đạt 210/210, 1 skip trên 13 file.
  Evidence nằm tại
  `docs/v32/benchmarks/capability-scope-benchmark-2026-08-26.md`.
- Bước nhỏ tiếp theo: MCP permission router fail-closed theo exact server/tool
  receipt; không configured thì 0 startup/network/process và tuyệt đối không
  tự cài, đăng nhập hoặc cấp quyền.

## Cập nhật 2026-08-26 — router Skill cho session/subagent mới

- Session root mới và child agent nay dò metadata Skill cục bộ đúng một lần
  trước request đầu. Profile có `skills.allowed` chỉ cấp các Skill khớp đã được
  phép; match đã cài nhưng chưa allow trở thành recommendation có lý do. Legacy
  profile không allowlist giữ nguyên hành vi.
- Receipt tách `selected` và `recommended`, giới hạn selection tối đa 8, ghi
  hash vào `session.model_config` trước khi tạo row và khôi phục fail-closed khi
  resume. Prompt đã persist được dùng nguyên byte; call sau và resume không
  phân loại lại hay bật/tắt Skill giữa phiên.
- System prompt và `skills_list`/`skill_view` của agent task-scoped chỉ thấy
  receipt được giao. `skill_manage` bị khóa, `tool_call` tiếp tục truyền scope,
  còn `execute_code` không được sinh stub Skill để tránh đường vòng đọc hoặc
  sửa Skill chưa được phép. Recommendation không ghi profile config.
- Child giữ chính Root Token Governor kể cả khi worker mất ContextVar; regression
  xác nhận model attempt của child được cộng vào breakdown `subagent`. Kết quả
  delegate trả cả selected/recommended/reason và bằng chứng 0 model/provider/
  network call cho bước routing; parent prompt đang chạy không đổi byte.
- Canonical source gate đạt 278/278, 1 skip trên 13 file cho capability contract,
  session init/resume, prompt builder, delegate, Tool Search, model dispatch và
  Turn Governor. `git diff --check` đạt. Không live probe, build, provider call,
  mạng, profile Hermes thật, push hay hành động public.
- Một lượt thăm dò rộng hơn còn ba assertion đường dẫn POSIX có sẵn trên
  Windows (`test_system_prompt.py` một ca, `test_skills_tool.py` hai ca); mã bị
  lỗi nằm ngoài phần thay đổi và không được ghi nhận là gate xanh.
- Bước nhỏ tiếp theo: benchmark exact số ký tự/token cho full catalog, parent,
  session và child (bao gồm simple prompt); sau đó mới khóa MCP permission router
  fail-closed, không tự cài/đăng nhập/cấp quyền.

## Cập nhật 2026-08-26 — marker khai sinh chỉ dành cho profile mới

- Thêm marker `skills.work_profile.onboarding_required` tại đúng hai điểm khai
  sinh: config mặc định chỉ được installer chép khi chưa có config, và lệnh tạo
  named profile hoàn toàn mới. Clone giữ nguyên config nguồn; update, repair và
  legacy profile không được backfill marker.
- Backend trả marker trong API state. Desktop chỉ mở **Thiết lập công việc** khi
  marker là `true`, kể cả provider đã cấu hình; backend cũ, profile legacy và
  người từng bỏ qua không bị hỏi lại. Save/Skip thay marker bằng receipt hoàn
  tất, nên không lặp giữa các lần mở.
- Regression đỏ đã được khóa trước khi sửa. Canonical Python gate đạt 61/61 cho
  capability, bundled sync, manual Skill config và API; named create/clone đạt
  2/2; config template đạt 56/56. Desktop mục tiêu đạt 26/26, typecheck đạt và
  ESLint phần thay đổi sạch. Toàn bộ kiểm tra dùng profile cô lập, không gọi
  provider/model/network và không đọc hoặc sửa profile Hermes thật.
- Không chạy toàn bộ `test_profiles.py` như một gate đạt trên Windows: file này
  còn sáu ca POSIX/symlink/wrapper nền không thuộc lát cắt; hai contract liên
  quan trực tiếp đã được chạy riêng và đều xanh.
- Bước nhỏ tiếp theo: nối task discovery vào session/subagent mới, chỉ cấp Skill
  đã allow; giữ parent prompt byte-stable, Skill chưa allow chỉ recommendation
  và mọi child call vẫn đi qua root Token Governor.

## Cập nhật 2026-08-26 — UI thiết lập công việc profile-scoped

- Nối typed Desktop client vào bốn API work profile/discovery và khóa mọi
  request theo đúng `connectionId + profile`; test cũng chứng minh owner tường
  minh không bị ambient backend ghi đè.
- First-run nay đưa bước **Thiết lập công việc** sau khi backend sẵn sàng, cho
  xem trước recommendation cục bộ, chỉnh danh sách Skill rồi mới lưu; bỏ qua
  cũng được persist rõ ràng. Profile đã hoàn tất tự đi tiếp và luồng thêm
  provider thủ công không bị chèn bước này.
- Settings có mục **Hồ sơ công việc** để xem lại lĩnh vực, tối đa ba việc thường
  làm và allowlist Skill. Mở Settings hoặc xem recommendation không migrate hay
  mutate legacy profile; chỉ nút lưu mới ghi bằng API profile-scoped.
- Hoàn tất copy/i18n cho `vi`, `en`, `ja`, `zh`, `zh-hant`, `ar`; component dùng
  primitive và semantic label hiện hữu, không tự lấy focus.
- Desktop gate đạt 34/34 trên 7 file cho API scope, onboarding, Settings và
  locale; toàn bộ ba cấu hình TypeScript đạt. ESLint phần thay đổi không có lỗi;
  `git diff --check` đạt. Không build, live probe, đọc/sửa profile Hermes thật,
  push hay hành động public.
- Bước nhỏ tiếp theo: khóa bằng regression một dấu hiệu fresh-profile-only bền
  vững cho default install và named profile create; update/repair cùng profile
  legacy không được bị hỏi lại. Sau đó mới nối task discovery vào session/agent.

## Cập nhật 2026-08-26 — API work profile profile-scoped

- Thêm API đọc state, local recommendation, apply/skip và local task discovery
  trên Skills router hiện hữu; request có thể nhắm named profile và không làm
  rò state sang profile chạy dashboard.
- Recommendation/discovery chỉ đọc, dùng mapping cục bộ và báo 0 model attempt,
  không provider/network. Apply dùng `_CONFIG_MUTATION_LOCK`, config writer
  chuẩn và từ chối Skill chưa cài trước khi ghi.
- Canonical runner đạt 63/63 trên 5 file: capability contract, bundled sync,
  manual toggle, profile-scoped Skills API và event-loop/off-thread regression.
  Tất cả dùng `HERMES_HOME` tạm; profile Hermes thật không bị đọc hoặc sửa.
- Bước nhỏ tiếp theo: nối First-run và Settings UI vào API này, cập nhật đầy đủ
  locale `vi`, `en`, `ja`, `zh`, `zh-hant`, rồi chạy component/a11y tests.

## Cập nhật 2026-08-26 — lát cắt B, allowlist fail-closed và dò Skill cục bộ

- Tiếp quản trên `feat/v32-token-context-ux` tại `551b46e69`; giữ nguyên
  `.tmp/` và không dùng hồ sơ Hermes thật.
- Regression đỏ chứng minh Skill bundled mới lọt khỏi snapshot
  `skills.disabled` của profile đã có `skills.allowed`; local task discovery
  chưa có contract.
- `reconcile_allowed_skill_catalog()` giữ legacy profile nguyên trạng, còn
  profile có allowlist sẽ khóa mọi bundled Skill ngoài quyền trước khi sync
  chép file. Nếu ghi config lỗi, sync dừng trước copy thay vì fail-open.
- `discover_task_skills()` phân loại bằng bảng local, chọn tối đa 8 Skill đã
  được phép cho session/agent mới và chỉ trả recommendation cho Skill chưa
  được phép. Contract ghi 0 model attempt, không provider/network và không
  mutate config.
- Canonical runner đạt 39/39 trên
  `tests/hermes_cli/test_capability_profile.py` và
  `tests/tools/test_skills_sync.py`.
- Bước nhỏ tiếp theo: nối backend API profile-scoped bằng
  `_CONFIG_MUTATION_LOCK`, `load_config`/`save_config`; manual toggle phải cập
  nhật `skills.allowed` khi work profile tồn tại và giữ legacy behavior.

## Cập nhật 2026-08-26 — đồng bộ sidebar Dự án/phiên cho candidate `vi-v0.32.0-4`

- Audit hai trạng thái sidebar xác nhận `vi-v0.32.0-3` mới chữa lỗi scope làm
  người dùng tưởng mất phiên; candidate đó chưa đồng bộ giao diện. Tổng quan chỉ
  xem trước ba phiên mà không báo phần còn lại, còn khi mở dự án thì tiêu đề đổi
  thành tên dự án và hàng dự án/nút xổ xuống biến mất.
- Source fix giữ tiêu đề **Dự án** ở cả hai trạng thái; dự án đang mở vẫn là
  hàng có biểu tượng, menu, nút xổ xuống và phần thân đầy đủ. Tổng quan báo đúng
  **Hiển thị thêm N phiên** và mở full view. Không thay đổi database hoặc vòng
  đời phiên.
- Thêm hai regression giao diện cho số phiên bị cắt và entered-project disclosure.
  Lát cắt trực tiếp đạt 71/71; toàn UI đạt 4.957/4.957; backend project contract
  đạt 60/60; lifecycle policy đạt 4/4; Desktop typecheck, ESLint, Prettier và
  `git diff --check` đạt.
- Hai test phụ ngoài gate dùng literal đường dẫn POSIX (`/tmp`, `/a`) không tương
  thích kỳ vọng chuẩn hóa đường dẫn Windows; 74 test còn lại trong lượt mở rộng
  đạt. Đây là khác biệt test theo nền tảng, không phải lỗi dữ liệu.
- `vi-v0.32.0-3` giữ nguyên byte và không được vá đè. Candidate tiếp theo là
  `vi-v0.32.0-4`; chưa build, chưa cài hồ sơ thật, chưa tag/release/đổi Latest.

## Cập nhật 2026-08-26 — sự cố tưởng mất phiên khi mở Dự án trên v32

- Audit read-only hồ sơ Hermes thật xác nhận `state.db` còn đủ 11 phiên và 752
  bản ghi tin nhắn; mọi phiên đều `hidden=0`, `archived=0`, ba cơ sở dữ liệu đều
  `integrity_check=ok` và không có khóa ngoại mồ côi. Đã chụp bản sao thô trước
  khi kiểm tra; không sửa dữ liệu người dùng.
- Nguyên nhân là phạm vi dự án được lưu bền trong giao diện: sau khi mở dự án,
  sidebar chỉ hiện phiên thuộc dự án đó, trong khi lối **Tất cả dự án** bị làm
  mờ `opacity-40`. Đây là lỗi hiển thị nghiêm trọng gây cảm giác mất dữ liệu,
  không phải thao tác xóa phiên.
- Ba thẻ 0 phiên/0 token xuất hiện thêm là kho git do cơ chế tự dò mặc định quét
  giới hạn trong thư mục người dùng; chúng không phải dự án vừa được tạo. Trang
  Dự án trước đây không ghi rõ nguồn tự động và không có thao tác ẩn trực tiếp.
- Bản sửa làm lối quay về nổi rõ và nói thẳng các phiên khác vẫn còn; kho tự dò
  có nhãn **Tự động tìm thấy** và nút **Ẩn khỏi danh sách dự án**.
- Theo yêu cầu an toàn nâng cấp ngày 2026-08-26, project scope không còn lưu qua
  restart; lối quay về báo chính xác số phiên ngoài dự án; tự dò git chuyển sang
  opt-in/tắt mặc định. `sessions.auto_prune` và `sessions.auto_archive` tiếp tục
  tắt mặc định.
- Thêm hợp đồng backend chứng minh tạo → archive → restore → delete dự án
  không đổi `hidden`/`archived` hoặc xóa phiên. Quyết định và quy trình xử lý
  khách hàng được khóa tại `docs/v32/session-safety-decisions.md` và
  `docs/v32/customer-session-incident-runbook.md`.
- Regression giao diện/dự án/cấu hình/i18n đạt 206/206; các ca scope, số phiên
  ngoài dự án và opt-in discovery đã chạy đỏ trước khi sửa rồi xanh sau sửa.
  Backend safety slice đạt 27/27, gồm hợp đồng vòng đời dự án không đổi phiên.
  Desktop typecheck, ESLint các tệp thay đổi và `git diff --check` đạt.
- Đây mới là source fix trên nhánh cô lập từ đúng `vi-v0.32.0-1`; chưa push,
  chưa đóng gói, chưa cài đè hồ sơ thật và chưa thực hiện hành động công khai.

## Cập nhật 2026-08-24 — continuity >350k và Governor opaque fail-closed

- Implementation tip trước checkpoint test:
  `ffa71a84065f9272bb65df28787fe80470f72558` trên
  `feat/v32-token-context-ux`.
- Ba runtime không thể quan sát attempt nội bộ — Codex app-server, Claude Code
  và Copilot ACP — đã được chặn fail-closed trong governed user turn. Lỗi trả có
  cấu trúc, không retry/fallback/switch và không khóa composer im lặng.
- Thêm integration thật cho transcript logic ít nhất 350k: compaction dùng
  `AIAgent.run_conversation`, persist SQLite, đóng/mở DB, tạo agent mới và tiếp
  tục lượt kế tiếp trong profile mock/offline. Task/path/commit/error/decision
  anchors đều được giữ.
- Sửa regression tests theo hành vi v32: đóng DB rõ ràng trên Windows, patch
  đúng `resolve_agent_cwd`, và chứng minh raw tool output 100k được spill trước
  recovery thay vì phình parent context.
- Canonical context/error group 10 tệp đạt **246/246**, exit 0 trong 79,1 giây.
  Đây là checkpoint source, chưa thay thế final exact-candidate receipt.
- Chủ dự án cho phép đúng **một build retry ngoại lệ** trên commit cuối đã sửa.
  Retry vẫn chưa dùng; chỉ được chạy sau khi toàn bộ source/pre-build gate xanh.
- Gia cố Windows lifecycle harness: Node portable phải khớp exact signed
  SHASUMS256 của `v26.5.1`; Playwright packages phải khớp package-lock
  version/integrity và exact tree fingerprint. Regression đạt 8/8; kiểm trực
  tiếp cây dependency hiện tại đạt cả ba package.
- GitHub Latest vẫn là v31. Không tag, push, draft hay promotion công khai ở mốc
  này.

## Cập nhật 2026-08-24 — khởi động Hermes Vietnamese v32

- Tạo worktree `projects/hermes-v32` và nhánh
  `feat/v32-token-context-ux` từ `origin/main@b360c837`; vì exact v31 tag không
  phải ancestor của main, đã tạo checkpoint hợp nhất cục bộ
  `3cce675cea2bfdfd2fd29352f35a529e827cf46f` để giữ main public contract và
  đưa đúng source `vi-v0.31.0-7@70b2418f` vào baseline. Không push/tag/draft.
- Xác minh GitHub Latest thật, Windows x64 size/SHA-256 và rollback target khớp
  public contract; v31 là unsigned community pilot, không phải stable.
- Audit read-only session bằng chứng xác nhận 208 model calls và 235 tool results
  trên 11 user messages; cache hit 97,6%. Không có persisted context/quota error
  hay compaction, nên chưa gắn nhãn sai thành hard context failure.
- Phát hiện runtime/context skew: log từng cache gpt-5.6-sol Codex ở 272k, source
  v31 phải resolve lên 900k, còn UI có thể headline published 1,05M.
- Hoàn tất đọc 17/17 workflow/installer/bootstrap/updater/build/signing surface.
  Gate v32 phải đóng hard-coded stable channel, Node floor lệch, mac patch
  fail-open, POSIX rollback risk và Windows ARM64 capability disclosure.
- Môi trường cô lập đã khóa 253 Python package và 1.296 Node package; audit npm
  0 vulnerability. Baseline đạt 287 Context tests và 26 UI tests. Nhóm raw
  output/Tool Search/cache đạt 149 tests; bốn symlink tests đỏ trước sửa vì
  runner Windows không có quyền tạo symlink, hai ca skip.
- Kế hoạch và ba decision log nằm tại `docs/release-vi-v0.32.0-plan.md` và
  `docs/decisions/2026-08-24-*.md`. Trạng thái hiện tại: candidate only/NO-GO;
  candidate dự kiến `0.32.0-vi.1`, chưa build và chưa có hành động public.

## Cập nhật 2026-08-23 — successor candidate V31 `vi-v0.31.0-7`

- Exact-artifact Windows x64 gate đã loại `vi-v0.31.0-6` trước nút gỡ cuối.
  Installer per-user đăng ký đúng app tại
  `C:\Users\HermesSmokeV31\AppData\Local\Programs\Hermes`, nhưng registry thật
  dùng khóa `48ae4bdc-0f8d-5252-af1e-bf7c0a8c3649`; detached cleanup `-6` lại
  dùng nhầm `0a5f5eba-85bf-50cc-a4b2-3c1cbe76f61a`. Vì vậy không thể chứng minh
  mục gỡ cài đặt thật sẽ được xóa. Màn hình xác nhận đã bị hủy, chưa xóa app hay
  dữ liệu; tag/draft/asset `-6` tiếp tục riêng tư và bất biến.
- Biên nhận trước gỡ đã khóa đúng commit `bdf7a24e…`, phiên bản
  `0.31.0-vi.6`, 26.098 file app, 40 file profile và 91 file userData. Biên nhận
  registry riêng xác minh `InstallLocation`, `UninstallString` và
  `DisplayVersion` dưới đúng tài khoản smoke.
- Successor cục bộ là `vi-v0.31.0-7` / `0.31.0-vi.7`. Cleanup đã chuyển sang
  khóa electron-builder thật; regression mới tự tính UUID v5 từ
  `build.appId=com.nousresearch.hermes` với namespace electron-builder để phát
  hiện mọi lệch identity trong tương lai.
- Source gate cục bộ đạt: 31/31 Node release/evidence/public-contract, 18 file/
  333 test Electron release/runtime, 296/296 plugin, ba nhóm UI 389/389,
  70/70 và 161/161, cùng 15 file/829 test Python phát hành và GUI uninstall
  (1 skip theo nền tảng). Desktop typecheck, ESLint 0 lỗi (168 cảnh báo nền),
  Prettier cho implementation/docs đổi, dependency audit 0 lỗ hổng,
  `uv lock --check`, dependency pin, JSON/YAML, secret-pattern scan và
  `git diff --check` đều đạt; test updater giữ style gốc để tránh reformat
  ngoài phạm vi.
- Commit, push, tag, native build, draft và exact-artifact smoke `-7` vẫn đang
  chờ. Chưa có hành động public nào cho candidate `-7`.

## Cập nhật 2026-08-23 — successor candidate V31 `vi-v0.31.0-6`

- Exact-artifact keep-data uninstall đã loại `vi-v0.31.0-5`: current per-user
  app bị xóa và 0 tiến trình còn lại; 40/40 tệp profile cùng 88/88 tệp Electron
  userData cô lập giữ đúng SHA-256. Tuy nhiên registry gỡ cài đặt HKCU còn trỏ
  đến `Uninstall Hermes.exe` đã mất, còn Python cleanup quét nhầm bản all-users
  `C:\Program Files\Hermes` và thử xóa. Không có pre-snapshot của bản ngoài
  phạm vi nên không thể loại trừ xóa một phần. `-5` tiếp tục riêng tư, bất biến
  và không được promotion.
- Successor được khóa là `vi-v0.31.0-6` / `0.31.0-vi.6`. Desktop handoff nay
  buộc Python phase bỏ qua packaged app locations; detached cleanup là owner
  duy nhất của exact app path lấy từ executable đang chạy.
- Windows cleanup chỉ xóa hai key NSIS HKCU khi `InstallLocation` khớp chính
  xác current app path. Sibling path và bản all-users HKLM không đủ điều kiện
  bị đụng tới. App tree hiện tại vẫn được retry xóa sau teardown.
- Regression đã được viết trước và đạt: 26/26 Electron desktop-uninstall cùng
  9 test đạt/1 skip trong Python GUI uninstall. Kế hoạch mới nằm tại
  `docs/release-vi-v0.31.0-6-plan.md`.
- Metadata candidate, README/README.vi, release notes, working brief và updater
  ordering đã chuyển sang `-6`. Latest vẫn là `vi-v0.20.0-25`; rollback
  candidate vẫn là `vi-v0.20.4-39`.
- Source gate cục bộ đạt: 31/31 Node release/evidence/public-contract, 18 file/
  332 test Electron release/runtime, 296/296 plugin, ba nhóm UI 389/389,
  70/70 và 161/161, cùng 14 file/820 test Python phát hành. Desktop typecheck,
  ESLint 0 lỗi (168 cảnh báo nền), Prettier cho implementation/docs đổi,
  dependency audit 0 lỗ hổng, `uv lock --check`, dependency pin, JSON/YAML,
  secret-pattern scan và `git diff --check` đều đạt; hai test legacy giữ nguyên
  style gốc để tránh reformat ngoài phạm vi.
- Chưa commit, push, tạo tag `vi-v0.31.0-6`, build native, tạo draft, chạy
  exact-artifact smoke `-6` hoặc thực hiện hành động public.

## Cập nhật 2026-08-23 — successor candidate V31 `vi-v0.31.0-5`

- Exact-artifact Windows x64 smoke đã loại `vi-v0.31.0-4`: backend Gateway
  thay thế đạt PID `30636`, trạng thái `running` và `overall=ok`, nhưng menu
  vẫn hiện **Đã dừng**, cho phép **Khởi động** và vô hiệu hóa **Dừng** quá
  45 giây. Ảnh cùng quyết định NO-GO đã được lưu; tag, draft, asset và bằng
  chứng `-1` đến `-4` tiếp tục riêng tư, bất biến và không được promotion.
- Successor được khóa là `vi-v0.31.0-5` / `0.31.0-vi.5`. Khi menu Gateway
  đang mở, status được làm mới tuần tự theo đúng `connectionId + profile`, tự
  hội tụ từ snapshot dừng chuyển tiếp sang PID mới mà không cần bấm **Kiểm tra
  sức khỏe**. Polling dừng khi đóng menu, đổi owner hoặc unmount; request ID và
  owner generation tiếp tục loại phản hồi muộn.
- Run `32589995695` đã dựng đủ sáu target `-4`; attempt 1 và 2 gặp
  `HTTP 403: Resource not accessible by integration` khi tạo release, còn
  attempt 3 đã thành công sau khi khôi phục một ref tại candidate commit, tạo
  draft `-4` riêng tư với 30 asset. Workflow `-5` harden đường staging bằng
  cách giữ verify-job peeled-commit/HEAD binding và worktree-clean guard; tại
  stage, workflow fetch lại tag rồi buộc cả stage HEAD và tag commit mới resolve
  bằng commit đã xác minh trước metadata/create. `--verify-tag` được giữ,
  `--target` dư thừa bị bỏ và contract test khóa cả guard mới lẫn lệnh create,
  nên tạo draft không còn phụ thuộc ref phụ. Draft `-4` tiếp tục riêng tư và
  bất biến.
- Metadata, README/README.vi, release notes, working brief, updater/version
  regression và kế hoạch `docs/release-vi-v0.31.0-5-plan.md` đã chuyển sang
  `-5`. Latest vẫn là `vi-v0.20.0-25`; các mốc rollback hiện hành không đổi.
- Gate cục bộ đạt: 26/26 Node release/evidence/public-contract, 23/23 Vitest
  workflow/updater, 13/13 Vitest Gateway convergence, 19/19 Python stable
  update-channel, JSON/YAML parse và `git diff --check`.
- Chưa commit, push, tạo tag `vi-v0.31.0-5`, build artifact, tạo draft, chạy
  exact-artifact smoke `-5` hoặc thực hiện hành động public.

## Cập nhật 2026-08-23 — khóa controller promotion hậu tag `vi-v0.31.0-4`

- Candidate đã dựng vẫn là tag bất biến `vi-v0.31.0-4` tại commit
  `4e8910072d83a8b728d34711922c90ae4b6768e4`; checkout trong promotion tiếp tục
  lấy đúng `inputs.tag`, nên byte, manifest và provenance của candidate không đổi.
- Bản sửa hậu tag được cô lập thành checkpoint **control-plane-only** riêng:
  workflow yêu cầu `controller_sha` đủ 40 ký tự và bắt buộc nó bằng
  `${{ github.sha }}` của ref dùng để dispatch trước khi checkout candidate.
  Diff đang chờ commit/push bởi luồng phát hành; không được gắn lại tag `-4` vào
  commit controller.
- Promotion có hai nguồn gốc tách biệt và phải lưu cả hai: `head_sha` của run
  promotion là commit controller được chọn bằng `--ref`, còn tag, checkout,
  staging run và `candidate-provenance.json` tiếp tục trỏ commit candidate
  `4e8910072d83a8b728d34711922c90ae4b6768e4`.
- Kiểm tra bốn disclosure pilot đã chuyển sang validator Node chuẩn hóa khoảng
  trắng; validator tự thử một fixture bị xuống dòng và một fixture cố ý thiếu
  `SignPath` trước khi kiểm release body thật.
- Xác minh cục bộ đạt: workflow-contract Vitest 7/7, YAML parse, validator
  disclosure positive/negative/live, 26/26 Node release/evidence/public-contract
  và `git diff --check`.
- Lát cắt controller này không rebuild hoặc thay đổi installer/artifact, không
  sửa tag/target/manifest/provenance/evidence, không upload asset và không thay
  đổi trạng thái draft/public. Chưa commit, push, dispatch hoặc promotion trong
  bước ghi nhận này.

## Cập nhật 2026-08-23 — successor candidate V31 `vi-v0.31.0-4`

- Exact-artifact smoke của `vi-v0.31.0-3` trên Chrome 151 với profile và
  fixture cô lập đã loại candidate: truy vấn partition-aware vẫn trả preview
  rỗng khi optional host permission giữ cổng URL hiện tại và chỉ một scheme.
  Grant exact-host không cổng làm cookie website xuất hiện, khóa nguyên nhân ở
  hợp đồng permission thay vì pairing hoặc fixture. `-1/-2/-3` và draft/asset/
  evidence tương ứng tiếp tục bất biến; không candidate cũ nào được promotion.
- Candidate kế tiếp được khóa là `vi-v0.31.0-4` / `0.31.0-vi.4`. Connector xin
  đúng hostname ở cả HTTP/HTTPS, không mang cổng, không mở wildcard/eTLD+1; giữ
  `{ partitionKey: {} }` và thu hồi cả hai pattern mới cùng legacy
  origin-có-cổng. Giới hạn cookie miền cha ở subdomain được ghi rõ thay vì âm
  thầm mở rộng permission.
- Hợp đồng phân phối đã chuyển current candidate sang `-4` trong metadata,
  README/README.vi, release notes, working brief và regression updater/version.
  Kế hoạch mới nằm tại `docs/release-vi-v0.31.0-4-plan.md`; kế hoạch của ba
  candidate trước không bị sửa. Latest mặc định vẫn là `vi-v0.20.0-25`, mốc
  quay lui candidate vẫn là `vi-v0.20.4-39`.
- Gate cục bộ trên diff chung đạt: 26/26 Node release/evidence/public-contract,
  10 file/74 test Connector/import/pairing/UI/updater/workflow/distribution, 19/19
  stable update-channel, Desktop typecheck và ESLint 0 lỗi (168 warning nền có
  sẵn), cùng `git diff --check`. Bundle Connector dựng từ source freeze có
  SHA-256 `8e4d7b7615b8c88a51390145a923965bdffe5d1ddd298ad9d3d1974f738407aa`.
- Chưa commit, push, tạo tag `vi-v0.31.0-4`, build sáu artifact, tạo draft mới,
  chạy exact-artifact smoke `-4` hoặc thực hiện hành động public. Candidate vẫn
  NO-GO cho promotion cho tới khi các cổng đó có bằng chứng trên đúng byte.

## Cập nhật 2026-08-22 — successor candidate V31 `vi-v0.31.0-3`

- Exact-byte smoke của `vi-v0.31.0-2` trên Chrome 151 cho thấy website đã tạo
  và đang dùng cookie nhưng truy vấn mặc định của extension trả danh sách rỗng;
  cookie do extension API tạo mới hiện ra. `-2` chưa public và được giữ bất biến
  cùng `-1` thay vì sửa/rebuild asset cũ.
- Candidate kế tiếp được khóa là `vi-v0.31.0-3` / `0.31.0-vi.3`. Product
  `v31.0`, technical base `0.31.0`, upstream `0.20.4`, app identity, data root,
  lockfile và mười tên artifact không đổi. Latest mặc định vẫn là
  `vi-v0.20.0-25`; rollback candidate vẫn là `vi-v0.20.4-39`.
- Connector Chromium dùng truy vấn phân vùng tường minh để nhìn thấy cả hai
  nhóm, chỉ chuyển cookie không phân vùng còn hiệu lực và tiếp tục fail closed
  cho cookie phân vùng. Workflow contract khóa extension, cookie-import và
  pairing regression trước khi tạo draft.
- Gate cục bộ đã đạt: 31/31 release/version/evidence validator, 40/40
  Connector/updater/workflow Vitest, 296/296 plugin, 44 file/388 test Agents,
  12 file/70 test UI cố định, 19 file/161 test Advisor/ngôn ngữ, 18 file/310
  test release/Electron, typecheck, lint 0 lỗi, dependency audit 0 lỗ hổng,
  `uv lock --check`, đủ 10 URL trên README/README.vi/release notes, JSON/YAML,
  metadata nền không đổi và `git diff --check`.
- Windows Application Control chặn executable nằm trong `.venv`, nhưng runner
  chuẩn đã chạy được bằng CPython 3.11 gốc được phép với đúng site-packages của
  repo: `test_update_channel_stable.py` đạt 19/19. Toàn batch Python phát hành
  chạy đủ 820/820 assertion đạt; riêng subprocess Windows của
  `test_tui_gateway_server.py` không tự thoát sau khi báo 586/586 đạt và bị
  runner cưỡng dừng ở timeout. CI Linux chính tắc vẫn là gate bắt buộc trước
  khi tạo draft; đây là khoảng trống cleanup theo host, không phải test fail.
- Chưa commit, push, tạo tag, build artifact, tạo draft hoặc thực hiện hành động
  public cho `vi-v0.31.0-3`.

## Cập nhật 2026-08-22 — Gateway ngoài cùng bên trái trong header V31

- Header của phiên và từng session tile được khóa theo thứ tự cố định
  **Gateway → Agents → Ngữ cảnh → Advisor**. Gateway là control ngoài cùng bên
  trái, còn Agents, context/cost và Advisor giữ nguyên phạm vi theo từng phiên.
- Mọi thao tác Gateway trong header giữ cặp owner bất biến
  `connectionId + profile`. Profile multiplex không sở hữu lifecycle chỉ được
  xem chẩn đoán; owner mơ hồ hoặc backend cũ ở profile có tên sẽ fail closed,
  không rơi về Gateway đang foreground.
- Backend serialize start/restart/stop theo canonical lifecycle owner. Retry
  cùng verb tái sử dụng đúng action/PID; verb xung đột trả 409; các owner khác
  vẫn chạy độc lập. Webhook, WhatsApp và Telegram dùng chung registry này.
- UI chặn phản hồi status cũ sau đổi owner hoặc hai lượt tải cùng owner, dành
  60 giây cho ownership preflight, giữ thông báo timeout chuyên biệt và không
  cung cấp force-stop/uptime giả khi backend chưa có hợp đồng an toàn.
- Menu đã đủ EN/VI/JA/ZH/ZH-Hant cho copy mới. Candidate kế tiếp là
  `vi-v0.31.0-2` / `0.31.0-vi.2`; draft bất biến `vi-v0.31.0-1` được giữ nguyên
  và không được tái sử dụng artifact hay evidence.
- Gate cuối của lát cắt đạt: 43/43 backend lifecycle/multiplex, 42/42 UI owner,
  race, timeout và i18n, 44/44 file với 388/388 test trong batch Agents cố
  định, plugin 296/296, Desktop typecheck, ESLint 0 lỗi, Ruff, Prettier và
  `git diff --check`. Chưa push, tag, dựng artifact `-2` hoặc công bố.

## Cập nhật 2026-08-20 — khóa phạm vi candidate Hermes Vietnamese V31

- Chủ dự án chốt tên sản phẩm công khai là **Hermes Vietnamese** và cho phép
  hoàn tất candidate đa nền tảng để kiểm chứng; chưa cho phép thay Public
  Latest hoặc gọi candidate là stable.
- Tên hiển thị, shortcut, trình gỡ cài đặt, DMG, Linux desktop entry và Windows
  version resource được đồng bộ từ một hợp đồng metadata. Giới thiệu ứng dụng
  tách rõ Hermes Agent/Nous Research, Lê Đình Lực (LucDinhLe) và giấy phép MIT.
- Để cài đè giữ dữ liệu, app ID, package product name, executable, protocol,
  HERMES_HOME và updater repository vẫn giữ nguyên. Distribution test khóa
  các định danh này và candidate Windows sẽ dừng nếu đóng dấu metadata lỗi.
- Candidate dự kiến `vi-v0.20.4-38`, lớp `community-prerelease`; workflow dựng
  sáu target native và chỉ staging draft. Kế hoạch gate nằm tại
  `docs/release-vi-v0.20.4-38-plan.md`.
- Cổng cục bộ đạt 80 kiểm thử runtime/phát hành, 88 kiểm thử giao diện và 754
  kiểm thử Python liên quan pricing, gateway, Advisor, updater/rollback;
  typecheck, ESLint 0 lỗi, Ruff, npm audit 0 lỗ hổng, `uv lock --check`,
  Prettier mục tiêu và source build đều đạt.
- Chưa commit, push, tag, build candidate native hoặc tạo draft tại thời điểm
  ghi mục này.

## Cập nhật 2026-08-20 — chi phí USD theo từng phiên cho V31

- Meter cạnh Advisor hiển thị thêm chi phí model của đúng phiên khi panel đủ
  rộng; bảng chi tiết tách token đầu vào, đầu ra và cache.
- Tuyến API trực tiếp dùng chi phí ước tính theo bảng giá công khai. Tuyến
  Codex thuộc gói thuê bao hiển thị **đã gồm trong gói** kèm giá trị API tương
  đương để tham khảo, không diễn giải thành khoản người dùng sẽ bị trừ thêm.
- Cập nhật bảng giá chính thức GPT-5.5 và dòng GPT-5.6 tại ngày 2026-08-20;
  xử lý hệ số dài ngữ cảnh OpenAI trên từng lượt vượt 272.000 token và giữ bảng
  giá Claude hiện hành từ tài liệu Anthropic.
- Backend chuyển đủ token cache, trạng thái/nguồn giá và giá trị tham chiếu theo
  runtime session; giao diện không dùng mức chiếm cửa sổ ngữ cảnh để tính tiền.
- Xác minh cục bộ đạt 52/52 kiểm thử Python mục tiêu, 23/23 kiểm thử UI mục
  tiêu, Desktop typecheck, Ruff và `git diff --check`. Thay đổi chưa được push,
  đóng gói, tạo candidate hoặc phát hành.

## Cập nhật 2026-08-20 — meter ngữ cảnh theo từng phiên cho V31

- Chủ dự án chốt meter nằm cạnh Advisor, dùng dung lượng từng model theo công
  bố của nhà phát hành và giúp người dùng biết lúc nào cần compact hoặc mở phiên
  mới.
- Nhánh thực hiện `feat/v31-session-context-meter` được tạo từ đúng commit V30
  bất biến `0b53a0ab7bc48a2d6513a864df7176aafb2dbf07`; V30 không bị sửa.
- Hợp đồng hiển thị tách ba dữ kiện: dung lượng model công bố, giới hạn tuyến
  đang kết nối và ngưỡng compact thực của Hermes. Model chưa xác minh không
  được gắn nhãn số liệu chính thức.
- Đã triển khai cục bộ hợp đồng backend, nguồn tài liệu chính thức, meter theo
  từng `ChatView`, chế độ thu gọn theo container và bảng chi tiết ngưỡng
  compact. Nguồn công bố có liên kết trực tiếp tới tài liệu nhà phát hành.
- Kiểm chứng sau thay đổi đạt 16/16 kiểm thử UI mục tiêu, 7/7 kiểm thử context
  breakdown, 250/250 kiểm thử metadata/compressor, typecheck và lint mục tiêu.
  Kết quả đã được checkpoint bằng commit cục bộ trên nhánh V31; chưa push, tag,
  đóng gói hoặc phát hành.
- Đặc tả và tiêu chí nghiệm thu nằm tại
  `docs/hermes-v31-session-context-meter.md`.

## Cập nhật 2026-08-20 — chuẩn bị candidate V30 `vi-v0.20.4-37`

- Chủ dự án cho phép tạo candidate kế tiếp, build/staging và smoke Windows x64
  bằng hồ sơ cô lập; chưa cho phép promotion hoặc thay Public Latest.
- Candidate gom đúng V30 Foundation tại `8f9b5534c`, tài liệu ranh giới edition
  tại `db1c9b6b9` và bản sửa tương thích marker bootstrap cũ. Không đổi thương
  hiệu Hermes, MIT license, app identity, data root hoặc updater feed.
- Workflow candidate gọi đích danh kiểm thử Dự án, Thống kê sử dụng, tiến trình
  công việc, panel phải, Advisor và runtime marker cũ. Promotion pilot về sau
  phải có bằng chứng các bề mặt này trước khi được phép công khai.
- Tag dự kiến là `vi-v0.20.4-37`, lớp `community-prerelease`; rollback kỹ thuật
  cho lỗi đường nâng cấp là `vi-v0.20.4-34`. Chưa tạo commit/tag/draft/artifact
  tại thời điểm ghi mục này.

## Cập nhật 2026-08-20 — chốt V30 Foundation và kiến trúc AI for Boss Edition

- Chủ sản phẩm đã chấp thuận mô hình một lõi Hermes-derived công khai theo MIT
  và một lớp AI for Boss source-available/thương mại nằm ở kho riêng. Lõi chỉ
  cung cấp hợp đồng edition trung tính; mã, thương hiệu, pháp lý, updater và
  dịch vụ riêng của AI for Boss không được nhập ngược vào lõi.
- Bốn nhóm thay đổi hậu V29 đã được checkpoint sạch trên branch
  `feat/v30-foundation` tại commit
  `8f9b5534c0c831cb953ccbd3852feab4febb8d9e`: Advisor trong từng phiên,
  Dự án/Thống kê sử dụng, panel phải và tiến trình công việc có cấu trúc.
- Gate cục bộ đạt: 16 kiểm thử Python mục tiêu, 99 kiểm thử UI, Desktop
  typecheck, Ruff, Prettier và `git diff --check`; ESLint đạt 0 lỗi với 133 cảnh
  báo nền có sẵn.
- Lệnh build gộp vẫn bị Windows Device Guard chặn binary `uv` trong AppData.
  Các bước tương đương đã đạt: tạo install stamp bằng venv, build connector và
  renderer, bundle Electron, stage native dependencies, stage Agent payload và
  `assert-dist-built`. Bước bundle Electron cần chạy ngoài sandbox sau lỗi
  Access Denied; không có bước phát hành nào được thực hiện.
- Chưa đổi root MIT license, app identity, dữ liệu, updater, signing hoặc tên
  hiển thị. Chưa chọn văn bản license thương mại và chưa thông qua nhãn hiệu
  **AI for Boss**.
- Tài liệu quyết định và cổng nghiệm thu:
  `docs/hermes-v30-foundation-and-ai-for-boss-edition.md`. Bước nhỏ kế tiếp là
  thiết kế Edition Contract trung tính trên một branch riêng, sau đó mới tạo
  product-overlay repo sạch; chưa áp brand AI for Boss vào ứng dụng.
- Không push, PR, tag, candidate, installer hoặc thay Public Latest.

## Cập nhật 2026-08-20 — tiến trình công việc và checkpoint Advisor trong từng phiên

- Mỗi phiên nay có một dòng tiến trình tạm thời ngay trong hội thoại, gồm việc
  Hermes đang làm và lý do vận hành của bước đó. Dòng này theo các nhịp phân
  tích yêu cầu, suy luận bước kế tiếp, chuẩn bị/chạy/kiểm tra công cụ, tóm tắt
  ngữ cảnh và soạn kết quả; tự biến mất khi hoàn tất, lỗi, dừng hoặc runtime bị
  thu hồi. Không có công tắc bật/tắt riêng.
- Agent phát sự kiện có cấu trúc khi Advisor bắt đầu và kết thúc checkpoint
  **kế hoạch**, **hướng xử lý mới** và **kết quả cuối**. Giao diện hiển thị rõ
  mục đích của lượt gọi, trạng thái đạt/yêu cầu sửa/không sẵn sàng/chưa giải
  quyết và nhận xét ngắn đã được giới hạn; không suy đoán từ chuỗi tiếng Anh và
  không trình bày chain-of-thought ẩn.
- Trạng thái được khóa theo runtime session. Phiên chính và từng tile không thể
  ghi đè tiến trình của nhau; các đường kết thúc thiếu `message.complete` và
  thao tác dừng cũng dọn đúng trạng thái của phiên liên quan.
- Xác minh cục bộ: 25/25 kiểm thử Python Advisor/gateway, 58/58 kiểm thử UI liên
  quan, Desktop typecheck, Ruff, Prettier và `git diff --check` đạt. ESLint toàn
  dự án đạt 0 lỗi, còn 133 cảnh báo nền có sẵn.
- Chuỗi build cục bộ đã dựng thành công renderer production, Electron main và
  preload, native dependencies rồi qua `assert-dist-built`. Lệnh build gộp ban
  đầu bị Windows Device Guard chặn binary `uv` trong AppData; bước tạo install
  stamp được chạy tương đương bằng Python của venv dự án. Payload Agent cục bộ
  là thin stub vì lượt này không bật chế độ build release resident.
- Tài liệu phạm vi và rollback: `docs/hermes-session-work-progress.md`. Thay đổi
  hiện chỉ nằm trong worktree, chưa commit, push, tạo candidate hoặc phát hành.

## Cập nhật 2026-08-20 — khôi phục panel phải và hoàn thiện danh mục Advisor

- Hồ sơ mới mặc định mở lại panel công cụ ngoài cùng bên phải, gồm **Tệp**,
  **Trình duyệt** và **Terminal**. Hồ sơ đã chạy bản lỗi được chuyển đổi một
  lần từ trạng thái đóng mặc định sang mở; sau đó lựa chọn đóng/mở của người
  dùng tiếp tục được lưu và tôn trọng ở lần mở sau.
- Menu model Advisor tiếp tục lấy toàn bộ model từ mọi nhà cung cấp đã kết nối.
  Fixture kiểm thử Windows nay mô phỏng hai nhà cung cấp và năm model để lượt
  nghiệm thu giao diện không còn tạo ấn tượng sai rằng chỉ có một lựa chọn.
- Việt hóa mục `Scheduled jobs` thành **Tác vụ định kỳ** trong thanh trái.
- Xác minh cục bộ: 24/24 kiểm thử UI liên quan đạt, Desktop typecheck đạt,
  ESLint toàn dự án 0 lỗi (133 cảnh báo nền), Prettier đạt, `git diff --check`
  đạt và production build đạt.
- Smoke giao diện Windows x64 trong hồ sơ tạm cô lập xác nhận panel phải hiện
  đủ Tệp/Trình duyệt/Terminal, menu Advisor hiện 5 model thuộc 2 nhà cung cấp,
  đổi thành công từ `gpt-5.6-sol` sang `claude-sonnet-5`, và nhãn **Tác vụ định
  kỳ** hiển thị đúng. Không đọc hoặc ghi dữ liệu Hermes đang cài.
- Thay đổi hiện chỉ nằm trong worktree, chưa commit, push, tạo candidate hoặc
  cập nhật bản Hermes đang cài.

## Cập nhật 2026-08-19 — đưa Dự án và Thống kê sử dụng ra thanh trái

- Ngay dưới **Phiên mới** có hai mục cố định mới: **Dự án** và
  **Thống kê sử dụng**. Cả hai mở trong panel giữa như các trang Kỹ năng/Tệp kết
  quả và không chiếm panel công cụ ngoài cùng bên phải.
- Trang **Dự án** lấy trực tiếp cây dự án hiện có, cho phép tạo, tìm, mở,
  ghim/bỏ ghim; mỗi dự án hiển thị thư mục chính, số phiên và tổng token đã dùng.
  Dự án ghim được đưa lên đầu; thứ tự ghim hiện có trong sidebar vẫn được giữ.
- Trang **Thống kê sử dụng** dùng cùng nguồn analytics của Hermes, có bộ lọc
  7/30/90 ngày, token vào/ra theo ngày và danh sách model kèm lượng token tiêu
  thụ. Dữ liệu bám theo hồ sơ Hermes đang hoạt động và gồm cả lượt gọi phụ như
  Advisor khi backend đã ghi nhận.
- Sửa phần **Ý tưởng** trong hộp tạo dự án: bỏ câu sai thời điểm “đã lưu vào
  IDEA.md”, ghi rõ đây là nội dung không bắt buộc và chỉ được lưu thành
  `IDEA.md` trong thư mục chính sau khi người dùng tạo dự án.
- Xác minh cục bộ: 87/87 kiểm thử mục tiêu đạt, Desktop typecheck đạt, ESLint 0
  lỗi (133 cảnh báo nền), Prettier đạt và production build đạt.
- Smoke giao diện bằng `dev:mock` trên Windows x64 đã mở đúng bản build trong
  hồ sơ tạm cô lập: **Dự án**, **Thống kê sử dụng** và thanh Advisor kèm model
  `mock-model` xuất hiện đúng vùng làm việc. Công cụ mở thử cũng đã nhận đúng
  tên nhị phân `electron.exe` trên Windows thay vì chỉ tìm tên POSIX.
- Thay đổi hiện chỉ nằm trong worktree, chưa commit, push, tạo candidate hoặc
  cập nhật bản Hermes đang cài.

## Cập nhật 2026-08-19 — gom toàn bộ điều khiển Advisor vào phiên làm việc

- Bỏ khu vực bật/tắt và chọn model Advisor khỏi **Cài đặt → Model**; trang Cài
  đặt cũng không còn hiện cảnh báo định tuyến cũ của riêng tác vụ Advisor.
- Thanh Advisor trong panel giữa giữ công tắc theo từng phiên và có thêm nút
  model kèm mũi tên xuống. Menu dùng danh mục model chung nhưng chỉ lấy các nhà
  cung cấp đã kết nối, luôn mở đủ model và không phụ thuộc trạng thái thu gọn
  hoặc danh sách rút gọn của menu model làm việc.
- Chọn model ghi vào định tuyến `auxiliary.advisor` của hồ sơ đang hoạt động,
  cập nhật giao diện tức thời và hoàn tác nếu backend từ chối. Cấu hình model
  Advisor vẫn dùng chung trong hồ sơ; trạng thái bật/tắt tiếp tục tách theo phiên.
- Xác minh cục bộ: 48/48 kiểm thử mục tiêu đạt, Desktop typecheck đạt, ESLint và
  Prettier các tệp thay đổi đạt, `git diff --check` đạt và production build đạt.
- Thay đổi hiện chỉ nằm trong worktree, chưa commit, push, tạo candidate hoặc
  đưa vào bản Hermes đã cài trên máy.

## Cập nhật 2026-08-19 — chuẩn bị candidate Hermes Vietnamese v29

- Chủ dự án cho phép phát hành v29. Candidate hiện tại là
  `vi-v0.20.4-36`, lớp `community-prerelease`; bản này không thay Public Latest
  v25 nếu chưa có quyết định riêng.
- Candidate bất biến `vi-v0.20.4-35` đã dừng trước promotion: exact-artifact
  smoke chứng minh Advisor được ghi đúng vào `state.db` nhưng phản hồi cold
  resume không trả lại `advisor_enabled`, làm công tắc hiện tắt sau khi mở lại.
  Không thay tag/asset `-35`; bản sửa và regression test đi vào `-36`.
- Viết lại toàn bộ ghi chú phát hành theo góc nhìn sản phẩm: Hermes Vietnamese
  có gì hơn cách dùng Hermes mặc định và từng lợi thế giúp người dùng thế nào.
  Phần giới thiệu không dùng changelog hoặc kể thay đổi qua v26–v28.
- Hồ sơ công khai bao quát runtime/installer resident, workspace nhiều phiên và
  dự án, Browser dùng chung, Connector có consent, tóm tắt reasoning tiếng Việt,
  Advisor theo từng phiên, Project pin và cập nhật cộng đồng giữ dữ liệu.
- Workflow candidate gọi đích danh test Advisor bar, project menu, thứ tự/cách
  ly pin và backend Advisor theo phiên. Promotion pilot bổ sung cổng pane
  isolation, session scope, project pin/reorder và chuyển tiếp exact v28 → v29.
- Cổng source hiện đạt: 9/9 tag/runtime input, 23/23 release/updater Electron,
  49/49 UI v29, 21/21 backend Advisor, Desktop typecheck, ESLint 0 lỗi (133 cảnh
  báo nền), Ruff, Prettier, `uv lock --check` và npm runtime audit 0 lỗ hổng.
- Chưa push nhánh, tạo PR/tag/draft/artifact hoặc công khai release. Bước tiếp
  theo là commit sạch, push/fetch độc lập, chạy CI rồi mới tạo tag candidate.

## Cập nhật 2026-08-19 — Advisor theo phiên và dự án ghim

- Thêm thanh bật/tắt Advisor ngay dưới đầu mỗi phiên trong panel giữa. Thanh
  dùng biên bố cục riêng của `ChatView`, tự ẩn model rồi ẩn nhãn khi người dùng
  kéo hẹp và không chiếm sang panel Tệp/Trình duyệt/Terminal ngoài cùng bên phải.
- Advisor nay có trạng thái riêng cho từng phiên, truyền qua `session.create`,
  `session.info` và `config.set` có `session_id`; thay đổi ở một phiên không ghi
  đè mặc định hồ sơ hoặc phiên khác. Trạng thái được lưu và khôi phục khi mở lại.
- Bảo vệ hai trường hợp biên: ID phiên đã cũ trả lỗi và hoàn tác giao diện thay
  vì rơi xuống ghi cấu hình toàn cục; compute-host áp dụng lại override mới cho
  phiên đã tồn tại ở lượt tiếp theo.
- Panel trái có khu vực **Dự án đã ghim** dạng một dòng. Menu thường và menu
  chuột phải hỗ trợ Ghim/Bỏ ghim; người dùng có thể kéo thả đổi thứ tự. Pin chỉ
  lưu ID theo từng kết nối, không di chuyển hay sao chép dữ liệu dự án.
- Xóa/loại dự án sẽ xóa pin; khi dự án tự phát hiện được nhận làm dự án chính
  thức, pin được chuyển sang ID mới mà không mất vị trí.
- Xác minh: 335 kiểm thử UI liên quan Advisor/sidebar/project đã đạt ở các lượt
  mục tiêu; 45/45 kiểm thử updater và 10/10 kiểm thử backend Advisor đạt;
  Desktop typecheck, ESLint, Ruff, `git diff --check` và production build đều
  đạt. Lượt UI toàn cục không tự kết thúc trong môi trường jsdom do các ca Canvas
  cũ nên đã dừng, không được ghi nhận là đạt.
- Tài liệu phạm vi: `docs/hermes-v29-session-advisor-and-project-pins.md`.
  Chưa push, tạo PR, tag, candidate hoặc phát hành.

## Cập nhật 2026-08-19 — sửa đường cập nhật đóng gói cho bản sau v28

- Làm rõ nguyên nhân màn hình v28 báo không truy cập được máy chủ cập nhật:
  release `vi-v0.20.4-34` không có `latest*.yml`, còn GitHub provider của
  `electron-updater` không coi nhãn `vi-vX.Y.Z-N` là SemVer hợp lệ.
- Nhánh cục bộ `feat/v29-community-updater` thêm resolver đọc GitHub Releases
  công khai, bỏ draft/release thiếu manifest của target, chọn bản cộng đồng mới
  nhất rồi ghim generic feed vào URL release bất biến.
- Workflow candidate sinh đủ bốn manifest Windows/macOS/Linux từ đúng artifact
  đã gom, ghi SHA-512 + byte size, sau đó mới lập `SHA256SUMS.txt` và upload
  draft. Download vi sai vẫn tắt để cài đúng byte đã nghiệm thu.
- Windows handoff đổi sang silent + relaunch. Nhận diện nâng cấp
  `com.nousresearch.hermes`, tên executable/shortcut/uninstall và vùng dữ liệu
  vẫn giữ nguyên; onboarding/config/chat không bị reset bởi update.
- About hiển thị dự án gốc/nhà phát hành Nous Research, người duy trì bản Việt
  hóa Lê Đình Lực (LucDinhLe), giấy phép MIT và kênh GitHub Releases. Bản đóng
  gói không còn hiện `nhánh unknown · commit unknown`; link tải lại trỏ về
  release cộng đồng.
- Install stamp của build đóng gói dùng đúng `X.Y.Z-vi.N`, thay cho version
  nguồn dạng `X.Y.Z+distance` từng xuất hiện lệch với bộ cài.
- Gate workflow-equivalent cục bộ hiện đạt: 128/128 Electron/release, 110/110 UI
  gồm About/Advisor/onboarding, 126/126 Python release và Desktop typecheck.
  Bản dựng production Desktop và ESLint toàn dự án đều đạt; còn 133 cảnh báo
  lint nền đã có sẵn, không có lỗi mới. Chưa dựng artifact native,
  chưa chạy update-from-v28 exact-artifact, chưa push/tag/draft/public release.
- v28 không thể tự nhận code sửa này. Bản sửa đầu tiên cần cài thủ công một lần;
  các bản sau mới đi qua nút **Cập nhật ngay** và cài yên lặng.

## Cập nhật 2026-08-19 — chặn candidate v28 cho tới khi cài lại sạch

- Candidate bất biến `vi-v0.20.4-29` dừng ở Windows ARM64 do Git for Windows
  `tar` hiểu đường dẫn ổ đĩa như tên máy; `vi-v0.20.4-30` dừng ở verifier do
  so sánh chuỗi đường dẫn `tar.exe` khác dấu phân cách. Cả hai tag được giữ
  nguyên làm bằng chứng và không được di chuyển hoặc tái sử dụng.
- Candidate `vi-v0.20.4-31` đã dựng đủ 6/6 target và tạo draft prerelease 26
  asset tại workflow `32165043998`; tải ngược từng asset khớp byte, checksum và
  provenance. Candidate vẫn **NO-GO** vì Install & Update E2E phát hiện bộ cài
  chạy lại thất bại ở bước Node dependencies.
- PR #38 vẫn mở dạng draft, có nhãn `ci-reviewed`. CI commit
  `0c7972bff2f426b59368fb5d4ed664749bb4e1d3` đạt ở lượt chạy lại
  `32171281649`; Public Latest vẫn là `vi-v0.20.0-25`.
- E2E chẩn đoán từ đúng bản công khai v25 tại run `32171292220` giữ được lỗi
  gốc: npm trả `ENOTEMPTY` khi đổi `node_modules/ink` sang thư mục tạm
  `.ink-xKZbo5aM` còn sót từ lần cài trước. Đây là lỗi tính lặp lại an toàn của
  installer, không phải lỗi mạng hoặc thiếu package.
- Checkpoint `bc7cefa6f92cac98350b74e3e769e0cd3728e0d7` đã qua CI và Docker.
  E2E kế tiếp `32174589129` xác nhận bộ dò tìm đúng toàn bộ rename target nhưng
  npm tiếp tục tự dừng với `Exit handler never called`; cây `node_modules` bị
  gián đoạn trên diện rộng nên không còn an toàn để sửa từng thư mục.
- Checkpoint `df8f41dbc1ce78f2f9ae7e41f8c0936bee87a366` đã qua CI
  `32175819273` và Docker `32175818327`. E2E `32176441666` xác nhận việc dựng
  lại toàn bộ cây dependency vẫn kết thúc sau khoảng 71 giây với cùng lỗi npm.
  Ba lượt npm của bản v25 cũng dừng theo cùng nhịp; proxy ghi hàng loạt TLS EOF.
  Đối chiếu cấu hình cho thấy sandbox chỉ đưa CA Internet thật vào
  `NODE_EXTRA_CA_CERTS`, trong khi chính proxy E2E cấp chứng thư bằng CA tạm của
  sandbox. Bản sửa hiện dùng bundle kết hợp hai CA, giữ xác minh TLS và đồng
  thời lưu `~/.npm/_logs` vào artifact nếu còn lỗi.
- Bộ cài nay chỉ kích hoạt phục hồi khi thấy staging npm hậu tố 8 ký tự đồng
  thời có package gốc cùng tên. Khi đó nó dựng lại ba cây dependency có thể tái
  tạo của root, TUI và web; source, lockfile, config và dữ liệu người dùng không
  bị chạm. Một thư mục ẩn chỉ giống tên nhưng không có package gốc sẽ không kích
  hoạt việc dọn cây.
- `bash -n scripts/install.sh` đạt. Các ca hành vi Linux phải đạt trên CI và E2E
  v25 phải xanh trước khi push candidate. Candidate kế tiếp, nếu toàn bộ CI và
  E2E công khai đều xanh, là `vi-v0.20.4-32`.

## Cập nhật 2026-08-18 — chuẩn bị Hermes Vietnamese v28

- Worktree `projects/hermes-v28`, nhánh `release/v28-upstream-sync`, đồng bộ từ
  upstream tag đã ký `v2026.8.18`, commit
  `e624e9fde561e1add9388384012b295fde669ade`, Hermes Agent `0.20.4`.
- Phạm vi v28 giữ trọn Connector và tóm tắt reasoning của v26, Advisor của v27;
  sửa fresh profile mặc định tiếng Việt và đổi ô nhập thành **Gửi yêu cầu**.
- Khôi phục kênh cập nhật stable theo tag cộng đồng `vi-v*`; các đường cài,
  cập nhật, eject, release notes và bootstrap runtime đã trỏ về
  `LucDinhLe/hermes-agent-vietnamese`. Eject tải script từ đúng commit đã đóng
  gói, thay vì giao commit cộng đồng cho bộ cài upstream.
- Stable resolver đọc GitHub Releases công khai và lọc draft, nên tag candidate
  chưa promotion không bị đưa sớm tới các máy đang dùng.
- Nâng Electron lên `42.8.0`, nanoid lên `3.3.18`; `npm audit` runtime và đầy đủ
  đều trả `0 vulnerabilities`; `uv lock --check` đạt.
- Cổng nguồn đã đạt: 120/120 release/runtime tests, 92/92 UI release + Advisor,
  126/126 Python release tests, 11/11 eject tests, Desktop typecheck và production
  source build. ESLint đạt 0 lỗi, còn 135 cảnh báo nền upstream được giữ công khai.
- Full UI trước sửa có 4.779 test đạt và 8 lỗi; ba hồi quy thật đã được sửa, các
  tệp ảnh hưởng và đúng suite workflow đều xanh. Full Electron có 1.463 test đạt,
  28 lỗi và 3 skip do giả định POSIX/quyền/timing trên Windows; đúng suite release
  workflow đạt sạch. Hai full-suite này không được diễn giải thành toàn bộ xanh.
- Draft PR #38 đã mở và gắn `ci-reviewed`; CI nguồn cùng Docker xanh tại commit
  `cd701e873ec43c04c93c200929237a62b1d074e0`.
- Candidate bất biến `vi-v0.20.0-28` bị cổng build từ chối trước khi tạo draft vì
  tag mang version `0.20.0` không khớp version nguồn upstream `0.20.4`. Tag lỗi
  được giữ nguyên làm bằng chứng, không di chuyển hoặc tái sử dụng.
- Candidate bất biến `vi-v0.20.4-28` đã qua cổng tag/version nhưng native build
  phát hiện pipeline resident vẫn kỳ vọng `agent-browser@0.26.0` ở root, trong
  khi upstream 0.20.4 đã chủ ý chuyển gói này ra khỏi workspace dependency graph.
  Không có draft hay artifact nào được tạo; tag tiếp tục được giữ nguyên làm
  bằng chứng thất bại.
- Candidate thay thế phải dùng `vi-v0.20.4-29`, lấy tarball browser bất biến vào
  vùng dựng release riêng rồi nhúng vào payload resident, không đưa dependency
  trở lại root; sau đó dựng lại sáu target, tải exact artifact và chạy
  smoke/rollback theo workflow.
- PR CI đã chặn thử nghiệm đưa dependency trở lại root tại commit `c624465d5`;
  commit này không được gắn tag. Bản sửa kế tiếp giữ nguyên hợp đồng lazy của
  upstream và khóa tarball resident riêng bằng SHA-512.
- Public Latest vẫn là `vi-v0.20.0-25`; rollback giữ `vi-v0.20.0-14`. Candidate
  v28 chỉ được công khai dạng community prerelease sau toàn bộ exact-artifact gate.

## Cập nhật 2026-08-18 — bổ sung Giám sát (Advisor) và mở candidate kế tiếp

- Xác nhận `vi-v0.20.0-26` đã là tag bất biến tại
  `8ea73dcb475e32b8171bb970cc98ba809119f9b8`; không di chuyển hoặc dựng lại tag.
  Phạm vi v26 mở rộng chỉ có thể đi vào candidate kế tiếp
  `vi-v0.20.0-27` sau khi commit sạch, push và CI nguồn xanh.
- Thêm Advisor mặc định tắt, chỉ đọc và không có tools. Khi bật, Hermes tự rà
  soát trước mutating batch đầu tiên, khi đổi nhóm công cụ/lặp lỗi và trước kết
  quả cuối; verdict `PASS/REVISE/ASK_USER/BLOCK`, mặc định tối đa hai vòng sửa.
- Batch bị yêu cầu sửa được đóng đủ synthetic tool result theo từng
  `tool_call_id`; final candidate bị từ chối chỉ là scaffolding tạm và bị loại
  khỏi transcript bền vững. Review packet redaction secret và không chứa hidden
  chain-of-thought.
- Settings → Model có mục **Giám sát (Advisor)** ngay sau model chính, chỉ gồm
  công tắc bật/tắt và bộ chọn provider/model. Không thêm nút gọi thủ công trong
  chat. Cấu hình/model tách profile và áp dụng cho phiên mới.
- Cổng release nay gọi đích danh test Advisor Python, vòng hội thoại, model UI
  và i18n; promotion pilot yêu cầu evidence off-zero-call, plan/recovery/final,
  read-only, bounded revision và model persistence.
- Kiểm thử hiện tại: 119/119 Electron/release, 61/61 UI v26 cũ,
  26/26 Advisor UI+i18n, 107/107 Python release và Desktop typecheck đều đạt.
  Một lượt chạy hai suite UI đồng thời từng timeout do tải máy; workflow đã tách
  suite Advisor và cả hai suite đều xanh khi chạy tuần tự. Chưa build candidate mới, chưa tạo tag,
  draft hay public release. GitHub CLI hiện không xác thực được nên chưa thể
  push/tạo draft PR hoặc đọc CI từ máy này.

## Cập nhật 2026-08-17 — khóa cổng candidate và promotion v26

- Workflow tạo candidate nay gọi đích danh test extension MV3, ba lớp Connector
  Electron, consent UI, preview pane, reasoning UI/store và RPC Python; không còn
  dựa vào việc test mới vô tình được suite tổng quát thu thập.
- Promotion community pilot bắt buộc bằng chứng Windows x64 cho Chrome/Edge
  profile cô lập, consent/revoke/persistence/redaction, reasoning bật/tắt và giữ
  nguyên bản gốc, safe tool, update exact v25, repair/uninstall và rollback.
- Cổng release local sau thay đổi đạt 119/119 Electron/release tests, 61/61 UI
  tests và 36/36 Python release tests. Desktop typecheck, `uv lock --check`,
  dependency production audit (0 vulnerability) và scan mẫu secret trên toàn bộ
  diff v26 đều đạt.
- Full UI trước đó đạt 3.700 test và có 4 timeout không tái hiện khi chạy riêng;
  full Electron có 20 lỗi thuộc giả định POSIX/quyền Windows, trong khi đúng bộ
  release workflow đạt sạch. Hai kết quả full-suite này được giữ là cảnh báo môi
  trường, không được ghi thành gate xanh.
- Release notes được chuyển sang v26 và cố ý ghi candidate-only. Public Latest
  vẫn là `vi-v0.20.0-25`; chưa có tag, draft hoặc artifact v26 tại thời điểm này.

## Cập nhật 2026-08-17 — hoàn thiện lát cắt tóm tắt reasoning tiếng Việt v26

- Thêm RPC stateless `reasoning.summarize`: backend kiểm SHA-256, giới hạn
  reasoning công khai ở 64 KiB và gọi riêng auxiliary task
  `reasoning_summary_vi`; không ghi vào transcript hoặc prompt của phiên chính.
- Tùy chọn **Tóm tắt suy luận bằng tiếng Việt** mặc định tắt. Khi tắt, đường
  hậu xử lý dừng trước hash và tạo đúng zero model call; khi bật chỉ chạy sau
  `message.complete`, tối đa một lần cho cùng digest.
- Giữ nguyên reasoning và câu trả lời gốc; summary nằm trong panel riêng với
  model, độ trễ và trạng thái chi phí/usage. Lỗi auxiliary chỉ hiện trong panel,
  không đổi lượt chính thành lỗi.
- Cache local tách transcript, không lưu reasoning nguồn, bị khóa theo
  `profile + session lineage + message id + source SHA-256`, giới hạn 120 bản
  ghi/1 MiB, phục hồi qua restart và có nút xóa trong Settings.
- Bổ sung copy VI/EN/JA/ZH/ZH-Hant và cấu hình model riêng cho task. Kiểm thử
  targeted hiện đạt 58 Python tests, 22 Desktop tests, Desktop typecheck và
  lint thay đổi đều không lỗi/cảnh báo.

## Cập nhật 2026-08-17 — khóa threat model và đặc tả v26

- Tạo worktree sạch `feat/v26-secure-connector` từ `origin/main` tại
  `4d597f74600cdc3791edf7d34566534182946c55`; không chạm các worktree cũ và giữ
  nguyên release/tag/asset v25.
- Xác minh baseline: 6/6 public-release tests, 18/18 preview/reasoning UI tests,
  26/26 bundled-runtime/hardening tests và Desktop typecheck đều đạt trong môi
  trường cô lập, dùng đúng lockfile.
- Khóa threat model tại `docs/hermes-connector-v26-threat-model.md`: consent hai
  phía, optional domain permissions, loopback một lần, metadata-only IPC,
  RAM-only payload, import đúng `persist:hermes-preview` và revoke theo ledger.
- Khóa quyết định bỏ qua có cảnh báo đối với partitioned cookie vì Electron 41
  chưa có API giữ `partitionKey`; không hạ cấp thành cookie không phân vùng.
- Khóa đặc tả tại `docs/hermes-v26-spec.md`; nền móng trust v26 chỉ dành cho
  companion chính chủ. Extension Manager tổng quát được hoãn sang v27.
- Tạo `docs/release-vi-v0.20.0-26-plan.md` với cổng Chrome/Edge profile cô lập,
  exact Windows x64, update v25 -> v26, redaction và public GO/NO-GO.

## Cập nhật 2026-08-17 — bàn giao v25 và khởi động phạm vi v26

- Đóng gói toàn bộ hành trình từ tiếp nhận v15 tới public thành công v25 tại
  `docs/release-vi-v0.20.0-25-retrospective.md`, gồm sự cố, nguyên nhân gốc,
  candidate v15–v24, cổng hồi quy, workflow bằng chứng và audit sau public.
- Đưa `docs/release-engineering-rulebook.md` vào repository làm hợp đồng phát
  hành chính thức; bổ sung cổng điều hướng công khai để chặn README/Latest trỏ
  nhầm phiên bản sau promotion.
- Tạo `docs/handoff-vi-v0.20.0-26.md` với nguồn sự thật, ranh giới bất biến của
  v25, gaps còn mở, bản đồ mã và prompt tiếp quản cho phiên mới.
- Phạm vi định hướng v26 gồm Hermes Connector cho Chrome/Edge để chuyển cookie
  theo domain với consent rõ ràng, nền móng extension tin cậy và tùy chọn tóm
  tắt reasoning công khai bằng tiếng Việt. Không hứa tương thích mọi extension
  Chrome Web Store và không cố lấy chain-of-thought ẩn.
- Chưa viết mã v26, chưa tạo candidate/tag/artifact và không thay release v25.

## Cập nhật 2026-08-17 — viết lại mô tả và hướng dẫn cài v25

- Viết lại phần giới thiệu công khai theo hành trình của người mới: lý do dự án
  tồn tại, nhóm người dùng, nguồn gốc Hermes Agent, giấy phép MIT và phạm vi duy
  trì độc lập của Lê Đình Lực.
- Bổ sung bảng điểm mạnh so với cách tự cài Hermes Agent từ mã nguồn, hướng dẫn
  kiểm tra kiến trúc máy, chọn đúng artifact và kết nối ChatGPT, Claude,
  Gemini hoặc nhà cung cấp khác sau cài đặt.
- Loại mục liệt kê thay đổi kỹ thuật của v25 khỏi phần giới thiệu release; giữ
  riêng tình trạng kiểm thử, ký số, nền tảng build-only và rollback để người dùng
  hiểu đúng rủi ro.
- Thêm bốn ảnh cảnh báo Edge do người duy trì cung cấp vào hướng dẫn Windows,
  README tiếng Việt và ghi chú phát hành. Hướng dẫn chỉ cho phép bỏ chặn khi đúng
  nguồn, đúng tên và đúng SHA-256; cảnh báo phát hiện mối đe dọa cụ thể phải dừng.
- Thêm regression khóa sự tồn tại và liên kết của bốn ảnh, đồng thời cấm đưa
  lại mục `Cải thiện trong bản v25` vào phần giới thiệu công khai.

## Cập nhật 2026-08-17 — sửa đường tải công khai v14 trỏ nhầm

- Sau khi `vi-v0.20.0-25` được công bố, README, hướng dẫn cài Windows và GitHub
  `Latest` vẫn trỏ `vi-v0.20.0-14`. Người duy trì và ít nhất một người dùng đã
  tải nhầm v14; đây là lỗi đồng bộ phát hành, không phải lỗi hồ sơ cục bộ.
- Bản Windows x64 v25 đã được người duy trì tải trực tiếp và cài thành công.
  Artifact công khai giữ nguyên 332.776.297 byte, SHA-256
  `0f31c4a23bbb7913300b3f3571ad346aae517d367705a965d451a1febf620e59`.
- Theo quyết định sản phẩm mới, v25 được dùng làm bản tải mặc định để lấy phản
  hồi cộng đồng nhưng vẫn giữ nhãn pilot, công khai rõ năm target build-only và
  tình trạng chưa ký số. v14 chỉ còn là mục tiêu rollback.
- Hợp đồng tài liệu mới khóa tag tải mặc định và toàn bộ tên asset giữa README,
  hướng dẫn và release notes để chặn tái diễn việc công bố một bản nhưng hướng
  người dùng sang bản khác.

## Cập nhật 2026-08-16 — candidate v20 dựng đủ, dừng ở verifier draft

- `vi-v0.20.0-20` đạt toàn bộ sáu build native và 12/12 Install & Update E2E;
  macOS Intel đã dựng thành công `cryptography==50.0.0` từ sdist khóa hash với
  OpenSSL 3.5.7 tĩnh, đóng blocker của v19.
- Draft kín v20 upload đủ artifact và đối chiếu thành công mọi installer/gói
  native. Verifier dừng vì dòng provenance trong `SHA256SUMS.txt` chứa tiền tố
  `release-assets/`, trong khi bước tải lại đã đứng trong thư mục `uploaded`.
  Đây là lỗi đường dẫn manifest của workflow; không phải sai byte artifact.
- Workflow nay tạo checksum provenance ngay bên trong `release-assets`, nên
  manifest luôn ghi basename giống toàn bộ asset khác. Regression cấm mẫu đường
  dẫn cũ. Tag/draft v20 giữ bất biến; candidate kế tiếp là `vi-v0.20.0-21`.

## Cập nhật 2026-08-16 — đóng blocker macOS Intel cho candidate v20

- Candidate bất biến `vi-v0.20.0-19` đạt source contracts, Install & Update E2E
  và năm job native: Windows x64/ARM64, macOS Apple Silicon, Linux x64/ARM64.
  macOS Intel dừng đúng ở runtime payload vì `cryptography==50.0.0` không phát
  hành wheel x86_64; không có draft hoặc artifact v19 nào được công bố.
- Candidate kế tiếp giữ nguyên sàn bảo mật `cryptography==50.0.0` và chỉ cho
  macOS Intel dựng sdist đã khóa hash. Workflow dựng OpenSSL 3.5.7 tĩnh từ URL
  phiên bản bất biến, kiểm SHA-256
  `a8c0d28a529ca480f9f36cf5792e2cd21984552a3c8e4aa11a24aa31aeac98e8`,
  rồi import-probe native payload trước khi đóng gói. macOS ARM64 vẫn bắt buộc
  wheel; không nới ngoại lệ cho nền tảng khác.
- Regression hiện tại: 75/75 kiểm thử desktop release, 21 kiểm thử Python,
  typecheck/lint đạt (0 lỗi; 96 cảnh báo có sẵn), `uv lock --check` đạt và npm
  runtime audit báo 0 lỗ hổng. Candidate vẫn là **NO-GO/candidate only** cho tới
  khi tag v20 dựng đủ sáu nền tảng và exact artifact vượt runtime smoke.

## Cập nhật 2026-08-15 — đóng blocker Windows ARM64 cho candidate v19

- Native staging v18 xác nhận Windows ARM64 dừng ở `pywinpty==2.0.15`: bản này
  không có wheel ARM64 nên pip biên dịch sdist và linker lấy nhầm
  `C:\Program Files\Git\usr\lib\winpty.lib` x64, gây xung đột machine type cùng
  15 symbol `winpty_*` không thể liên kết. Đây là lỗi runtime thật, không phải
  lỗi mạng hoặc runner.
- Runtime Windows nay ghim `pywinpty==3.0.5`, bản đầu tiên có wheel CPython
  3.11/3.12 hoàn chỉnh cho cả x64 và ARM64. Không dùng 3.0.4 vì changelog chính
  thức xác nhận wheel x64/ARM64 của bản đó thiếu native binary.
- Windows ARM64 staging đã loại `pywinpty` khỏi danh sách cho phép build sdist;
  lock chứa URL và SHA-256 riêng cho cả `win_amd64` lẫn `win_arm64`. Regression
  chặn hạ pin, thiếu một trong hai kiến trúc hoặc đưa package quay lại đường
  source-build.
- Trên Windows x64, wheel 3.0.5 cài thật chứa `_winpty.pyd`, `conpty.dll`,
  `winpty.dll`, `winpty-agent.exe`, `OpenConsole.exe`; toàn bộ spawn, đọc/ghi,
  resize và đóng ConPTY đạt. Kiểm thử hiện tại: Python 21 đạt, đóng gói/Electron
  27 đạt, `uv lock --check` đạt.
- Candidate vẫn là `vi-v0.20.0-19`. Chưa tạo hoặc đẩy tag cho tới khi commit
  cuối sạch, fetch được và CI nguồn mới đạt; v18 giữ bất biến.

## Cập nhật 2026-08-15 — candidate v18 dừng ở verifier macOS, chuyển sang v19

- Verify nguồn và Install & Update E2E v18 đều đạt; Windows x64, Linux x64 và
  Linux ARM64 xanh trọn job native. Cả hai runner Mac dựng thành công ứng dụng,
  DMG và ZIP `0.20.0-vi.18`, nhưng verifier tìm DMG theo phiên bản package nội
  bộ `0.17.0`, tưởng artifact chưa có và kích hoạt một build thừa lần hai.
- Bộ dò DMG nay khóa theo hậu tố `-mac-<arch>.dmg`, đúng cùng contract mà bước
  chuẩn hóa artifact dùng, độc lập với release-version override. Regression xác
  nhận cả Apple Silicon và Intel, loại blockmap/sai kiến trúc; bộ hợp đồng tăng
  lên 74/74.
- Candidate kế tiếp là `vi-v0.20.0-19`; tag v18 giữ bất biến. Không có draft hay
  artifact v18 nào được công bố.

## Cập nhật 2026-08-15 — candidate v17 dừng ở đóng gói, chuyển sang v18

- Verify nguồn v17 đạt; Install & Update E2E tạo đúng ma trận tag `vi-v*` và
  xanh toàn bộ 10 tuyến cài lại/nâng cấp từ v1, v5, v9, v12 và v16.
- Sáu job native lộ ba lỗi đóng gói: biểu thức peel tag qua shell mất dấu `^`
  trên Windows; biến chứng thư Apple rỗng bị electron-builder hiểu là đường dẫn
  thư mục; electron-builder tự kích hoạt publish chỉ vì checkout đang ở tag.
- Runtime staging nay gọi Git bằng argv xác định; build community prerelease
  xóa hoàn toàn biến chứng thư rỗng; wrapper electron-builder luôn dùng
  `--publish never`. Staging draft và public promotion tiếp tục là hai bước độc
  lập. Regression đạt 73/73 và bộ UI đã chốt đạt 27/27; typecheck đạt.
- Candidate kế tiếp là `vi-v0.20.0-18`. Tag v17 là bất biến, không di chuyển;
  không có draft/artifact v17 nào đủ điều kiện công bố.

## Cập nhật 2026-08-15 — candidate v16 dừng ở đóng gói, chuyển sang v17

- Verify của tag bất biến `vi-v0.20.0-16` đạt, gồm 36/36 kiểm thử Python phát
  hành. Ba runner native macOS Apple Silicon, Linux x64 và Linux ARM64 cùng dừng
  ở `stage-agent-payloads.mjs`: Node 26 coi liên kết npm
  `node_modules/.bin/agent-browser` là thư mục khi `cpSync` dereference. Workflow
  được hủy sau khi đã chứng minh lỗi chung để không tiếp tục tốn runner; không có
  draft release hoặc artifact v16 nào được tạo.
- Runtime staging nay tạo ba launcher `agent-browser` xác định trực tiếp từ bin
  contract của package, không sao chép chi tiết `.bin` phụ thuộc npm/hệ điều
  hành. Regression tái tạo entry dạng thư mục đạt 17/17; launcher Windows chạy
  thật và trả `agent-browser 0.26.0`. Exact-artifact verifier mới buộc launcher
  Unix là tệp executable và launcher Windows là tệp, ngăn lỗi cấu trúc lọt qua.
- Install/update E2E v16 tạo đúng matrix tag `vi-v*`; ba tuyến `hermes update`
  từ v1/v5/v8/v12 đều đạt. Các tuyến installer re-run fetch HTTPS ra GitHub thật
  thay vì bare repo cô lập nên lệch commit. Sandbox nay rewrite HTTPS GitHub qua
  SSH shim/fake remote; contract test tăng lên 6/6. Candidate kế tiếp là
  `vi-v0.20.0-17`; không di chuyển hoặc tái sử dụng tag v16.
- Quyết định tiếp tục là **candidate only / NO-GO** cho tới khi v17 dựng đủ sáu
  nền tảng và đúng artifact qua runtime smoke. Nếu công bố, đây chỉ là
  **community prerelease chưa ký số**, đúng chấp thuận của chủ phát hành; không
  quảng cáo stable và không dùng tiền lệ AICoworker thay cho bằng chứng Hermes.

## Cập nhật 2026-08-15 — candidate v15 dừng trước build, chuyển sang v16

- Tag bất biến `vi-v0.20.0-15` đã kích hoạt đúng workflow phát hành và
  install/update E2E của fork, nhưng cổng verify dừng trước build vì workflow
  gọi `pytest` khi chưa cài nhóm phụ thuộc `dev`. Không có artifact hoặc release
  v15 nào được tạo.
- Workflow nay cài nhóm kiểm thử từ `uv.lock` bằng
  `uv sync --locked --python 3.11 --extra dev` và chạy bốn tệp release qua
  wrapper chuẩn `scripts/run_tests.sh`. Contract test cấm tái xuất hiện lệnh
  `uv run pytest` thiếu môi trường.
- Xác minh bản sửa: release workflow contract 5/5; bốn tệp Python đạt 36/36
  bằng runner cô lập chuẩn. Vì không di chuyển hoặc tái sử dụng tag bất biến,
  candidate kế tiếp mang số `vi-v0.20.0-16`.
- Install/update E2E của tag v15 đã tạo đủ matrix nhưng mọi leg fetch nhầm tag
  Việt hóa từ repo upstream NousResearch; leg của chính v15 còn tự kiểm thử cập
  nhật từ một commit sang chính nó. Reusable workflow nay truyền URL fork vào
  sandbox và tag-trigger loại candidate hiện tại khỏi tập phiên bản nguồn.
- Regression cho picker/fork route đạt 5/5; YAML và Bash syntax đều hợp lệ.

## Cập nhật 2026-08-15 — cho phép community prerelease không ký, không hạ chuẩn stable

- Chủ phát hành chấp nhận công bố đúng trạng thái hiện có và không mua Apple
  Developer Program ở vòng này. Hồ sơ SignPath Foundation cho Windows đã được
  gửi; chưa có kết quả phê duyệt hoặc cấu hình ký trong GitHub.
- Commit `74cb448` thêm lớp phát hành tường minh `community-prerelease`. Lớp này
  khóa Apple/SignPath secrets khỏi build, ghi `releaseClass` vào provenance,
  bắt buộc release giữ nhãn prerelease và yêu cầu bằng chứng cảnh báo
  SmartScreen/Gatekeeper trên từng artifact. Đường `stable` vẫn bắt buộc
  Authenticode, Developer ID, notarization và stapling như trước.
- Promotion tiếp tục tách khỏi build/staging và chỉ nhận đúng manifest, đúng
  runtime-smoke run, đúng release class và đủ quyết định `GO` trên sáu nền tảng.
  Chấp nhận unsigned không miễn fresh install, gateway, onboarding, persistence,
  update, repair, uninstall hoặc rollback.
- Xác minh cục bộ trong clone sạch tải độc lập từ GitHub: YAML parse đạt; workflow
  contract 5/5; evidence/tag tests 9/9; Prettier đạt; Desktop typecheck đạt;
  `uv lock --check` đạt; `npm audit --omit=dev --omit=optional --audit-level=high`
  trả 0 lỗ hổng.
- Hai thay đổi tài liệu có sẵn ở worktree cũ (`docs/community-release.md` và
  `docs/release-engineering-rulebook.md`) không bị sửa, xóa hoặc đưa vào commit.
- Quyết định vẫn **candidate only / NO-GO** cho public cho tới khi workflow tạo
  đúng draft artifacts và runtime smoke exact-byte đạt đủ ma trận. Không dùng
  tiền lệ AICoworker thay cho bằng chứng Hermes.

## Cập nhật 2026-08-15 — tab Browser và checkpoint công khai v15

- Commit `04345ecdf` thay Browser một-bề-mặt bằng thanh tab thật trong panel
  phải: `+` tạo webview độc lập, `×` đóng từng tab, chuyển tab không tháo
  webview, và đóng tab cuối tự trở về chế độ Tệp. URL do agent mở điều hướng tab
  Browser đang chọn thay vì tự sinh tab ngoài ý muốn.
- Bỏ nhãn chữ **Hệ thống tệp** ở đầu panel; nút biểu tượng Tệp vẫn giữ tooltip,
  trạng thái chọn và tên trợ năng. Bổ sung bản dịch nhãn tab mới cho toàn bộ
  locale Desktop.
- 50/50 test trực tiếp cho store/tab/đọc trang/fit Browser đạt; typecheck và
  lint đạt. UI đầy đủ đạt 421/424 tệp, 3.690/3.697 phép thử ở lượt tải cao; cả 7
  ca trong 3 tệp timeout/chồng DOM đều đạt khi chạy riêng tuần tự.
- Hợp đồng CVE/lock/workflow đạt 10/10; `npm audit --omit=optional` trả 0. Bộ
  Electron mục tiêu đạt 124/128; 4 ca còn lại là quyền POSIX, đường dẫn Linux và
  bash không có trên Windows, không đi qua mã thay đổi này.
- Windows x64 build từ `04345ecdf` đạt. Installer 121.419.758 byte, SHA-256
  `46D4EAD85DE96610232B4085047205A405BA9FA7810169661841D5B262A37804`;
  app đã cài có SHA-256
  `1BF43E7D75C000B4EFD6C358DFF34168519C2BA285B5E88B7C7E905D7044A7D6`.
  Stamp sạch, đúng commit công khai trên nhánh; cả hai executable `NotSigned`.
- Đã gỡ bản per-user cũ. Lượt cài nâng quyền đầu tiên chọn nhầm all-users nên đã
  gỡ ngay và cài lại thành công bằng `/currentuser`; không xóa, nhập hoặc khôi
  phục hồ sơ Hermes. Bản cài mới nằm đúng `%LOCALAPPDATA%\\Programs\\Hermes`.
- Nhánh `chore/prepare-vi-v0.20.0-15` đã push. Tuyến mở tự động của đúng
  executable mới bị Enterprise Application Control chặn vì hash chưa ký; công
  cụ quan sát cửa sổ Windows cũng bị từ chối quyền. Không đổi hoặc lách chính
  sách. Fresh bootstrap/UI máy thật của artifact cuối vì vậy chưa có bằng chứng
  đạt.
- Quyết định vẫn **NO-GO** cho merge/tag/release. Còn thiếu Windows smoke sau
  khi executable được cho phép/ký, job GitHub thực với tag `vi-v*`, macOS Apple
  Silicon thật và Linux x64 thật.

## Cập nhật 2026-08-15 — mở rộng và tự fit Trình duyệt ở panel phải

- Bỏ giới hạn cứng `20rem` (320 px) của panel Tệp/Trình duyệt. Panel nay có thể
  kéo tới `min(65vw, 90rem)`; vùng hội thoại vẫn giữ sàn `22vw`, còn kích thước
  người dùng kéo tiếp tục được lưu bằng pane state hiện có.
- Webview tự tính zoom theo bề rộng thực: giữ trang ở 100% từ 960 px trở lên,
  thu nhỏ tỷ lệ thuận khi panel hẹp và chặn ở 45% để nội dung vẫn đọc được.
  Không chèn CSS/JavaScript riêng vào website.
- Test hồi quy được viết trước và đạt 18/18 cho giới hạn panel, công thức fit,
  lifecycle `dom-ready`/resize và chuyển Tệp/Trình duyệt. Typecheck đạt; lint 0
  lỗi; production build đạt.
- Toàn bộ UI suite đạt 421/424 tệp và 3.685/3.692 phép thử ở lượt tải cao; cả 3
  tệp còn lại (13 phép thử) đều đạt khi chạy riêng tuần tự, xác nhận lỗi lượt đầu
  là timeout/chồng DOM do nghẽn tài nguyên, không phải hồi quy panel.
- Smoke production tại commit `b5b707511` dùng `HERMES_HOME` và user-data tạm
  cô lập, bắt đầu với 0 phiên. Panel kéo thật từ 237 lên 645 px, lưu đúng 645 px
  và giữ nguyên khi đổi Tệp ↔ Trình duyệt. Google ở 237 px dùng zoom 45%; ở 645
  px dùng 67% và có `innerWidth = scrollWidth = 963`, không tràn ngang.
- Không đọc, nhập hoặc khôi phục hồ sơ Hermes cũ. Quyết định phát hành vẫn
  **NO-GO** vì fresh bootstrap đúng commit cuối, runner GitHub `vi-v*`, macOS
  Apple Silicon thật và Linux x64 thật chưa đạt.

## Cập nhật 2026-08-15 — quyết định NO-GO cho vi-v0.20.0-15

- Lỗi tên phiên không tự hiện và đổi tên trả HTTP 500 được truy ra đúng
  `state.db` cũ bị `database disk image is malformed`, không phải lỗi cài mới.
  Theo quyết định bỏ dữ liệu cũ, toàn bộ session DB/sidecar/session files cũ đã
  được **di chuyển để cách ly**, không nhập hoặc khôi phục. Hồ sơ mới bắt đầu từ
  0 phiên.
- Commit `b2fa5e368` làm đường đổi tên bền vững qua lineage root/tip sau nén;
  commit `4148a5546` bổ sung `hermes doctor --fix` để đổi cơ sở dữ liệu WAL cũ
  sang rollback journal khi chứng minh được không có tiến trình đang giữ DB.
- Smoke thật trên ứng dụng đang cài và hồ sơ sạch đạt: tên tự sinh xuất hiện ở
  panel trái; đổi thành **Kiểm thử đổi tên v15** lưu bền qua reload; tạo/đóng tab
  và chuyển Tệp/Trình duyệt ở panel phải đều đạt; log hiện tại không còn 500,
  malformed hay traceback.
- Bộ cài Windows x64 cuối build thành công từ `4148a5546`, 121.419.143 byte,
  SHA-256 `3B06CADCCA7BD1E2EB0A402CF672AC0E227E54D95F75968203A7595F2916907D`.
  Stamp sạch, payload contract đạt, artifact `NotSigned` và không chứa `tar`,
  `image-size`, state DB, `.env`, credentials hoặc dữ liệu cá nhân.
- Artifact cuối nay chạy qua Application Control. Renderer đóng gói + backend
  mã cuối khởi động khỏe trên `HERMES_HOME` cô lập, tạo 0 phiên và giữ
  `journal_mode=delete` với SQLite 3.49.1. Fresh bootstrap thuần dừng ở 404 vì
  stamp `4148a5546` là commit cục bộ chưa có trên GitHub; không thay stamp hoặc
  push để lách cổng ghim commit.
- Kiểm thử mục tiêu đạt; typecheck/build/lint tệp đổi đạt; `npm audit` trả 0.
  UI đầy đủ đạt 3.680/3.687 ở lượt song song và cả 7 ca timeout/chồng DOM đều
  đạt khi chạy riêng. Electron đạt 993/1.023; 27 ca POSIX/quyền/timing không phù
  hợp Windows vẫn là lỗi nền và không thuộc lát cắt.
- Website production build locale `en` đạt; typecheck website còn lỗi nền
  TypeScript 6/Docusaurus/JSX và dữ liệu user stories, không thuộc lát cắt.
- Quyết định: **NO-GO** cho phát hành công khai/thử nghiệm rộng. Còn thiếu runner
  GitHub thật cho `vi-v*`, fresh bootstrap artifact cuối sau khi commit được
  phép xuất hiện trên GitHub, macOS Apple Silicon thật và Linux x64 thật. Xem
  `docs/release-vi-v0.20.0-15-go-no-go.md`.

## Cập nhật 2026-08-15 — chuẩn bị checkpoint vi-v0.20.0-15

- Tạo worktree tách biệt từ `origin/main` tại `771fd6df9`; không đụng nhánh
  `docs/record-vi-v0.20.0-14` hoặc các hiện vật smoke cũ.
- Nâng runtime `cryptography` từ `48.0.1` lên `50.0.0`, là sàn chung đã vá
  CVE-2026-69247, CVE-2026-69248 và CVE-2026-69249. Môi trường cô lập cài thật
  tập `[all]`, DingTalk, Teams, Azure và dev; 174 regression tests đạt.
- Ép toàn cây Node build/optional lên `tar 7.5.22`; `npm ci` và
  `npm rebuild get-windows` đạt; sáu test staging Windows và bảy test packaging
  matrix đạt.
- Nâng `nanoid` website lên `3.3.18`. OSV Scanner 2.3.8 hiện chỉ còn hai cảnh
  báo `image-size 2.0.2` website-only chưa có fixed version; `cryptography`,
  `tar` và `nanoid` đã biến mất khỏi kết quả quét cục bộ.
- Sửa install/update E2E để trigger tag `vi-v*`, ưu tiên họ tag Việt hóa trên
  fork, giữ tương thích tag upstream và thêm job chẩn đoán trigger. 4 test hợp
  đồng workflow/tag đạt; YAML parse đạt. Chưa push nên GitHub chưa thể chứng minh
  job mới tạo trên runner thật.
- Desktop typecheck đạt; lint đạt với 0 lỗi và 91 cảnh báo có sẵn; 70/70 UI test
  liên quan tab phiên, đóng tab và Browser panel phải đạt; production build đạt
  ngoài sandbox.
- Cổng tiếp theo: commit checkpoint để install-stamp ghim đúng mã v15, đóng gói
  Windows x64, quét nội dung artifact và chạy fresh-install bằng hồ sơ cô lập.

## Cập nhật 2026-08-14 — khôi phục nút đóng tab phiên

- Khôi phục nút `×` trên mọi tab ngang có thể đóng: tab đang hoạt động luôn hiển thị, tab nền hiện khi rê chuột hoặc focus bằng bàn phím.
- Nút dùng vùng bấm 24 px, con trỏ bàn tay, nhãn trợ năng và tooltip theo ngôn ngữ giao diện; thao tác được chặn khỏi cơ chế kéo/chọn tab để một lần bấm chỉ thực hiện một việc.
- Giữ nguyên hành vi an toàn có sẵn: phiên đang chạy hỏi xác nhận, còn đóng tab chỉ ẩn tab và phiên vẫn mở lại được từ danh sách bên trái.
- Chuẩn hóa tiêu đề tab từ dữ liệu cũ `NEW SESSION` thành **Phiên mới** theo locale hiện tại; tiêu đề thật do người dùng đặt không bị thay đổi.
- Xác minh: 28/28 kiểm thử mục tiêu đạt; typecheck đạt; lint 0 lỗi; 3.679/3.686 phép thử UI đầy đủ đạt ở lượt song song và cả 7 lỗi timeout/chồng DOM đều đạt khi chạy lại riêng; production build Desktop đạt ngoài sandbox.

## Cập nhật 2026-08-14 — phát hành vi-v0.20.0-14

- PR #21 đưa bản sửa nút đóng tab và tiêu đề **Phiên mới** vào `main`; PR #22 cập nhật toàn bộ liên kết tải, hướng dẫn Windows và ghi chú phát hành cho `vi-v0.20.0-14`.
- CI của lát cắt mã nguồn đạt toàn bộ kiểm tra bắt buộc, gồm bộ giao diện đầy đủ 3.679 phép thử ở lượt GitHub; cổng rà soát thay đổi nhạy cảm cũng đạt.
- Bản [`vi-v0.20.0-14`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14) được công bố là **Latest** từ commit `571f43d527f5a95122baadf29768172682c7a765`, không phải bản nháp hoặc pre-release.
- Sáu job đóng gói đều xanh, tạo đủ 19 tài sản cho Windows x64/ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 cùng các bảng SHA-256.
- Bộ cài Windows x64 tải ngược từ bản phát hành công khai có 121.419.240 byte và SHA-256 `270c782c54f9cda496c6b5fb0a7a1b06af7fb919859952072fae971d45f14355`; mã băm khớp `SHA256SUMS.txt`.
- Bộ cài vẫn chưa ký số trong thời gian chờ SignPath Foundation xét duyệt; cảnh báo SmartScreen được giải thích bằng hướng dẫn ảnh chụp đã liên kết ở đầu trang phát hành.

## Cập nhật 2026-08-14 — phát hành vi-v0.20.0-12

- PR #14 đã nhập vào `main`, gồm luồng cài đặt/kết nối model, sửa bootstrap Windows, khôi phục tab nhiều phiên và đưa Trình duyệt dùng chung vào panel phải.
- Sửa hai phép thử `prompt-overlays` từng mặc định chữ tiếng Anh bằng cách khóa locale của chính bài test; toàn bộ UI suite trên GitHub đạt 3.672/3.672 phép thử.
- Cổng phát hành phát hiện advisory mới `GHSA-2v37-7h3g-55p8`. PR #15 nâng riêng `nanoid` dòng 3 từ `3.3.17` lên `3.3.18`; `npm audit --omit=optional --audit-level=high` trả `0 vulnerabilities`, kiểm tra lockfile semantic và CI đạt.
- Pre-release [`vi-v0.20.0-12`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-12) được tạo từ commit `4aee0954b12e5f5848c56d08741baeb036e1527d`, đủ 19 tài sản cho Windows, macOS và Linux x64/ARM64 cùng bảng SHA-256.
- Bộ cài Windows x64 công khai có SHA-256 `cd42357d336b3f21fa2017fd521169ef00a034abda9524909da700a3cdc7c989`; mã băm tải thật khớp cả `SHA256SUMS.txt` và digest GitHub. Tệp vẫn chưa ký số trong thời gian chờ SignPath xét duyệt.

## Cập nhật 2026-08-14 — đưa Trình duyệt vào panel phải

- Bỏ mục **Trình duyệt** khỏi thanh điều hướng bên trái và giữ nguyên toàn bộ tab phiên trong vùng làm việc giữa.
- Thêm hai nút **Tệp** và **Trình duyệt** cạnh tên thư mục ở đầu panel phải; biểu tượng dùng kích thước điều khiển panel 32 px để dễ nhìn và có trạng thái đang chọn rõ ràng.
- Trình duyệt dùng chung được render trực tiếp trong panel phải. Chuyển qua lại chỉ ẩn bề mặt, không tháo cây tệp hoặc webview, nên trạng thái cây, lịch sử trang và phiên đăng nhập còn nguyên.
- URL do người dùng hoặc agent mở tự chuyển panel phải sang Trình duyệt và mở lại panel nếu đang đóng. Phiên không có thư mục làm việc vẫn dùng được Browser; chế độ Tệp hiển thị trạng thái chưa có dự án.
- Browser cũ từng được lưu như một pane động sẽ bị layout mirror loại khỏi vùng giữa trong lần chạy mới; tab URL và partition cookie `persist:hermes-preview` vẫn được giữ.
- Xác minh hoàn tất: 59/59 kiểm thử mục tiêu đạt; Desktop typecheck đạt; ESLint và Prettier các tệp thay đổi đạt; production build và Windows x64 unpacked 466 tệp đạt.
- Đã nâng cấp trên máy Windows thử nghiệm với điểm quay lui riêng. Bootstrap hoàn tất đúng commit `60e9b75d5`, dịch vụ nền trả `ok` cho Hermes 0.20.0 và mã băm ứng dụng cài đặt khớp bản đóng gói. Đại ca đã xác nhận trực quan vị trí biểu tượng và việc chuyển giữa **Tệp** với **Trình duyệt**.

## Cập nhật 2026-08-14 — khôi phục tab nhiều phiên và sửa vị trí Trình duyệt

- Thanh tab trong vùng làm việc luôn hiện mặc định kể cả khi chỉ có một phiên; nút `+` tiếp tục tạo phiên mới trong đúng vùng đang làm việc. Tùy chọn người dùng chủ động **Ẩn thanh tab** vẫn được tôn trọng.
- Bấm một phiên ở danh sách bên trái nay chuyển tới tab đã mở hoặc xếp phiên thành tab mới; chỉ dùng lại vùng chính khi đó thực sự là bản nháp trống.
- Nút **Trình duyệt** vẫn nằm ở thanh điều hướng bên trái nhưng nội dung web mở thành tab ở vùng giữa, cạnh các phiên làm việc; tab có tiêu đề theo ngôn ngữ giao diện và vẫn có thể kéo ra cạnh để xem song song.
- Nâng mã định danh Browser để tự di chuyển bản đã bị ghim nhầm vào vùng danh sách phiên ở các build thử trước; giữ nguyên địa chỉ cuối và partition cookie `persist:hermes-preview`.
- Cho phép popup do người dùng kích hoạt để các website có luồng đăng nhập OAuth hoặc mạng xã hội hoạt động trong phiên Browser dùng chung.
- Xác minh hiện tại: 54/54 kiểm thử mục tiêu đạt; Desktop typecheck đạt; ESLint và Prettier các tệp thay đổi đạt; production build và Windows x64 unpacked đạt.
- Đã nâng cấp bản `c7cee6a1d` trên máy Windows thử nghiệm với điểm quay lui riêng. Bootstrap tự đồng bộ đúng commit sau khi nhánh được đẩy lên GitHub; marker hoàn tất và `/api/health` trả `ok`, Hermes 0.20.0.
- Toàn bộ UI suite không hoàn tất trong giới hạn 180 giây và lặp lại các lỗi nền không thuộc lát cắt tại `prompt-overlays`, `messaging`, `gateway-settings` và `skills`; không ghi nhận bộ này là đạt. Bước quan sát giao diện tự động không khả dụng trong môi trường thử, nên cần xác nhận trực quan thủ công trên cửa sổ Hermes đang mở.

## Cập nhật 2026-08-14 — sửa lỗi Windows chặn Python khi cài mới

- Xác định nguyên nhân từ nhật ký Windows Code Integrity: Enterprise Application Control cho phép ứng dụng Hermes nhưng chặn `python.exe` không có chữ ký trong bản Python do `uv` quản lý.
- Windows bootstrap chuyển sang CPython 3.12.10 chính thức có chữ ký của Python Software Foundation; bộ cài kiểm tra cả chữ ký Authenticode và SHA-256 đã ghim trước khi chạy.
- Hỗ trợ Windows x64 và ARM64; `uv` nhận đường dẫn tuyệt đối tới interpreter đã xác minh để không tự chọn lại bản Python không có chữ ký.
- Lưu lựa chọn interpreter tin cậy qua các stage, tái sử dụng Python hợp lệ đã cài theo Hermes, registry hoặc PATH khi sửa chữa và cập nhật.
- Fresh-install smoke test dùng hồ sơ riêng trong LocalAppData trên Windows và tự đi qua lựa chọn cài cục bộ; không đọc hoặc sửa hồ sơ Hermes chính.
- Xác minh thật trên máy có Application Control: Python 3.12.10 và `venv\\Scripts\\python.exe` đều có chữ ký hợp lệ; stage phụ thuộc hoàn tất; CLI Hermes chạy; `/api/health` trả HTTP 200 với Hermes 0.20.0.
- 17/17 kiểm thử hồi quy installer đạt; 13/13 kiểm thử fresh-install/gate đạt; Desktop typecheck đạt; lint 0 lỗi. Toàn bộ Electron suite có 19 lỗi nền tảng cũ khi các ca POSIX chạy trên Windows, không liên quan lát cắt này và không được ghi nhận là đạt.

## Cập nhật 2026-08-14 — không gian Trình duyệt dùng chung

- Thêm **Trình duyệt** vào thanh điều hướng bên trái và mở trong cùng vùng với **Phiên** theo mặc định.
- Người dùng có thể chuyển tab, kéo Trình duyệt sang vùng riêng, xem song song và thay đổi kích thước bằng hệ thống pane hiện có.
- Bổ sung thanh địa chỉ, quay lại, tiến tới và tải lại; chỉ cho phép địa chỉ HTTP/HTTPS.
- Người dùng và agent thao tác trên cùng Electron webview và cùng partition đăng nhập `persist:hermes-preview`.
- `read_preview` trả thêm danh sách phần tử tương tác có mã tham chiếu; công cụ Desktop mới `interact_preview` hỗ trợ bấm, nhập, nhấn phím, cuộn và điều hướng.
- Không đọc giá trị mật khẩu và từ chối để agent nhập vào ô mật khẩu.
- Ẩn các nút của vùng **Thay đổi mã** khi chưa có thay đổi tương thích, giúp giao diện bớt gây nhầm lẫn.
- Xác minh: 39/39 kiểm thử UI mục tiêu đạt, 71/71 kiểm thử Python đạt, typecheck đạt, lint 0 lỗi, production build và Windows unpacked đạt.
- Smoke test dùng hồ sơ mới tách biệt đã lên màn hình thiết lập lần đầu. Nhật ký không có lỗi gateway hoặc bootstrap; phím tắt toàn cục đang trùng với ứng dụng khác nhưng không ảnh hưởng tính năng Trình duyệt.
- Tài liệu kỹ thuật và giới hạn hiện tại: `docs/shared-browser-pane.md`.

## Cập nhật 2026-08-13 — mở đầy đủ kết nối và tên model Claude

- Màn **Kết nối model** hiển thị trực tiếp toàn bộ luồng đăng nhập tài khoản mà backend cung cấp và toàn bộ nhà cung cấp có thể thiết lập bằng khóa API; không còn giấu danh mục khóa sau nút phụ.
- Danh mục khóa được sinh từ nguồn nhà cung cấp lõi, tự nhận thêm nhà cung cấp mới và loại đúng các luồng OAuth, tiến trình ngoài hoặc cấu hình thiếu biến xác thực.
- AWS Bedrock và Google Vertex AI tiếp tục được cấu hình tại **Cài đặt → Nhà cung cấp → API** vì cần nhiều trường cấu hình chuyên biệt.
- Claude Code dùng tên model cụ thể: Sonnet 5, Fable 5, Opus 5, Opus 4.8 và Haiku 4.5; quyền sử dụng thực tế vẫn do tài khoản Claude quyết định.
- Tài liệu giải thích rõ Gemini dùng Google AI Studio API key hoặc Vertex AI. Không tích hợp lại OAuth của Gemini CLI vì điều khoản của Google cấm phần mềm bên thứ ba dùng luồng đó.
- Xác minh: 7/7 kiểm thử onboarding đạt, 4/4 kiểm thử Claude Code provider đạt, Desktop typecheck đạt.
- Lần công bố `vi-v0.20.0-9` đầu tiên bị hủy ở giới hạn 15 phút sau khi tải 17/19 tệp. Workflow được sửa để tiếp tục bản nháp, bỏ qua tệp đã có và chỉ công bố khi tải đủ; giới hạn job tăng lên 30 phút.

## Cập nhật 2026-08-13 — viết lại tài liệu công khai

- Chuyển thông tin độc lập của dự án sang cách diễn đạt trung tính, tránh dùng cụm “không được bảo chứng” ở phần mở đầu.
- Ghi đúng trạng thái ký số: hồ sơ SignPath Foundation đã nộp và đang chờ xét duyệt; ký số là xác minh nhà phát hành, không phải giấy phép sử dụng của Microsoft hoặc Apple.
- Chuẩn hóa tên hiển thị thành **Hermes Vietnamese**, bỏ biểu tượng trang trí sau tên.
- Thêm link tải trực tiếp cho từng hệ điều hành và kiến trúc, cùng hướng dẫn kiểm tra phiên bản hệ điều hành, chip x64/ARM64, Apple Silicon/Intel trước khi tải.
- Viết lại README trang chủ theo hành trình ba bước: tải và cài, kết nối model, bắt đầu giao việc.
- Cập nhật toàn bộ liên kết tải sang `vi-v0.20.0-8` và bảng chọn đúng bộ cài cho sáu nền tảng.
- Viết lại hướng dẫn tiếng Việt chi tiết cho Windows, macOS, Linux; ChatGPT OAuth; Claude Pro/Max qua Claude Code; Gemini bằng khóa Google AI Studio; nhà cung cấp khác và model cục bộ.
- Bổ sung bảng phân biệt tài khoản/gói thuê bao/API, xử lý lỗi thường gặp, cảnh báo chưa ký số, cập nhật, sao lưu và gỡ cài đặt.
- Giữ rõ cam kết: **Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.**
- Cập nhật mẫu ghi chú phát hành theo luồng kết nối mới. Các liên kết nội bộ đã được kiểm tra, Prettier và `git diff --check` đều đạt.

## Cập nhật 2026-08-13 — ưu tiên kết nối tài khoản sẵn có

- Nhánh: `fix/provider-first-onboarding`, bắt đầu từ `origin/main` tại `5bfbbc2ad`.
- Màn **Kết nối model** hiện trực tiếp theo thứ tự: ChatGPT OAuth, Claude Pro/Max, Google Gemini bằng khóa API; Nous Portal và các dịch vụ khác nằm dưới **Nhà cung cấp khác**.
- Bỏ nhãn **Đề xuất** và cơ chế ẩn các nhà cung cấp phía sau Nous Portal.
- Gemini được ghi rõ là luồng Google AI Studio/API key trong toàn bộ locale; bấm vào sẽ mở form khóa API với Gemini được chọn sẵn.
- Xác minh: 32/32 kiểm thử onboarding+i18n đạt; 7/7 kiểm thử onboarding trực tiếp đạt; typecheck đạt; lint không có lỗi (chỉ còn cảnh báo có sẵn ở tệp khác).
- Bản Windows unpacked đã đóng gói thành công. Smoke test trực tiếp trên bản dev tách biệt xác nhận đúng thứ tự, đúng tiếng Việt và đúng hành vi bấm Gemini.
- Cửa sổ thử dùng `HERMES_HOME` và user-data riêng, không đọc hoặc sửa hồ sơ Hermes chính.

## Mục tiêu hiện tại

Hợp nhất thiết lập Desktop lần đầu thành ba bước trên Windows, macOS và Linux, đồng thời giữ nguyên giao diện và tính năng lõi Hermes sau khi thiết lập.

## Trạng thái đã xác minh

- Nhánh làm việc ban đầu: `fix/readable-window-controls`, HEAD `492220e5f`.
- Worktree sạch trước thay đổi.
- Baseline đạt 18/18 kiểm thử giao diện cài đặt/onboarding.
- Baseline đạt 20/20 kiểm thử bootstrap Electron.
- Typecheck Desktop đạt.
- `bootstrap-runner.ts` đã có bộ điều khiển `install.ps1` cho Windows và `install.sh` cho macOS/Linux.
- Giao diện vẫn còn nhánh cũ hướng dẫn người dùng macOS/Linux tự mở Terminal; nhánh này cần được loại bỏ khỏi luồng người dùng.

## Quyết định

- Ba bước chỉ là lớp thiết lập lần đầu; Terminal tích hợp và ứng dụng chính không đổi.
- Tái sử dụng luồng nhà cung cấp/model hiện có, không xây một luồng xác thực thứ hai.
- Model cục bộ dùng điểm cuối cục bộ hiện có trong lát cắt đầu; chưa nhúng model nặng vào bộ cài nền.
- Lựa chọn ngôn ngữ phải hoạt động trước khi backend sẵn sàng và được đồng bộ vào cấu hình khi bước 2 bắt đầu.

## Đã hoàn thành trong lát cắt này

- Thêm chỉ báo ba bước dùng chung cho cài đặt cục bộ, kết nối từ xa và onboarding nhà cung cấp/model.
- Cho phép đổi English/Tiếng Việt trước khi backend chạy; lựa chọn được lưu vào cấu hình ở bước 2.
- Loại bỏ hướng dẫn buộc người dùng macOS/Linux mở Terminal khỏi màn hình cài đặt.
- Giữ nguyên Terminal tích hợp và không gian làm việc Hermes sau onboarding.
- Củng cố Windows bootstrap bằng gói `uv` chính thức từ PyPI, kiểm tra SHA-256 trước khi giải nén; vẫn giữ đường cài Astral cũ làm dự phòng.
- Bổ sung gói macOS Intel x64 vào ma trận bên cạnh Apple Silicon, Windows x64/ARM64 và Linux x64/ARM64.
- Cập nhật README, ghi chú phát hành và tài liệu vận hành cộng đồng.

## Xác minh

- 34/34 kiểm thử giao diện trực tiếp cho thiết lập, onboarding và i18n đạt.
- 27/27 kiểm thử Electron bootstrap và ma trận đóng gói đạt.
- 8/8 kiểm thử nguồn cho `install.ps1` đạt.
- Typecheck Desktop và lint trên toàn bộ tệp thay đổi đạt; chỉ còn cảnh báo test có sẵn của dự án.
- Windows `uv` bootstrap đã chạy thật trong thư mục sạch: `uv 0.12.3`, mã băm được xác minh và tiến trình kết thúc thành công.
- Production build Desktop đạt sau khi chạy ngoài giới hạn sandbox.
- Bộ UI đầy đủ bị hết thời gian ở một số bài cũ không thuộc lát cắt này; các bài liên quan trực tiếp đều xanh và lỗi chậm đã được ghi nhận, không bị diễn giải thành kết quả đạt.

## Bước phát hành tiếp theo

Tạo checkpoint Git, đẩy nhánh và chạy workflow pre-release sáu nền tảng. Gói macOS/Linux cần được kiểm tra thêm trên máy thật trước khi bỏ nhãn thử nghiệm cộng đồng.

## Cập nhật 2026-08-26 — hotfix an toàn phiên `vi-v0.32.0-2`

- Hồ sơ thật đã có snapshot cục bộ `20260826-031728`; `state.db` integrity OK,
  còn 11 phiên/752 tin nhắn, `hidden=0`, `archived=0`.
- Đã đưa cửa sổ resident về **Tất cả dự án**; các phiên cũ hiển thị lại mà
  không cần phục hồi hay ghi lại database.
- Candidate source tách riêng khỏi nhánh v32.1 dang dở. Project scope là tạm
  thời, tự dò repo mặc định tắt, lối thoát báo đúng số phiên bên ngoài.
- Trang Dự án có nút **Ẩn** và **Xóa**. Hai thao tác chỉ đổi metadata dự án;
  xóa dự án không còn phát yêu cầu mở phiên trắng và backend tree tiếp tục nhận
  mọi session id sau archive/delete.
- Dữ liệu tiếp tục lưu trong `HERMES_HOME` của đúng máy hoặc máy ảo; không có
  Hermes cloud backup hay đường upload tự động.
- Source gate hiện tại đạt UI 4.955/4.955 trên 549 tệp, lát cắt Dự án 38/38,
  backend project/config/tree 60/60, lifecycle policy 4/4, typecheck và lint.
- Chưa push, build, cài hoặc công bố `vi-v0.32.0-2`; cần source gate và quyền
  push repository công khai trước khi tạo immutable artifact.
