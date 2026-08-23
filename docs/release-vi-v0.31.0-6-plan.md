# Kế hoạch successor candidate Hermes Vietnamese v31.0 — iteration 6

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-6`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.6`.
- Lõi upstream hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- `vi-v0.31.0-6` thay thế candidate `vi-v0.31.0-5` bị exact-artifact uninstall
  smoke loại. Tag, draft, asset, manifest, checksum và bằng chứng của
  `vi-v0.31.0-1` đến `vi-v0.31.0-5` là bất biến, giữ riêng tư và không được
  promotion, rebuild, di chuyển hoặc dùng làm bằng chứng cho `-6`.
- Bản tải mặc định/Latest vẫn là community pilot `vi-v0.20.0-25`. Mốc quay lui
  candidate là `vi-v0.20.4-39`.

## Lý do tạo successor candidate

Keep-data uninstall trên đúng Windows x64 artifact `-5` giữ nguyên SHA-256 của
40/40 tệp profile và 88/88 tệp Electron userData cô lập, xóa app per-user và để
lại 0 tiến trình Hermes. Gate vẫn **FAILED** vì mục gỡ cài đặt HKCU còn tồn tại
và trỏ đến `Uninstall Hermes.exe` đã mất. Python GUI cleanup đồng thời quét
`C:\Program Files\Hermes`, là bản all-users `-1` ngoài phạm vi, rồi thử xóa và
nhận access denied. Không có pre-snapshot của cây này nên không thể loại trừ xóa
một phần.

Nguyên nhân gốc là Desktop gọi Python uninstaller mà không giới hạn packaged-app
scope; Python xóa mọi đường dẫn chuẩn, còn detached cleanup xóa thư mục app bằng
`rmdir` nên bỏ qua đăng ký NSIS. Successor giao packaged app cho một owner duy
nhất: detached cleanup của đúng executable đang chạy.

## Phạm vi sửa

- Luồng Desktop thêm `--skip-packaged-apps` cho Python phase ở cả `gui`, `lite`
  và `full`; CLI tương tác trực tiếp vẫn giữ hành vi hiện hành khi flag vắng.
- Python GUI cleanup nhận danh sách packaged path tường minh; danh sách rỗng
  không được tự quay lại quét các vị trí chuẩn.
- Detached Windows cleanup chỉ xóa hai key NSIS HKCU ổn định khi
  `InstallLocation` khớp chính xác `appPath` đã resolve từ `process.execPath`.
- Không truy vấn/xóa HKLM và không đụng sibling install path. App tree hiện tại
  vẫn được retry xóa sau khi desktop/backend đã thoát.
- Không đổi app ID, executable, data root, schema dữ liệu, bootstrap marker,
  extension ID, pairing protocol, dependency hoặc surface sản phẩm.

## Hợp đồng phiên bản và phân phối

- Product version giữ `v31.0`; technical base giữ `0.31.0`; upstream giữ
  `0.20.4`. Workflow inject `0.31.0-vi.6` từ tag.
- `.github/public-release.json` chỉ đổi `featuredCandidate.tag` sang
  `vi-v0.31.0-6`; default `vi-v0.20.0-25`, release class, rollback công khai,
  metadata Windows v25 và mười tên download giữ nguyên.
- README, README.vi và release notes cùng trỏ mười URL `vi-v0.31.0-6`, nêu rõ
  `-5` bị uninstall smoke loại và năm candidate cũ bất biến.
- Updater phải chứng minh
  `0.31.0-vi.6 > 0.31.0-vi.5 > 0.31.0-vi.4 > 0.31.0-vi.3 > 0.31.0-vi.2 > 0.31.0-vi.1 > 0.20.4-vi.39`.

## Cổng mã nguồn trước tag

- Python behavior test chứng minh packaged path rỗng không xóa current hoặc
  sibling packaged install.
- Module-entry test chứng minh `--skip-packaged-apps` đi tới cả keep-data/full
  uninstall path.
- Electron behavior test chứng minh Desktop handoff luôn thêm flag và Windows
  script chỉ xóa registry sau exact `InstallLocation` match.
- Toàn bộ Gateway convergence, Connector permission/partition, Agents fixed
  header, updater, workflow staging, public-download, YAML, lint, typecheck,
  release validator và compatibility gate của `-5` tiếp tục đạt.
- Fixture/evidence `-1` đến `-5` chỉ là lịch sử; không được nâng thành bằng chứng
  artifact `-6`.

## Cổng artifact và promotion

- Chỉ tạo annotated tag sau commit sạch đã push/fetch và source gate xanh.
- Build lại sáu target native, tạo manifest/provenance/checksum mới và staging
  draft bất biến. Không tái sử dụng byte/hash của `-5`.
- Tải lại exact Windows x64 installer `-6`, đối chiếu manifest rồi chạy repair,
  keep-data uninstall và delete-data uninstall bằng smoke account cô lập.
- Mỗi uninstall lane phải có pre/post snapshot của current per-user app,
  registry, profile/userData đích và unrelated all-users installation.
- Keep-data phải xóa current app + registry, giữ đúng dữ liệu; delete-data phải
  xóa đúng dữ liệu đã tuyên bố. Cả hai phải để unrelated install byte-for-byte
  không đổi và 0 tiến trình/port Hermes của lane.
- Sau uninstall, rollback `vi-v0.20.4-39` vẫn phải cài/mở khỏe. Các gate còn
  lại trong ma trận 62 exact-artifact tiếp tục là blocker của promotion.
- Năm target chưa có máy thật giữ `BUILD-ONLY-PILOT`. Signing/notarization và
  smoke máy thật vẫn chặn Stable/Latest.
- Chỉ workflow promotion riêng, evidence JSON hợp lệ và quyết định mới của chủ
  dự án được chuyển draft thành public community prerelease.

## Quay lui

- Nếu source gate hoặc exact-artifact smoke `-6` lỗi, giữ cả sáu candidate bất
  biến, sửa trên commit mới và tăng iteration.
- Rollback candidate là `vi-v0.20.4-39`; không nhập state không tương thích và
  không xóa dữ liệu ngoài lane đã ghi rõ.
- Latest/tải mặc định vẫn là `vi-v0.20.0-25` cho tới một quyết định promotion
  riêng; chuẩn bị candidate không thay hợp đồng public hiện hành.
