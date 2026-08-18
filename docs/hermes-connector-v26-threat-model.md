# Threat model Hermes Connector v26

**Trạng thái:** đã khóa để triển khai v26<br>
**Ngày:** 2026-08-17<br>
**Phạm vi:** companion Chrome/Edge chính chủ chuyển cookie của một website sang
Browser của Hermes trên cùng máy.

## 1. Tài sản cần bảo vệ

- Giá trị cookie đăng nhập, gồm cookie `HttpOnly`.
- Mã ghép nối, token truyền một lần và payload đang chờ xác nhận.
- Hồ sơ Chrome/Edge nguồn và partition Chromium đích
  `persist:hermes-preview`.
- Sự đồng ý theo website, lịch sử import và quyền thu hồi.
- Log, crash evidence và artifact phát hành không được chứa dữ liệu trên.

Mật khẩu, autofill, bookmark, lịch sử, localStorage, IndexedDB, service-worker
storage, certificate và toàn bộ hồ sơ trình duyệt nằm ngoài phạm vi. Connector
không có mã để đọc các loại dữ liệu này.

## 2. Biên tin cậy

1. **Chrome/Edge profile:** extension MV3 chạy trong profile người dùng đã cài.
2. **Loopback:** HTTP chỉ bind vào `127.0.0.1` trên cổng ngẫu nhiên và chỉ tồn
   tại trong một lần ghép nối.
3. **Electron main:** nơi duy nhất nhận giá trị cookie và thao tác cookie store.
4. **Renderer:** chỉ nhận hostname, số lượng, expiry tổng hợp, số cookie bỏ qua
   và trạng thái. Renderer không nhận tên hoặc giá trị cookie.
5. **Chromium partition:** chỉ `persist:hermes-preview` được phép làm đích.
6. **Đĩa:** chỉ lưu metadata tối thiểu phục vụ revoke; không lưu giá trị cookie
   hoặc token.

Không có máy chủ trung gian. Kẻ có quyền quản trị hệ điều hành, debugger hoặc
khả năng đọc bộ nhớ của tiến trình nằm ngoài threat model v26. Hermes không bật
crash upload cho connector và không chủ động tạo crash evidence chứa payload.

## 3. Luồng đồng ý

1. Người dùng đang mở một URL `http` hoặc `https` trong Browser của Hermes và
   bấm **Dùng phiên đăng nhập từ Chrome/Edge**.
2. Desktop hiển thị đúng hostname đích, sinh mã ghép nối một lần và mở endpoint
   loopback trong tối đa 120 giây.
3. Người dùng mở popup extension trên tab nguồn. Extension hiển thị hostname,
   yêu cầu quyền `cookies` và host permission cho origin hiện tại từ thao tác đó.
4. Extension chỉ gọi `cookies.getAll({url, storeId})` cho tab hiện tại. Nó hiển
   thị hostname, tổng số cookie, số cookie không hỗ trợ và expiry tổng hợp trước
   khi gửi.
5. Người dùng nhập mã và bấm gửi. Desktop xác nhận browser/origin, hiển thị cùng
   metadata và yêu cầu xác nhận nhập lần cuối.
6. Electron main validate và ghi cookie. Payload bị xóa khỏi RAM ngay sau import,
   hủy hoặc timeout.

Mọi thay đổi hostname, đóng app, hết hạn, sai token, sai extension origin hoặc
request lặp đều fail-closed. Không có import nền và không tự động ghép lại.

## 4. Quyền extension

- Manifest V3, `incognito: "not_allowed"`.
- Quyền cài mặc định chỉ đủ để mở popup và nhận tab do người dùng kích hoạt.
- `cookies` và host pattern cho HTTP/HTTPS là optional permissions.
- Quyền host được xin trong popup từ thao tác người dùng, chỉ cho origin hiện
  tại. Extension không dùng `<all_urls>` như quyền mặc định.
- Loopback origin được giới hạn ở `http://127.0.0.1/*`; không dùng `localhost`,
  LAN address hoặc wildcard network host.
- Extension không enumerate profile. `storeId` được lấy từ tab hiện tại, vì vậy
  nhiều profile tách biệt theo quy tắc của Chromium.

Người dùng có thể thu hồi host permission trong trình duyệt. Công tắc connector
trong Hermes chặn toàn bộ lần ghép nối mới nhưng không thay đổi quyền của trình
duyệt nguồn.

## 5. Giao thức loopback

- Bind chính xác `127.0.0.1`, cổng hệ điều hành cấp; không bind `0.0.0.0` hoặc
  IPv6 wildcard.
- Mỗi attempt có secret ngẫu nhiên tối thiểu 128 bit, TTL 120 giây, một origin
  đích và một extension origin chính chủ.
- Request phải có `Origin` đúng allowlist, content type JSON, header giao thức
  riêng và token đúng. CORS preflight chỉ phản hồi origin hợp lệ.
- Token được so sánh constant-time, tiêu thụ sau lần nhận hợp lệ đầu tiên và
  đưa vào replay tombstone tới hết TTL.
