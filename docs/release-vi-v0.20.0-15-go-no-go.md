# Quyết định phát hành vi-v0.20.0-15

Ngày đánh giá: 2026-08-15

## Quyết định

**NO-GO cho phát hành công khai hoặc thử nghiệm rộng.** Phần rủi ro runtime
nghiêm trọng đã được đóng cục bộ, nhưng ba cổng bắt buộc vẫn chưa có bằng chứng
đạt:

1. Gói Windows x64 cuối tại `04345ecdf` build và cài đúng per-user. Commit đã
   có trên GitHub và install stamp khớp, nhưng Enterprise Application Control
   chặn executable mới chưa ký trước khi bootstrap/UI có thể chạy. Không thay
   đổi hoặc lách chính sách để tạo kết quả giả.
2. Workflow `install-e2e` đã có test hợp đồng cục bộ nhưng chưa được chạy trên
   GitHub runner với tag `vi-v*`; push nhánh thường không kích hoạt workflow
   này và hiện chưa có tag ứng viên.
3. Chưa có smoke test trên máy thật macOS Apple Silicon và Linux x64.

Có thể cân nhắc **thử nội bộ có kiểm soát** sau khi fresh bootstrap của đúng
commit cuối đạt và GitHub workflow tạo job thật. Không giữ hoặc nhập dữ liệu
Hermes cũ trong bất kỳ bước nào.

## Bằng chứng

| Cổng                           | Kết quả                                       | Bằng chứng chính                                                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Python runtime                 | Đạt                                           | `cryptography==50.0.0` trong `pyproject.toml`, `uv.lock`, môi trường regression và venv bootstrap sạch; 174 test regression đạt.                                                                                                                 |
| Hợp đồng bảo mật/lock/workflow | Đạt cục bộ                                    | 13/13 test đạt; tag picker ưu tiên `vi-v*`, trigger nhận `vi-v*`, có job diagnostics.                                                                                                                                                            |
| Node desktop/build             | Đạt                                           | Toàn cây root dùng `tar 7.5.22`; `npm ci`, `npm audit` root 0, `npm rebuild get-windows`, staging và packaging matrix đạt.                                                                                                                       |
| Cảnh báo còn lại               | Chấp nhận có điều kiện                        | OSV cục bộ chỉ còn hai advisory `image-size 2.0.2` trong website, chưa có fixed version và không nằm trong Desktop artifact.                                                                                                                     |
| Desktop code quality           | Đạt cho lát cắt                               | Typecheck và lint đạt; 50/50 test trực tiếp cho tab/đọc trang/fit Browser đạt. UI tổng đạt 3.690/3.697 ở lượt tải cao; 7 ca timeout/chồng DOM đều đạt khi chạy riêng.                                                                               |
| Panel phải/Browser             | Đạt bằng test/build                           | `48fb23a88` mở rộng và refit panel. `04345ecdf` thêm tab Browser `+`/`×`, giữ từng webview khi chuyển tab, đóng tab cuối về Tệp và bỏ nhãn chữ Hệ thống tệp. Chưa thể xác nhận trực quan artifact cuối vì Application Control.                    |
| Windows bootstrap sạch         | Bị chặn trước bootstrap                       | Stamp bản đã cài sạch và khớp `04345ecdf` trên GitHub. Hồ sơ/AppData smoke mới được tạo tách biệt nhưng Windows chặn `Hermes.exe` chưa ký trước khi tiến trình chạy, nên không ghi nhận health/onboarding/UI là đạt.                                  |
| Bản vá UI phát hiện khi smoke  | Đạt bằng test/build                           | Tab ban đầu từng giữ placeholder tiếng Anh sau khi chuyển locale; commit `c646de336` dùng tiêu đề draft dịch động. Typecheck, lint và 4/4 test liên quan đạt.                                                                                    |
| Tên/đổi tên phiên              | Đạt                                           | Hồ sơ cũ hỏng được cách ly, không khôi phục. Trên bản cài cuối, tên tự sinh hiện ở panel trái; đổi tên thành `Kiểm thử v15 đã đạt` lưu trong DB với `title_source=user`, không còn 500. Sau smoke, phiên thử đã xóa và DB về 0 phiên/0 tin.      |
| SQLite/WAL                     | Đạt có giảm hiệu năng                         | Runtime SQLite 3.49.1 còn lỗi WAL-reset nhưng mã lõi giữ DB mới ở `journal_mode=delete`; `4148a5546` cho `doctor --fix` chuyển DB WAL cũ khi offline. Hồ sơ thử cuối có 0 phiên và state DB ở rollback mode.                                     |
| Trình cập nhật repo            | Đạt cục bộ; chưa thể kiểm tra tuyến công khai | `dd89c0423`: remote chính thức SSH được đổi sang HTTPS; kiểm tra nền của cả SSH/HTTPS chính thức dùng `ls-remote` chỉ đọc nên không fetch trùng bootstrap; checkout nông chỉ fetch tối đa 64 commit. 13/13 installer và 7/7 Electron remote đạt. |
| Windows artifact cuối          | Build/cài đạt; chạy bị chính sách chặn         | NSIS x64 từ `04345ecdf`, stamp sạch và hash executable cài đặt khớp package. Gỡ bản cũ, sửa ngay lượt cài nhầm all-users và cài lại đúng per-user. Artifact vẫn chưa ký nên hash mới bị Enterprise Application Control chặn.                      |
| Desktop suite tổng quan        | Chấp nhận có điều kiện                        | UI 3.690/3.697, 421/424 tệp; cả 7 ca lỗi tải cao đạt riêng. Electron mục tiêu 124/128; 4 ca POSIX/đường dẫn Linux/thiếu bash không phù hợp Windows.                                                                                                  |
| Website                        | Build đạt, typecheck nền chưa đạt             | Docusaurus locale `en` build thành công; còn hai broken-link warning có sẵn. Typecheck vướng cấu hình Docusaurus/TypeScript 6, namespace JSX và thiếu `userStories.json`.                                                                        |
| macOS Apple Silicon            | Chưa đạt                                      | Chưa có máy thật.                                                                                                                                                                                                                                |
| Linux x64                      | Chưa đạt                                      | Chưa có máy thật.                                                                                                                                                                                                                                |

