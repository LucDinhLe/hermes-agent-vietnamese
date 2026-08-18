# Kế hoạch phát hành Hermes Vietnamese vi-v0.20.4-29

## Quyết định phạm vi

`vi-v0.20.4-29` là community prerelease cài được ngay sau khi vượt đủ cổng phát
hành. Đây không phải stable và không tự thay Public Latest `vi-v0.20.0-25`.
Candidate bắt đầu ở trạng thái draft; chỉ workflow promotion mới được công khai
đúng byte đã nghiệm thu.

Nền upstream được khóa tại tag đã ký `v2026.8.18`, commit
`e624e9fde561e1add9388384012b295fde669ade`, tương ứng Hermes Agent `0.20.4`.
Không phát hành trực tiếp từ `main` động.

## Công việc bắt buộc

- Đồng bộ thay đổi upstream 0.20.4 mà không làm mất lớp Việt hóa và phân phối
  cộng đồng.
- Giữ toàn bộ nâng cấp v26: Hermes Connector chính chủ cho Chrome/Edge, consent,
  pairing một lần, import/revoke cookie cô lập, redaction và tùy chọn tóm tắt
  reasoning công khai bằng tiếng Việt.
- Giữ toàn bộ nâng cấp v27: Advisor mặc định tắt, chỉ đọc, không có tools; tự rà
  ở checkpoint kế hoạch, phục hồi và kết quả cuối; model/provider riêng nằm cạnh
  model làm việc; tối đa hai vòng chỉnh sửa.
- Giữ Browser nhiều tab ở panel phải, runtime resident, repair, update, uninstall
  giữ/xóa dữ liệu, build stamp và kênh cập nhật `vi-v*`.
- Nâng Electron lên `42.8.0`; khóa dependency đã kiểm toán để `npm audit` đầy đủ
  không còn advisory tại candidate source.
- Sửa giao diện tiếng Việt: `Gửi yêu cầu` thay cho `Gửi theo dõi`; fresh profile
  nhận `display.language=vi` từ backend để không bị mặc định tiếng Anh lấn át.
- Khôi phục mọi URL cài đặt, cập nhật và release về kho công khai
  `LucDinhLe/hermes-agent-vietnamese`.
- Khôi phục `hermes update --eject`: bản đóng gói tải script cài nguồn từ đúng
  commit cộng đồng đã đóng gói, không ghim commit Việt hóa vào installer upstream.
- Kênh stable chỉ nhìn GitHub Release đã công khai; tag của draft candidate bị
  ẩn khỏi máy người dùng cho tới lúc promotion hoàn tất.

## Ngoài phạm vi

- Không thêm nút gọi Advisor thủ công.
- Không cho Advisor quyền công cụ hoặc quyền thay đổi trạng thái trực tiếp.
- Không đọc trực tiếp hồ sơ Chrome/Edge và không hỗ trợ tùy ý extension từ Chrome
  Web Store.
- Không hạ chuẩn an toàn cookie partitioned/CHIPS.
- Không tuyên bố stable, Authenticode, Apple notarization hoặc hỗ trợ thương mại
  khi chưa có bằng chứng tương ứng.

## Cổng mã nguồn

- Không còn conflict marker; worktree sạch tại candidate commit.
- Python compile, targeted pytest, Desktop typecheck, lint, format và toàn bộ bộ
  test chuẩn đạt.
- `npm audit --omit=optional --audit-level=high` không còn lỗ hổng high/critical
  áp dụng cho gói phát hành, hoặc có đánh giá ngoại lệ công khai và được duyệt.
- Release workflow contract, community distribution, installer, updater,
  connector, reasoning summary và Advisor tests đều đạt.
- Tag `vi-v0.20.4-29` bất biến, trỏ đúng candidate commit; draft release chỉ được
  tạo từ tag này.

## Cổng artifact chính xác

- Sáu target native build và staging thành công; `SHA256SUMS.txt`, provenance và
  release-runtime-evidence khớp đúng byte tải lại từ draft.
- Windows x64 phải được cài mới bằng artifact tải từ draft trong Hermes HOME,
  AppData, Electron user-data, Chrome profile và Edge profile cô lập.
- Smoke bắt buộc: first-run không cần developer tools; bundled runtime; gateway;
  onboarding; tạo/đổi tên phiên; tab phiên; Browser nhiều tab và resize panel;
  safe tool; persistence sau restart.
- Connector: Chrome/Edge cô lập, consent preview, persistence, revoke, rollback
  khi lỗi và không rò secret trong log/evidence.
- Reasoning summary: bật hoạt động, tắt tạo zero call, reasoning gốc được giữ.
- Advisor: tắt tạo zero call; plan/recovery/final checkpoint; read-only; bounded
  revision; lưu lựa chọn model qua restart.
- Update từ exact public v25; repair; uninstall giữ dữ liệu; uninstall xóa dữ
  liệu; rollback về `vi-v0.20.0-14`.

## Điều kiện công khai

Chỉ công khai dạng community prerelease khi mọi gate bắt buộc có bằng chứng GO.
Windows unsigned và macOS chưa notarize phải được ghi rõ. Nếu bất kỳ byte nào
thay đổi sau staging, hủy candidate và dùng tag kế tiếp; không di chuyển tag,
không thay asset đã nghiệm thu.

## Quay lui

- Public Latest trước promotion: `vi-v0.20.0-25`.
- Mốc rollback được giữ nguyên: `vi-v0.20.0-14`.
- Thu hồi v28 bằng cách chuyển release về draft hoặc xóa quyền tải công khai,
  giữ nguyên tag và evidence phục vụ điều tra; hướng người dùng về bản rollback.
