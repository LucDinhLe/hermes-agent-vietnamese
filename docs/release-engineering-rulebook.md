# Quy tắc phát hành Hermes Vietnamese 1.1

Tài liệu này là hợp đồng kỹ thuật cho việc đóng gói, kiểm thử, staging, công bố,
cập nhật và quay lui Hermes Vietnamese. `docs/community-release.md` mô tả cách
vận hành từng lớp phát hành; tài liệu này xác định những điều không được phép
bỏ qua.

## Kết quả sản phẩm cần chứng minh

Một bản phát hành chỉ thành công khi người dùng bình thường có thể đi hết chuỗi:

```text
tải đúng tệp → kiểm tra → cài đặt → mở lần đầu → runtime sẵn sàng
→ gateway khỏe → onboarding → tạo phiên → khởi động lại vẫn giữ dữ liệu
```

Build xanh, đúng cấu trúc gói hoặc mở được giao diện chưa chứng minh toàn bộ
chuỗi trên.

## Quyền quyết định

- Chủ dự án quyết định đối tượng phát hành, mức rủi ro còn chấp nhận, ngoại lệ
  ký số, thời điểm công bố và nội dung truyền thông.
- Kỹ thuật quyết định cách hiện thực hóa sau khi phạm vi và các cổng bằng chứng
  đã được ghi rõ.
- Mọi hành động public phải dừng nếu thiếu quyền xác nhận của chủ dự án.

## Các lớp phát hành

### Thử nghiệm cục bộ

- Có thể dùng commit và artifact cục bộ.
- Không được tải lên release công khai.
- Bằng chứng chỉ có giá trị trên đúng máy và đúng SHA-256 đã thử.

### Candidate

- Được dựng từ commit sạch, đã push và có thể fetch độc lập.
- Được đưa vào draft hoặc staging kín.
- Không được rebuild hoặc thay byte trong quá trình nghiệm thu.

### Community pilot

- Có thể chưa ký số khi cảnh báo cài đặt và giới hạn được công bố nổi bật.
- Sáu target phải build trên runner native và đối chiếu manifest.
- Windows x64 phải vượt exact-artifact smoke trên máy thật theo
  `docs/community-release.md`.
- Target chưa có máy thật phải mang nhãn `BUILD-ONLY-PILOT`, không được mô tả
  như đã tương thích thực tế.
- Chủ dự án có thể cho pilot làm bản tải mặc định/Latest để lấy phản hồi, nhưng
  không được gọi là stable hoặc final.

### Stable hoặc phát hành rộng cho người học

- Cần chữ ký/công chứng phù hợp nền tảng.
- Cần runtime smoke trên mọi nền tảng và kiến trúc được quảng cáo.
- Cần update, relaunch, repair, uninstall, rollback và bằng chứng máy thật.
- Cần chủ dự án chịu trách nhiệm công bố.

## Các bất biến

1. **Nguồn có thể truy xuất:** chỉ build từ commit sạch mà remote đã công bố.
2. **Build đúng một lần:** mỗi candidate có commit, phiên bản, nền tảng, kiến
   trúc, kích thước và SHA-256 riêng. Rebuild tạo candidate mới.
3. **Thử đúng byte:** smoke tệp sẽ public; không lấy build khác hoặc thư mục
   unpacked làm bằng chứng thay thế.
4. **Critical path tự chứa:** lần chạy đầu không phụ thuộc Git, nhánh động, tag
   di chuyển, source chưa public hoặc package registry không được khai báo.
5. **Native là native:** payload có module native phải được dựng và kiểm tra trên
   đúng hệ điều hành/kiến trúc.
6. **Runtime smoke chặn promotion:** gateway, onboarding và persistence phải có
   bằng chứng trước công bố theo phạm vi đã chọn.
7. **Staging trước, promotion sau:** build và public là hai workflow riêng.
8. **Giữ nguyên byte:** staging, smoke và public phải dùng cùng một digest.
9. **Một cổng lỗi là lỗi:** thành công của nền tảng khác không bù được bằng
   chứng còn thiếu.
