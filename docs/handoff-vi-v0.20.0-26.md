# Bàn giao Hermes Vietnamese từ v25 sang v26

Tài liệu này cho phép một phiên làm việc mới tiếp quản mà không cần đọc lại lịch
sử chat dài. Trước khi sửa mã, đọc `AGENTS.md`,
`docs/release-engineering-rulebook.md`, `docs/community-release.md`,
`docs/release-vi-v0.20.0-25-retrospective.md` và phần đầu `PROGRESS.md`.

## Trạng thái nguồn sự thật

| Mục                    | Giá trị                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Repository             | <https://github.com/LucDinhLe/hermes-agent-vietnamese>             |
| Public Latest          | `vi-v0.20.0-25`                                                    |
| Candidate/tag commit   | `78d23ad2290521a8410d0aaa778e1566dc50f69a`                         |
| Public docs checkpoint | `e56e13658f94145ccd5f12c791fe1fd0aa1abb96`                         |
| Windows x64 SHA-256    | `0f31c4a23bbb7913300b3f3571ad346aae517d367705a965d451a1febf620e59` |
| Release class          | `community-pilot`                                                  |
| Rollback               | `vi-v0.20.0-14`                                                    |

v25 là bất biến. Không rebuild, thay asset, di chuyển tag hoặc dùng tag v25 cho
bất kỳ thay đổi mã nào. Sửa mô tả sau release là metadata-only và đã hoàn tất.

## Ranh giới an toàn

- Tạo worktree/nhánh mới từ `origin/main`; không làm tiếp trên nhánh cũ.
- Không dùng hồ sơ Hermes đang vận hành của người duy trì.
- Mọi test cần `HERMES_HOME`, AppData và Electron user-data cô lập.
- Không đọc, nhập hoặc khôi phục database/hồ sơ Hermes cũ.
- Không ghi cookie, token, API key, lịch sử duyệt web hoặc dữ liệu người dùng vào
  source, log, ảnh hay artifact.
- Không public candidate v26 trước khi đúng artifact vượt các cổng đã freeze.

## Phạm vi định hướng v26

Đại ca đã chấp thuận hướng đi ở mức sản phẩm; phiên mới phải viết threat model,
đặc tả và kế hoạch kiểm thử trước khi code.

### 1. Hermes Connector cho Chrome và Edge

Mục tiêu là cho người dùng chủ động chuyển phiên đăng nhập của **một website đã
chọn** từ Chrome/Edge sang Browser của Hermes.

Yêu cầu tối thiểu:

- Companion extension Manifest V3 do chính dự án phát hành.
- Người dùng bấm rõ **Dùng phiên đăng nhập này trong Hermes** trên domain hiện
  tại; không quét hoặc xuất toàn bộ cookie store.
- Extension xin `cookies` và host permission theo domain cần dùng, ưu tiên
  optional permissions thay vì `<all_urls>` mặc định.
- Ghép cặp cục bộ bằng mã một lần; chỉ nhận trên loopback, có timeout, chống
  replay và xác nhận hai phía.
- Chuyển đúng thuộc tính domain, path, expiry, secure, HttpOnly, SameSite và
  partition key khi nền tảng hỗ trợ.
- Ghi cookie vào Electron session `persist:hermes-preview`, không ghi ra log hay
  file trung gian dạng rõ.
- Hiển thị domain, số cookie và thời hạn trước khi nhập; có nút thu hồi/xóa cookie
  đã nhập.
- Không chuyển mật khẩu, autofill, lịch sử, bookmark, localStorage hoặc toàn bộ
  hồ sơ trình duyệt trong v26.

Các ca phải kiểm: domain/subdomain, session cookie, expiry, HttpOnly, SameSite,
partitioned cookie, nhiều Chrome profile, incognito bị loại, ghép cặp hết hạn,
request lặp, app tắt giữa chừng và xóa sau import.

### 2. Phạm vi extension bên trong Hermes

Electron chỉ hỗ trợ một phần Chrome Extensions API, extension unpacked và phải
gọi `loadExtension` lại khi ứng dụng khởi động. Vì vậy v26 chỉ nên hỗ trợ
**Hermes Connector chính chủ** và nền móng quản lý extension tin cậy.

Không hứa hẹn trong v26:

- Cài trực tiếp mọi extension từ Chrome Web Store.
- Tương thích đầy đủ Chrome APIs.
- Tự động nạp extension không rõ nguồn hoặc cấp quyền rộng.

Nếu cần Extension Manager tổng quát, tách thành v27 sau khi có allowlist,
permission review, signature/digest, enable/disable và crash isolation.

### 3. Việt hóa phần suy luận

v25 đã Việt hóa nhãn như **Đang suy nghĩ**, **Đã suy nghĩ trong...**. Nội dung
`reasoning.delta` do model/provider gửi vẫn có thể là tiếng Anh.

Phạm vi v26 đề xuất:

