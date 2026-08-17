## Hermes Vietnamese vi-v0.20.0-25 — bản pilot cộng đồng

Hermes Vietnamese được tạo ra để người Việt có thể cài Hermes Agent như một ứng dụng thông thường, kết nối model của mình và bắt đầu giao việc mà không phải tự dựng môi trường lập trình. Hermes có thể trò chuyện, làm việc với tệp, chạy lệnh, dùng trình duyệt, ghi nhớ qua nhiều phiên, học kỹ năng và chạy tác vụ theo lịch. Đường cài từ mã nguồn của dự án gốc phù hợp với người kỹ thuật nhưng Git, Python, Node.js, dependency, dòng lệnh và tài liệu tiếng Anh vẫn là rào cản với nhiều người dùng phổ thông.

Bản cộng đồng đóng gói phần lõi đó thành trải nghiệm Desktop Việt/Anh có hướng dẫn rõ từ lúc tải về tới phiên làm việc đầu tiên. Dự án phục vụ người dùng cá nhân, người làm nội dung, đào tạo, nghiên cứu, vận hành và các nhóm nhỏ muốn thử một AI agent có thể thao tác trên máy dưới quyền kiểm soát của chính họ.

Dự án được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của Nous Research theo [giấy phép MIT](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/LICENSE), do [Lê Đình Lực](https://github.com/LucDinhLe) phát triển và duy trì như một dự án cá nhân vì cộng đồng. Đây là bản phân phối độc lập, không phải bản phát hành chính thức của Nous Research, OpenAI, Anthropic, Google, Microsoft hoặc Apple.

> **Đây là bản pilot cộng đồng và là bản tải mặc định/Latest, chưa phải bản stable.** Windows x64 đã được cài thử bằng chính tệp đang công khai. Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 đã build trên runner native nhưng chưa được smoke trên máy người dùng thật. [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14) được giữ nguyên làm bản quay lui.

### Bản này dành cho ai?

- Người muốn dùng AI agent bằng giao diện tiếng Việt và vẫn có thể chuyển nhanh sang English.
- Người muốn cài bằng giao diện, không phải tự clone mã nguồn hoặc chuẩn bị công cụ lập trình.
- Người cần làm việc với hội thoại, tệp, Terminal, trình duyệt, bộ nhớ, kỹ năng và nhiều phiên trong cùng một ứng dụng.
- Người có tài khoản ChatGPT, Claude Pro/Max, khóa API Gemini hoặc một nhà cung cấp AI khác và muốn tự chọn model phù hợp.
- Người chấp nhận thử bản cộng đồng, sao lưu dữ liệu và phản hồi lỗi để dự án được hoàn thiện.

Bản pilot chưa phù hợp với công việc trọng yếu cần phần mềm đã ký số, hỗ trợ thương mại, bảo hành hoặc bằng chứng nghiệm thu đầy đủ trên đúng loại máy đang dùng.

### Điểm mạnh so với cách tự cài Hermes Agent từ mã nguồn

| Nhu cầu                         | Hermes Vietnamese bổ sung                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cài như ứng dụng thông thường   | Bộ cài có giao diện cho Windows, macOS và Linux; người dùng phổ thông không phải tự cài Git, Python, Node.js hoặc chạy lệnh để hoàn tất lần đầu.                             |
| Bắt đầu bằng tiếng Việt         | Giao diện tiếng Việt mặc định, chuyển nhanh VI/EN; tên model, thương hiệu và giá trị kỹ thuật vẫn giữ nguyên để dễ đối chiếu tài liệu quốc tế.                               |
| Đi từ cài đặt tới giao việc     | Quy trình ba bước gồm chọn ngôn ngữ, chuẩn bị Hermes, kết nối model; có hướng dẫn riêng cho ChatGPT, Claude, Gemini, API key và model cục bộ.                                |
| Làm nhiều việc trong một cửa sổ | Tab nhiều phiên có nút `+`/`×`, danh sách phiên, Terminal tích hợp, vùng Tệp và nhiều tab Trình duyệt dùng chung trong panel phải.                                           |
| Giảm lỗi do môi trường máy      | Runtime thiết yếu, source snapshot và dependency của đúng bản phát hành được đóng gói hoặc khóa; lần chạy đầu không phụ thuộc một nhánh Git động hoặc source chưa công khai. |
| Dễ kiểm tra và phục hồi         | Có SHA-256 cho artifact, luồng repair, lựa chọn giữ/xóa dữ liệu khi gỡ cài đặt, hướng dẫn sao lưu và kênh cập nhật `vi-v*` riêng.                                            |
| Giữ năng lực lõi Hermes         | Vẫn dùng hệ thống model, công cụ, bộ nhớ, kỹ năng, lịch chạy, AI agent phụ và Gateway của dự án gốc.                                                                         |

Hermes Vietnamese không tặng kèm model AI, tài khoản trả phí, API key hoặc hạn mức sử dụng.

### 1. Kiểm tra máy và chọn đúng tệp

- **Windows:** nhấn Windows + I → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. `x64-based processor` chọn x64; `ARM-based processor` chọn ARM64.
- **macOS:** mở ** → About This Mac/Giới thiệu về máy Mac**. Máy cần macOS 12 trở lên. Chip Apple M chọn Apple Silicon; chip Intel chọn bản Intel.
- **Linux:** mở **Settings → About**. `x86_64/amd64` chọn x64; `aarch64/arm64` chọn ARM64.

| Máy đang dùng           | Tải trực tiếp                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Gói DEB x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.deb)                          |
| Ubuntu/Debian ARM64     | [Gói DEB ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.deb)                      |
| Fedora/RHEL x64         | [Gói RPM x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.rpm)                          |
| Fedora/RHEL ARM64       | [Gói RPM ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.rpm)                      |
| Linux khác x64          | [AppImage x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-x64.AppImage)                    |
| Linux khác ARM64        | [AppImage ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Linux-arm64.AppImage)                |