10. **Lỗi thoát ra ngoài phải thành regression:** sửa nguyên nhân gốc và thêm
    cổng. Chỉ tạo candidate mới khi source sản phẩm, đầu vào đóng gói hoặc byte
    artifact thay đổi; không vá đè asset đã nghiệm thu.
11. **Đường tải là hợp đồng:** README, hướng dẫn cài, release notes, `Latest`, tên
    asset và hash phải cùng trỏ một phiên bản. `.github/public-release.json` là
    nguồn hợp đồng cho bản tải mặc định.
12. **Tách metadata khỏi artifact:** có thể sửa mô tả và tài liệu sau phát hành,
    nhưng phải ghi rõ đây là đổi metadata. Tag, target commit và asset không được
    thay.
13. **Hậu kiểm public:** sau promotion phải kiểm tag/Latest, asset count, digest,
    manifest, HTTP đường tải và thời điểm tạo/cập nhật asset.
14. **Cập nhật là một artifact đã nghiệm thu:** stable phải mang đủ
    `latest*.yml` theo nền tảng. Manifest dùng SHA-512 của đúng installer đã
    staging, nằm trong `SHA256SUMS.txt`, và feed trong ứng dụng phải ghim vào
    URL của một release bất biến thay vì nhánh hoặc nhãn động. Community
    prerelease chưa ký phải ghi `updateFeedEnabled=false`, không sinh
    `latest*.yml` và fail closed trước mọi updater I/O.
15. **Lifecycle theo đúng nguồn:** control Gateway gắn với phiên phải giữ owner
    `connectionId + profile` bất biến qua mọi await. Backend phải serialize
    start/restart/stop theo canonical lifecycle owner; phản hồi muộn hoặc owner
    mơ hồ phải fail closed, không được repaint hay điều khiển Gateway foreground.
16. **Cookie permission và phân vùng phải fail closed:** Connector Chromium
    phải xin đúng hostname ở cả HTTP/HTTPS mà không giữ cổng hoặc tự mở rộng
    wildcard/eTLD+1; revoke phải xóa hai pattern hiện tại cùng grant
    origin-có-cổng cũ, kiểm tra lại hậu điều kiện và fail closed nếu quyền còn
    tồn tại. Cookie được liệt kê bằng truy vấn phân vùng tường minh,
    coi `partitionKey` thiếu hoặc `null` là không phân vùng, đếm object phân
    vùng thực sự là không hỗ trợ và chỉ chuyển cookie không phân vùng còn hiệu
    lực. Không được coi kết quả rỗng là bằng chứng website hoặc miền cha không
    có cookie.

## Cổng bắt buộc

### A. Nguồn và phạm vi

- [ ] Lớp phát hành và đối tượng được nêu rõ.
- [ ] Phạm vi đã freeze; không trộn feature ngoài blocker.
- [ ] Worktree sạch; commit đã push và fetch được.
- [ ] Nếu dựng local candidate chưa có tag: dùng tường minh
      `--local-candidate --commit=<full-clean-HEAD>`. Nhãn `--tag` lúc này chỉ
      là label manifest; index và worktree phải sạch hoàn toàn, gồm cả file
      chưa được Git theo dõi, vì Desktop build đọc trực tiếp source,
      `public/**` và `assets/**`. Candidate này không được stage/promote.
      Local candidate không được dùng `--no-install`: dependency phải được dựng
      lại bằng `npm ci` từ lockfile đã commit. Cổng provenance phải kiểm lại
      exact HEAD và worktree sạch sau build/package, trước khi báo thành công.
      CI/draft vẫn bắt buộc exact tag trỏ đúng commit đã fetch.
- [ ] Phiên bản trước và rollback target được ghi.

### B. Mã nguồn và chuỗi cung ứng