- Giữ nguyên bản suy luận công khai do provider trả về để đối chiếu.
- Thêm tùy chọn **Tóm tắt suy luận bằng tiếng Việt** sau khi lượt chạy kết thúc.
- Ghi rõ đây là bản tóm tắt/dịch, có thể tăng chi phí và độ trễ.
- Chỉ xử lý reasoning mà backend thực sự cung cấp. Không cố lấy hoặc suy diễn
  chain-of-thought ẩn, encrypted thinking hoặc dữ liệu provider không công bố.
- Không dịch giữa lúc stream theo từng token vì dễ giật giao diện, tăng chi phí
  và làm lệch cấu trúc reasoning/tool call.

## Bản đồ mã liên quan

- `apps/desktop/src/app/chat/right-rail/preview-pane.tsx`: tạo Browser webview và
  partition `persist:hermes-preview`.
- `apps/desktop/src/store/preview.ts`: tab Browser, persistence và định danh tab.
- `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event.ts`: agent
  đọc/tương tác cùng webview và nhận `reasoning.delta`.
- `apps/desktop/src/components/assistant-ui/thread/message-parts.tsx`: khối hiển
  thị suy luận.
- `apps/desktop/src/i18n/vi.ts`: nhãn tiếng Việt.
- `apps/desktop/electron/main.ts`: Electron main process, IPC/session và nơi phù
  hợp để quản lý extension/cookie import.
- `.github/workflows/release-vietnamese.yml`: native build/staging.
- `.github/workflows/promote-pilot-vietnamese.yml`: community pilot promotion.
- `.github/public-release.json`: hợp đồng bản tải mặc định.

## Lát cắt triển khai đề xuất

1. **Đặc tả và threat model:** luồng dữ liệu, consent, permission, pair/revoke,
   log redaction và trường hợp lỗi. Chưa code trước khi bước này được duyệt.
2. **Cookie import core:** schema, validation và Electron session adapter với
   test thuần; không có extension thật.
3. **Loopback pairing:** one-time code, timeout, origin binding, replay guard và
   test mất mạng/gửi lặp.
4. **Chrome/Edge extension:** UI domain-scoped, optional permissions, package và
   hướng dẫn cài thử.
5. **Desktop UX:** xem trước domain/số cookie, nhập, xóa, trạng thái lỗi và trợ
   năng VI/EN.
6. **Reasoning summary:** bản gốc + bản tiếng Việt tùy chọn, kiểm chi phí/độ trễ
   và persistence.
7. **Regression/release:** security scan, Desktop tests, package smoke, exact
   artifact, update từ v25 và public download contract.

Mỗi lát cắt có commit/test riêng. Cookie import và reasoning summary không nên
được gom vào một commit hoặc một lần nghiệm thu.

## Cổng phát hành v26 cần bổ sung

- Extension không hoạt động khi chưa có consent và domain permission.
- Loopback endpoint từ chối origin/token sai, request hết hạn và replay.
- Cookie/token không xuất hiện trong log, crash dump, analytics hoặc release
  evidence.
- Import chỉ ảnh hưởng `persist:hermes-preview`; không chạm Chrome/Edge profile.
- Xóa cookie đã nhập hoạt động và persistence sau restart đúng tài liệu.
- Extension Chrome và Edge được thử trên hồ sơ trình duyệt riêng.
- Windows x64 update từ exact v25 sang exact v26 giữ phiên Hermes và cookie của
  Hermes theo chính sách đã duyệt.
- Bản tóm tắt suy luận giữ bản gốc, không thay nội dung assistant và không chạy
  khi người dùng tắt.
- Promotion vẫn kiểm `.github/public-release.json`, Latest, asset, manifest và
  URL tải sau public.

## Gaps kế thừa từ v25

- Chưa có Authenticode Windows hoặc Developer ID/notarization macOS.
- Chưa có real-machine smoke cho Windows ARM64, macOS Apple Silicon/Intel và
  Linux x64/ARM64.
- Chưa chạy safe tool bằng provider thử trên exact Windows artifact.
- Chưa kiểm update v14 → v25 bằng exact artifact; v26 tối thiểu phải kiểm
  v25 → v26 và ghi rõ đường hỗ trợ cũ hơn.

## Prompt bắt đầu phiên mới

```text
Tiếp quản Hermes Vietnamese v26 từ docs/handoff-vi-v0.20.0-26.md.
Đọc đầy đủ AGENTS.md, docs/release-engineering-rulebook.md,
docs/community-release.md và docs/release-vi-v0.20.0-25-retrospective.md.
Tạo worktree sạch từ origin/main. Không chạm hồ sơ Hermes thật và không thay
asset/tag v25. Bắt đầu bằng threat model cùng đặc tả cho Hermes Connector:
cookie transfer theo domain, consent rõ ràng, loopback pairing một lần,
redaction và revoke/delete. Dừng trước code nếu còn quyết định quyền riêng tư
chưa được chủ dự án duyệt.
```

## Điều kiện hoàn tất bàn giao

Phiên tiếp theo được coi là tiếp quản thành công khi xác nhận đúng repository,
`origin/main`, v25 public identity, worktree sạch và tạo kế hoạch cho lát cắt 1.
Không được nói “đã tiếp quản” chỉ vì đã đọc tài liệu.
