# Kế hoạch successor candidate Hermes Vietnamese v31.0 — iteration 5

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-5`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.5`.
- Lõi upstream được hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- `vi-v0.31.0-5` thay thế candidate `vi-v0.31.0-4` bị exact-artifact smoke
  loại. Tag, draft, asset, manifest, checksum và bằng chứng của
  `vi-v0.31.0-1` đến `vi-v0.31.0-4` là bất biến, giữ riêng tư và không
  được promotion, rebuild, di chuyển hoặc dùng làm bằng chứng cho `-5`.
- Bản tải mặc định/Latest hiện hành vẫn là community pilot
  `vi-v0.20.0-25`. Mốc quay lui của candidate là `vi-v0.20.4-39`; rollback
  công khai của bản Latest vẫn theo `.github/public-release.json`.

## Lý do tạo successor candidate

Exact-artifact Windows x64 smoke của `vi-v0.31.0-4` chạy stop → start/restart
trên Gateway thật. Backend thay thế đã có PID mới và trả
`overall=ok`, nhưng menu vẫn hiện **Đã dừng**, để **Khởi động** khả dụng
và vô hiệu hóa **Dừng** quá 45 giây. Ảnh và quyết định NO-GO đã
được ghi lại.

Windows có thể nhìn thấy process thay thế trước khi PID, lock và runtime state
mà `/api/status` đọc đã ổn định. Candidate `-4` chỉ đọc status một
lần sau lifecycle action, nên snapshot dừng chuyển tiếp có thể bị giữ vô
hạn. Successor làm mới status tuần tự chỉ khi menu đang mở, theo đúng
`connectionId + profile`, và tự dừng khi menu đóng, owner đổi hoặc component
unmount. Request ID và owner generation hiện có tiếp tục loại phản hồi muộn.

Run dựng `-4` `32589995695` đã hoàn tất sáu native build. Attempt 1 và 2
nhận `HTTP 403: Resource not accessible by integration` tại
`gh release create`; attempt 3 đã tạo thành công draft `-4` riêng tư với 30
asset sau khi khôi phục một ref tại candidate commit. Workflow đã xác minh tag,
peeled commit, exact checkout và worktree sạch. Successor harden đường staging
bằng cách checkout rồi fetch lại output tag, buộc cả stage HEAD và tag commit
mới resolve bằng verify-job commit trước metadata/create. `--target` dư thừa bị
bỏ để draft creation chỉ dựa vào tag đã xác minh, không còn phụ thuộc ref phụ
tại commit đó; `--verify-tag`, guard release đã tồn tại, draft-only staging,
manifest/provenance và hậu kiểm byte vẫn được giữ.
Draft `-4` tiếp tục bất biến và không được dùng làm bằng chứng cho `-5`.

## Phạm vi sản phẩm

- Giữ toàn bộ Agents, thứ tự header
  `Gateway -> Agents -> Context -> Advisor`, Connector exact-host HTTP/HTTPS và
  backend-owner routing đã chốt.
- Menu Gateway tự hội tụ từ snapshot dừng tạm thời sang PID mới mà không
  buộc người dùng bấm **Kiểm tra sức khỏe**.
- Mỗi lần đọc status giữ owner đã capture; không dùng foreground owner,
  không xếp chồng request và không repaint từ phản hồi của owner cũ.
- Polling chỉ quan sát status; không tự khởi động/dừng Gateway, không thay
  đổi lifecycle serialization, confirmation hay semantics an toàn của menu.
- Không đổi extension ID, pairing protocol, app ID, executable, data root, schema
  dữ liệu, dependency hoặc surface sản phẩm khác.
- Không ghi cookie value, pairing code, credential hoặc dữ liệu người dùng vào
  log, screenshot, manifest, ledger hay bằng chứng release.

## Hợp đồng phiên bản và phân phối

- Product version giữ `v31.0`; technical base giữ `0.31.0`; upstream giữ
  `0.20.4`.
- `apps/desktop/package.json`, product metadata, Python version, lockfile, app
  ID, executable, protocol, data root, bootstrap marker và tên artifact không
  đổi. Build workflow tự inject `0.31.0-vi.5` từ tag.
