# Báo cáo quét tĩnh: Parity giữa vỏ desktop (fork) và lõi Hermes Agent v2026.8.31

Ngày quét: 2026-09-04. Phạm vi: `apps/desktop/src`, `apps/desktop/electron`, `apps/shared` (đã loại `*.test.*`, `e2e`, fixtures, mock) đối chiếu với `gateway/`, `tui_gateway/`, `web/`, `hermes_cli/` ở HEAD (`experiment/composite`, sau khi lõi đã được thay bằng cây upstream `v2026.8.31`).

Phương pháp: `rg -o` trích literal `/api/...`, `/ws...`, `/events...` trong vỏ; trích mọi `@app.*`, `@router.*`, `@hub_router.*`, `@manage_router.*`... trong lõi; so khớp thủ công. Không sửa tệp nào.

---

## 1. API HTTP/WebSocket

Vỏ desktop gọi khoảng **114 đường dẫn `/api/...` khác nhau** cộng 1 WebSocket (`/api/ws`) và 1 kênh sự kiện (`/events`, dùng riêng bởi plugin kanban qua `/api/plugins/kanban/events`). Lõi 8.31 (`hermes_cli/web_server.py` + `hermes_cli/web_routers/*` + `plugins/kanban/dashboard/plugin_api.py`) hiện đăng ký hơn 250 route.

### 1.1 Đường dẫn THIẾU trong lõi 8.31 (xác nhận, đúng như đã biết trước — không tìm thêm được cái mới)

| Đường dẫn | Method | Nơi vỏ gọi |
|---|---|---|
| `/api/mcp/assignments` | GET | `apps/desktop/src/hermes.ts:2373` |
| `/api/skills/work-profile` | GET/PUT | `apps/desktop/src/hermes.ts:1400,1424` |
| `/api/skills/work-profile/recommend` | (GET/POST) | `apps/desktop/src/hermes.ts:1411` |
| `/api/skills/discover` | (GET/POST) | `apps/desktop/src/hermes.ts:1437` |

Đã rà thêm nhưng **không phát hiện đường dẫn thiếu nào khác** ngoài 4 cái trên — toàn bộ ~110 đường dẫn còn lại trong `apps/desktop` đều có route tương ứng (cùng tiền tố) trong lõi 8.31, kể cả các nhóm ít rõ ràng:

- `/api/agents` — KHÔNG phải route gateway cục bộ; đây là API của Nous Portal cloud (`portalBaseUrl + /api/agents`, xem `apps/desktop/electron/main.ts:8215`), không thuộc lõi Hermes Agent. Loại khỏi so sánh.
- `/api/tools` (không hậu tố) — chỉ xuất hiện như một prefix-check chuỗi trong `connection-config.ts:578` (routing logic), không phải lệnh gọi thật.
- `/api/plugins/kanban/*` — không phải route của gateway lõi mà là router riêng của plugin `plugins/kanban/dashboard/plugin_api.py`; plugin này **có tồn tại nguyên vẹn** trong lõi 8.31 với đầy đủ `/board`, `/tasks`, `/boards`, `/events` (WebSocket), v.v. Không thấy vênh rõ ràng ở mức tên route (chưa đối chiếu sâu từng field payload).
- `/api/actions/{name}/status` khớp đúng route lõi `@app.get("/api/actions/{name}/status")`.

### 1.2 Method/tham số — không phát hiện sai lệch rõ ràng

Ở mức method (GET/POST/PUT/DELETE/WS) cho các đường dẫn dùng chung, không thấy method bị đổi so với route lõi 8.31 tương ứng (ví dụ `/api/config` GET+PUT, `/api/env` GET+PUT+DELETE, `/api/webhooks/{name}/enabled` PUT, `/api/sessions/{id}` GET+PATCH+DELETE... đều khớp). **Không chắc**: chưa đối chiếu schema tham số/body chi tiết (field-level) cho từng route do giới hạn thời gian — chỉ so khớp path + method.

### 1.3 `/api/ws` và `/events`

