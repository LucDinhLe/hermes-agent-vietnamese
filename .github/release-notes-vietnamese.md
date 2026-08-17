## Hermes Vietnamese vi-v0.20.0-26 — candidate kín để nghiệm thu

Hermes Vietnamese v26 bổ sung Hermes Connector chính chủ cho Chrome/Edge và tùy
chọn tóm tắt phần suy luận công khai bằng tiếng Việt. Đây là bản phân phối độc
lập của [Hermes Agent](https://github.com/NousResearch/hermes-agent), do
[Lê Đình Lực](https://github.com/LucDinhLe) phát triển cho cộng đồng theo giấy
phép MIT.

> **Đây mới là draft candidate, không phải bản tải công khai và không phải
> stable.** Public Latest vẫn là `vi-v0.20.0-25`. Chỉ promotion đúng artifact đã
> vượt toàn bộ exact-artifact gate mới được phép thay đổi trạng thái này.

### Điểm mới trong v26

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
  extension manifest/digest, Desktop consent/trust và reasoning summary đã được
  đưa thẳng vào workflow tạo candidate.
- Sáu target native phải build thành công và khớp SHA-256 trước khi draft được
  tạo: Windows x64/ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64.
- **Windows x64 chưa được tuyên bố exact-artifact smoke đạt ở thời điểm tạo
  draft.** Candidate phải được tải lại từ draft và thử trong Hermes HOME,
  AppData, Electron user-data, Chrome profile và Edge profile hoàn toàn cô lập.
- Cổng bắt buộc còn gồm: fresh install, first-run không cần developer tools,
  gateway/onboarding, safe tool, Chrome+Edge Connector, revoke/persistence,
  redaction, reasoning summary bật/tắt, update từ exact v25, repair, uninstall và
  rollback.
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
- Rollback target đã phê duyệt: [`vi-v0.20.0-14`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).
- Thu hồi cookie chỉ xóa giá trị đã nhập; ledger không lưu giá trị cũ nên không
  thể khôi phục cookie sau khi revoke.

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và chi phí dịch vụ.
