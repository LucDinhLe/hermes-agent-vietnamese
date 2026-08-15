# Quyết định phát hành vi-v0.20.0-15

Ngày đánh giá: 2026-08-15

## Quyết định

**NO-GO cho phát hành công khai hoặc thử nghiệm rộng.** Phần rủi ro runtime
nghiêm trọng đã được đóng cục bộ, nhưng ba cổng bắt buộc vẫn chưa có bằng chứng
đạt:

1. Gói Windows x64 cuối chạy được, nhưng fresh bootstrap thuần dừng ở HTTP 404:
   install stamp ghim commit cục bộ `4148a5546`, trong khi nhánh chưa được phép
   push. Renderer/backend mã cuối đã smoke bằng hồ sơ cô lập và source override;
   cách đó không được tính thay cho bootstrap từ đúng commit đã công bố.
2. Workflow `install-e2e` đã có test hợp đồng cục bộ nhưng chưa được chạy trên
   GitHub runner với tag `vi-v*`, vì nhánh chưa được push.
3. Chưa có smoke test trên máy thật macOS Apple Silicon và Linux x64.

Có thể cân nhắc **thử nội bộ có kiểm soát** sau khi fresh bootstrap của đúng
commit cuối đạt và GitHub workflow tạo job thật. Không giữ hoặc nhập dữ liệu
Hermes cũ trong bất kỳ bước nào.

## Bằng chứng

| Cổng                           | Kết quả                                      | Bằng chứng chính                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python runtime                 | Đạt                                          | `cryptography==50.0.0` trong `pyproject.toml`, `uv.lock`, môi trường regression và venv bootstrap sạch; 174 test regression đạt.                                                                                                         |
| Hợp đồng bảo mật/lock/workflow | Đạt cục bộ                                   | 13/13 test đạt; tag picker ưu tiên `vi-v*`, trigger nhận `vi-v*`, có job diagnostics.                                                                                                                                                    |
| Node desktop/build             | Đạt                                          | Toàn cây root dùng `tar 7.5.22`; `npm ci`, `npm audit` root 0, `npm rebuild get-windows`, staging và packaging matrix đạt.                                                                                                               |
| Cảnh báo còn lại               | Chấp nhận có điều kiện                       | OSV cục bộ chỉ còn hai advisory `image-size 2.0.2` trong website, chưa có fixed version và không nằm trong Desktop artifact.                                                                                                             |
| Desktop code quality           | Đạt cho lát cắt                              | Typecheck đạt; lint 0 lỗi (91 cảnh báo có sẵn); 70/70 UI test liên quan và 4/4 test tiêu đề phiên đạt.                                                                                                                                   |
| Windows bootstrap sạch         | Đạt trên checkpoint trước bản vá UI cuối     | Bootstrap đủ stage từ checkout sạch ghim `18c00b4c3`; venv có `cryptography 50.0.0`; `/api/health` trả HTTP 200, Hermes 0.20.0; onboarding hiện, không có phiên cũ.                                                                      |
| Bản vá UI phát hiện khi smoke  | Đạt bằng test/build                          | Tab ban đầu từng giữ placeholder tiếng Anh sau khi chuyển locale; commit `c646de336` dùng tiêu đề draft dịch động. Typecheck, lint và 4/4 test liên quan đạt.                                                                            |
| Tên/đổi tên phiên              | Đạt                                          | Hồ sơ cũ hỏng được cách ly, không khôi phục. Trên hồ sơ sạch, tên tự sinh hiện ở panel trái, đổi tên lưu bền qua reload, không còn 500. `b2fa5e368` thêm bảo vệ lineage root/tip và test hồi quy.                                        |
| SQLite/WAL                     | Đạt có giảm hiệu năng                        | Runtime SQLite 3.49.1 còn lỗi WAL-reset nhưng mã lõi giữ DB mới ở `journal_mode=delete`; `4148a5546` cho `doctor --fix` chuyển DB WAL cũ khi offline. Hồ sơ thử cuối có 0 phiên và state DB ở rollback mode.                             |
| Windows artifact cuối          | Build/khởi động đạt; bootstrap cuối còn chặn | NSIS x64 từ `4148a5546`, stamp sạch; payload không chứa `tar`, `image-size`, state DB, `.env` hay credentials. Application Control cho chạy; backend mã cuối ready trên hồ sơ cô lập. Bootstrap ghim commit trả 404 vì commit chưa push. |
| Desktop suite tổng quan        | Chấp nhận có điều kiện                       | UI 3.680/3.687 ở lượt song song; cả 7 ca lỗi đều đạt khi chạy riêng. Electron 993/1.023; 27 ca POSIX/quyền/timing nền thất bại trên Windows. Test mục tiêu của lát cắt đều xanh.                                                         |
| Website                        | Build đạt, typecheck nền chưa đạt            | Docusaurus locale `en` build thành công; còn hai broken-link warning có sẵn. Typecheck vướng cấu hình Docusaurus/TypeScript 6, namespace JSX và thiếu `userStories.json`.                                                                |
| macOS Apple Silicon            | Chưa đạt                                     | Chưa có máy thật.                                                                                                                                                                                                                        |
| Linux x64                      | Chưa đạt                                     | Chưa có máy thật.                                                                                                                                                                                                                        |

