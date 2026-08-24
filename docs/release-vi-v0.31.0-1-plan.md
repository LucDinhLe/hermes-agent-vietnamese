# Kế hoạch candidate Hermes Vietnamese v31.0

## Candidate và quyết định phát hành

- Tên phát hành: **Hermes Vietnamese v31.0**.
- Tag bất biến dự kiến: `vi-v0.31.0-1`.
- Phiên bản kỹ thuật của ứng dụng: `0.31.0-vi.1`.
- Lõi upstream được hiển thị riêng: **Hermes Agent 0.20.4**.
- Lớp phát hành: `community-prerelease`; không gắn Stable hoặc Latest khi chưa
  đủ ký số và smoke máy thật theo policy.
- Bản tải mặc định/Latest hiện hành vẫn là community pilot
  `vi-v0.20.0-25`, không phải stable. Không sửa, ghi đè hoặc
  tái sử dụng tag `vi-v0.20.4-39`.
- Mốc quay lui cho candidate là `vi-v0.20.4-39`; mốc quay lui công khai của
  bản tải mặc định/Latest vẫn theo `.github/public-release.json`.
- `v31.0` là mốc chính thức đầu tiên của hợp đồng phiên bản sản phẩm
  tách khỏi upstream. Nhãn working `v31.1` trong kế hoạch candidate vi39
  không phải technical/updater version; candidate này chuẩn hóa nhãn hiển thị
  thành `v31.0` trong khi SemVer nâng cấp vẫn tăng đơn điệu.

## Phạm vi sản phẩm

- Bỏ pane hồ sơ cộng tác cũ khỏi panel trái và loại bỏ riêng hai định danh layout cũ mà
  không reset bố cục hay panel phải của người dùng.
- Dùng **Agent/Agents** trên lớp trình bày; giữ nguyên plugin ID, storage key,
  protocol, tiêu đề phiên cũ, hồ sơ và dữ liệu tương thích.
- Thêm khu vực Agents cố định theo từng phiên, cạnh đồng hồ ngữ cảnh/chi phí và
  Advisor; hỗ trợ nhiều Agent cộng tác ở phạm vi phiên hoặc dự án.
- Hành động chọn Agent chỉ thêm hoặc xóa cộng tác viên. Agent chủ trì, model,
  gateway và system prompt không tự thay đổi.
- Có tìm kiếm/lọc theo thông tin năng lực hiện có và lối vào **Quản lý Agents**
  ổn định cho hồ sơ, nhóm, năng lực và tác vụ định kỳ.
- Việt hóa đầy đủ bề mặt tạo, sửa và quản lý Agent; giữ locale English đầy đủ và
  giải thích tác động quyền, hạn mức, tài khoản và chi phí khi chia sẻ thông tin
  xác thực.
- Giữ Advisor loop, context meter, USD estimate, thinking progress, multi-pane,
  right rail, session/project, group chat và routine/cron hiện hữu.

## Hợp đồng tương thích và cập nhật

Không thay đổi app ID `com.nousresearch.hermes`, executable/product identity
`Hermes` / `Hermes.exe`, protocol `hermes`, updater repository, thư mục dữ liệu
hoặc bootstrap marker. Profile Agent và profile định dạng cũ, session, project, group, routine,
credential decision và onboarding marker phải đọc được mà không migration phá
hủy hoặc quay lại bootstrap.

Updater phải chọn `vi-v0.31.0-1` cao hơn `0.20.4-vi.39`, chỉ nhận release công
khai có manifest đúng nền tảng và không chọn draft. Candidate chưa công khai sẽ
không xuất hiện trong ứng dụng; sau khi công khai ở lớp prerelease, phạm vi người
dùng updater phải được báo cáo trung thực.

## Cổng bắt buộc trước khi public prerelease

- Unit/component/integration cho Agents header, dropdown, tìm/lọc, nhiều Agent,
  phạm vi phiên/dự án, management entry, keyboard/accessibility và responsive.
- Fixture tương thích cho `hermes-bots`, profile/session/group/routine cũ, layout
  pane cũ, collaboration storage thiếu/hỏng và update từ `0.20.4-vi.39`.
- EN/VI i18n parity; không còn chuỗi Bot/Bots ở bề mặt Agent và không còn cụm
  hướng dẫn bị cấm; các hằng wire/legacy được allowlist rõ.
- Advisor/model/context/cost/thinking/right panel vẫn hoạt động; plugin test,
  typecheck, lint, release-contract test và package/build gate đạt.
- Workflow build native Windows x64, Windows arm64, macOS Intel, macOS Apple
  Silicon, Linux x64 và Linux arm64 tạo đủ artifact cùng update manifest.
- Tải lại exact artifact Windows x64, đối chiếu SHA-256 local/GitHub, smoke cài
  mới, relaunch và update từ `vi-v0.20.4-39` trong khi giữ dữ liệu.
- Artifact chỉ build nhưng chưa smoke máy thật phải ghi rõ `BUILD-ONLY`; không
  suy diễn từ build xanh thành đã chạy thật.

## Cổng promotion Stable/Latest

Không promote Stable/Latest chỉ để đổi nhãn GitHub. Promotion chỉ được xem xét
khi signing gate của workflow đạt và từng nền tảng có bằng chứng exact-artifact
smoke máy thật theo release policy. Nếu thiếu bất kỳ bằng chứng nào, quyết định
vẫn là giữ candidate ở prerelease và giữ Latest hiện hành.