- `/api/ws` (WebSocket chính, có `?token=` hoặc `?ticket=`) khớp `@app.websocket("/api/ws")` trong lõi 8.31 — còn nguyên.
- `/events` chỉ dùng nội bộ plugin kanban (`/api/plugins/kanban/events`, alias `board=<slug>`), khớp `@router.websocket("/events")` trong `plugin_api.py` của lõi.

---

## 2. Lệnh & cờ CLI khởi động backend (electron main)

Từ `backend-command.ts`, `backend-child.ts`, `backend-env.ts`, `bundled-runtime.ts`, `bootstrap-*.ts`:

- Lệnh dựng: `[--profile <name>]? serve --host 127.0.0.1 --port 0` (qua module `hermes_cli.main`), có nhánh đổi `serve`→`dashboard --no-open` khi cần chạy dashboard.
- **`serve` vẫn tồn tại nguyên trong lõi 8.31** (`hermes_cli/subcommands/dashboard.py:137`, cùng `--host/--port/--insecure/--skip-build/--isolated`, cộng `--no-open` (SUPPRESS, tương thích ngược) và các cờ SSH mới `--ssh-session-token-file`, `--ssh-owner-nonce`). Không thấy cờ nào vỏ dùng mà lõi thiếu.
- Biến môi trường: đối chiếu ~50 biến `HERMES_*` xuất hiện trong `apps/desktop/electron`. Phần lớn là **nội bộ Electron** (`HERMES_DESKTOP_*`, `HERMES_PARENT_*`, `HERMES_LOGIN_PATH_*`, `HERMES_BASE_PATH__`, `HERMES_SESSION_TOKEN__` — hai cái cuối là placeholder mẫu chuỗi, không phải tên biến thật). Các biến core-facing đã kiểm và **còn nguyên trong lõi 8.31**: `HERMES_HOME`, `HERMES_ROOT`, `HERMES_WEB_DIST`, `HERMES_DASHBOARD_SESSION_TOKEN`, `HERMES_DASHBOARD_READY`, `HERMES_BACKEND_READY`, `HERMES_DESKTOP_READY_FILE`, `HERMES_PARENT_NONCE`, `HERMES_PARENT_START_MARKER`, `HERMES_SERVE_HEADLESS`, `HERMES_PORTAL_BASE_URL`.
- **Phát hiện: `HERMES_INSTALL_KEY`, `HERMES_UNINSTALL_KEY`, `HERMES_PROBE_TIMEOUT_MS` không xuất hiện ở đâu trong lõi 8.31** (0 kết quả ngoài `apps/`). Cần xác nhận thêm mục đích 2 biến install/uninstall key trong vỏ — nếu chúng chỉ phục vụ luồng cài đặt/gỡ cài đặt do vỏ tự quản lý (không gửi cho lõi), không phải điểm vỡ; nhưng chưa xác minh được (không tìm thấy nơi vỏ *đọc* các biến này để biết mục đích thật — có thể là hằng số chưa dùng, hoặc dự phòng chờ removal).

### 2.1 Dashboard token / health / cổng — còn nguyên
- Cơ chế `HERMES_DASHBOARD_SESSION_TOKEN` cho `/api/ws` auth vẫn còn (`hermes_cli/web_server.py:581-870`), khớp comment trong `dashboard-token.ts`.
- `/api/health` và `/api/status` đều còn trong lõi 8.31.
- Cổng mặc định (`--port 9119`, `0` = auto) không đổi.

### 2.2 Install stamp / install_manifest.py / version_info.py (đã bỏ, đúng như dự đoán)
- `hermes_cli/install_manifest.py` — **không còn tồn tại** trong lõi 8.31.
- `hermes_cli/version_info.py` — **không còn tồn tại**; `scripts/write_install_stamp.py` (còn tồn tại ở gốc kho, KHÔNG bị xoá) vẫn ghi trong docstring rằng "runtime đọc qua `hermes_cli.version_info`" — đây là **tài liệu lạc hậu trong chính lõi upstream**, module đó không còn.
- Tuy nhiên: vỏ **không gọi các module Python này trực tiếp** — `apps/desktop/electron/main.ts` (dòng ~624-707) tự đọc file JSON `install-stamp.json` (đóng gói sẵn ở `resourcesPath` hoặc `build/`) bằng Node, không qua subprocess Python. Vì vậy việc `install_manifest.py`/`version_info.py` biến mất **không chặn khởi động runtime** — chỉ ảnh hưởng nếu pipeline build của vỏ gọi các module này lúc đóng gói (chưa kiểm — nằm ngoài phạm vi tĩnh apps/desktop). **Không chắc**: cần xác minh script build/package của `apps/desktop` (electron-builder hooks) có gọi các module đã mất này không.

