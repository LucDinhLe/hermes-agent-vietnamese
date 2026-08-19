# Đặc tả Hermes Vietnamese v26

**Phiên bản:** 1.1 khóa triển khai<br>
**Ngày:** 2026-08-18<br>
**Cơ sở:** `origin/main` tại `4d597f74600cdc3791edf7d34566534182946c55`

## 1. Mục tiêu sản phẩm

v26 bổ sung ba khả năng độc lập:

1. Chuyển có kiểm soát phiên đăng nhập của website hiện tại từ Chrome/Edge sang
   Browser của Hermes.
2. Tạo bản tóm tắt tiếng Việt tùy chọn từ reasoning công khai sau khi lượt chạy
   kết thúc, đồng thời giữ nguyên reasoning và câu trả lời gốc.
3. Cho phép bật một model **Giám sát (Advisor)** độc lập để rà soát kế hoạch,
   nhịp phục hồi và kết quả cuối của model làm việc.

Nền móng trust của extension được đưa vào connector. Trình quản lý extension
tổng quát và hỗ trợ Chrome Web Store được hoãn sang v27.

## 2. Hermes Connector

### 2.1 Thành phần

- `apps/desktop/extensions/hermes-connector/`: extension MV3 dùng chung cho
  Chrome và Edge, gồm popup, service worker, manifest và hướng dẫn cài.
- `apps/desktop/electron/browser-connector/`: schema, pairing server, cookie
  adapter, import ledger và trust policy.
- preload API `browserConnector`: renderer chỉ gọi start/status/confirm/cancel,
  list imports/revoke, enable/disable và xem trust metadata.
- Dialog trong Browser toolbar của `preview-pane.tsx`.

### 2.2 API renderer

Renderer không được truyền hoặc nhận cookie value.

```ts
type ConnectorPreview = {
  attemptId: string
  hostname: string
  browser: 'chrome' | 'edge'
  cookieCount: number
  unsupportedCount: number
  sessionCount: number
  earliestExpiry?: number
  latestExpiry?: number
  expiresAt: number
}

type ConnectorImportRecord = {
  id: string
  hostname: string
  cookieCount: number
  importedAt: number
  persistentUntil?: number
}
```

Các lệnh:

- `start({url})` trả mã ghép nối, hostname và deadline.
- `status({attemptId})` trả trạng thái cùng metadata preview.
- `confirm({attemptId})` import một lần.
- `cancel({attemptId})` xóa payload pending và đóng endpoint.
- `imports()` trả ledger metadata.
- `revoke({importId})` xóa identity đã nhập.
- `trust()` trả version, extension ID, digest, permission allowlist và trạng thái.
- `setEnabled(boolean)` lưu công tắc; khi tắt phải hủy attempt đang mở.

### 2.3 State machine

```text
disabled
  -> idle
  -> pairing (120 s)
  -> extension_confirmed
  -> desktop_preview
  -> importing
  -> imported

pairing/extension_confirmed/desktop_preview
  -> cancelled | expired | rejected
```

Mỗi transition kiểm attempt ID hiện tại. Transition lặp hoặc lùi trạng thái bị
từ chối. App quit luôn đi tới `cancelled` trong RAM.

### 2.4 Schema wire

Protocol `hermes-cookie-transfer/1`; JSON UTF-8, tối đa 2 MiB.

```ts
type TransferCookie = {
  name: string
  value: string
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  session: boolean
  expirationDate?: number
  sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict'
  storeId: string
  partitionKey?: { topLevelSite?: string; hasCrossSiteAncestor?: boolean }
}
```

Giới hạn: 500 cookie, name/value tối đa 4096 byte mỗi trường, domain 255 ký tự,
path 2048 ký tự. Trường thừa bị bỏ; sai kiểu hoặc vượt giới hạn làm request bị
từ chối. `storeId` phải đồng nhất với profile chứa tab nguồn. `partitionKey`
hiện được nhận để báo không hỗ trợ, không được import.

### 2.5 Chuyển sang Electron Cookie API

- `url` được tạo từ scheme nguồn, host phù hợp domain và path đã chuẩn hóa.
- `hostOnly=true`: bỏ `domain`; `hostOnly=false`: truyền domain chuẩn hóa.
- `sameSite`: `no_restriction -> no_restriction`, `lax -> lax`,
  `strict -> strict`, `unspecified -> unspecified`.
