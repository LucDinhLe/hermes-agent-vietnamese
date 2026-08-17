## Hermes Vietnamese vi-v0.20.0-25 — bản pilot cộng đồng

Hermes Vietnamese là bản cộng đồng đa nền tảng của [Hermes Agent](https://github.com/NousResearch/hermes-agent), được điều chỉnh để người dùng Việt có thể tải bộ cài, mở ứng dụng và làm theo hướng dẫn trên màn hình. Giao diện tiếng Việt được bật mặc định, có nút chuyển nhanh VI/EN; tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI sinh ra vẫn được giữ nguyên.

Đây là dự án cá nhân, độc lập, nhằm giúp người dùng Việt tiếp cận Hermes thuận tiện hơn. Phần lõi, kiến trúc và giấy phép đến từ dự án gốc; bản tiếng Việt bổ sung trải nghiệm Desktop, bộ cài, bootstrap, cập nhật, bản địa hóa và các bản vá tương thích cho người dùng phổ thông.

> **Đây là bản pilot cộng đồng và là bản tải mặc định/Latest, chưa phải bản stable.** Windows x64 đã được cài thử bằng chính tệp đang công khai. Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 đã build trên runner native nhưng chưa được smoke trên máy người dùng thật. [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14) được giữ nguyên làm bản quay lui.

### Bản này dành cho ai?

- Người dùng Việt muốn một AI agent có thể trò chuyện, làm việc với tệp, chạy lệnh và duyệt web trong cùng một ứng dụng.
- Người không muốn tự clone mã nguồn, cài Python, Node.js, Git hoặc dùng Terminal để hoàn tất lần khởi động đầu tiên.
- Người muốn giao diện tiếng Việt nhưng vẫn giữ nguyên các tên model và giá trị kỹ thuật để dễ đối chiếu với tài liệu quốc tế.
- Người sẵn sàng thử nghiệm một bản cộng đồng, sao lưu dữ liệu và gửi phản hồi khi gặp lỗi.

Bản pilot này chưa phù hợp cho tác vụ quan trọng nếu bạn cần phần mềm đã ký số, bảo hành, hỗ trợ thương mại hoặc bằng chứng nghiệm thu đầy đủ trên đúng loại máy của mình.

> **Dùng Windows và gặp cảnh báo khi tải/cài?** Xem [hướng dẫn từng bước bằng hình ảnh](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/docs/cai-dat-windows-bang-anh.md). Hãy phân biệt cảnh báo uy tín do tệp chưa ký với cảnh báo phát hiện mối đe dọa thực sự; không tắt cơ chế bảo vệ trên toàn máy.

### Chọn đúng tệp

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

Windows 32-bit và Linux ARM 32-bit chưa được đóng gói.

### Kiểm tra máy trước khi tải

- **Windows:** nhấn Windows + I → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. “x64-based processor” chọn x64; “ARM-based processor” chọn ARM64.
- **macOS:** mở ** → About This Mac/Giới thiệu về máy Mac**. Máy cần macOS 12 trở lên. Chip Apple M chọn Apple Silicon; chip Intel chọn bản Intel.
- **Linux:** mở **Settings → About**. “x86_64/amd64” chọn x64; “aarch64/arm64” chọn ARM64.

Xem thêm [hướng dẫn kiểm tra máy và chọn bộ cài](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

### Có gì hơn bản Hermes mặc định?

- Giao diện tiếng Việt mặc định và chuyển nhanh VI/EN.
- Bộ cài Desktop cho Windows, macOS và Linux có sẵn Python, Node.js, uv, dependency và source snapshot thiết yếu; lần chạy đầu không phụ thuộc Git hoặc source chưa công khai.
- Trình thiết lập bằng giao diện để chọn ngôn ngữ, kết nối model và bắt đầu làm việc.
- Quy trình đóng gói đa kiến trúc, kiểm tra SHA-256, bootstrap, repair, uninstall và kênh cập nhật vi-v dành riêng cho bản cộng đồng.
- Các điều chỉnh UI cho cách làm việc nhiều phiên, trình duyệt bên phải và trải nghiệm người dùng Việt.

### Cải thiện trong bản v25

- Khôi phục tên phiên được tạo tự động ở danh sách bên trái và cho phép đổi tên phiên bền vững, không còn lỗi 500 do phiên đã chuyển lineage sau nén.
- Giữ thanh tab nhiều phiên ở vùng giữa; nút **+** mở tab mới và nút **×** đóng tab hiện tại mà không xóa phiên khỏi lịch sử.
- Thêm nhiều tab trình duyệt trong panel phải, mỗi tab giữ trạng thái riêng; đóng tab trình duyệt cuối sẽ trở về vùng Tệp.
- Cho panel phải kéo rộng hơn và tự fit toàn cảnh trang web khi panel hẹp.
- Bỏ dòng chữ **Hệ thống tệp** thừa ở đầu panel nhưng vẫn giữ biểu tượng Tệp và nhãn trợ năng.
- Sửa tiêu đề giữ chỗ để hiển thị **Phiên mới** đúng theo ngôn ngữ giao diện.
- Sửa bootstrap để bản đóng gói không phụ thuộc Git, nhánh, tag động hoặc source chưa công khai.
- Sửa updater của fork để dùng đúng kênh vi-v và chuyển remote chính thức từ SSH sang HTTPS khi cần. Tuy nhiên, cập nhật Desktop từ v14 bằng chính artifact v25 vẫn là cổng chưa được kiểm chứng.
- Bổ sung repair/uninstall an toàn và sửa DB WAL cũ bằng hermes doctor khi Hermes đã dừng.
- Nâng runtime lên **cryptography 50.0.0**, loại phiên bản bị ảnh hưởng bởi ba CVE đã biết trong khóa cũ.
- Không kèm lịch sử, hồ sơ, tài khoản, OAuth token, API key hoặc dữ liệu vận hành của người đóng gói.

### Trước khi cài và kết nối model

1. Bạn cần tài khoản hoặc API key của nhà cung cấp AI do mình chọn. Bộ cài không kèm tài khoản ChatGPT, Claude hoặc Gemini, không kèm hạn mức trả phí và không nhúng sẵn model AI nặng.
2. Sao lưu dữ liệu Hermes hiện có trước khi thử bản pilot. Không nhập hồ sơ cũ bị lỗi hoặc bản sao không rõ tình trạng.
3. Chỉ tải từ trang phát hành chính thức này và đối chiếu tệp với [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-25/SHA256SUMS.txt).
4. Thông tin đăng nhập và dữ liệu của mỗi người được lưu trong hồ sơ trên máy của mình. Khi bạn chủ động dùng một model, trình duyệt hoặc dịch vụ mạng, dữ liệu cần thiết có thể được gửi tới dịch vụ đã chọn theo điều khoản và chính sách của họ.
5. Không đăng API key, mã OAuth, lịch sử riêng tư hoặc log chưa làm sạch vào issue công khai.

### Tình trạng kiểm thử

- **Windows x64:** exact-artifact smoke đạt trên máy Windows 11 vật lý: cài mới bằng hồ sơ sạch, runtime đóng gói, gateway/onboarding, tạo và đổi tên phiên, tab phiên/trình duyệt, panel phải, khởi động lại giữ dữ liệu, repair và gỡ cài đặt giữ/xóa dữ liệu.
- **Còn thiếu trên Windows x64:** chưa chạy một tool bằng provider thật và chưa kiểm chứng cập nhật Desktop từ v14 bằng chính artifact v25.
- **Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64:** đã build trên runner native và khớp SHA-256 nhưng chưa có smoke trên máy người dùng; được công bố theo phạm vi build-only pilot để xin phản hồi.

### Ai phát triển và duy trì?

- **Hermes Agent gốc:** do [Nous Research](https://github.com/NousResearch/hermes-agent) và cộng đồng phát triển, phân phối theo giấy phép MIT.
- **Hermes Vietnamese:** dự án cá nhân vì cộng đồng do [Lê Đình Lực (LucDinhLe)](https://github.com/LucDinhLe) phát triển và duy trì.

Đây là bản cộng đồng độc lập, không phải bản phát hành chính thức của Nous Research, OpenAI, Anthropic hoặc Google. Người duy trì bản tiếng Việt tiếp nhận vấn đề về bản dịch, tài liệu, bộ cài, cập nhật và điều chỉnh tương thích; lỗi thuộc lõi Hermes sẽ được đối chiếu với upstream để chuyển đúng nơi xử lý.

### Bảo mật và chữ ký

- Dự án đã nộp hồ sơ tham gia chương trình ký mã nguồn mở của **SignPath Foundation** và đang chờ SignPath xét duyệt để ký bản Windows.
- Windows chưa có Authenticode nên SmartScreen hoặc Application Control có thể cảnh báo/chặn.
- Dự án chưa tham gia Apple Developer Program; bản macOS chưa có Developer ID hoặc notarization và có thể bị Gatekeeper cảnh báo/chặn. Không có tuyên bố rằng Apple đang xét duyệt bản này.
- Chữ ký số giúp xác minh nguồn phát hành; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp.
- Vấn đề bảo mật không nên đăng công khai; hãy làm theo [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md).

### Mong cộng đồng dùng thử và phản hồi

Bản pilot được công khai để nhận phản hồi thực tế trước khi hoàn thiện bản stable. Báo lỗi, góp ý bản dịch, đề xuất trải nghiệm cài đặt hoặc xác nhận “chạy tốt trên máy tôi” đều giúp dự án cải thiện.

Vui lòng gửi tại [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) và cho biết:

- Hệ điều hành, phiên bản và kiến trúc máy.
- Tên tệp đã cài.
- Các bước tái hiện, kết quả mong đợi và kết quả thực tế.
- Ảnh chụp hoặc log đã xóa tên riêng, đường dẫn nhạy cảm, API key, OAuth token và nội dung riêng tư.

Đặc biệt mong nhận phản hồi từ người dùng Windows ARM64, Mac Apple Silicon/Intel và Linux x64/ARM64 vì đây là các target đang thiếu smoke trên máy người dùng.

### Miễn trừ trách nhiệm

Phần mềm được cung cấp **theo nguyên trạng**, không kèm bảo hành rõ ràng hoặc ngụ ý, theo giấy phép MIT. Dự án không bảo đảm phần mềm luôn không có lỗi, phù hợp với mọi mục đích, kết quả AI luôn chính xác hoặc dịch vụ, model và giá của bên thứ ba luôn được duy trì.

Bạn chịu trách nhiệm kiểm tra kết quả, quyền đã cấp, chi phí dịch vụ và hậu quả trước khi cho agent thực hiện thao tác quan trọng, gửi dữ liệu, chạy lệnh, sửa hoặc xóa tệp. Trong phạm vi pháp luật cho phép và theo giấy phép MIT, tác giả cùng chủ sở hữu bản quyền không chịu trách nhiệm đối với khiếu nại, thiệt hại hoặc nghĩa vụ phát sinh từ phần mềm hay việc sử dụng phần mềm.

Đọc đầy đủ: [LICENSE](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/LICENSE), [miễn trừ trách nhiệm](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/DISCLAIMER.md), [chính sách ký mã](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/CODE_SIGNING_POLICY.md) và [hướng dẫn cài đặt tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md).

### Bằng chứng phát hành và quay lui

- [Native staging và đóng gói](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640061)
- [Install/update E2E](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640288)
- [Promotion và hậu kiểm byte công khai](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31931684926)
- Rollback: quay lại [vi-v0.20.0-14](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-14).

Các candidate v15–v24 không được công khai. Những lỗi chặn phát hành phát hiện ở các candidate này đã được sửa tại v25 và khóa bằng regression test.