- `.github/public-release.json` chỉ đổi `featuredCandidate.tag` sang
  `vi-v0.31.0-5`; default tag `vi-v0.20.0-25`, release class, rollback công
  khai, metadata Windows v25 và mười tên download giữ nguyên.
- README, README.vi và release notes phải cùng trỏ đúng mười URL download của
  `vi-v0.31.0-5`, ghi rõ `vi-v0.31.0-4` bị exact-artifact smoke loại và
  bốn candidate cũ bất biến.
- Updater phải chứng minh
  `0.31.0-vi.5 > 0.31.0-vi.4 > 0.31.0-vi.3 > 0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39`,
  bỏ qua draft và release thiếu manifest đúng target.

## Cổng mã nguồn bắt buộc trước khi tạo tag

- Behavior regression Gateway phải chứng minh PID cũ đang chạy → restart thành
  công → snapshot dừng tạm thời → PID mới đang chạy. UI tự chuyển sang
  **Đang chạy**, hiện PID mới và bật **Dừng** mà không gọi health check.
- Regression phải khóa polling tuần tự, cleanup timer và exact owner cho mọi
  `getStatus`; test owner-switch/late-reply hiện có tiếp tục đạt.
- Connector regression tiếp tục chứng minh permission origins HTTP/HTTPS bỏ
  cổng, giữ exact hostname, revoke grant mới/legacy và query phân vùng fail closed.
- Release workflow phải chạy release, Connector, Gateway, updater và compatibility
  gates trước `gh release create`; workflow-contract test khóa thứ tự này.
- Contract staging phải yêu cầu `gh release create "$TAG" --verify-tag --draft`,
  cấm `--target` trong lệnh create và cấm mọi `--draft=false` ở workflow build.
  Guard riêng của stage phải chạy sau checkout nhưng trước metadata/create,
  fetch lại tag và buộc stage HEAD cùng tag commit bằng verify-job commit.
- Fixed Agents/Gateway gate, updater resolver, stable update channel, Vietnamese
  version resolver, public-download contract, YAML parse, lint, typecheck và
  các release validators đều đạt trên cùng worktree.
- Fixture `-1/-2/-3/-4` chỉ dùng để kiểm hành vi lịch sử; không assertion,
  screenshot, log, hash hoặc evidence cũ nào được nâng thành gate `-5`.

## Cổng artifact và promotion

- Sau khi source gate xanh, tạo một commit sạch đã push/fetch được rồi mới
  tạo annotated tag `vi-v0.31.0-5`. Không di chuyển bốn tag v31 cũ.
- Build lại đủ sáu target trên runner native. Ghi manifest, provenance, byte
  size và SHA-256/SHA-512 mới; không tái sử dụng artifact/hash/evidence `-4`.
- Upload đúng byte vào draft `vi-v0.31.0-5`, tải lại và đối chiếu manifest
  trước runtime smoke. Lỗi create/upload phải dừng ở draft audit, không thay
  asset hoặc rerun native build để lấp bằng chứng.
- Windows x64 phải chạy lại toàn bộ 62 exact-artifact gate trên `-5`, gồm
  fresh install, Gateway/onboarding, restart convergence, session persistence,
  update từ v25/v28/v39, repair, uninstall và rollback.
- Connector phải smoke lại trên Chrome và Edge bằng profile cô lập với fixture
  HTTP và HTTPS ở cổng không mặc định; không tái sử dụng canary, pairing
  code, staged extension hoặc evidence cũ.
- Năm target chưa có máy thật giữ nhãn `BUILD-ONLY-PILOT`. Signing/notarization
  và smoke máy thật vẫn là blocker của Stable/Latest.
- Chỉ workflow promotion riêng, evidence JSON hợp lệ và quyết định của chủ dự
  án mới được chuyển draft thành public community prerelease.

## Quay lui

- Nếu source gate hoặc smoke của `vi-v0.31.0-5` lỗi, giữ cả năm candidate bất
  biến, sửa trên commit mới và tăng iteration tiếp theo.
- Candidate rollback về `vi-v0.20.4-39`; không xóa hoặc nhập lại dữ liệu Hermes
  trong quá trình thử và quay lui.
- Latest/tải mặc định vẫn là `vi-v0.20.0-25` cho tới một quyết định
  promotion riêng; không dùng việc chuẩn bị candidate để đổi hợp đồng
  public hiện hành.