- [ ] Lockfile cập nhật và khóa.
- [ ] Typecheck, lint, unit, integration, UI và security scan phù hợp đều đạt.
- [ ] Control đa nguồn chứng minh exact-owner routing, loại phản hồi cũ và
      serialize các lifecycle verb xung đột theo cùng canonical owner.
- [ ] Regression Connector chứng minh Chrome/Edge nhìn thấy cookie do website
      tạo, normalize cùng kết quả cho `partitionKey` thiếu/`null`, chỉ chuyển
      cookie không phân vùng còn hiệu lực, đếm đúng cookie phân vùng/hết hạn và
      không ghi giá trị cookie vào log hoặc evidence.
- [ ] Permission regression chứng minh HTTP/HTTPS exact-host bỏ cổng, không
      mở wildcard/eTLD+1, nhận partial/legacy grant và revoke đủ hai pattern mới
      cùng origin-có-cổng cũ. Kết quả `false`, no-op, lỗi API hoặc grant chồng
      lấp phải được kiểm tra lại; UI không được báo thành công hay giữ payload
      ghép nối khi quyền đích còn tồn tại.
- [ ] Không còn lỗ hổng runtime nghiêm trọng chưa được chấp nhận.
- [ ] Artifact không chứa secret, hồ sơ, database, log hoặc đường dẫn riêng tư.
- [ ] Mọi tải xuống cần thiết đều dùng nguồn bất biến và kiểm digest.

### C. Build và cấu trúc native

- [ ] Build host, workflow, package/lock và hai installer cùng chặn dưới Node 26.
- [ ] Mỗi target build trên runner native tương ứng.
- [ ] Executable và module native đúng kiến trúc.
- [ ] macOS patch electron-builder xác nhận marker/shape; thiếu target hoặc sai
      shape trên Darwin phải làm build lỗi.
- [ ] POSIX thay venv theo transaction: dựng candidate trước, giữ backup qua
      dependency/import probe, rollback tự động trước khi dọn replacement lỗi.
- [ ] Windows ARM64 thiếu `get-windows` chỉ được chấp nhận cho community
      build-only bằng flag tường minh và file limitation đã vào checksum;
      stable phải fail. PE machine field phải khớp target arch.
- [ ] Python, Hermes payload, dependency, installer metadata, icon và license
      hiện diện.
- [ ] Gói resident đầy đủ nhận marker bootstrap schema 1 hợp lệ từ bản cũ kể
      cả khi marker chưa có `desktopVersion`; không quay lại network bootstrap
      hoặc chạy runtime quản lý trong AppData.
- [ ] Windows giữ ổn định upgrade identity và install location.
- [ ] Metadata cập nhật có đủ filename, byte size, SHA-512 và SemVer cộng đồng;
      resolver bỏ qua draft và release thiếu manifest của target đang chạy.
- [ ] `latest-mac.yml` phân biệt đúng Intel và Apple Silicon nhưng cả hai URL
      vẫn tải đúng byte ZIP đã chuẩn hóa và nghiệm thu.
- [ ] macOS kiểm cấu trúc app, DMG, signing và notarization.
- [ ] Manifest ghi filename, byte size và SHA-256.

### D. Fresh-install smoke

Chỉ dùng user/hồ sơ cô lập. Không đọc, nhập hoặc khôi phục dữ liệu Hermes thật.

- [ ] Tệp tải về khớp hash.
- [ ] Cài và mở bằng đường người dùng thực tế, không cần developer tools.
- [ ] Runtime/bootstrap, gateway và onboarding đạt.
- [ ] Tạo/đổi tên phiên, kiểm tab phiên/Browser và panel phải.
- [ ] Phiên detached có `cwd = null` là dữ liệu hợp lệ và phải tiếp tục hiển thị.
      Gate dự án phải tạo hoặc mở một phiên project-addressable qua đúng thao tác
      UI người dùng; không được ép sửa `cwd` của phiên cũ để làm cho test đạt.
