# Kế hoạch successor candidate Hermes Vietnamese v31.0 — iteration 4

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-4`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.4`.
- Lõi upstream được hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- `vi-v0.31.0-4` thay thế candidate `vi-v0.31.0-3` bị loại bởi exact-artifact
  smoke. Tag, draft, asset, manifest, checksum và bằng chứng của
  `vi-v0.31.0-1`, `vi-v0.31.0-2` và `vi-v0.31.0-3` là bất biến, không được sửa,
  rebuild, di chuyển hoặc dùng làm bằng chứng cho candidate mới.
- Bản tải mặc định/Latest hiện hành vẫn là community pilot
  `vi-v0.20.0-25`. Mốc quay lui của candidate là `vi-v0.20.4-39`; rollback
  công khai của bản Latest vẫn theo `.github/public-release.json`.

## Lý do tạo successor candidate

Exact-artifact smoke của `vi-v0.31.0-3` trên Chrome 151 dùng profile cô lập và
fixture cookie mạnh ở cổng không mặc định. Website có cookie thường, session và
partitioned đang hoạt động nhưng preview của Connector báo không có cookie hỗ
trợ. Giữ truy vấn `{ partitionKey: {} }` rồi chỉ đổi permission sang pattern
không mang cổng làm cookie xuất hiện, khóa nguyên nhân tại host permission.

Candidate `-3` dựng pattern từ `URL.origin`, vì vậy grant giữ cổng của tab và
chỉ một scheme. Cookie là dữ liệu theo host/path thay vì theo cổng, còn cookie
`Secure` cần quyền HTTPS. Candidate mới xin đúng hostname ở cả HTTP và HTTPS,
không mang cổng; khi thu hồi, nó xóa hai pattern mới cùng pattern
origin-có-cổng cũ mà candidate trước có thể đã để lại.

## Phạm vi sản phẩm

- Giữ toàn bộ phạm vi Agents, thứ tự header
  `Gateway -> Agents -> Context -> Advisor` và backend-owner routing của v31.
- Giữ truy vấn cookie phân vùng tường minh và toàn bộ lọc fail-closed của `-3`.
- Đổi permission từ một origin-có-cổng sang đúng exact hostname ở cả
  `http://<hostname>/*` và `https://<hostname>/*`.
- Không dùng `<all_urls>`, wildcard subdomain hoặc suy diễn eTLD+1. Cookie miền
  cha khi tab ở subdomain có thể vẫn nằm ngoài kết quả; đây là giới hạn được
  công bố, không phải lý do để âm thầm mở rộng quyền.
- Revoke xóa riêng từng pattern hiện tại và legacy origin-có-cổng, kiểm tra lại
  từng grant sau lệnh xóa và fail closed nếu quyền còn hiệu lực. Khi lỗi, UI xóa
  payload/mã ghép nối khỏi RAM và không được báo thu hồi thành công. Quyền
  `cookies` chỉ bị xóa khi không còn origin nguồn nào khác ngoài loopback vận
  chuyển.
- Không đổi extension ID, pairing protocol, app ID, executable, data root,
  schema dữ liệu, dependency hoặc surface sản phẩm.
- Không ghi cookie value, pairing code hoặc credential vào log, screenshot,
  manifest, ledger hay bằng chứng release.

## Hợp đồng phiên bản và phân phối

- Product version giữ `v31.0`; technical base giữ `0.31.0`; upstream giữ
  `0.20.4`.
- `apps/desktop/package.json`, product metadata, Python version, lockfile, app
  ID, executable, protocol, data root, bootstrap marker và tên artifact không
  đổi. Build workflow tự inject `0.31.0-vi.4` từ tag.
- `.github/public-release.json` chỉ đổi `featuredCandidate.tag` sang
  `vi-v0.31.0-4`; default tag `vi-v0.20.0-25`, release class, rollback công
  khai, metadata Windows v25 và mười tên download giữ nguyên.
- README, README.vi và release notes phải cùng trỏ đúng mười URL download của
  `vi-v0.31.0-4`, ghi rõ `vi-v0.31.0-3` bị exact-artifact smoke loại và ba
  candidate cũ bất biến.