- `expirationDate` chỉ truyền cho cookie persistent còn hiệu lực.
- `secure`, `httpOnly`, `path`, `name`, `value` được giữ.
- Validate `SameSite=None` phải có `Secure` theo hành vi Chromium hiện đại.
- Gọi `flushStore` sau import và revoke.

Import là best-effort theo từng cookie nhưng fail-closed ở validation: payload
sai không ghi gì. Khi một `cookies.set` lỗi sau khi validation xong, adapter xóa
mọi identity đã ghi trong attempt đó và trả lỗi tổng quát.

### 2.6 Trusted extension foundation

v26 có trust record cố định:

- package/version và stable extension ID;
- SHA-256 của bundle phát hành;
- permission allowlist được kiểm trong build/test;
- enable/disable persist qua restart;
- lỗi load/pair/import được chuẩn hóa;
- không nạp extension bên thứ ba vào Electron;
- không tuyên bố tương thích Chrome Web Store.

Build phải đóng gói extension như resource độc lập và sinh manifest checksum.
UI hiển thị digest rút gọn cùng đường dẫn **Mở thư mục extension** để người dùng
cài unpacked trong profile thử nghiệm. Release notes phải nói rõ unpacked MV3.

## 3. Tóm tắt reasoning tiếng Việt

### 3.1 Hành vi

- Mặc định tắt.
- Settings có công tắc **Tóm tắt suy luận bằng tiếng Việt** và cảnh báo rằng mỗi
  summary tạo thêm một model call, chi phí và độ trễ.
- Chỉ chạy sau `message.complete`, khi turn có reasoning công khai không rỗng.
- Không chạy giữa stream, không chạy khi tắt, không chạy lại cùng digest.
- UI giữ khối reasoning gốc và câu trả lời assistant nguyên byte. Summary xuất
  hiện trong mục con riêng, có nhãn rõ là bản tóm tắt do model tạo.
- Không yêu cầu, khôi phục hay suy đoán hidden/encrypted chain-of-thought.

### 3.2 Backend

RPC `reasoning.summarize` nhận `session_id`, `message_id`, SHA-256 và phần
reasoning công khai. Backend giới hạn input, gọi auxiliary task
`reasoning_summary_vi`, yêu cầu tóm tắt trung thành bằng tiếng Việt và cấm thêm
chi tiết không có trong nguồn.

Kết quả gồm summary, source digest, provider/model, latency và usage nếu provider
cung cấp. Auxiliary call không sửa session history, không thay assistant answer
và không đi vào prompt lượt sau.

### 3.3 Persistence

Summary là dữ liệu dẫn xuất và được lưu local, tách khỏi transcript, theo khóa
`profile + session lineage + message id + source digest`. Cache không lưu hidden
reasoning và bị vô hiệu khi reasoning digest đổi. Tắt tính năng ngăn mọi call mới
nhưng không tự xóa summary cũ; Settings có hành động xóa cache. Profile khác
không đọc cache của nhau.

Nếu backend không trả usage, UI ghi **Chi phí không được provider cung cấp**.
Latency đo ở client quanh RPC. Lỗi auxiliary chỉ hiện trong summary panel và
không đổi trạng thái thành công của turn chính.

## 4. Giám sát (Advisor)

### 4.1 Hành vi và vị trí

- Mặc định tắt. Khi tắt phải tạo đúng zero Advisor call.
- Settings → Model đặt mục **Giám sát (Advisor)** ngay sau model chính và trước
  các model phụ trợ, chỉ có công tắc bật/tắt và bộ chọn provider/model.
- Không có nút **Gọi Giám sát ngay** trong chat. Khi bật, Hermes tự gọi Advisor:
  1. trước batch công cụ có thể thay đổi trạng thái đầu tiên;
  2. khi đổi sang một nhóm công cụ thay đổi trạng thái mới hoặc lặp lỗi;
  3. sau các cổng verify xác định và trước khi lưu/trả kết quả cuối.
- Mỗi nhóm chỉnh sửa bị giới hạn mặc định hai lần và tối đa bốn lần qua cấu
  hình nâng cao; không được tự lặp vô hạn.

