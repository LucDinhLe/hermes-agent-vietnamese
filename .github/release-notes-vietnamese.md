## Hermes Vietnamese vi-v0.20.4-34 — đồng bộ Hermes Agent 0.20.4

Hermes Vietnamese v26 bổ sung Hermes Connector chính chủ cho Chrome/Edge và tùy
chọn tóm tắt phần suy luận công khai bằng tiếng Việt. Bản `-27` bổ sung Advisor
chỉ đọc để rà kế hoạch, đổi hướng phục hồi và kết quả cuối bằng một mô hình
riêng do người dùng chọn. Bản `-28` giữ nguyên các nâng cấp đó, đồng bộ nền lõi
với [Hermes Agent 0.20.4](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.18),
khôi phục cập nhật từ kho cộng đồng và sửa giao diện lần đầu luôn mặc định tiếng
Việt. Đây là bản phân phối độc lập của
[Hermes Agent](https://github.com/NousResearch/hermes-agent), do [Lê Đình
Lực](https://github.com/LucDinhLe) phát triển cho cộng đồng theo giấy phép MIT.

> **Lớp phát hành: community prerelease, không phải stable.** Workflow luôn tạo
> draft trước. Chỉ đúng artifact đã vượt toàn bộ exact-artifact gate mới được
> chuyển thành bản công khai; Public Latest vẫn là `vi-v0.20.0-25`.

### Bản tải công khai hiện hành

`vi-v0.20.0-25` vẫn là **bản tải mặc định/Latest** trong thời gian v28 được
nghiệm thu. Người dùng thông thường nên tiếp tục tải đúng tệp v25 dưới đây:

| Máy đang dùng           | Tải bản Public Latest v25                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Gói DEB x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.deb)                          |
| Ubuntu/Debian ARM64     | [Gói DEB ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.deb)                      |
| Fedora/RHEL x64         | [Gói RPM x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.rpm)                          |
| Fedora/RHEL ARM64       | [Gói RPM ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.rpm)                      |
| Linux khác x64          | [AppImage x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.AppImage)                    |
| Linux khác ARM64        | [AppImage ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.AppImage)                |

Nếu Edge hoặc SmartScreen cảnh báo vì bản v25 chưa ký số, chỉ tiếp tục sau khi
đã kiểm đúng nguồn, tên tệp và SHA-256:

| 1. Bấm See more                                                                                                                                                                          | 2. Chọn Keep trong menu tải xuống                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Edge báo Hermes chưa được tải xuống phổ biến](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-warning-see-more-v25.jpg)      | ![Menu tải xuống của Edge có lựa chọn Keep](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-download-menu-keep-v25.jpg) |
| **3. Kiểm tra tên tệp và nguồn tải**                                                                                                                                                     | **4. Mở mũi tên và chọn Keep anyway**                                                                                                                                             |
| ![Edge hiện Publisher Unknown vì bộ cài chưa ký số](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-publisher-unknown-v25.jpg) | ![Edge hiện lựa chọn Keep anyway](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-keep-anyway-v25.jpg)                  |

### Điểm mạnh so với cách tự cài Hermes Agent từ mã nguồn

Hermes Vietnamese đóng gói Desktop, runtime và hướng dẫn VI/EN thành một đường
cài có thể kiểm tra, thay vì yêu cầu người dùng phổ thông tự chuẩn bị Git,
Python, Node.js và dependency. Bản phân phối không kèm model, tài khoản trả phí,
API key hoặc hạn mức sử dụng.

### Điểm mới trong v28

#### Đồng bộ nền Hermes Agent mới nhất

- Đồng bộ từ tag upstream đã ký `v2026.8.18`, tương ứng Hermes Agent `0.20.4`,
  thay vì bám một nhánh động.
- Giữ các thay đổi lõi mới của upstream về model/provider, gateway, bộ nhớ,
  công cụ, Desktop và an toàn cập nhật; đồng thời giữ nguyên lớp phân phối tiếng
  Việt, runtime resident, installer và cơ chế quay lui của dự án cộng đồng.