- Updater phải chứng minh
  `0.31.0-vi.4 > 0.31.0-vi.3 > 0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39`, bỏ
  qua draft và release thiếu manifest đúng target.

## Cổng mã nguồn bắt buộc trước khi tạo tag

- Behavior regression phải chứng minh permission origins cho HTTP/HTTPS bỏ
  cổng, giữ exact hostname với hostname thường, IPv4 và IPv6, không tự mở
  wildcard/eTLD+1. Không thêm test đọc source text để thay bằng chứng hành vi.
- Permission lifecycle regression phải chứng minh partial grant và legacy
  origin-có-cổng đều được nhận diện, revoke thử đủ hai pattern mới cùng pattern
  legacy và không xóa host permission không thuộc website hiện tại. Kết quả
  `false`, no-op, lỗi API, grant chồng lấp và trạng thái chỉ còn loopback đều
  phải có hậu kiểm hành vi; lỗi thu hồi phải chặn payload cũ khỏi ghép nối.
- Regression extension tiếp tục chứng minh truy vấn gồm `partitionKey: {}`,
  normalize cookie thiếu/`null` partition key, chỉ chuyển cookie không phân vùng
  còn hiệu lực và đếm đúng partitioned/expired.
- Pairing-server và cookie-import regression tiếp tục fail closed nếu payload
  chứa cookie bị loại hoặc partitioned cookie mất partition key.
- Release workflow phải chạy extension, cookie-import và pairing regressions
  trước `gh release create`; workflow-contract test khóa thứ tự này.
- Fixed Agents/Gateway gate, updater resolver, stable update channel, Vietnamese
  version resolver, public-download contract, YAML parse, lint, typecheck và
  các release validators đều đạt trên cùng worktree.
- Fixture `-1/-2/-3` dùng để kiểm hành vi lịch sử vẫn giữ nguyên; chỉ assertion
  đại diện candidate hiện tại đổi sang `-4`.

## Cổng artifact và promotion

- Sau khi source gate xanh, tạo một commit sạch đã push/fetch được rồi mới tạo
  annotated tag `vi-v0.31.0-4`. Không di chuyển ba tag v31 cũ.
- Build lại đủ sáu target trên runner native. Ghi manifest, provenance, byte
  size và SHA-256/SHA-512 mới; không tái sử dụng artifact/hash/evidence `-3`.
- Upload đúng byte vào draft `vi-v0.31.0-4`, tải lại và đối chiếu manifest trước
  runtime smoke.
- Windows x64 phải chạy lại exact-artifact fresh install, Gateway/onboarding,
  session persistence, update từ `vi-v0.20.4-39`, repair, uninstall và rollback.
- Connector phải smoke trên Chrome và Edge bằng profile cô lập với fixture HTTP
  và HTTPS ở cổng không mặc định: grant đúng hai pattern, preview metadata đúng,
  import thành công, restart còn record, revoke xóa grant cũ/mới và quét
  redaction không thấy sentinel value hay pairing code.
- Smoke phải ghi rõ giới hạn parent-domain cookie; không dùng wildcard permission
  để biến test thành xanh.
- Năm target chưa có máy thật giữ nhãn `BUILD-ONLY-PILOT`. Signing/notarization
  và smoke máy thật vẫn là blocker của Stable/Latest.
- Chỉ workflow promotion riêng, evidence JSON hợp lệ và quyết định của chủ dự
  án mới được chuyển draft thành public community prerelease.

## Quay lui

- Nếu source gate hoặc smoke của `vi-v0.31.0-4` lỗi, giữ cả bốn candidate bất
  biến, sửa trên commit mới và tăng iteration tiếp theo.
- Candidate rollback về `vi-v0.20.4-39`; không xóa hoặc nhập lại dữ liệu Hermes
  trong quá trình thử và quay lui.
- Latest/tải mặc định vẫn là `vi-v0.20.0-25` cho tới một quyết định promotion
  riêng; không dùng việc chuẩn bị candidate để đổi hợp đồng public hiện hành.