- Body giới hạn 2 MiB; tối đa 500 cookie; timeout đọc ngắn; method và path khác
  allowlist bị từ chối.
- Desktop xác nhận hai phía trước khi cấp token upload một lần. Token upload bị
  ràng buộc với attempt, origin và hostname.
- Server đóng sau success, cancel, app quit hoặc timeout. Pending payload được
  zero-reference trong mọi đường kết thúc.

Mã ghép nối không phải bằng chứng cài đặt đáng tin tuyệt đối trước malware cục
bộ. Allowlist extension ID, digest bundle được công bố và cài extension từ
artifact chính chủ là lớp trust v26. Rủi ro malware có quyền đọc browser/process
memory được ghi nhận là residual risk.

## 6. Quy tắc cookie

- Chỉ chấp nhận cookie áp dụng cho URL tab nguồn và hostname phải khớp hostname
  mà Desktop đã khóa khi bắt đầu.
- Giữ `domain`, `path`, `secure`, `httpOnly`, expiry và `sameSite` khi Electron
  hỗ trợ. Cookie host-only được ghi mà không truyền `domain`.
- Cookie session không có expiry và chỉ sống theo chính sách session của
  Chromium đích. Cookie persistent giữ expiry nguồn.
- Cookie đã hết hạn, schema sai, domain không liên quan hoặc vi phạm tiền tố
  `__Host-`/`__Secure-` bị từ chối.
- Electron 41 không có API `partitionKey` cho `cookies.set`. Cookie partitioned
  bị bỏ qua và được tính vào mục **không hỗ trợ**; tuyệt đối không bỏ partition
  key rồi nhập thành cookie không phân vùng.
- Import chỉ gọi `session.fromPartition('persist:hermes-preview')`.
- Import có thể thay cookie cùng identity đang có trong Hermes Browser. UX phải
  nói rõ trước xác nhận; v26 không giữ bản sao giá trị cũ.

## 7. Persistence và revoke

- Giá trị cookie chỉ tồn tại trong extension, request loopback, RAM Electron main
  và cookie store Chromium đích.
- File metadata chỉ giữ import ID, hostname, thời điểm, expiry và identity cần
  xóa gồm name/domain/path/secure/host-only. Không giữ value, token hoặc URL đầy
  đủ có query/fragment.
- Ghi metadata nguyên tử với quyền user-only khi hệ điều hành hỗ trợ.
- Revoke xóa đúng identity đã nhập rồi gọi `flushStore`; không quét hoặc xóa
  cookie khác. Nếu website đã làm mới cùng identity sau import, revoke vẫn xóa
  identity đó. UX phải nêu giới hạn này.
- Metadata được prune khi revoke hoặc khi mọi expiry persistent đã qua. Cookie
  session mất theo vòng đời Chromium session.

## 8. Log, lỗi và bằng chứng

- Không log request body, cookie name/value, pairing token, header hoặc URL đầy
  đủ. Log chỉ được phép có mã lỗi ổn định, attempt ID ngẫu nhiên không bí mật và
  hostname đã được người dùng thấy.
- Lỗi schema trả mã tổng quát; exception được chuẩn hóa trước khi qua IPC.
- Test và release evidence dùng cookie giả cố định, không dùng profile thật.
- Scanner trước release phải tìm secret/cookie fixture ngoài thư mục test và
  tìm token/value trong log exact-artifact smoke.

## 9. Mối đe dọa và biện pháp

| Mối đe dọa                         | Biện pháp v26                                                   | Kết quả               |
| ---------------------------------- | --------------------------------------------------------------- | --------------------- |
| Website kích hoạt import           | Chỉ thao tác popup + optional permission + xác nhận Desktop     | Chặn                  |
| Trang web gọi loopback             | Origin allowlist, header riêng, token 128-bit, CORS fail-closed | Chặn                  |
| Đoán/replay mã                     | TTL 120 giây, constant-time compare, consume-once, tombstone    | Chặn                  |
| Chuyển nhầm domain                 | Khóa hostname hai phía và validate từng cookie                  | Chặn                  |
| Rò payload qua renderer/log        | Giá trị chỉ ở main; IPC metadata-only; redaction tests          | Chặn                  |
| Mất partition isolation            | Bỏ qua cookie partitioned có cảnh báo                           | Chặn                  |
| Extension giả cục bộ               | Stable extension ID + digest/artifact review; xác nhận hai phía | Giảm thiểu            |
| Malware/admin đọc bộ nhớ           | Ngoài threat model; TTL ngắn và zero-reference                  | Residual              |
| Revoke xóa phiên mới cùng identity | Cảnh báo rõ; chỉ identity đã ghi                                | Residual đã chấp nhận |

## 10. Điều kiện dừng

Candidate không được public nếu có bất kỳ trường hợp nào sau đây:

- Endpoint nghe ngoài loopback hoặc chấp nhận origin/token sai.
- Cookie/token xuất hiện trong log, crash evidence hay artifact không phải fixture.
- Renderer nhận value cookie.
- Partitioned cookie bị nhập mà mất partition key.
- Revoke chạm cookie ngoài import ledger.
- Extension hoạt động trước consent hoặc không có permission domain.