## Artifact Windows cuối

- Tệp: `Hermes-0.17.0-win-x64.exe`
- Kích thước: `121419758` byte
- SHA-256: `46D4EAD85DE96610232B4085047205A405BA9FA7810169661841D5B262A37804`
- Install stamp: `04345ecdf9ea22ef28145bad206211b79a00739b`
- Trạng thái chữ ký: `NotSigned`
- SHA-256 `win-unpacked/Hermes.exe` và executable đã cài:
  `1BF43E7D75C000B4EFD6C358DFF34168519C2BA285B5E88B7C7E905D7044A7D6`

Hai hash trên chỉ là artifact cục bộ để kiểm chứng, chưa phải hash phát hành.

## Thay đổi đã làm

- Nâng `cryptography` lên 50.0.0 và khóa bằng test metadata/lock.
- Ép `tar` root/build/optional lên 7.5.22; nâng `nanoid` website lên 3.3.18.
- Phân loại đủ 22 Code Scanning alerts theo runtime, build/optional và website.
- Sửa scheduled install E2E cho họ tag `vi-v*`, thêm diagnostics và test bằng
  repo Git tạm thật.
- Sửa tiêu đề tab draft đầu tiên phản ứng với locale để hiển thị **Phiên mới**.
- Cho đổi tên đúng phiên runtime hiện hành khi session đã đổi từ lineage root
  sang tip sau nén.
- Bổ sung sửa chữa offline cho DB WAL cũ trong `hermes doctor --fix`; không đổi
  journal mode khi còn tiến trình giữ DB.
- Cho panel Tệp/Trình duyệt mở rộng theo viewport và tự fit trang web khi hẹp;
  giữ nguyên kích thước đã lưu và sàn an toàn của vùng hội thoại. Bổ sung refit
  tại ranh giới kết thúc thao tác để không phụ thuộc hoàn toàn vào
  `ResizeObserver` của Electron.
- Thêm thanh tab Browser riêng trong panel phải: `+` tạo tab, `×` đóng tab,
  mỗi webview giữ trạng thái khi chuyển tab; đóng tab cuối trở về Tệp. Bỏ nhãn
  chữ **Hệ thống tệp** nhưng giữ nút biểu tượng và trợ năng.
- Sửa updater của bản cài được quản lý: tự đổi remote chính thức từ SSH sang
  HTTPS trước khi fetch, ưu tiên HTTPS khi clone mới và giữ nguyên remote fork;
  kiểm tra nền chỉ đọc và giới hạn fetch của checkout nông ở 64 commit.
- Cách ly toàn bộ dữ liệu session cũ bị hỏng; tuyệt đối không khôi phục vào hồ
  sơ sạch hoặc artifact.
- Gỡ bản Windows cũ, sao lưu/xóa mục gỡ cài đặt HKLM bị treo và cài lại per-user;
  sau smoke test, hồ sơ hoạt động còn 0 phiên/0 tin nhắn.