---

## 3. Import Python / tệp cấu hình / event schema

- Các đường dẫn `.hermes/config.yaml`, `.hermes/active_profile`, `.hermes/plugins`, `.hermes/profiles`, `.hermes/cache`, `.hermes/desktop-ssh` đều còn dùng nguyên trong lõi 8.31 (`hermes_cli/config.py`, `hermes_cli/profiles.py`...).
- `.hermes/desktop-plugins/` — chỉ là quy ước thư mục nội bộ của vỏ (renderer tự quét plugin runtime JS ở máy người dùng), không phải API lõi cần hỗ trợ — không phải điểm vỡ.
- **Không kiểm sâu được schema sự kiện WS** (`type` field trong khung `/api/ws`) do giới hạn thời gian: `apps/desktop/src/contrib/events.ts` fan-out theo `event.type` nhưng không liệt kê danh sách type cố định trong code (nhận mọi type từ lõi qua `'*'` wildcard listener), nên rủi ro schema-drift ở tầng này **thấp về mặt "crash"** (không có switch/case cứng nhắc bị thiếu case) nhưng **không loại trừ** khả năng field bị đổi tên bên trong payload từng loại event. Đánh dấu KHÔNG CHẮC — cần review thủ công sâu hơn nếu muốn chắc chắn.

---

## 4. Diff `apps/desktop/electron`: vỏ fork (`baseline/v2026.9.2-main`) vs vỏ upstream tại `v2026.8.31`

`git diff --stat`: **165 tệp, +25080/-7772 dòng** — phần lớn là do vỏ fork đã phân kỳ nhiều tính năng (Advisor, work-profile, kanban mở rộng...) so với vỏ upstream, không phải "thay đổi trong 2 tuần" của cùng một dòng phát triển. Xác nhận: cây `apps/desktop/electron` hiện tại (HEAD) **giống hệt** `baseline/v2026.9.2-main` (diff rỗng) — vỏ chưa được cập nhật theo lõi mới.

Thu hẹp vào các tệp "hợp đồng backend" theo yêu cầu:

- `backend-command.ts`, `backend-child.ts`, `backend-env.ts`, `dashboard-token.ts`, `gateway-ws-probe.ts`: **byte-identical** giữa baseline và upstream 8.31 — logic dựng lệnh CLI và mint token không đổi.
- `connection-config.ts`: **+115/-13** — toàn bộ là cải tiến định tuyến/độ tin cậy phía upstream, KHÔNG phải xoá tính năng:
  - Thêm `withTransientRetries` (thử lại mint ticket/WS khi lỗi mạng thoáng qua, bỏ qua khi 401/403).
  - Thêm bảo toàn `statusCode` HTTP qua wrapper lỗi ticket.
  - Route `/api/actions/{name}/status` và `POST /api/mcp/catalog/install` được ghim buộc phải cùng backend "primary" (action polling phải trùng process đã spawn action) — nếu vỏ fork có logic tương tự riêng cho polling action, cần kiểm không bị đá văng khỏi backend đúng.
  - Thêm cơ chế dịch tham số `recents_profile` (ngoài `profile`) cho `/api/profiles/sessions/sidebar` khi dùng SSH alias.
