<p align="center">
  <img src="assets/banner.png" alt="Hermes Agent" width="100%">
</p>

# Hermes Agent tiếng Việt ☤

**Bản địa hóa cộng đồng giúp người Việt không thạo tiếng Anh có thể cài đặt, cấu hình và sử dụng Hermes Agent dễ dàng hơn.**

Đây là một **dự án cá nhân, độc lập**, được thực hiện nhằm hỗ trợ người dùng Việt tiếp cận và sử dụng Hermes Agent thuận tiện hơn.

Dự án đang xin chương trình ký mã miễn phí cho phần mềm mã nguồn mở. Trạng thái hiện tại, phạm vi ký và vai trò phê duyệt được công bố trong [Code signing policy](CODE_SIGNING_POLICY.md). Các bản phát hành hiện tại vẫn chưa được ký số.

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-5"><img src="https://img.shields.io/badge/Bản_thử_nghiệm-Windows_%7C_macOS_%7C_Linux-F97316?style=for-the-badge" alt="Tải bản thử nghiệm đa nền tảng"></a>
  <a href="README.vi.md"><img src="https://img.shields.io/badge/Hướng_dẫn-Tiếng_Việt-DC2626?style=for-the-badge" alt="Hướng dẫn tiếng Việt"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Giấy_phép-MIT-16A34A?style=for-the-badge" alt="Giấy phép MIT"></a>
</p>

## Dự án này dành cho ai?

Dự án dành cho người Việt muốn dùng một AI agent có khả năng làm việc với tệp, dòng lệnh, trình duyệt, bộ nhớ, kỹ năng và lịch tự động, nhưng gặp trở ngại vì giao diện và tài liệu tiếng Anh.

Bản cộng đồng hiện cung cấp:

- Giao diện Desktop mặc định bằng tiếng Việt và nút chuyển nhanh **VI/EN**.
- Bộ cài cho Windows x64/ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64.
- Hướng dẫn tiếng Việt về cài đặt, đăng nhập nhà cung cấp AI, cập nhật và xử lý cảnh báo bảo mật.
- Quy trình đồng bộ thay đổi từ dự án gốc, kiểm thử đa nền tảng và phát hành kèm mã SHA-256.
- Cơ chế đăng nhập bằng tài khoản AI của từng người. Bộ cài không chứa tài khoản, khóa API hoặc dữ liệu của người đóng gói.

- 👉 **[Đọc hướng dẫn và chọn đúng bộ cài](README.vi.md)**
- 👉 **[Tải bản thử nghiệm đa nền tảng](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-5)**
- 👉 **[Báo lỗi hoặc đề xuất bản dịch](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)**

## Hermes có thể làm gì?

Hermes Agent dùng chung một lõi AI agent trên giao diện dòng lệnh, ứng dụng Desktop và các nền tảng nhắn tin. Những khả năng chính từ dự án gốc gồm:

| Khả năng              | Mô tả                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Làm việc với máy tính | Đọc và sửa tệp, chạy lệnh, duyệt web và thực thi mã theo quyền người dùng cấp.               |
| Bộ nhớ và kỹ năng     | Ghi nhớ qua nhiều phiên, tìm lại hội thoại và tạo hoặc cải thiện kỹ năng từ trải nghiệm.     |
| Nhiều nhà cung cấp AI | Hỗ trợ Nous Portal, OpenRouter, OpenAI, Anthropic, Gemini và các điểm cuối tương thích khác. |
| Tự động hóa           | Tạo lịch chạy, giao việc cho AI agent phụ và gửi kết quả tới các kênh được cấu hình.         |
| Nền tảng nhắn tin     | Có thể kết nối Telegram, Discord, Slack, WhatsApp và nhiều nền tảng khác qua Gateway.        |
| Nhiều môi trường chạy | Hỗ trợ máy cá nhân, Docker, SSH và một số môi trường đám mây hoặc máy chủ từ xa.             |