## Cổng máy thật còn thiếu

### macOS Apple Silicon

1. Tải DMG/ZIP arm64 từ run cùng commit; đối chiếu SHA-256.
2. Kiểm tra Gatekeeper trên artifact chưa ký/notarize và ghi đúng cảnh báo.
3. Cài bằng user mới hoặc `HOME`/`HERMES_HOME` cô lập; xác minh không có session,
   token hoặc profile cũ.
4. Chạy bootstrap, kiểm tra backend health, onboarding, tạo hai phiên, chuyển/đóng
   tab, và đổi Tệp/Trình duyệt ở panel phải.
5. Khởi động lại để kiểm tra marker, locale và dữ liệu chỉ nằm trong home thử.

### Linux x64

1. Thử AppImage và ít nhất một gói native phù hợp distro (`deb` hoặc `rpm`).
2. Dùng user/container desktop sạch với `HOME`/`HERMES_HOME` cô lập.
3. Xác minh bootstrap, health, onboarding, hai phiên/tab, đóng tab, panel
   Tệp/Trình duyệt và quyền executable/sandbox.
4. Khởi động lại và kiểm tra không truy cập home Hermes ngoài sandbox.

CI build không thay thế hai lượt máy thật trên.

## Rollback

- Giữ `vi-v0.20.0-14` là Latest; không thay asset hoặc tag hiện tại.
- Nhánh v15 đã push nhưng chưa merge/tag/release. Nếu dừng hẳn, giữ báo cáo và
  đóng nhánh/PR; bản v14 công khai không thay đổi.
- Nếu cần bỏ thay đổi trên nhánh, revert `04345ecdf` trước, sau đó
  `48fb23a88`, `dd89c0423`, `3b49907af`, `b5b707511` và lần lượt từ
  `4148a5546` về trước;
  chạy lại lock/security tests sau mỗi revert.
- Máy thử có thể cài lại bộ v14 công khai; không nhập hoặc khôi phục profile cũ
  trong quá trình rollback.
- Nếu một pre-release v15 sau này lỗi, đánh dấu pre-release/thu hồi Latest và
  hướng người thử quay lại v14; không tự động phục hồi state/profile cũ.

## Release notes dự kiến

### Hermes Vietnamese vi-v0.20.0-15

- Vá ba lỗ hổng runtime Python bằng `cryptography 50.0.0`.
- Cập nhật sàn phụ thuộc Node cho chuỗi build và website.
- Sửa kiểm thử cài đặt định kỳ để hỗ trợ tag phát hành `vi-v*` và in chẩn đoán
  rõ ràng khi trigger.
- Sửa cập nhật trên máy dùng remote GitHub SSH bằng cách chuyển remote chính
  thức sang HTTPS; không thay đổi remote fork/tùy chỉnh. Kiểm tra cập nhật nền
  không còn fetch trùng và checkout nông không tải toàn bộ lịch sử Git.
- Sửa tab phiên đầu tiên hiển thị đúng **Phiên mới** theo ngôn ngữ giao diện.
- Khôi phục tên phiên tự sinh ở danh sách trái và đổi tên bền vững qua lineage
  phiên sau nén.
- Cho panel phải mở rộng hơn và tự fit toàn cảnh trang web khi panel hẹp.
- Thêm tab Browser có nút `+` và `×`; bỏ dòng chữ **Hệ thống tệp** thừa ở đầu
  panel trong khi vẫn giữ biểu tượng Tệp.
- Thêm `hermes doctor --fix` để sửa an toàn DB WAL cũ khi Hermes đã dừng.
- Không kèm lịch sử, hồ sơ, thông tin đăng nhập hoặc dữ liệu Hermes cũ.

Lưu ý dự kiến: bộ cài chưa ký số trong thời gian chờ SignPath, vì vậy Windows
SmartScreen/Application Control và macOS Gatekeeper có thể chặn hoặc cảnh báo.

## Điều kiện để đổi sang GO

1. Cho phép/ký đúng executable tại `04345ecdf`, rồi chạy fresh-install smoke
   trọn vẹn bằng hồ sơ mới. Không đổi chính sách hoặc bỏ ghim commit để vượt
   cổng này.
2. Workflow `install-e2e` phải tạo job và chạy được với tag ứng viên `vi-v*`,
   phân loại rõ lỗi hạ tầng nếu có.
3. Hoàn tất máy thật macOS Apple Silicon và Linux x64, hoặc giữ v15 ở phạm vi
   pre-release nội bộ thay vì thử nghiệm rộng.