- `backend-health.ts`: **+148 dòng mới** — thêm phát hiện lỗi "Nous Cloud agent down" (502/503/504 từ host `*.agents.nousresearch.com`) với thông báo hành động cụ thể, và `makeUnsignedOauthError()` cho trường hợp remote OAuth chưa đăng nhập. Đây là bổ sung UX lỗi, không đổi hợp đồng API.
- `backend-ownership.ts`: thêm `parseBackendOwnershipDetailed` + `quarantine()` — sửa lỗi tệp ownership hỏng bị coi nhầm là "rỗng" khiến tiến trình backend mồ côi rò rỉ (không dọn được) — cải tiến độ bền, không đổi API.
- `backend-ready.ts`, `backend-start-failure.ts`, `bootstrap-runner.ts`, `primary-backend-startup.ts`: thay đổi nhỏ, cùng mạch cải thiện xử lý lỗi khởi động, không đổi lệnh/route.
- `bundled-runtime.ts` (347 dòng, chỉ có ở fork): **không tồn tại trong upstream `v2026.8.31`** — xác nhận bằng `git show v2026.8.31:apps/desktop/electron/bundled-runtime.ts` báo lỗi "exists on disk, but not in v2026.8.31". Đây là cơ chế fork tự dò/tải Python runtime đóng gói riêng (không phải do upstream xoá — file này chưa từng tồn tại ở nhánh upstream). Không phải "điểm vỡ do lõi 8.31 đổi", mà là kiến trúc đóng gói riêng của fork — vẫn hoạt động độc lập với lõi Python miễn interpreter mà nó tìm ra tương thích với `hermes_cli` mới. **Không chắc**: chưa xác minh liệu `hermes_cli` v2026.8.31 có yêu cầu phiên bản Python/dependency mới hơn mà cơ chế dò-runtime cũ trong `bundled-runtime.ts` chưa hỗ trợ.

**Tóm tắt task 4**: trong khoảng giữa hai mốc, upstream chỉ tăng cường độ bền của lớp khởi động (retry, phân loại lỗi Cloud-down, sửa bug ownership-file hỏng, ghim route action-polling vào đúng backend) — **không** có thay đổi phá vỡ giao thức khởi động/CLI/HTTP mà vỏ đang dùng.

---

## Bảng: Điểm vỡ dự kiến

| Vị trí trong vỏ | Lõi 8.31 | Mức | Đề xuất |
|---|---|---|---|
| `hermes.ts:2373` gọi `GET /api/mcp/assignments` | Route không tồn tại | Mất tính năng (màn hình gán MCP theo phiên sẽ lỗi/rỗng) | Ẩn bằng `VITE_VI_FEATURES` — thuộc nhóm "gợi ý kỹ năng theo công việc" *hoặc* nhóm MCP riêng chưa nêu trong 4 nhóm đã quyết — **cần xác nhận nhóm tính năng chính xác với người quyết định**, vì "gán MCP" không khớp rõ 1 trong 4 nhóm liệt kê (Advisor riêng / hồ sơ năng lực / gợi ý kỹ năng theo công việc / ngân sách lượt) |
| `hermes.ts:1400,1424` `GET/PUT /api/skills/work-profile` | Route không tồn tại | Mất tính năng (trang "hồ sơ năng lực" không tải/lưu được) | Ẩn bằng `VITE_VI_FEATURES` — thuộc **hồ sơ năng lực** |
| `hermes.ts:1411` `/api/skills/work-profile/recommend` | Route không tồn tại | Mất tính năng | Ẩn bằng `VITE_VI_FEATURES` — thuộc **gợi ý kỹ năng theo công việc** |
| `hermes.ts:1437` `/api/skills/discover` | Route không tồn tại | Mất tính năng | Ẩn bằng `VITE_VI_FEATURES` — thuộc **gợi ý kỹ năng theo công việc** (hoặc hồ sơ năng lực, chồng lấn — cần xác nhận) |
| `apps/desktop/electron/*` gọi `HERMES_INSTALL_KEY`/`HERMES_UNINSTALL_KEY`/`HERMES_PROBE_TIMEOUT_MS` | Biến không được lõi đọc ở đâu cả | Không chắc — có thể cosmetic (biến chỉ nội bộ vỏ) hoặc mất tính năng nếu lõi từng đọc chúng | Sửa vỏ: dò lại nơi 3 biến này thực sự được dùng để xác minh mức độ; hiện KHÔNG có bằng chứng chúng chặn khởi động |
| `scripts/write_install_stamp.py` (core) tham chiếu `hermes_cli.version_info` đã mất | Module đã xoá khỏi lõi | Cosmetic (tài liệu lạc hậu trong chính core, vỏ không gọi module này lúc runtime) | Không cần sửa vỏ; nếu pipeline build vỏ gọi `write_install_stamp.py` và script đó tự import `hermes_cli.version_info` ở đâu đó ngoài docstring thì cần kiểm lại (chưa thấy import thật, chỉ có trong comment) |
| `bundled-runtime.ts` (fork) — cơ chế dò Python đóng gói | Không tồn tại trong vỏ upstream (không phải do lõi 8.31 xoá) | Không chắc — kiến trúc riêng của fork, cần xác minh tương thích Python version với `hermes_cli` mới | Giữ nguyên (thuộc vỏ, không phải điểm parity với lõi) — theo dõi riêng nếu `hermes_cli` 8.31 đổi yêu cầu Python |
| `connection-config.ts` — route `/api/mcp/catalog/install` cần cùng backend với poll `/api/actions/*` | Có trong cả fork & upstream 8.31 (route lõi khớp) | Cosmetic (đã tương thích, chỉ nêu để lưu ý nếu vỏ merge code sau này) | Không cần sửa — chỉ cảnh báo khi đồng bộ hoá code vỏ theo upstream sau này, đảm bảo giữ đúng logic ghim backend |