Tài liệu kỹ thuật đầy đủ của dự án gốc nằm tại [hermes-agent.nousresearch.com/docs](https://hermes-agent.nousresearch.com/docs/).

## Cài đặt nhanh

1. **Tải về và cài đặt:** mở [bản thử nghiệm đa nền tảng hiện tại](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-5), chọn đúng gói và chọn English hoặc Tiếng Việt trong trình thiết lập.
2. **Kết nối model:** đăng nhập OAuth, dùng khóa API hoặc kết nối model cục bộ qua điểm cuối tương thích OpenAI.
3. **Bắt đầu giao việc:** xác nhận model mặc định và vào không gian làm việc Hermes đầy đủ, gồm cả Terminal tích hợp.

Người dùng không cần mở Terminal, chạy lệnh hay sửa tệp cấu hình để hoàn tất thiết lập lần đầu. Terminal tích hợp vẫn được giữ nguyên để Hermes và người dùng thực hiện công việc sau khi cài đặt.

Hướng dẫn riêng cho Windows, macOS, Linux, SmartScreen và Gatekeeper được trình bày trong [README tiếng Việt](README.vi.md).

Người chỉ muốn cài Hermes CLI trên Windows có thể dùng trình cài PowerShell của dự án tại [`scripts/install.ps1`](scripts/install.ps1). Người dùng ứng dụng Desktop tiếng Việt nên ưu tiên bộ cài trên trang Bản phát hành để có đúng giao diện và cơ chế cập nhật của bản cộng đồng.

## Tài khoản và chi phí mô hình

Hermes là phần mềm AI agent, không phải một gói mô hình AI miễn phí. Mỗi người tự đăng nhập hoặc cung cấp khóa API của nhà cung cấp mình chọn:

- OpenAI Codex dùng luồng đăng nhập tài khoản ChatGPT được hỗ trợ.
- Claude Pro/Max dùng Claude Code trong phạm vi cầu nối hiện có của bản cộng đồng.
- Claude API là tài khoản tính phí theo mức sử dụng, tách biệt với Claude Pro/Max.
- Gemini dùng khóa API của Google AI Studio; gói Gemini trên web không tự động cấp quyền API.
- Nous Portal, OpenRouter và các nhà cung cấp tương thích khác vẫn có thể được cấu hình theo tài liệu Hermes.

## An toàn và riêng tư

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Bộ cài phát hành không chứa tài khoản, khóa API, mã OAuth hoặc dữ liệu trò chuyện của người đóng gói. Dự án cộng đồng này không vận hành máy chủ tập trung để thu thập thông tin đăng nhập của người dùng.

Khi người dùng chủ động cấu hình hoặc sử dụng một tính năng có kết nối mạng, dữ liệu cần thiết có thể được chuyển tới dịch vụ đã chọn. Các dịch vụ đó có thể gồm nhà cung cấp AI, công cụ web và tìm kiếm, trình duyệt, nền tảng nhắn tin, GitHub và nguồn phụ thuộc công khai. Việc xử lý dữ liệu chịu điều khoản và chính sách quyền riêng tư của từng dịch vụ.

AI agent có thể chạy lệnh và thao tác với tệp trong phạm vi bạn cấp. Hãy đọc yêu cầu quyền trước khi chấp thuận, tránh đưa bí mật vào nội dung công khai và dùng môi trường cách ly cho công việc có rủi ro cao.

Windows và macOS hiện có thể cảnh báo vì bộ cài cộng đồng chưa có chứng thư ký số thương mại. Hãy tải tệp từ trang phát hành của chính kho này và đối chiếu `SHA256SUMS.txt` trước khi cài. Dự án đang ở giai đoạn phát hành sớm; phản hồi thực tế giúp việc hoàn thiện nhanh hơn.

Lỗ hổng thuộc bản dịch, bộ cài hoặc quy trình phát hành của fork nên được báo cáo riêng theo [chính sách bảo mật](SECURITY.md). Không đăng khóa API, mã OAuth hoặc dữ liệu cá nhân trong issue công khai.

## Nguồn gốc và tính minh bạch

Đây là một bản cộng đồng không chính thức, được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của [Nous Research](https://nousresearch.com) theo giấy phép MIT. Dự án này không được Nous Research, OpenAI, Anthropic hoặc Google bảo chứng.

Tên sản phẩm, tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI tạo ra được giữ nguyên khi cần để bảo đảm kỹ thuật. Phần giao diện và hướng dẫn dành cho người dùng được Việt hóa.

Giấy phép, thuật toán, kiến trúc và các tính năng lõi của Hermes vẫn được giữ theo dự án gốc. Bản cộng đồng bổ sung lớp Việt hóa, tài liệu, đóng gói đa nền tảng và các điều chỉnh tương thích cho người dùng Việt. Dự án không thay thế giấy phép gốc và không tuyên bố sở hữu phần lõi của Hermes.

## Miễn trừ trách nhiệm

Hermes được cung cấp theo giấy phép MIT với nguyên trạng phần mềm, không kèm cam kết bảo hành. Dự án cộng đồng không bảo đảm hệ thống luôn hoạt động liên tục, thuật toán hoặc kết quả AI luôn chính xác, hay mọi nhà cung cấp bên thứ ba luôn duy trì tính năng, model và chính sách hiện tại.

Người dùng cần kiểm tra kết quả và quyền được yêu cầu trước khi cho AI agent thực hiện thao tác quan trọng. Bản giải thích tiếng Việt tại [MIỄN TRỪ TRÁCH NHIỆM](DISCLAIMER.md) giúp người dùng hiểu phạm vi áp dụng, không thay thế hoặc sửa đổi [giấy phép MIT gốc](LICENSE).

## Bảo trì và đóng góp

Kho này được duy trì công khai với lịch sử thay đổi, issue, pull request, quy trình build đa nền tảng và bản phát hành có thể kiểm chứng. Trọng tâm bảo trì gồm chất lượng bản dịch, khả năng cài đặt trên ba hệ điều hành, đồng bộ an toàn với Hermes Agent gốc và bảo vệ thông tin đăng nhập của người dùng.

- Xem [phạm vi và trách nhiệm của người duy trì](MAINTAINERS.md).
- Dùng [issue](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) để báo lỗi bản dịch, lỗi cài đặt hoặc đề xuất cải thiện.
- Pull request cần mô tả rõ thay đổi, phạm vi ảnh hưởng và bằng chứng kiểm thử.
- Thay đổi thuộc lõi Hermes nên được đối chiếu với [kho upstream](https://github.com/NousResearch/hermes-agent) để tránh tạo hai cách sửa khác nhau cho cùng một lỗi.

## Giấy phép

MIT, xem [LICENSE](LICENSE). Bản quyền mã nguồn gốc thuộc Nous Research theo thông báo trong giấy phép. Xem thêm [bản giải thích phạm vi và miễn trừ trách nhiệm bằng tiếng Việt](DISCLAIMER.md).
