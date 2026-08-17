# Đặc tả Hermes Vietnamese v26

**Phiên bản:** 1.0 khóa triển khai<br>
**Ngày:** 2026-08-17<br>
**Cơ sở:** `origin/main` tại `4d597f74600cdc3791edf7d34566534182946c55`

## 1. Mục tiêu sản phẩm

v26 bổ sung hai khả năng độc lập:

1. Chuyển có kiểm soát phiên đăng nhập của website hiện tại từ Chrome/Edge sang
   Browser của Hermes.
2. Tạo bản tóm tắt tiếng Việt tùy chọn từ reasoning công khai sau khi lượt chạy
   kết thúc, đồng thời giữ nguyên reasoning và câu trả lời gốc.

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

## 4. UX và trợ năng

- Copy chính có đủ VI/EN; theo quy tắc desktop, mọi key mới phải có cả VI, EN,
  JA, ZH và ZH-Hant trước merge.
- Dialog có focus trap, Esc để đóng khi an toàn, keyboard order rõ và live region
  cho trạng thái pairing/import.
- Nút import là destructive-adjacent, phải nêu domain và số cookie ngay trên
  nút xác nhận.
- Không hiển thị cookie name/value. Expiry chỉ hiển thị tổng hợp.
- Trạng thái unsupported partitioned cookie không bị giấu trong số thành công.

## 5. Phi chức năng

- Không network ngoài loopback cho connector.
- Pairing startup dưới 250 ms trên máy kiểm thử; polling không quá 2 Hz.
- Summary không chặn render assistant answer.
- Mọi file lưu mới ghi nguyên tử và chịu được JSON hỏng bằng fail-closed cùng
  bản sao `.corrupt-<timestamp>` không chứa cookie value.
- Test không dùng profile thật; mọi HOME/AppData/user-data đều cô lập.

## 6. Tiêu chí chấp nhận

Connector đạt khi toàn bộ ca domain/subdomain, session/persistent expiry,
HttpOnly, SameSite, partitioned-skip, multi-profile, incognito-disabled,
expired/replay/wrong-origin, app quit và revoke đều xanh trên unit/integration;
sau đó Chrome và Edge isolated smoke trên exact artifact đều xanh.

Reasoning summary đạt khi bản gốc và assistant response không đổi, off tạo zero
auxiliary calls, on tạo tối đa một call theo digest, lỗi không ảnh hưởng turn,
cache tách profile và restart phục hồi đúng summary.

## 7. Deferred sang v27

- Trình quản lý extension tổng quát.
- Cài trực tiếp Chrome Web Store hoặc CRX.
- Hỗ trợ extension API tùy ý trong Electron.
- Đồng bộ cookie liên tục hoặc hai chiều.
- Partitioned cookie trước khi Electron cung cấp API giữ partition key.
- Dịch reasoning theo token trong lúc stream.