- Khôi phục đường cài và kênh cập nhật về
  `LucDinhLe/hermes-agent-vietnamese`; kênh stable ưu tiên tag `vi-v*` công khai.
- Khôi phục `hermes update --eject` để tải script cài nguồn từ đúng commit của
  Hermes Vietnamese; không còn giao commit cộng đồng cho bộ cài upstream.
- Kênh cập nhật stable chỉ chọn GitHub Release đã công khai; tag của draft
  candidate không còn bị báo sớm cho người dùng.
- Nâng Electron lên `42.8.0`; kiểm toán dependency đầy đủ tại candidate source
  trả về `0 vulnerabilities`.
- Lần chạy đầu nhận tiếng Việt từ cả Desktop và cấu hình backend; ô nhập tiếp
  theo dùng câu **Gửi yêu cầu**, không dùng cụm **Gửi theo dõi**.

### Các nâng cấp được giữ từ v26 và v27

#### Hermes Connector cho Chrome và Edge

- Companion extension Manifest V3 chính chủ, dùng cùng một gói cho Chrome và
  Edge; cài theo chế độ unpacked từ thư mục được Hermes cung cấp.
- Người dùng phải bật Connector, chọn đúng tab/domain, cấp optional host
  permission và xác nhận ở cả extension lẫn Hermes trước khi import.
- Ghép cặp qua `127.0.0.1` bằng mã dùng một lần, có thời hạn, khóa theo origin,
  chống replay và tự hủy khi app đóng hoặc yêu cầu bị hủy.
- Màn hình consent hiển thị hostname, số cookie và thời hạn trước khi nhập.
- Cookie chỉ được nhập vào Electron session `persist:hermes-preview`; ledger cục
  bộ chỉ giữ metadata cần cho thu hồi, không giữ giá trị cookie.
- Có nút thu hồi để xóa đúng cookie đã nhập. Import lỗi được rollback.
- Không đọc trực tiếp hồ sơ Chrome/Edge và không chuyển mật khẩu, autofill, lịch
  sử, bookmark, localStorage hoặc toàn bộ profile.

Giới hạn v26: cookie partitioned/CHIPS bị bỏ qua khi runtime không thể bảo toàn
partition key một cách an toàn. v26 chỉ hỗ trợ Hermes Connector chính chủ và nền
móng trust/allowlist/digest của nó; không tuyên bố tương thích mọi extension trên
Chrome Web Store. Extension Manager tổng quát được tách khỏi phạm vi v26.

#### Tóm tắt suy luận bằng tiếng Việt

- Tùy chọn **Tóm tắt suy luận bằng tiếng Việt** mặc định tắt.
- Chỉ chạy sau khi lượt trả lời hoàn tất và chỉ với reasoning công khai thực sự
  do model/provider trả về.
- Reasoning gốc và câu trả lời assistant được giữ nguyên; bản tóm tắt nằm trong
  một panel riêng và ghi rõ model/provider tạo nó.
- Khi tắt, Hermes không tạo request tóm tắt mới. Cache cục bộ không lưu reasoning
  nguồn và được tách theo profile/session/digest.
- Mỗi lần tạo tóm tắt có thể phát sinh thêm độ trễ và chi phí model; usage/cost
  chỉ hiển thị khi provider cung cấp số liệu phù hợp.
- Tính năng không cố truy xuất chain-of-thought ẩn, encrypted thinking hoặc dữ
  liệu provider không công bố.

#### Giám sát bằng Advisor

- Advisor mặc định tắt và có cấu hình model/provider riêng ngay cạnh model làm
  việc trong Settings → Model.
- Khi bật, Hermes tự gọi Advisor trước batch công cụ có thể thay đổi trạng thái
  đầu tiên, khi đổi hướng hoặc lặp lỗi và trước khi giao kết quả cuối.
