# Kế hoạch successor candidate Hermes Vietnamese v31.0 — iteration 3

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-3`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.3`.
- Lõi upstream được hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- `vi-v0.31.0-3` thay thế candidate `vi-v0.31.0-2` chưa được công khai. Tag,
  draft, asset, manifest, checksum và bằng chứng của cả `vi-v0.31.0-1` lẫn
  `vi-v0.31.0-2` là bất biến, không được sửa, rebuild, di chuyển hoặc dùng làm
  bằng chứng cho candidate mới.
- Bản tải mặc định/Latest hiện hành vẫn là community pilot
  `vi-v0.20.0-25`. Mốc quay lui của candidate là `vi-v0.20.4-39`; rollback
  công khai của bản Latest vẫn theo `.github/public-release.json`.

## Lý do tạo successor candidate

Exact-byte smoke của `vi-v0.31.0-2` trên Chrome 151 cho thấy website đã tạo và
đang dùng cookie nhưng truy vấn mặc định `cookies.getAll({ url, storeId })` của
extension trả danh sách rỗng; cookie do chính extension API tạo mới hiện ra.
Kết quả này làm preview bỏ sót cookie website và khiến số cookie không hỗ trợ
không phản ánh đúng trạng thái thực.

Hợp đồng Chromium cho phép truyền `partitionKey: {}` để liệt kê cả cookie có và
không phân vùng. Candidate mới dùng truy vấn tường minh đó, normalize cookie có
`partitionKey` thiếu hoặc `null` thành không phân vùng, đếm object phân vùng
thực sự là không hỗ trợ và chỉ chuyển cookie không phân vùng còn hiệu lực. Không
suy diễn rằng mọi cookie thường đều có `partitionKey`.

## Phạm vi sản phẩm

- Giữ toàn bộ phạm vi Agents, thứ tự header
  `Gateway -> Agents -> Context -> Advisor` và backend-owner routing của v31.
- Sửa đúng lát cắt đọc/phân loại cookie trong extension Chromium để preview
  nhìn thấy cookie do website tạo trên Chrome/Edge hiện hành.
- Cookie có phân vùng tiếp tục bị bỏ qua; cookie hết hạn tiếp tục bị loại và
  được đếm riêng. Preview/pairing chỉ đưa metadata cần thiết trước khi người
  dùng chấp thuận.
- Không mở rộng permission, không đổi extension ID, pairing protocol, app ID,
  executable, data root, schema dữ liệu, dependency hoặc surface sản phẩm.
- Không ghi cookie value, pairing code hoặc credential vào log, screenshot,
  manifest, ledger hay bằng chứng release.

## Hợp đồng phiên bản và phân phối

- Product version giữ `v31.0`; technical base giữ `0.31.0`; upstream giữ
  `0.20.4`.
- `apps/desktop/package.json`, product metadata, Python version, lockfile, app
  ID, executable, protocol, data root, bootstrap marker và tên artifact không
  đổi. Build workflow tự inject `0.31.0-vi.3` từ tag.
- `.github/public-release.json` chỉ đổi `featuredCandidate.tag` sang
  `vi-v0.31.0-3`; default tag `vi-v0.20.0-25`, release class, rollback công
  khai, metadata Windows v25 và mười tên download giữ nguyên.
- README, README.vi và release notes phải cùng trỏ đúng mười URL download của
  `vi-v0.31.0-3`, ghi rõ `vi-v0.31.0-2` chưa public và hai candidate cũ bất biến.
- Updater phải chứng minh
  `0.31.0-vi.3 > 0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39`, bỏ qua draft và
  release thiếu manifest đúng target.

## Cổng mã nguồn bắt buộc trước khi tạo tag

- Regression extension dùng cookie store giả phải chứng minh truy vấn gồm
  `partitionKey: {}`, cả cookie thiếu `partitionKey` và cookie có
  `partitionKey: null` đều được đưa vào danh sách importable, cookie mang object
  phân vùng/hết hạn bị loại và các count khớp preview.
- Pairing-server regression phải chứng minh count unsupported/expired chỉ là
  metadata; payload transfer chứa thêm cookie đã bị loại phải fail closed.
- Cookie-import regression tiếp tục chặn cookie phân vùng ở phía Desktop để
  extension không trở thành ranh giới tin cậy duy nhất.
- Release workflow phải chạy extension, cookie-import và pairing regressions
  trước `gh release create`; workflow-contract test khóa thứ tự này.
- Fixed Agents/Gateway gate, updater resolver, stable update channel, Vietnamese
  version resolver, public-download contract, YAML parse, lint, typecheck và
  các release validators đều đạt trên cùng worktree.
- Fixture `-1/-2` dùng để kiểm hành vi chung vẫn giữ nguyên; chỉ assertion đại
  diện candidate hiện tại đổi sang `-3`.

## Cổng artifact và promotion

- Sau khi source gate xanh, tạo một commit sạch đã push/fetch được rồi mới tạo
  annotated tag `vi-v0.31.0-3`. Không di chuyển tag `vi-v0.31.0-1` hoặc
  `vi-v0.31.0-2`.
- Build lại đủ sáu target trên runner native. Ghi manifest, provenance, byte
  size và SHA-256/SHA-512 mới; không tái sử dụng artifact/hash/evidence cũ.
- Upload đúng byte vào draft `vi-v0.31.0-3`, tải lại và đối chiếu manifest trước
  runtime smoke.
- Windows x64 phải chạy lại exact-artifact fresh install, Gateway/onboarding,
  session persistence, update từ `vi-v0.20.4-39`, repair, uninstall và rollback.
- Connector phải smoke trên Chrome và Edge bằng profile cô lập: website tạo
  cookie giả, preview metadata đúng, import thành công, restart còn record,
  revoke xóa quyền/trạng thái và quét log/evidence không thấy sentinel value hay
  pairing code.
- Năm target chưa có máy thật giữ nhãn `BUILD-ONLY-PILOT`. Signing/notarization
  và smoke máy thật vẫn là blocker của Stable/Latest.
- Chỉ workflow promotion riêng, evidence JSON hợp lệ và quyết định của chủ dự
  án mới được chuyển draft thành public community prerelease.

## Quay lui

- Nếu source gate hoặc smoke của `vi-v0.31.0-3` lỗi, giữ cả ba candidate bất
  biến, sửa trên commit mới và tăng iteration tiếp theo.
- Candidate rollback về `vi-v0.20.4-39`; không xóa hoặc nhập lại dữ liệu Hermes
  trong quá trình thử và quay lui.
- Latest/tải mặc định vẫn là `vi-v0.20.0-25` cho tới một quyết định promotion
  riêng; không dùng việc chuẩn bị candidate để đổi hợp đồng public hiện hành.
