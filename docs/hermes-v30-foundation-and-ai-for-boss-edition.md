# Hermes V30 Foundation và AI for Boss Edition

Trạng thái: **đã chấp thuận về kiến trúc, chưa phải quyết định phát hành**

Ngày chốt: 2026-08-20

Mốc nguồn Foundation: `8f9b5534c0c831cb953ccbd3852feab4febb8d9e`

## 1. Quyết định

V30 tiếp tục phát triển trên một lõi Hermes-derived công khai theo giấy phép
MIT. **AI for Boss** là một edition sản phẩm thương mại/source-available dùng
chung lõi đó, được phát triển và phân phối bằng một lớp riêng.

Quyết định này tạo ra một cây nguồn kỹ thuật, hai sản phẩm có ranh giới rõ:

1. `hermes-agent-vietnamese` / `projects/hermes-v28` là lõi Community MIT.
2. Một kho product overlay sạch, tên chính thức sẽ được chốt ở lát cắt sau, là
   lớp sản phẩm AI for Boss riêng cho chủ doanh nghiệp.
3. Lõi chỉ biết một hợp đồng edition trung tính. Lõi không phụ thuộc ngược vào
   kho riêng, thương hiệu AI for Boss hoặc cơ chế cấp phép thương mại.
4. Mọi mã đã có trong lõi, gồm Advisor, Dự án, Thống kê sử dụng, panel công cụ
   và tiến trình công việc, tiếp tục là MIT. Quyền đã cấp ở các bản công khai
   không bị thu hồi hoặc diễn giải lại.

## 2. Ranh giới sở hữu

### Lõi Community MIT

- Runtime, gateway, phiên làm việc, công cụ, project/session model và các API
  chung.
- Desktop shell chung cùng các bề mặt Advisor, Dự án, Thống kê sử dụng và tiến
  trình công việc hiện có.
- Hợp đồng edition tổng quát: schema, loader, validation, điểm gắn theme/asset,
  defaults, onboarding và policy packs.
- Kiểm thử tương thích bảo đảm bản Community vẫn chạy khi không có overlay.
- Root `LICENSE`, notice Nous Research và attribution của bên thứ ba được giữ
  nguyên.

### AI for Boss source-available/thương mại

- Edition manifest, tên sản phẩm, hình ảnh thương hiệu và nội dung riêng.
- Thiết lập mặc định, onboarding và workflow dành cho chủ doanh nghiệp.
- Policy/approval packs, bộ hướng dẫn vận hành, dịch vụ cập nhật, hỗ trợ và các
  tích hợp thương mại do đội AI for Boss sở hữu.
- Điều khoản sản phẩm, EULA, notice, trademark và cơ chế cấp phép nếu được chốt
  ở một lát cắt sau.

Gói phân phối AI for Boss phải tách rõ giấy phép sản phẩm khỏi MIT và các giấy
phép bên thứ ba. Điều khoản hạn chế của lớp thương mại không được áp lên mã
Hermes MIT được nhúng trong cùng gói.

## 3. Nhận diện cài đặt và dữ liệu

Hermes Community và AI for Boss phải có thể cài cạnh nhau. Bản AI for Boss sau
này cần `appId`, executable, shortcut, protocol, data root, updater feed, asset
channel và signing identity riêng.

Trong lát cắt Foundation và Edition Contract đầu tiên, các giá trị hiện hữu của
Hermes như `com.nousresearch.hermes`, `hermes`, `HERMES_HOME`, CLI, tag
`vi-v*` và kênh updater hiện tại chưa được đổi. Các giá trị mới của AI for Boss
chỉ được chốt sau khi hoàn tất rà soát nhãn hiệu và thiết kế migration.

Không được silent-update người dùng Hermes sang AI for Boss. Nếu có chức năng
nhập dữ liệu từ Hermes, luồng đó phải:

- xin đồng ý rõ ràng;
- sao lưu trước khi nhập;
- sao chép thay vì di chuyển dữ liệu gốc;
- hiển thị phạm vi dữ liệu và đích đến;
- có kiểm thử quay lui và không làm ảnh hưởng bản Community.

## 4. Giấy phép, ký mã và thương hiệu

- Giấy phép gốc của Hermes tiếp tục là MIT.
- Chưa đặt giấy phép source-available cho AI for Boss ở mốc Foundation.
  PolyForm Perimeter 1.0.0 mới là ứng viên và cần rà soát pháp lý trước khi
  nhận làm văn bản chuẩn.
- Kho AI for Boss phải giữ riêng `LICENSE`, `LICENSING.md`, notice của Hermes,
  third-party notices và SBOM trước khi tạo bất kỳ gói phân phối nào.
- Hồ sơ SignPath Foundation của Hermes gắn với dự án công khai MIT. AI for Boss
  cần signing identity, chính sách và chứng thư riêng; không mặc định tái sử
  dụng quyền ký của Hermes.
