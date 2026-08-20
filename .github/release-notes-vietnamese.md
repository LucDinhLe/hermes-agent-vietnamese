## Hermes Vietnamese vi-v0.20.4-38 — v31 cho công việc AI có kiểm soát

Hermes Vietnamese v31 là bản Desktop độc lập của
[Hermes Agent](https://github.com/NousResearch/hermes-agent), do
[Lê Đình Lực (LucDinhLe)](https://github.com/LucDinhLe) phát triển cho cộng
đồng theo giấy phép MIT. Bản này dùng lõi Hermes Agent 0.20.4 và cung cấp môi
trường làm việc hoàn chỉnh cho người muốn giao việc cho AI mà không phải tự
dựng Hermes từ mã nguồn.

> **Lớp phát hành: community prerelease, chưa phải stable.** Windows và macOS
> chưa ký số/công chứng đầy đủ. Hãy tải đúng kho chính thức và kiểm SHA-256.

### Những lợi thế chính

#### Cài đặt và cập nhật như một ứng dụng Desktop

- Bộ cài mang theo Python, Node.js, `uv`, Hermes và dependency đã khóa.
- Lần mở đầu dùng runtime tích hợp, không phụ thuộc Git, nhánh động hoặc công cụ
  lập trình trong máy người dùng.
- Cập nhật giữ nguyên app identity và vùng dữ liệu. Cấu hình, cuộc trò chuyện,
  lịch định kỳ và trạng thái onboarding không bị chuyển sang hồ sơ mới.
- Có các lựa chọn sửa chữa, gỡ giao diện nhưng giữ dữ liệu hoặc gỡ toàn bộ.

**Lợi ích:** người dùng tập trung vào công việc; môi trường cài đặt và nâng cấp
được quản lý như một sản phẩm thay vì một dự án lập trình.

#### Làm việc theo phiên, dự án và panel

- Mở nhiều phiên thành tab hoặc chia panel để đối chiếu song song.
- Panel phải giữ Tệp, Trình duyệt và Terminal, co giãn độc lập với vùng chat.
- Trang **Dự án** cho phép tìm, mở, ghim và tạo phiên đúng thư mục.
- Trang **Thống kê sử dụng** tổng hợp token theo thời gian, dự án và model.
- Từng phiên có chỉ báo mức dùng cửa sổ ngữ cảnh theo giới hạn model do nhà
  cung cấp công bố, kèm ngưỡng rút gọn thực tế của Hermes.
- Chi phí theo phiên được ước tính bằng USD từ token vào, token ra và cache,
  có tách model làm việc với model Advisor.

**Lợi ích:** người dùng biết công việc nằm ở đâu, model nào đang tiêu tốn tài
nguyên, chi phí tương đương API và khi nào một phiên sắp chạm giới hạn ngữ
cảnh. Số tiền là ước tính theo bảng giá model, không thay thế hóa đơn thực tế
của gói thuê bao hoặc nhà cung cấp.

#### Advisor phản biện ngay trong từng phiên

- Advisor là model độc lập, chỉ đọc và không có công cụ thao tác thay người làm.
- Công tắc và menu model nằm ngay trong panel phiên; menu lấy đủ model từ mọi
  nhà cung cấp đã kết nối.
- Hermes gọi Advisor tại checkpoint kế hoạch, hướng phục hồi và kết quả cuối.
- Trạng thái bật/tắt tách theo phiên; model Advisor dùng định tuyến riêng.

**Lợi ích:** công việc quan trọng có thêm một lớp kiểm tra mục tiêu và chất
lượng, trong khi tác vụ đơn giản vẫn có thể tắt Advisor để tiết kiệm chi phí.

#### Theo dõi tiến trình mà không lộ suy luận riêng tư

- Trong lúc làm, Hermes hiển thị việc đang thực hiện và lý do vận hành của bước
  đó, ví dụ chuẩn bị công cụ, kiểm tra kết quả hoặc rút gọn ngữ cảnh.
- Khi Advisor được gọi, phiên hiển thị rõ checkpoint và kết luận đạt, cần chỉnh
  sửa hoặc chưa thể đánh giá.
- Dòng tiến trình tự biến mất khi lượt làm việc hoàn tất, bị dừng hoặc lỗi.
- Hermes không trình bày chain-of-thought ẩn; reasoning công khai do provider
  thực sự trả về vẫn được giữ nguyên để người dùng đối chiếu.

**Lợi ích:** người dùng theo kịp tiến trình và học được cách tổ chức công việc,
đồng thời giữ được tính trung thực và quyền riêng tư của suy luận model.

#### Dùng Browser và phiên đăng nhập có kiểm soát

- Browser nhiều tab dùng chung giữa người dùng và agent nhưng nằm riêng trong
  panel phải.
- Hermes Connector cho Chrome/Edge chỉ hoạt động sau khi người dùng chọn domain
  và xác nhận ghép cặp.
- Không chuyển mật khẩu, autofill, lịch sử, bookmark hoặc toàn bộ hồ sơ trình
  duyệt. Cookie nhập vào Electron session riêng và có thể thu hồi.

**Lợi ích:** agent làm việc trên đúng website được phép mà không cần sao chép
toàn bộ hồ sơ trình duyệt của người dùng.

### Tải đúng bản cho máy

| Máy đang dùng           | Tệp cài v31                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Windows x64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Windows-x64-Setup.exe)         |
| Windows 10/11 ARM64     | [Windows ARM64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Windows-arm64-Setup.exe)     |
| Mac chip Apple M-series | [macOS Apple Silicon DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [macOS Intel DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Linux x64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-x64.deb)                     |
| Ubuntu/Debian ARM64     | [Linux ARM64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-arm64.deb)                 |
| Fedora/RHEL x64         | [Linux x64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-x64.rpm)                     |
| Fedora/RHEL ARM64       | [Linux ARM64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-arm64.rpm)                 |
| Linux khác x64          | [Linux x64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-x64.AppImage)           |
| Linux khác ARM64        | [Linux ARM64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-38/Hermes-Vietnamese-Linux-arm64.AppImage)       |

### Quyền riêng tư, chi phí và tình trạng nghiệm thu

- Bản phân phối không kèm tài khoản, model trả phí, API key hoặc hạn mức sử
  dụng. Chi phí phụ thuộc model/provider người dùng chọn.
- Cookie, token và bí mật không được đưa vào artifact hoặc bằng chứng phát hành.
- Tên hiển thị, shortcut và metadata là **Hermes Vietnamese**. App ID, tên tệp
  thực thi nội bộ, giao thức và vùng dữ liệu vẫn giữ nguyên để cài đè nhận đúng
  cấu hình và cuộc trò chuyện hiện có.
- Windows x64: exact-artifact smoke chưa chạy cho candidate này.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 **chưa có smoke
  trên máy người dùng** và chỉ được xem là `BUILD-ONLY-PILOT` nếu công khai.
- Windows chưa Authenticode; dự án đang theo đuổi ký qua SignPath Foundation.
- Dự án chưa tham gia Apple Developer Program; macOS chưa có Developer ID hoặc
  notarization.

### Hỗ trợ và quay lui

- Lỗi và góp ý: [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- Báo cáo bảo mật: [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md)
- Hướng dẫn: [README tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md)
- Mốc quay lui đã diễn tập: [`vi-v0.20.0-14`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và chi phí dịch vụ.