- [ ] Với hồ sơ có phiên cũ chưa gắn thư mục, tạo và mở một dự án rồi xác nhận
      lối **Tất cả dự án** luôn dễ thấy, báo đúng số phiên nằm ngoài dự án, các
      phiên đó vẫn truy cập được và không phiên nào tự đổi sang hidden/archived
      hoặc bị xóa. Khởi động lại phải trở về toàn bộ dự án, không khôi phục scope
      lọc cũ.
- [ ] Tự dò kho git phải **tắt mặc định** và chỉ chạy sau khi người dùng bật.
      Kho được tìm thấy phải có nhãn nguồn cùng thao tác ẩn ngay trong trang Dự
      án; không được trình bày như dự án người dùng vừa tạo.
- [ ] Regression backend phải chứng minh chuỗi tạo → lưu trữ → khôi phục →
      xóa dự án không làm thay đổi hoặc xóa bất kỳ hàng nào trong `state.db`.
- [ ] Connector Chrome và Edge dùng profile cô lập phải vượt fixture HTTP và
      HTTPS có non-default port: preview chỉ có metadata, import, persistence
      sau restart, revoke cả grant cũ/mới và quét redaction.
- [ ] Chạy một tool an toàn bằng provider thử hoặc mock phù hợp.
- [ ] Khởi động lại và xác nhận giữ trạng thái.
- [ ] Lưu OS build, kiến trúc, log sạch và ảnh bằng chứng.

### E. Update, repair, uninstall và rollback

- [ ] Cài bản trước trên hồ sơ sạch và tạo dữ liệu đại diện.
- [ ] Update qua đúng đường người dùng; shutdown, thay thế, relaunch thành công.
- [ ] Update Windows dùng handoff silent; không hiện lại wizard cài mới sau khi
      người dùng đã bấm cập nhật trong Hermes.
- [ ] Fixture nâng cấp giữ nguyên marker do `install.ps1`/`install.sh` bản cũ
      tạo ra và chứng minh bản resident mở thẳng runtime tích hợp, không hiện
      lại trình thiết lập lần đầu.
- [ ] Gateway khỏe và dữ liệu còn nguyên sau update.
- [ ] Kiểm mất mạng hoặc update gián đoạn.
- [ ] Repair một fixture có thể phục hồi.
- [ ] Uninstall giữ/xóa dữ liệu đúng lựa chọn.
- [ ] Diễn tập rollback mà không âm thầm nhập state không tương thích.

### F. Tin cậy và bảo mật

- [ ] Authenticode Windows được kiểm và báo đúng.
- [ ] Signing/notarization/stapling macOS được kiểm và báo đúng.
- [ ] Update metadata và artifact có kiểm toàn vẹn.
- [ ] SmartScreen/Gatekeeper được thử; không suy đoán.
- [ ] Log/ảnh không chứa credential hoặc dữ liệu riêng.

### G. Staging và promotion

- [ ] Candidate được upload vào draft/staging.
- [ ] Job nghiệm thu draft riêng tư dùng quyền `contents: write` tối thiểu để
      GitHub cho phép nhìn và tải draft; job chỉ đọc phải có contract test chứng
      minh không gọi API sửa, xóa hoặc công bố release.
- [ ] Hash staging khớp manifest được nghiệm thu.
- [ ] Evidence chỉ đúng hash đó và ghi `false` cho cổng chưa chạy.
- [ ] Release notes nêu signing, support matrix, giới hạn, repair và rollback.
- [ ] Chủ dự án ghi quyết định GO đúng phạm vi.
- [ ] Promotion public đúng byte staging, không rebuild.
- [ ] Public hash và đường tải được hậu kiểm.

### H. Điều hướng công khai

- [ ] GitHub `Latest` trả đúng tag trong `.github/public-release.json`.
- [ ] README/README.vi/hướng dẫn cài và release notes không trỏ bản rollback như
      bản tải mặc định.