Windows 32-bit và Linux ARM 32-bit chưa được đóng gói. Hướng dẫn chi tiết nằm tại [README tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

### 2. Cài đặt và xử lý cảnh báo trên Windows

Bộ cài đang chờ xét duyệt ký số nên Microsoft Edge có thể báo tệp chưa được tải xuống phổ biến và hiện `Publisher: Unknown`. Chỉ tiếp tục khi đường tải thuộc kho này, tên tệp đúng với máy và SHA-256 khớp [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/SHA256SUMS.txt).

| 1. Bấm See more                                                                                                                                                                          | 2. Chọn Keep trong menu tải xuống                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Edge báo Hermes chưa được tải xuống phổ biến](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-warning-see-more-v25.jpg)      | ![Menu tải xuống của Edge có lựa chọn Keep](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-download-menu-keep-v25.jpg) |
| **3. Kiểm tra tên tệp và nguồn tải**                                                                                                                                                     | **4. Mở mũi tên và chọn Keep anyway**                                                                                                                                             |
| ![Edge hiện Publisher Unknown vì bộ cài chưa ký số](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-publisher-unknown-v25.jpg) | ![Edge hiện lựa chọn Keep anyway](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/main/docs/assets/windows-install/edge-keep-anyway-v25.jpg)                  |

Các phiên bản Edge có thể bỏ qua một màn hình. Nếu tệp bị tải lặp và tên có thêm `(1)` hoặc `(2)`, hãy xác nhận bằng SHA-256. Không cần chọn **Report this app as safe**. Nếu Microsoft Defender nêu tên một mối đe dọa cụ thể, hãy dừng cài đặt và gửi báo cáo; không tắt Defender, SmartScreen hoặc chính sách bảo mật của toàn máy.

Xem từng bước tại [Cài Windows bằng hình ảnh](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/docs/cai-dat-windows-bang-anh.md). Trên macOS, mở DMG đúng kiến trúc và kéo ứng dụng vào Applications. Trên Linux, ưu tiên `.deb` cho Ubuntu/Debian, `.rpm` cho Fedora/RHEL hoặc AppImage cho bản phân phối khác.

### 3. Hoàn tất thiết lập và kết nối model

1. Mở Hermes, chọn **Tiếng Việt** hoặc **English**.
2. Chọn cài Hermes trên máy và giữ kết nối Internet trong lúc ứng dụng chuẩn bị runtime.
3. Tại **Kết nối model**, chọn đường phù hợp:
   - **OpenAI OAuth (ChatGPT):** đăng nhập tài khoản ChatGPT có quyền dùng Codex.
   - **Claude Pro / Max:** đăng nhập qua Claude Code.
   - **Google Gemini:** nhập khóa API tạo tại Google AI Studio.
   - **Nhà cung cấp khác:** nhập tài khoản, API key hoặc endpoint tương ứng.
4. Chọn model, tạo phiên đầu tiên và giao một việc thử không quan trọng.

Gói ChatGPT, Claude hoặc Gemini trên web không tự động trở thành hạn mức API của mọi nhà cung cấp. Mỗi dịch vụ có tài khoản, giới hạn và cách tính phí riêng. Nếu chưa có kết nối, chọn **Tôi sẽ chọn nhà cung cấp sau**, rồi mở **Cài đặt → Model/Nhà cung cấp** để cấu hình.