### Điểm không chắc, cần người quyết định xác nhận
1. Nhóm tính năng chính xác của `/api/mcp/assignments` trong 4 nhóm đã quyết ẩn (Advisor riêng / hồ sơ năng lực / gợi ý kỹ năng theo công việc / ngân sách lượt) — không khớp rõ ràng nhóm nào.
2. Mục đích thật của `HERMES_INSTALL_KEY`, `HERMES_UNINSTALL_KEY`, `HERMES_PROBE_TIMEOUT_MS` trong vỏ — chưa tìm được nơi đọc giá trị (chỉ thấy tên biến, có thể đã chết hoặc dự phòng).
3. Có/không có sai lệch **schema tham số/body chi tiết (field-level)** cho các route dùng chung — chỉ so khớp path + method, chưa so khớp payload.
4. Schema sự kiện WS (`/api/ws` frame `type`) — chưa liệt kê đối chiếu đầy đủ danh sách loại sự kiện lõi phát ra so với những gì `apps/desktop/src/contrib/events.ts` và các nơi tiêu thụ khác kỳ vọng (do dùng cơ chế fan-out tổng quát `'*'`, rủi ro thấp nhưng chưa loại trừ).
5. Pipeline build/đóng gói của `apps/desktop` (electron-builder scripts) có gọi trực tiếp `hermes_cli.install_manifest`/`hermes_cli.version_info` đã mất hay không — nằm ngoài phạm vi tĩnh `apps/desktop/src`+`electron` thuần, chưa kiểm.
6. `/api/plugins/kanban/*` — mới so khớp tên route, chưa so khớp payload/behavior chi tiết giữa plugin fork dùng và plugin lõi 8.31 (cả hai đều có `plugins/kanban/dashboard/plugin_api.py` nhưng chưa diff nội dung).


## Bổ sung 04/09 (sau khi Luc cài thử bản thunghiem.1)

Quét tĩnh chỉ so route HTTP. Thực tế còn một kênh thứ hai là RPC qua WebSocket gateway (`gateway.request(method, params)`). So lại: giao diện dùng 18 method, lõi 8.31 có 188, thiếu duy nhất `preview.interact.respond` (chỉ gọi khi lõi phát sự kiện `preview.interact.request`, lõi upstream không phát, vô hại). Riêng `config.set` với `key: 'advisor'` (thanh Advisor theo phiên) là khoá của fork; lõi 8.31 trả `unknown config key: advisor` và giao diện hiện "Không lưu được giá trị mặc định của model". Sửa: thanh Advisor theo phiên ẩn sau cờ `VITE_VI_FEATURES=advisor` (tính năng "Advisor riêng" đã quyết tạm ẩn). Advisor của upstream 8.31 là MoA reference advisors, khái niệm khác, không dùng chung khoá.