- Advisor chỉ nhận packet đã rút gọn/redact, không có tools và không trực tiếp
  thao tác tệp, trình duyệt, terminal hoặc nhắn người dùng thay model làm việc.
- Verdict gồm `PASS`, `REVISE`, `ASK_USER` và `BLOCK`; vòng chỉnh sửa được giới
  hạn mặc định hai lần để tránh lặp vô hạn.
- Khi tắt, đường Advisor tạo đúng zero model call. Khi bật, mỗi checkpoint có
  thể làm tăng độ trễ và chi phí theo model được chọn.

### Quyền riêng tư và bảo mật

- Cookie/token không được ghi vào log, crash evidence, analytics hay file trung
  gian dạng rõ.
- Extension chỉ xin quyền `cookies`, `storage`, `activeTab` và quyền host tùy
  chọn cho domain người dùng vừa chọn; không xin `<all_urls>` mặc định.
- Connector mặc định tắt. Trust record kiểm extension ID, digest và permission
  allowlist; extension lỗi hoặc sai digest không được tin cậy.
- Hermes có thể chạy lệnh, sửa tệp và gửi dữ liệu tới model/dịch vụ mà người dùng
  chọn. Hãy thử bằng dữ liệu không nhạy cảm trước và kiểm tra quyền được hỏi.

### Tình trạng candidate và cổng nghiệm thu

- Source/unit gate cho cookie validation/import/revoke, loopback pairing,
  extension manifest/digest, Desktop consent/trust, reasoning summary và
  Advisor plan/recovery/final đã được đưa thẳng vào workflow tạo candidate.
- Sáu target native phải build thành công và khớp SHA-256 trước khi draft được
  tạo: Windows x64/ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64.
- **Windows x64 chưa được tuyên bố exact-artifact smoke đạt trước workflow
  runtime-smoke.** Candidate phải được tải lại từ draft và thử trong Hermes HOME,
  AppData, Electron user-data, Chrome profile và Edge profile hoàn toàn cô lập.
- Cổng bắt buộc còn gồm: fresh install, first-run không cần developer tools,
  gateway/onboarding, safe tool, Chrome+Edge Connector, revoke/persistence,
  redaction, reasoning summary bật/tắt, Advisor bật/tắt/read-only/bounded,
  update từ exact v25, repair, uninstall và rollback.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 chỉ được ghi
  `BUILD-ONLY-PILOT` nếu chưa có smoke trên máy người dùng; không suy diễn từ CI.

Không được public candidate nếu thiếu một gate trên. Mọi lỗi làm thay đổi byte
đều phải tạo candidate tag mới; không thay asset hoặc di chuyển tag đã nghiệm
thu.

### Chữ ký và cảnh báo nền tảng

- Candidate community-prerelease Windows hiện chưa có Authenticode; SignPath
  Foundation vẫn là hướng ký dự kiến. SmartScreen hoặc chính sách doanh nghiệp
  có thể cảnh báo/chặn.
- Dự án chưa tham gia Apple Developer Program; candidate macOS chưa có Developer
  ID hoặc notarization và có thể bị Gatekeeper cảnh báo/chặn.
- SHA-256 xác minh byte tải về nhưng không thay thế chữ ký số.

### Phản hồi và báo cáo bảo mật

Chỉ dùng dữ liệu thử không nhạy cảm khi nghiệm thu Connector. Không đăng cookie,
pairing token, API key, OAuth token, mật khẩu, lịch sử duyệt web, database hoặc
log chưa làm sạch vào issue hay bằng chứng.

- Lỗi và góp ý: [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- Báo cáo bảo mật: [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md)
- Cài đặt: [README tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md)

### Quay lui

- Public Latest hiện tại: [`vi-v0.20.0-25`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-25).
- [`vi-v0.20.0-14`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14) được giữ nguyên làm bản quay lui.
- Thu hồi cookie chỉ xóa giá trị đã nhập; ledger không lưu giá trị cũ nên không
  thể khôi phục cookie sau khi revoke.

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và chi phí dịch vụ.
