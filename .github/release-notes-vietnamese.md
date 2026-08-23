## Hermes Vietnamese v31.0 — Agents cộng tác luôn sẵn trong từng phiên

Candidate bất biến: `vi-v0.31.0-6`

Phiên bản kỹ thuật Desktop: `0.31.0-vi.6`

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

> **Candidate kế nhiệm:** `vi-v0.31.0-6` thay thế candidate
> `vi-v0.31.0-5` bị exact-artifact keep-data uninstall loại. Nhánh giữ dữ liệu
> đã bảo toàn toàn bộ profile/userData cô lập và xóa app per-user, nhưng để lại
> mục gỡ cài đặt HKCU trỏ đến tệp đã mất; Python cleanup còn quét nhầm bản
> all-users ở `C:\Program Files\Hermes`. Tag, draft, asset và bằng chứng của
> `vi-v0.31.0-1` đến `vi-v0.31.0-5` vẫn được giữ riêng tư và nguyên vẹn;
> không rebuild, di chuyển hoặc sửa đè candidate cũ.

> **Chuẩn hóa phiên bản:** `v31.0` là mốc đầu tiên dùng hợp đồng
> phiên bản sản phẩm tách khỏi upstream. Nhãn working `v31.1` trong kế hoạch
> candidate vi39 không phải technical/updater version và được thay bằng mốc
> chính thức `v31.0`; đường nâng cấp vẫn tăng từ `0.20.4-vi.39` lên
> `0.31.0-vi.6`.

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
- Updater nhận `0.31.0-vi.6` là mới hơn `0.31.0-vi.5`, `0.31.0-vi.4`, `0.31.0-vi.3`,
  `0.31.0-vi.2`, `0.31.0-vi.1` và
  `0.20.4-vi.39`. Cổng phát hành bắt buộc
  thử cài đè từ `vi-v0.20.4-39` và kiểm tra profile, session, project, group,
  routine cùng trạng thái onboarding còn nguyên.

### Gateway tự hội tụ sau restart mà không cần kiểm tra thủ công

- Windows có thể nhìn thấy process Gateway thay thế trước khi PID, lock và runtime
  state mà `/api/status` đọc đã ổn định. Candidate `-4` chỉ đọc status một
  lần sau action, nên snapshot chuyển tiếp **Đã dừng** có thể bị giữ vô hạn.
- Khi menu mở, candidate mới làm mới status tuần tự theo đúng
  `connectionId + profile`; lần đọc sau chỉ được lên lịch sau khi lần trước
  kết thúc. Polling dừng khi đóng menu, đổi owner hoặc unmount; phản hồi muộn
  vẫn bị loại theo request ID và owner generation hiện có.
- Cổng chấp nhận phải thấy chuỗi PID cũ đang chạy → restart thành công →
  snapshot dừng tạm thời → PID mới đang chạy; UI tự hiện **Đang chạy**, PID
  mới và bật **Dừng** mà không bấm **Kiểm tra sức khỏe**. Mọi lần đọc
  status vẫn phải nhận đúng owner.

### Gỡ cài đặt Windows chỉ tác động đúng bản đang chạy

- Desktop giao cho Python phase bỏ qua mọi packaged-app location; việc xóa app
  đóng gói thuộc riêng detached cleanup đã nhận `appPath` từ executable hiện tại.
- Windows cleanup chỉ xóa key cài đặt và gỡ cài đặt NSIS trong HKCU khi
  `InstallLocation` khớp chính xác `appPath`. Bản all-users HKLM và sibling path
  không đủ điều kiện bị đụng tới.
- Exact-artifact gate phải chạy lại cả giữ dữ liệu lẫn xóa dữ liệu với snapshot
  trước/sau của current app, registry, dữ liệu đích và unrelated all-users app.

### Advisor và các bề mặt v26–v39 được giữ nguyên

- Planning/final checking của Advisor tiếp tục chạy theo từng phiên.
- Context meter, USD estimate, model selector, Advisor selector/toggle, thinking
  progress, tab/chia panel và panel phải vẫn hiện diện.
- Browser, Projects, Usage analytics, routine catalog tiếng Việt, connector và
  runtime resident tiếp tục dùng hợp đồng đã chốt ở các candidate trước.

### Connector không bỏ sót cookie website trên Chromium hiện hành

- Chrome/Edge Connector liệt kê cả cookie có và không phân vùng theo hợp đồng
  Chromium hiện hành, nhưng chỉ đưa cookie không phân vùng, còn hiệu lực vào
  payload chuyển sang Hermes.
- Quyền tùy chọn được xin cho đúng hostname của tab, đồng thời cho `http` và
  `https`, không mang cổng và không mở wildcard miền cha. Thu hồi xóa cả hai
  pattern mới cùng grant origin-có-cổng do candidate cũ có thể để lại.
- Cookie thực sự có phân vùng vẫn bị bỏ qua và được đếm đúng là không hỗ trợ;
  cookie hết hạn được đếm riêng. Preview chỉ hiển thị metadata, không hiển thị
  tên bí mật hoặc giá trị cookie.
- Giới hạn đã biết: cookie miền cha khi tab ở subdomain có thể không được
  Chromium trả về dưới grant exact-host. Candidate này không tuyên bố hỗ trợ
  wildcard hoặc eTLD+1 và không âm thầm mở rộng quyền.
- Cổng candidate chạy regression extension/import/pairing trước khi tạo draft.
  Exact-artifact smoke phải thử Chrome và Edge bằng profile cô lập, gồm preview,
  import, persistence, revoke và quét redaction.

### Staging không yêu cầu GitHub xử lý lại target của tag

- Workflow đã checkout tag, fetch tag từ origin, peel commit, buộc HEAD khớp commit
  và buộc worktree sạch trước khi build. Job staging lại checkout output tag,
  fetch tag mới nhất rồi buộc cả stage HEAD và tag commit mới resolve bằng commit
  đã xác minh trước metadata/create; `gh release create` vẫn bắt buộc
  `--verify-tag`.
- Attempt 1 và 2 của run dựng `-4` gặp lỗi 403
  `Resource not accessible by integration`; attempt 3 đã tạo thành công draft
  riêng tư với 30 asset sau khi khôi phục một ref tại candidate commit.
  Successor bỏ `--target` dư thừa để lệnh tạo draft chỉ dựa vào tag đã xác minh,
  không còn phụ thuộc ref phụ tại commit đó. Workflow không tạo hoặc di chuyển
  tag, không rebuild artifact đã nghiệm thu và không công khai release trong
  job staging.

### Tệp candidate theo nền tảng

Chỉ dùng các liên kết dưới đây sau khi release chuyển khỏi draft. Luôn đối chiếu
với `SHA256SUMS.txt` nằm trong cùng release.

| Máy đang dùng           | Tệp candidate                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Windows x64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Windows-x64-Setup.exe)         |
| Windows 10/11 ARM64     | [Windows ARM64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Windows-arm64-Setup.exe)     |
| Mac chip Apple M-series | [macOS Apple Silicon DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [macOS Intel DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Linux x64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-x64.deb)                     |
| Ubuntu/Debian ARM64     | [Linux ARM64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-arm64.deb)                 |
| Fedora/RHEL x64         | [Linux x64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-x64.rpm)                     |
| Fedora/RHEL ARM64       | [Linux ARM64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-arm64.rpm)                 |
| Linux khác x64          | [Linux x64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-x64.AppImage)           |
| Linux khác ARM64        | [Linux ARM64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-6/Hermes-Vietnamese-Linux-arm64.AppImage)       |

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