### Dữ liệu và quyền của agent

Thông tin đăng nhập và dữ liệu của mỗi người được lưu trong hồ sơ trên máy của mình. Bộ cài không chứa tài khoản, OAuth token, API key, lịch sử hoặc dữ liệu của người đóng gói. Khi bạn dùng model, trình duyệt hoặc dịch vụ mạng, dữ liệu cần thiết có thể được gửi tới dịch vụ đã chọn theo điều khoản của họ.

Hermes có thể chạy lệnh và sửa tệp trong phạm vi được cấp. Hãy bắt đầu bằng tác vụ nhỏ, đọc yêu cầu quyền và kiểm tra kết quả trước khi cho agent thao tác với dữ liệu quan trọng. Không đăng API key, mã OAuth, bản sao lưu hoặc log chưa làm sạch vào issue công khai.

### Tình trạng kiểm thử

- **Windows x64:** exact-artifact smoke đạt trên máy Windows 11 vật lý với cài mới bằng hồ sơ sạch, runtime đóng gói, gateway/onboarding, tạo và đổi tên phiên, tab phiên/trình duyệt, panel phải, khởi động lại giữ dữ liệu, repair và gỡ cài đặt giữ/xóa dữ liệu.
- **Còn thiếu trên Windows x64:** chưa chạy một tool bằng provider thật và chưa kiểm chứng cập nhật Desktop từ v14 bằng chính artifact v25.
- **Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64:** đã build trên runner native và khớp SHA-256 nhưng chưa có smoke trên máy người dùng; được công bố theo phạm vi build-only pilot để xin phản hồi.

### Bảo mật và chữ ký

- Dự án đã nộp hồ sơ tham gia chương trình ký mã nguồn mở của **SignPath Foundation** và đang chờ SignPath xét duyệt để ký bản Windows.
- Windows chưa có Authenticode nên SmartScreen hoặc Application Control có thể cảnh báo hoặc chặn.
- Dự án chưa tham gia Apple Developer Program; bản macOS chưa có Developer ID hoặc notarization và có thể bị Gatekeeper cảnh báo hoặc chặn. Apple không ở trạng thái xét duyệt bản này.
- Chữ ký số giúp xác minh nguồn phát hành; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp.
- Vấn đề bảo mật cần được gửi theo [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md), không đăng công khai.

### Mong cộng đồng dùng thử và phản hồi

Bản pilot được công khai để nhận phản hồi thực tế. Báo lỗi, góp ý bản dịch, đề xuất trải nghiệm cài đặt hoặc xác nhận “chạy tốt trên máy tôi” đều giúp dự án cải thiện.

Vui lòng gửi tại [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) và cho biết:

- Hệ điều hành, phiên bản và kiến trúc máy.
- Tên tệp đã cài.
- Các bước tái hiện, kết quả mong đợi và kết quả thực tế.
- Ảnh chụp hoặc log đã xóa tên riêng, đường dẫn nhạy cảm, API key, OAuth token và nội dung riêng tư.

Đặc biệt mong nhận phản hồi từ người dùng Windows ARM64, Mac Apple Silicon/Intel và Linux x64/ARM64 vì các target này đang thiếu smoke trên máy người dùng.

### Miễn trừ trách nhiệm

Phần mềm được cung cấp **theo nguyên trạng**, không kèm bảo hành rõ ràng hoặc ngụ ý, theo giấy phép MIT. Dự án không bảo đảm phần mềm luôn không có lỗi, phù hợp với mọi mục đích, kết quả AI luôn chính xác hoặc dịch vụ, model và giá của bên thứ ba luôn được duy trì.

Bạn chịu trách nhiệm kiểm tra kết quả, quyền đã cấp, chi phí dịch vụ và hậu quả trước khi cho agent thực hiện thao tác quan trọng, gửi dữ liệu, chạy lệnh, sửa hoặc xóa tệp. Trong phạm vi pháp luật cho phép và theo giấy phép MIT, tác giả cùng chủ sở hữu bản quyền không chịu trách nhiệm đối với khiếu nại, thiệt hại hoặc nghĩa vụ phát sinh từ phần mềm hay việc sử dụng phần mềm.

Đọc đầy đủ [LICENSE](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/LICENSE), [miễn trừ trách nhiệm](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md), [chính sách ký mã](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md) và [hướng dẫn cài đặt tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md).

### Bằng chứng phát hành và quay lui

- [Native staging và đóng gói](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640061)
- [Install/update E2E](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640288)
- [Promotion và hậu kiểm byte công khai](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31931684926)
- Rollback: quay lại [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).

Các candidate v15–v24 không được công khai.