### 4.2 Ranh giới an toàn

- Advisor là auxiliary call chỉ đọc, `tools=None`; không gọi công cụ, không sửa
  file, không gửi tin và không nói trực tiếp với người dùng.
- Review packet chỉ chứa mục tiêu người dùng, nội dung công khai cần rà soát,
  tên công cụ, khóa tham số và tham số đã redaction. Không gửi hidden reasoning
  hoặc chain-of-thought.
- Verdict chỉ gồm `PASS`, `REVISE`, `ASK_USER`, `BLOCK` cùng tóm tắt và chỉ dẫn
  ngắn. Không lưu suy luận riêng tư của Advisor.
- Khi chặn batch công cụ, Hermes phải trả synthetic tool result cho từng
  `tool_call_id`; không tạo chuỗi role sai hoặc tool result mồ côi.
- Candidate trả lời bị yêu cầu sửa là scaffolding tạm, bị loại khỏi transcript
  bền vững sau khi có bản thay thế.
- Lỗi mạng/model mặc định fail-open với cảnh báo để lớp tùy chọn không làm hỏng
  phiên chính. Người vận hành có thể đặt `advisor.fail_open: false` để buộc dừng
  thao tác thay đổi trạng thái khi Advisor không sẵn sàng.

### 4.3 Cấu hình

- Hành vi: `advisor.enabled`, `advisor.max_revisions`, `advisor.fail_open`.
- Định tuyến model: `auxiliary.advisor.provider/model/base_url/api_key/timeout`,
  dùng cùng cơ chế profile isolation và auxiliary accounting hiện có.
- Cấu hình được snapshot khi tạo agent/session; thay đổi trong Settings áp dụng
  cho phiên mới, không đổi quyết định giữa một tool sequence đang chạy.

## 5. UX và trợ năng

- Copy chính có đủ VI/EN; theo quy tắc desktop, mọi key mới phải có cả VI, EN,
  JA, ZH và ZH-Hant trước merge.
- Dialog có focus trap, Esc để đóng khi an toàn, keyboard order rõ và live region
  cho trạng thái pairing/import.
- Nút import là destructive-adjacent, phải nêu domain và số cookie ngay trên
  nút xác nhận.
- Không hiển thị cookie name/value. Expiry chỉ hiển thị tổng hợp.
- Trạng thái unsupported partitioned cookie không bị giấu trong số thành công.

## 6. Phi chức năng

- Không network ngoài loopback cho connector.
- Pairing startup dưới 250 ms trên máy kiểm thử; polling không quá 2 Hz.
- Summary không chặn render assistant answer.
- Advisor không thay đổi core tool schema hoặc system prompt đã cache.
- Mọi file lưu mới ghi nguyên tử và chịu được JSON hỏng bằng fail-closed cùng
  bản sao `.corrupt-<timestamp>` không chứa cookie value.
- Test không dùng profile thật; mọi HOME/AppData/user-data đều cô lập.

## 7. Tiêu chí chấp nhận

Connector đạt khi toàn bộ ca domain/subdomain, session/persistent expiry,
HttpOnly, SameSite, partitioned-skip, multi-profile, incognito-disabled,
expired/replay/wrong-origin, app quit và revoke đều xanh trên unit/integration;
sau đó Chrome và Edge isolated smoke trên exact artifact đều xanh.

Reasoning summary đạt khi bản gốc và assistant response không đổi, off tạo zero
auxiliary calls, on tạo tối đa một call theo digest, lỗi không ảnh hưởng turn,
cache tách profile và restart phục hồi đúng summary.

Advisor đạt khi off tạo zero call; on chặn đúng mutating batch trước thực thi,
giữ đủ tool-call/result pairing, gọi lại ở recovery/final, loại scaffolding khỏi
transcript, model đã chọn tồn tại qua restart và mọi vòng sửa đều bị chặn số lần.

## 8. Deferred

- Trình quản lý extension tổng quát.
- Cài trực tiếp Chrome Web Store hoặc CRX.
- Hỗ trợ extension API tùy ý trong Electron.
- Đồng bộ cookie liên tục hoặc hai chiều.
- Partitioned cookie trước khi Electron cung cấp API giữ partition key.
- Dịch reasoning theo token trong lúc stream.
