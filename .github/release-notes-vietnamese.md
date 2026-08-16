## Hermes Vietnamese vi-v0.20.0-25 — bản pilot cộng đồng

Hermes Vietnamese giúp người dùng Việt cài và sử dụng [Hermes Agent](https://github.com/NousResearch/hermes-agent) bằng ứng dụng Desktop, giao diện tiếng Việt và bộ cài có sẵn môi trường chạy. Bạn không cần Git, Terminal hay bộ công cụ lập trình để hoàn tất lần khởi động đầu tiên.

Đây là **community prerelease để dùng thử và cùng cải thiện**, chưa phải bản stable. Windows x64 đã được cài thử bằng chính tệp công khai; các kiến trúc còn lại đã build trên runner native và đang cần phản hồi từ người dùng có máy thật.

### Bản này dành cho ai?

- Người dùng Việt muốn dùng một AI agent có thể làm việc với tệp, trình duyệt, Terminal và nhiều công cụ trong cùng ứng dụng.
- Người muốn giao diện tiếng Việt mặc định nhưng vẫn giữ nguyên tên model, thương hiệu, giao thức và câu lệnh kỹ thuật.
- Người muốn tải bộ cài, mở ứng dụng và làm theo hướng dẫn trên màn hình thay vì tự clone mã nguồn hay cài Python/Node/Git.
- Người sẵn sàng dùng thử bản cộng đồng, sao lưu dữ liệu và gửi phản hồi có đủ bước tái hiện khi gặp lỗi.

Bản pilot này **không phù hợp** nếu bạn cần phần mềm đã ký số, được bảo hành, hỗ trợ thương mại hoặc dùng ngay cho tác vụ quan trọng mà chưa tự kiểm tra kết quả.

### Có gì hơn bản Hermes mặc định?

Phần lõi, kiến trúc và tính năng agent đến từ Hermes Agent của Nous Research. Bản cộng đồng này bổ sung:

- Giao diện tiếng Việt mặc định và nút chuyển nhanh **VI/EN**.
- Bộ cài Desktop cho Windows, macOS và Linux, kèm Python, Node.js, `uv`, dependency và source snapshot cần thiết; lần chạy đầu không phụ thuộc Git hay source chưa công khai.
- Trình thiết lập bằng giao diện để chọn ngôn ngữ, kết nối model và bắt đầu làm việc.
- Danh sách phiên đồng bộ tên tự động; cho phép đổi tên phiên, mở nhiều tab bằng `+` và đóng tab bằng `×` mà không xóa lịch sử.
- Trình duyệt nằm ở panel phải, có tab riêng, tự fit khi panel hẹp và có thể kéo rộng để xem toàn cảnh.
- Trình cập nhật theo đúng kênh `vi-v*` của bản tiếng Việt và giữ dữ liệu người dùng sau khởi động lại/cài lại.
- Quy trình đóng gói, SHA-256, kiểm thử cài đặt và các bản vá tương thích dành riêng cho bản cộng đồng; runtime dùng `cryptography 50.0.0` để đóng ba CVE đã biết của bản khóa cũ.

### Ai phát triển và duy trì?

- **Hermes Agent gốc:** phát triển bởi [Nous Research](https://github.com/NousResearch/hermes-agent) và cộng đồng, phân phối theo giấy phép MIT.
- **Hermes Vietnamese:** dự án cá nhân vì cộng đồng do [Lê Đình Lực (`LucDinhLe`)](https://github.com/LucDinhLe) phát triển và duy trì.

Đây là bản cộng đồng độc lập, **không phải bản phát hành chính thức** của Nous Research, OpenAI, Anthropic hoặc Google. Người duy trì bản tiếng Việt tiếp nhận vấn đề về bản dịch, tài liệu, bộ cài, cập nhật và các điều chỉnh tương thích của fork; lỗi thuộc lõi Hermes sẽ được đối chiếu với upstream để chuyển đúng nơi xử lý.

### Tình trạng nghiệm thu

- **Windows x64: exact-artifact smoke đạt** trên máy Windows 11 vật lý: cài mới với hồ sơ sạch, runtime đóng gói, gateway/onboarding, tạo và đổi tên phiên, tab phiên/trình duyệt, panel phải, restart giữ dữ liệu, repair và gỡ cài đặt giữ/xóa dữ liệu.
- Windows x64 chưa chạy một tool bằng provider thật và chưa kiểm chứng desktop updater từ v14 bằng chính artifact này; hai mục được công khai là giới hạn pilot, không được ghi nhận GO.
- **Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 chưa có smoke trên máy người dùng.** Các gói đã build trên runner native và khớp SHA-256 nhưng vẫn là build-only pilot.
- Bản ổn định/Latest vẫn là `vi-v0.20.0-14`; v25 không tự thay thế bản ổn định.

### Trước khi cài

1. **Bạn cần tài khoản hoặc API key của nhà cung cấp AI do mình chọn.** Bộ cài không kèm tài khoản ChatGPT/Claude/Gemini, không kèm hạn mức trả phí và không nhúng sẵn model AI nặng.
2. Sao lưu dữ liệu Hermes hiện có trước khi thử bản pilot. Không nhập hồ sơ cũ bị lỗi hoặc bản sao không rõ tình trạng.
3. Chọn đúng hệ điều hành và kiến trúc, chỉ tải từ trang release này và đối chiếu `SHA256SUMS.txt`.
4. Windows chưa có Authenticode nên SmartScreen có thể cảnh báo. macOS chưa có Developer ID/notarization nên Gatekeeper có thể chặn. Hãy kiểm tra SHA-256 và làm theo hướng dẫn của hệ điều hành; **không tắt cơ chế bảo vệ trên toàn máy**.
5. Dữ liệu và thông tin đăng nhập được lưu trong hồ sơ trên máy của bạn. Khi bạn dùng một model, trình duyệt hoặc dịch vụ mạng, dữ liệu cần thiết có thể được gửi tới dịch vụ bạn đã chọn theo điều khoản của họ.
6. Không đăng API key, mã OAuth, lịch sử riêng tư hoặc log chưa làm sạch vào issue công khai.

### Chọn đúng tệp

| Máy đang dùng           | Tệp nên tải                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian           | Chọn tệp `.deb` đúng kiến trúc x64 hoặc ARM64                                                                                                                |
| Fedora/RHEL             | Chọn tệp `.rpm` đúng kiến trúc x64 hoặc ARM64                                                                                                                |
| Linux khác              | Chọn tệp `.AppImage` đúng kiến trúc x64 hoặc ARM64                                                                                                           |

Windows 32-bit và Linux ARM 32-bit chưa được đóng gói.

### Mong cộng đồng dùng thử và phản hồi

Bản phát hành này được mở công khai để nhận phản hồi thực tế trước khi hoàn thiện bản stable. Mọi báo lỗi, góp ý bản dịch, đề xuất trải nghiệm cài đặt hoặc xác nhận “chạy tốt trên máy tôi” đều hữu ích.

Vui lòng gửi tại [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) và cho biết:

- Hệ điều hành, phiên bản và kiến trúc máy.
- Tên tệp đã cài và cách bạn tải/cài nó.
- Các bước để tái hiện; điều bạn mong đợi và điều thực tế xảy ra.
- Ảnh chụp hoặc log đã xóa tên riêng, đường dẫn nhạy cảm, API key, OAuth token và nội dung riêng tư.

Đặc biệt mong nhận phản hồi từ người dùng Windows ARM64, Mac Apple Silicon/Intel và Linux x64/ARM64 vì đây là các target đang thiếu smoke trên máy người dùng.

### Bảo mật và chữ ký

- Dự án đã nộp hồ sơ SignPath và đang chờ **SignPath** xét duyệt để ký bản Windows.
- Dự án **chưa tham gia Apple Developer Program**, vì vậy bản macOS chưa được Apple ký hoặc notarize; không có tuyên bố rằng Apple đang xét duyệt bản này.
- Bộ cài không chứa tài khoản, OAuth token, API key, lịch sử trò chuyện hay hồ sơ vận hành của người đóng gói.
- Vấn đề bảo mật không nên đăng công khai; hãy làm theo [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md).

### Miễn trừ trách nhiệm

Phần mềm được cung cấp **theo nguyên trạng**, không kèm bảo hành rõ ràng hoặc ngụ ý, theo giấy phép MIT. Dự án không bảo đảm phần mềm luôn không có lỗi, phù hợp với mọi mục đích, kết quả AI luôn chính xác hoặc dịch vụ/model/giá của bên thứ ba luôn được duy trì.

Bạn chịu trách nhiệm kiểm tra kết quả, quyền đã cấp, chi phí dịch vụ và hậu quả trước khi cho agent thực hiện thao tác quan trọng, gửi dữ liệu, chạy lệnh, sửa hoặc xóa tệp. Trong phạm vi pháp luật cho phép và theo giấy phép MIT, tác giả cùng chủ sở hữu bản quyền không chịu trách nhiệm đối với khiếu nại, thiệt hại hoặc nghĩa vụ phát sinh từ phần mềm hay việc sử dụng phần mềm.

Đọc đầy đủ: [LICENSE](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/LICENSE), [miễn trừ trách nhiệm](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md), [chính sách ký mã](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md) và [hướng dẫn cài đặt tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md).

### Bằng chứng phát hành và quay lui

- [Native staging và đóng gói](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640061)
- [Install/update E2E](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640288)
- [Promotion và hậu kiểm byte công khai](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31931684926)
- Đối chiếu tệp tải về với `SHA256SUMS.txt`; không cài nếu mã không khớp.
- Rollback: quay lại [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).

Các candidate v15–v24 không được công khai. Những lỗi chặn phát hành đã phát hiện ở các candidate này được sửa tại v25 và khóa bằng regression test.