- [ ] Mọi link tải dùng đúng tên asset thật.
- [ ] Mô tả public phân biệt pilot, build-only và stable.
- [ ] Nếu chỉ sửa tài liệu sau release, asset count, ID, size và digest vẫn giữ
      nguyên; thay đổi được ghi là metadata-only.

## Ma trận bằng chứng

| Target              | Bằng chứng build                | Bằng chứng runtime                          |
| ------------------- | ------------------------------- | ------------------------------------------- |
| Windows x64         | Runner Windows x64              | Exact installer trên Windows x64 thật       |
| Windows ARM64       | Runner Windows ARM64            | Exact installer trên Windows ARM64 thật     |
| macOS Apple Silicon | Runner Apple Silicon            | App đã ký/công chứng trên máy Apple Silicon |
| macOS Intel         | Runner Intel                    | App đã ký/công chứng trên máy Intel         |
| Linux x64           | Runner đúng compatibility floor | AppImage và một gói native                  |
| Linux ARM64         | Runner ARM64                    | AppImage hoặc một gói native                |

Thiếu runtime proof thì target chỉ được công bố theo phạm vi build-only pilot
được chủ dự án chấp thuận và ghi nổi bật.

## Vòng lỗi thành cổng

1. Giữ nguyên artifact, hash, log, ảnh, OS và bước tái hiện.
2. Xác định vì sao cổng cũ không phát hiện.
3. Thêm assertion nhỏ nhất có thể thất bại trước khi công bố.
4. Chạy assertion trên fixture lỗi và bản sửa.
5. Cập nhật rulebook, workflow/runbook và `PROGRESS.md`.
6. Tăng phiên bản nếu byte artifact đổi. Không thay asset cùng tag.

### Phân loại lỗi harness và hạ tầng

Candidate sản phẩm và controller nghiệm thu là hai danh tính độc lập:

- Candidate khóa bằng tag, commit sản phẩm, filename, size và SHA-256.
- Controller khóa bằng commit chứa workflow, runner và harness đã thực thi.
- Receipt bắt buộc ghi cả `candidate.commit` lẫn `harnessCommit`; promotion đối
  chiếu candidate với tag bất biến và harness với `head_sha` của run nghiệm thu.

Khi log chứng minh lỗi nằm ở harness hoặc hạ tầng và byte candidate không đổi:

1. Giữ nguyên draft, tag, provenance, size và SHA-256 của candidate.
2. Giữ nguyên run/evidence thất bại; không sửa hoặc xóa lịch sử.
3. Sửa harness/controller, thêm regression có thể bắt đúng lỗi vừa gặp.
4. Dispatch một run nghiệm thu mới từ exact controller commit và tải lại đúng
   candidate đã staging. Không rerun build, không tăng hậu tố candidate.
5. Chỉ dùng run mới nếu receipt xanh và khóa đủ cả hai commit. Promotion vẫn
   fail-closed nếu candidate digest hoặc harness commit lệch.

Nếu sửa mã Desktop, dependency, cấu hình đóng gói, asset đầu vào hoặc bất kỳ thứ
gì có thể làm thay byte bộ cài, bắt buộc tạo candidate mới và chạy lại các gate
bị ảnh hưởng. Lỗi GitHub 403/429, click của Playwright, timeout ghi fixture hoặc
sai hợp đồng action không tự động trở thành thay đổi sản phẩm.

## Trạng thái sau v25

`vi-v0.20.0-25` đã chứng minh đường community pilot gồm native build sáu target,
staging bất biến, exact-artifact Windows x64 smoke và promotion cùng byte. Các
gaps còn mở cho stable là chữ ký/công chứng, máy thật cho năm target còn lại,
safe-tool bằng provider thử và update từ v14 bằng exact artifact.

Hồi cứu đầy đủ nằm tại `docs/release-vi-v0.20.0-25-retrospective.md`; điểm bắt
đầu của phiên tiếp theo nằm tại `docs/handoff-vi-v0.20.0-26.md`.
