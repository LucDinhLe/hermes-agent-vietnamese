## Hermes Vietnamese vi-v0.20.4-35 — v29 cho công việc AI dài hơi

Hermes Vietnamese v29 là bản Desktop độc lập của
[Hermes Agent](https://github.com/NousResearch/hermes-agent), do
[Lê Đình Lực (LucDinhLe)](https://github.com/LucDinhLe) phát triển cho cộng
đồng theo giấy phép MIT. Sản phẩm dùng lõi Hermes Agent 0.20.4 và bổ sung một
đường cài đặt, giao diện cùng quy trình làm việc phù hợp hơn cho người dùng
không muốn tự dựng Hermes từ mã nguồn.

> **Lớp phát hành: community prerelease, không phải stable.** Windows và macOS
> hiện chưa ký số/công chứng đầy đủ. Hãy tải đúng kho phát hành chính thức và
> kiểm SHA-256 trước khi cài.

### Hermes Vietnamese có gì hơn bản Hermes mặc định?

#### Cài xong là có môi trường Desktop để làm việc

- Bộ cài mang theo runtime và payload Hermes cần thiết; người dùng không phải tự
  chuẩn bị Git, Python, Node.js hay ghép dependency để mở ứng dụng lần đầu.
- Có màn hình thiết lập bằng tiếng Việt, kết nối model/tài khoản và kiểm tra
  trạng thái dịch vụ ngay trong ứng dụng.
- Cơ chế sửa chữa, gỡ giao diện nhưng giữ dữ liệu, hoặc gỡ toàn bộ được tách rõ
  để người dùng chủ động quyết định với dữ liệu của mình.

**Lợi ích:** giảm đáng kể lỗi cài đặt và thời gian chuẩn bị; người mới có thể tập
trung vào công việc thay vì vận hành một môi trường lập trình.

#### Không gian làm việc nhiều phiên, nhiều dự án

- Nhiều phiên có thể mở thành tab hoặc chia panel để đối chiếu song song.
- Browser nhiều tab nằm trong panel phải và dùng chung giữa người dùng với
  agent; panel Tệp, Browser và Terminal vẫn tách khỏi vùng hội thoại.
- Panel trái có **Dự án đã ghim**. Người dùng ghim/bỏ ghim và kéo thả sắp xếp
  các dự án quan trọng mà không di chuyển hay sao chép thư mục thật.
- Danh sách ghim được cách ly theo từng kết nối Hermes.

**Lợi ích:** quản lý công việc theo dự án thay vì tìm lại từng cuộc trò chuyện;
chuyển ngữ cảnh nhanh và giữ bố cục phù hợp với cách làm việc của mỗi người.

#### Advisor giám sát chất lượng theo từng phiên

- Advisor là một model độc lập, chỉ đọc, không có công cụ và không trực tiếp sửa
  tệp, thao tác Browser, Terminal hay trả lời thay model làm việc.
- Hermes có thể nhờ Advisor rà kế hoạch, hướng phục hồi khi lặp lỗi và kết quả
  cuối; số vòng yêu cầu chỉnh sửa được giới hạn để tránh lặp vô hạn.
- Công tắc Advisor nằm ngay dưới đầu từng phiên trong panel giữa, tự thu gọn khi
  người dùng kéo hẹp panel và không lấn sang panel phải.
- Mỗi phiên có trạng thái Advisor riêng; model Advisor vẫn được chọn tập trung
  trong **Cài đặt → Model**. Khi tắt, đường Advisor tạo zero model call.

**Lợi ích:** công việc dài hoặc quan trọng có thêm một lớp phản biện độc lập,
trong khi tác vụ đơn giản vẫn có thể tắt để tiết kiệm thời gian và chi phí.

#### Tóm tắt suy luận công khai bằng tiếng Việt

- Hermes chỉ tóm tắt phần reasoning công khai thực sự được model/provider trả
  về; không cố truy xuất chain-of-thought ẩn hay encrypted thinking.
- Reasoning gốc và câu trả lời được giữ nguyên để đối chiếu. Bản tiếng Việt nằm
  ở panel riêng và ghi rõ model/provider thực hiện.
- Tính năng mặc định tắt và không tạo model call khi tắt.

**Lợi ích:** người dùng dễ kiểm tra cách agent đi đến kết quả mà không đánh đổi
khả năng đối chiếu với nội dung gốc.

#### Dùng phiên đăng nhập website trong Browser Hermes có kiểm soát

- Hermes Connector chính chủ cho Chrome/Edge chỉ hoạt động sau khi người dùng
  bật tính năng, chọn domain, cấp quyền host tùy chọn và xác nhận ở cả hai phía.
- Ghép cặp dùng mã một lần trên loopback, có thời hạn và chống replay.
- Màn hình consent cho biết hostname, số cookie và thời hạn trước khi nhập.
- Cookie chỉ đi vào Electron session `persist:hermes-preview`; ledger thu hồi
  chỉ giữ metadata cần thiết, không lưu giá trị cookie. Có thể thu hồi đúng các
  cookie đã nhập và rollback nếu import lỗi.
- Không chuyển mật khẩu, autofill, lịch sử, bookmark, localStorage hoặc toàn bộ
  hồ sơ trình duyệt. Cookie partitioned/CHIPS bị bỏ qua nếu không thể bảo toàn
  partition key an toàn.

**Lợi ích:** agent có thể làm việc trên đúng website người dùng cho phép mà
không cần quét hoặc sao chép toàn bộ hồ sơ Chrome/Edge.

#### Cập nhật cộng đồng thuận tiện và giữ nguyên dữ liệu

- Hermes kiểm tra các GitHub Release cộng đồng đã công khai, chọn manifest đúng
  hệ điều hành rồi ghim vào URL release bất biến.
- Trên Windows, cập nhật dùng bộ cài đầy đủ đã nghiệm thu, cài yên lặng và mở lại
  ứng dụng. Danh tính ứng dụng cùng vùng dữ liệu được giữ ổn định nên cấu hình,
  bí mật, cuộc trò chuyện, lịch định kỳ và trạng thái onboarding không chuyển
  sang vùng mới.

**Lợi ích:** từ v29 trở đi, người dùng có thể cập nhật ngay trong Hermes thay vì
lặp lại trải nghiệm cài lần đầu cho mỗi bản mới.

### Tải đúng bản cho máy

| Máy đang dùng           | Tệp cài v29                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Windows x64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Windows-x64-Setup.exe)         |
| Windows 10/11 ARM64     | [Windows ARM64 Setup](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Windows-arm64-Setup.exe)     |
| Mac chip Apple M-series | [macOS Apple Silicon DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [macOS Intel DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Linux x64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-x64.deb)                     |
| Ubuntu/Debian ARM64     | [Linux ARM64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-arm64.deb)                 |
| Fedora/RHEL x64         | [Linux x64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-x64.rpm)                     |
| Fedora/RHEL ARM64       | [Linux ARM64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-arm64.rpm)                 |
| Linux khác x64          | [Linux x64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-x64.AppImage)           |
| Linux khác ARM64        | [Linux ARM64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.4-35/Hermes-Vietnamese-Linux-arm64.AppImage)       |

Người dùng v28 cần tải và chạy bộ cài v29 thủ công một lần vì v28 chưa đọc được
manifest cập nhật cộng đồng. Sau khi đã ở v29, các bản kế tiếp có thể đi qua
**Cài đặt → Giới thiệu → Cập nhật ngay**.

### Quyền riêng tư và chi phí

- Bản phân phối không kèm model, tài khoản trả phí, API key hoặc hạn mức sử
  dụng. Chi phí và chính sách dữ liệu phụ thuộc model/provider người dùng chọn.
- Cookie/token không được ghi vào log, crash evidence, analytics hay file trung
  gian dạng rõ.
- Hermes có thể chạy lệnh, sửa tệp và gửi dữ liệu tới model/dịch vụ đã kết nối.
  Hãy thử bằng dữ liệu không nhạy cảm trước và chỉ cấp quyền cần thiết.

### Tình trạng nghiệm thu

- Sáu target phải được dựng trên runner native và đối chiếu toàn bộ manifest,
  provenance cùng SHA-256 trước khi draft được tạo.
- Windows x64: exact-artifact smoke chưa chạy cho candidate này.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 hiện **chưa có
  smoke trên máy người dùng**; nếu công khai, chúng mang trạng thái
  `BUILD-ONLY-PILOT`.
- Windows community prerelease chưa ký Authenticode; dự án đang theo đuổi hướng
  ký qua SignPath Foundation. SmartScreen hoặc chính sách doanh nghiệp có thể
  cảnh báo/chặn.
- Dự án chưa tham gia Apple Developer Program; macOS chưa có Developer ID hoặc
  notarization và có thể bị Gatekeeper cảnh báo/chặn.
- SHA-256 giúp xác minh byte tải về nhưng không thay thế chữ ký số.

### Hỗ trợ, bảo mật và quay lui

- Lỗi và góp ý: [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- Báo cáo bảo mật: [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md)
- Hướng dẫn: [README tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md)
- Mốc quay lui đã diễn tập: [`vi-v0.20.0-14`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và chi phí dịch vụ.
