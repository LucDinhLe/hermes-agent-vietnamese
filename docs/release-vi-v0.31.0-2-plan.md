# Kế hoạch successor candidate Hermes Vietnamese v31.0

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-2`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.2`.
- Lõi upstream được hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- `vi-v0.31.0-2` thay thế candidate `vi-v0.31.0-1` chưa được promotion. Tag,
  draft, asset và bằng chứng của `vi-v0.31.0-1` là bất biến và không được sửa,
  rebuild, di chuyển hoặc dùng làm bằng chứng cho candidate mới.
- Bản tải mặc định/Latest hiện hành vẫn là community pilot
  `vi-v0.20.0-25`. Mốc quay lui của candidate là `vi-v0.20.4-39`; rollback
  công khai của bản Latest vẫn theo `.github/public-release.json`.

## Lý do tạo successor candidate

Exact-byte smoke của candidate đầu tiên cho thấy điều khiển Gateway nằm quá xa
các điều khiển cộng tác theo phiên. Candidate mới cố định thứ tự header
`Gateway -> Agents -> Context -> Advisor` và buộc mọi đọc/ghi vòng đời Gateway
đi theo đúng `BackendOwner` gồm `connectionId + profile` của phiên hoặc tile đã
khởi tạo thao tác. Background tile không được rơi về Gateway ambient của phiên
đang foreground.

## Phạm vi sản phẩm

- Giữ toàn bộ phạm vi Agents v31 đã chốt: nhiều Agent cộng tác theo phiên/dự
  án, quản lý Agents ổn định, Việt/Anh đầy đủ và không âm thầm đổi Agent chủ trì.
- Đưa điều khiển Gateway sang đầu trái của session header, trước Agents, Context
  và Advisor; giữ responsive/narrow-pane và panel phải hiện hữu.
- Route status, logs, doctor, start, restart và stop theo cùng backend owner đã
  capture. Hành động không chứng minh được owner phải fail closed thay vì tác
  động lên profile hoặc connection khác.
- Giữ hành vi zero-argument hiện có cho các lối vào toàn cục; `undefined` tiếp
  tục kế thừa profile/connection ambient theo hợp đồng `profileScoped`.
- Không thêm force-stop mới, migration dữ liệu, dependency, refactor hoặc thay
  đổi sản phẩm ngoài header delta này.

## Hợp đồng phiên bản và phân phối

- Product version giữ `v31.0`; technical base giữ `0.31.0`; upstream giữ
  `0.20.4`.
- `apps/desktop/package.json`, product metadata, Python version, lockfile, app
  ID, executable, protocol, data root, bootstrap marker và tên artifact không
  đổi. Build workflow tự inject `0.31.0-vi.2` từ tag.
- `.github/public-release.json` chỉ đổi `featuredCandidate.tag` sang
  `vi-v0.31.0-2`; default tag `vi-v0.20.0-25`, release class, rollback công
  khai và metadata Windows v25 giữ nguyên.
- README, README.vi và release notes phải cùng trỏ đúng mười URL download của
  `vi-v0.31.0-2` và ghi rõ `vi-v0.31.0-1` bị supersede trước promotion.
- Updater phải chứng minh `0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39`, bỏ qua
  draft và release thiếu manifest đúng target.

## Cổng mã nguồn bắt buộc trước khi tạo tag

- Behavior/component regression cho session header order, narrow pane, Gateway
  menu và backend-owner routing:
  - `src/app/chat/session-gateway-control.test.tsx`;
  - `src/app/chat/session-advisor-bar.test.tsx`;
  - `src/store/system-actions.test.ts`;
  - `src/hermes-profile-scope.test.ts`.
- Python profile-unification regression chứng minh status/logs/action routing
  giữ cùng profile và connection qua web server.
- Fixed Agents gate, workflow contract, updater resolver, stable update channel,
  Vietnamese version resolver, public-download contract, YAML parse, lint,
  typecheck và các release validators đều đạt trên cùng worktree.
- Historical `-1` fixtures dùng để kiểm hành vi chung vẫn được giữ; chỉ các
  assertion đại diện candidate hiện tại đổi sang `-2`.

## Cổng artifact và promotion

- Sau khi source gate xanh, tạo một commit sạch đã push/fetch được rồi mới tạo
  annotated tag `vi-v0.31.0-2`. Không di chuyển tag `vi-v0.31.0-1`.
- Build lại đủ sáu target trên runner native. Ghi manifest, provenance, byte
  size và SHA-256/SHA-512 mới; không tái sử dụng artifact/hash/evidence `-1`.
- Upload đúng byte vào draft `vi-v0.31.0-2`, tải lại và đối chiếu manifest trước
  runtime smoke.
- Windows x64 phải chạy lại exact-artifact fresh install, Gateway/onboarding,
  session persistence, update từ `vi-v0.20.4-39`, repair, uninstall và rollback.
- Năm target chưa có máy thật giữ nhãn `BUILD-ONLY-PILOT`. Signing/notarization
  và smoke máy thật vẫn là blocker của Stable/Latest.
- Chỉ workflow promotion riêng, evidence JSON hợp lệ và quyết định của chủ dự
  án mới được chuyển draft thành public community prerelease.

## Quay lui

- Nếu source gate hoặc smoke của `vi-v0.31.0-2` lỗi, giữ cả `-1` và `-2` bất
  biến, sửa trên commit mới và tăng iteration tiếp theo.
- Candidate rollback về `vi-v0.20.4-39`; không xóa hoặc nhập lại dữ liệu Hermes
  trong quá trình thử và quay lui.
- Latest/tải mặc định vẫn là `vi-v0.20.0-25` cho tới một quyết định promotion
  riêng; không dùng việc chuẩn bị candidate để đổi hợp đồng public hiện hành.