## Artifact Windows cuối

- Tệp: `Hermes-0.17.0-win-x64.exe`
- Kích thước: `121419143` byte
- SHA-256: `3B06CADCCA7BD1E2EB0A402CF672AC0E227E54D95F75968203A7595F2916907D`
- Install stamp: `4148a5546e00e7500176c9e42e621d0e0862424d`
- Trạng thái chữ ký: `NotSigned`
- SHA-256 `win-unpacked/Hermes.exe`:
  `C8CFCDD8F756EE87F8A286BD2393710888251FC0CD3EFBDE99F4BFD9BFAA5180`

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
- Cách ly toàn bộ dữ liệu session cũ bị hỏng; tuyệt đối không khôi phục vào hồ
  sơ sạch hoặc artifact.

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
- Nhánh v15 chỉ có commit cục bộ. Nếu dừng hẳn, bỏ worktree/nhánh sau khi lưu báo
  cáo; không cần rollback người dùng vì chưa có hành động công khai.
- Nếu thay đổi đã được push sau này nhưng chưa release, revert lần lượt từ
  `4148a5546` về trước; chạy lại lock/security tests sau mỗi revert.
- Nếu một pre-release v15 sau này lỗi, đánh dấu pre-release/thu hồi Latest và
  hướng người thử quay lại v14; không tự động phục hồi state/profile cũ.

## Release notes dự kiến

### Hermes Vietnamese vi-v0.20.0-15

- Vá ba lỗ hổng runtime Python bằng `cryptography 50.0.0`.
- Cập nhật sàn phụ thuộc Node cho chuỗi build và website.
- Sửa kiểm thử cài đặt định kỳ để hỗ trợ tag phát hành `vi-v*` và in chẩn đoán
  rõ ràng khi trigger.
- Sửa tab phiên đầu tiên hiển thị đúng **Phiên mới** theo ngôn ngữ giao diện.
- Khôi phục tên phiên tự sinh ở danh sách trái và đổi tên bền vững qua lineage
  phiên sau nén.
- Thêm `hermes doctor --fix` để sửa an toàn DB WAL cũ khi Hermes đã dừng.
- Không kèm lịch sử, hồ sơ, thông tin đăng nhập hoặc dữ liệu Hermes cũ.

Lưu ý dự kiến: bộ cài chưa ký số trong thời gian chờ SignPath, vì vậy Windows
SmartScreen/Application Control và macOS Gatekeeper có thể chặn hoặc cảnh báo.

## Điều kiện để đổi sang GO

1. Sau khi Đại ca cho phép push, build lại từ commit có thể tải bằng install
   stamp và chạy fresh-install smoke trọn vẹn trên hồ sơ mới. Không thay stamp
   hoặc bỏ ghim commit để vượt cổng này.
2. Push nhánh sau khi Đại ca cho phép; workflow `install-e2e` phải tạo job và
   chạy được với tag `vi-v*`, phân loại rõ lỗi hạ tầng nếu có.
3. Hoàn tất máy thật macOS Apple Silicon và Linux x64, hoặc giữ v15 ở phạm vi
   pre-release nội bộ thay vì thử nghiệm rộng.
