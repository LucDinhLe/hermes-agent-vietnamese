## Hermes Vietnamese v31.0 — Agents cộng tác luôn sẵn trong từng phiên

Candidate bất biến: `vi-v0.31.0-2`

Phiên bản kỹ thuật Desktop: `0.31.0-vi.2`

Lõi upstream: **Hermes Agent 0.20.4**

Hermes Vietnamese v31.0 là bản Desktop độc lập do
[Lê Đình Lực (LucDinhLe)](https://github.com/LucDinhLe) phát triển cho cộng
đồng theo giấy phép MIT, dựa trên
[Hermes Agent](https://github.com/NousResearch/hermes-agent). Phiên bản sản
phẩm Việt hóa và phiên bản upstream được hiển thị riêng để người dùng không
nhầm nguồn gốc hoặc đường nâng cấp.

> **Lớp phát hành: community prerelease, chưa phải stable.** Candidate chỉ được
> công khai sau khi sáu target build đạt, byte trên GitHub khớp SHA-256 và
> Windows x64 vượt exact-artifact smoke. Bản tải mặc định/Latest hiện
> hành vẫn là community pilot `vi-v0.20.0-25` cho tới khi signing và
> smoke máy thật đủ theo policy; bản này không được tái phân loại thành stable.

> **Candidate kế nhiệm:** `vi-v0.31.0-2` thay thế candidate `vi-v0.31.0-1`
> chưa được promotion sau khi exact-byte smoke phát hiện cần đưa điều khiển
> Gateway vào đúng header và backend owner của từng phiên. Tag, draft và byte
> của `vi-v0.31.0-1` vẫn được giữ nguyên; không rebuild hoặc sửa đè candidate cũ.

> **Chuẩn hóa phiên bản:** `v31.0` là mốc đầu tiên dùng hợp đồng
> phiên bản sản phẩm tách khỏi upstream. Nhãn working `v31.1` trong kế hoạch
> candidate vi39 không phải technical/updater version và được thay bằng mốc
> chính thức `v31.0`; đường nâng cấp vẫn tăng từ `0.20.4-vi.39` lên
> `0.31.0-vi.2`.

### Agents: cộng tác thay vì thay người chủ trì

- Pane hồ sơ cộng tác cũ có thể đóng rồi mất lối vào đã được bỏ khỏi panel trái.
- Mỗi phiên có nút **Agents** cố định cạnh mức dùng cửa sổ ngữ cảnh, chi phí
  USD và Advisor; nút này co giãn trong chính panel chat, không lấn panel phải.
- Dropdown cho biết Agent chủ trì, các Agent đang tham gia, vai trò/trạng thái,
  model và mô tả năng lực ngắn. Có tìm kiếm để lọc roster dài.
- Mời một Agent chỉ thêm cộng tác viên vào phiên hoặc dự án. Hành động đó không
  đổi Agent chủ trì, gateway, model, system prompt hay tự phát sinh lượt model.
- Một phiên hoặc dự án có thể giữ nhiều Agent cộng tác, kể cả Agent trùng tên
  nằm trên các kết nối khác nhau.
- **Quản lý Agents** là một trang ổn định để xem, tạo, sửa, sao chép, xóa, quản
  lý nhóm, năng lực, kỹ năng, công cụ, MCP và tác vụ định kỳ.

### Việt hóa đầy đủ và giữ English hoàn chỉnh

- Toàn bộ bề mặt tạo/sửa/quản lý Agent, avatar, model, SOUL.md, capabilities,
  skills, tools, MCP, profile sessions, groups và routines có copy tiếng Việt.
- Locale English vẫn đầy đủ và có thể đổi trực tiếp mà không làm mất dữ liệu
  đang nhập trong dialog.
- Lựa chọn chia sẻ tài khoản/API key giải thích rõ quyền truy cập, hạn mức và
  chi phí: yêu cầu của Agent được tính vào chính tài khoản/provider tương ứng.
  Mặc định cũ được giữ nguyên; v31 không âm thầm đổi quyết định credential.

### Tương thích dữ liệu và đường nâng cấp

- Giữ nguyên app ID, executable, protocol, thư mục dữ liệu và bootstrap marker;
  cài đè nhận đúng cấu hình, cuộc trò chuyện và onboarding hiện có.
- Plugin ID `hermes-bots`, storage key, profile/session/group/routine schema,
  tiêu đề `Bot Chat` và marker protocol cũ tiếp tục được đọc. Chỉ lớp trình bày
  dùng Agent/Agents; v31 không rewrite dữ liệu người dùng.
- Updater nhận `0.31.0-vi.2` là mới hơn cả `0.31.0-vi.1` và
  `0.20.4-vi.39`. Cổng phát hành bắt buộc
  thử cài đè từ `vi-v0.20.4-39` và kiểm tra profile, session, project, group,
  routine cùng trạng thái onboarding còn nguyên.

### Advisor và các bề mặt v26–v39 được giữ nguyên

- Planning/final checking của Advisor tiếp tục chạy theo từng phiên.
- Context meter, USD estimate, model selector, Advisor selector/toggle, thinking
  progress, tab/chia panel và panel phải vẫn hiện diện.
- Browser, Projects, Usage analytics, routine catalog tiếng Việt, connector và
  runtime resident tiếp tục dùng hợp đồng đã chốt ở các candidate trước.

### Tệp candidate theo nền tảng

Chỉ dùng các liên kết dưới đây sau khi release chuyển khỏi draft. Luôn đối chiếu
với `SHA256SUMS.txt` nằm trong cùng release.

| Máy đang dùng           | Tệp candidate                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Windows x64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Windows-x64-Setup.exe)         |
| Windows 10/11 ARM64     | [Windows ARM64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Windows-arm64-Setup.exe)     |
| Mac chip Apple M-series | [macOS Apple Silicon DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [macOS Intel DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Linux x64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-x64.deb)                     |
| Ubuntu/Debian ARM64     | [Linux ARM64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-arm64.deb)                 |
| Fedora/RHEL x64         | [Linux x64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-x64.rpm)                     |
| Fedora/RHEL ARM64       | [Linux ARM64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-arm64.rpm)                 |
| Linux khác x64          | [Linux x64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-x64.AppImage)           |
| Linux khác ARM64        | [Linux ARM64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-2/Hermes-Vietnamese-Linux-arm64.AppImage)       |

### Tình trạng nghiệm thu candidate khi được công khai

- Windows x64: exact-artifact smoke đạt trên chính byte phát hành là điều kiện
  bắt buộc; workflow promotion kiểm lại evidence, SHA-256 và trạng thái
  `PILOT-GO` trước khi candidate được chuyển khỏi draft.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 **chưa có smoke
  trên máy người dùng**; nếu build đạt, các target này vẫn chỉ là
  `BUILD-ONLY-PILOT`.
- Windows chưa Authenticode. Hồ sơ SignPath Foundation vẫn đang chờ xét duyệt;
  không được coi cảnh báo SmartScreen là bằng chứng bộ cài đã ký.
- Dự án chưa tham gia Apple Developer Program; macOS chưa có Developer ID,
  notarization hoặc stapling.
- Artifact chưa vượt cổng không được quảng cáo là stable, final hoặc đã smoke.

### Quyền riêng tư, chi phí và hỗ trợ

- Bản phân phối không kèm tài khoản, model trả phí, API key hay hạn mức. Chi phí
  phụ thuộc model/provider và tài khoản người dùng chọn.
- Cookie, token và bí mật không nằm trong artifact, log hay bằng chứng release.
- Lỗi và góp ý: [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- Báo cáo bảo mật: [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md)
- Mốc quay lui của candidate: [`vi-v0.20.4-39`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.4-39).

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và chi phí dịch vụ.