- Tên **AI for Boss** cần trademark clearance trước khi chốt app identity hoặc
  phát hành ra ngoài.

## 5. Xử lý hướng OpenClaw trước đây

Mốc sạch `c849fd5210a4b96290511cefe3266f7537071f50` của kho `ai-for-boss` được
giữ như hồ sơ nghiên cứu/thiết kế của hướng OpenClaw. Không merge prototype đó
vào lõi Hermes và không tái dùng kho archive này làm product overlay mới.

Những ý tưởng được phép chuyển thành yêu cầu sản phẩm:

- hành trình làm quen ba bước;
- đối tượng chủ doanh nghiệp;
- Agent Home khác với Dự án;
- Advisor kiểm tra kế hoạch và kết quả cuối;
- xem trước dữ liệu, quyền và chi phí;
- fail-closed ở các hành động có rủi ro;
- chỉ số usability và phong cách Editorial Calm.

Những thành phần không chuyển:

- khóa kiến trúc, manifest và contract riêng của OpenClaw;
- prototype first-run giả lập và code shell phụ thuộc OpenClaw;
- namespace dữ liệu `.aifb*` chưa được thiết kế lại;
- brand mark đã bị loại;
- giả định Always-on, Supervisor hoặc control plane chưa có bằng chứng chạy
  thật.

## 6. Các lát cắt thực hiện

### V30-Foundation — đã checkpoint

Mốc `8f9b5534c0c831cb953ccbd3852feab4febb8d9e` gom bốn nhóm thay đổi hậu V29:
Advisor theo từng phiên, Dự án/Thống kê sử dụng, khôi phục panel phải và sự kiện
tiến trình công việc có cấu trúc. Mốc này chưa đổi thương hiệu, giấy phép,
installer, updater hoặc định danh hệ điều hành.

### V30-Edition Contract — bước kế tiếp

Tạo edition schema/loader trung tính trong lõi và một fixture Community. Hợp
đồng phải có validation fail-fast, defaults rõ ràng và kiểm thử chứng minh lõi
không cần kho AI for Boss để build hoặc chạy.

### AI for Boss Preview — sau khi contract đạt

Tạo overlay mỏng trong một kho sản phẩm sạch, kèm license/notice inventory và
một build nội bộ. Preview chưa được phát hành cho đến khi đạt các cổng pháp lý,
nhận diện, ký mã, updater và migration.

### Product Identity Migration — release riêng

Chỉ ở lát cắt này mới thay app identity, data root, protocol, updater và
installer. Phải kiểm thử exact V29 → V30, cài song song, import có đồng ý, mở
lại sau cập nhật, gỡ từng ứng dụng và rollback.

## 7. Cổng chấp nhận

### Foundation

- Worktree sạch và có commit nguồn bất biến.
- Kiểm thử Advisor/gateway, UI mục tiêu, typecheck, lint, Ruff, Prettier và
  `git diff --check` đạt.
- Production renderer, Electron bundle, native staging, Agent payload staging
  và dist assertion đạt bằng các bước tương đương đã ghi nhận.
- Không đổi license, product identity, updater hoặc dữ liệu người dùng.
- Có rollback trực tiếp về V29 `160445721a40b405f7c566c05312d0dca9d33580`.

### Edition Contract

- Cùng một commit lõi dựng được Community không overlay và dựng được edition
  từ manifest hợp lệ.
- Manifest thiếu/sai bị chặn ở build; secret và dữ liệu riêng không được đóng
  gói nhầm vào Community.
- Community giữ nguyên tên, dữ liệu, updater và hành vi nâng cấp.
- Product bundle sao chép và kiểm tra đủ MIT notice cùng third-party notices.
- Test xác nhận lớp thương mại không re-license hoặc che nguồn MIT.

### AI for Boss có thể phân phối

- Giấy phép source-available/EULA đã được pháp lý duyệt và chủ thể pháp lý được
  ghi đúng.
- Trademark clearance đạt.
- Signing identity, updater feed và release policy riêng hoạt động.
- Cài song song, import có đồng ý, uninstall và rollback đạt trên artifact
  chính xác sẽ phát hành.
- SBOM, license inventory, security review và dữ liệu telemetry/consent được
  nghiệm thu.

## 8. Ngoài phạm vi V30 Foundation

License activation, thanh toán, approval inbox, audit ledger đầy đủ, Agent
Genesis hoàn chỉnh, sandbox mới, Always-on, control plane, telemetry thương mại
và commercial GA đều nằm ngoài phạm vi checkpoint này.

## 9. Trạng thái phát hành

Tài liệu này cho phép tiếp tục thiết kế và triển khai nội bộ. Nó không cho phép
push, tạo PR công khai, tag, candidate, installer, thay Public Latest hoặc phát
hành AI for Boss.
