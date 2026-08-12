<p align="center">
  <img src="assets/banner.png" alt="Hermes Agent" width="100%">
</p>

# Hermes Agent tiếng Việt ☤

**Bản địa hóa cộng đồng giúp người Việt không thạo tiếng Anh có thể cài đặt, cấu hình và sử dụng Hermes Agent dễ dàng hơn.**

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-5"><img src="https://img.shields.io/badge/Bản_thử_nghiệm-Windows_%7C_macOS_%7C_Linux-F97316?style=for-the-badge" alt="Tải bản thử nghiệm đa nền tảng"></a>
  <a href="README.vi.md"><img src="https://img.shields.io/badge/Hướng_dẫn-Tiếng_Việt-DC2626?style=for-the-badge" alt="Hướng dẫn tiếng Việt"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Giấy_phép-MIT-16A34A?style=for-the-badge" alt="Giấy phép MIT"></a>
</p>

## Dự án này dành cho ai?

Dự án dành cho người Việt muốn dùng một AI agent có khả năng làm việc với tệp, dòng lệnh, trình duyệt, bộ nhớ, kỹ năng và lịch tự động, nhưng gặp trở ngại vì giao diện và tài liệu tiếng Anh.

Bản cộng đồng hiện cung cấp:

- Giao diện Desktop mặc định bằng tiếng Việt và nút chuyển nhanh **VI/EN**.
- Bộ cài cho Windows x64/ARM64, macOS Apple Silicon và Linux x64/ARM64.
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

1. Mở [bản thử nghiệm đa nền tảng hiện tại](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-5).
2. Chọn tệp đúng với hệ điều hành và kiến trúc máy.
3. Đối chiếu mã SHA-256 nếu hệ điều hành hiện cảnh báo.
4. Cài ứng dụng, chọn nhà cung cấp mô hình rồi đăng nhập bằng tài khoản của bạn.

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

AI agent có thể chạy lệnh và thao tác với tệp trong phạm vi bạn cấp. Hãy đọc yêu cầu quyền trước khi chấp thuận, tránh đưa bí mật vào nội dung công khai và dùng môi trường cách ly cho công việc có rủi ro cao.

Windows và macOS hiện có thể cảnh báo vì bộ cài cộng đồng chưa có chứng thư ký số thương mại. Hãy tải tệp từ trang phát hành của chính kho này và đối chiếu `SHA256SUMS.txt` trước khi cài. Dự án đang ở giai đoạn phát hành sớm; phản hồi thực tế giúp việc hoàn thiện nhanh hơn.

Lỗ hổng thuộc bản dịch, bộ cài hoặc quy trình phát hành của fork nên được báo cáo riêng theo [chính sách bảo mật](SECURITY.md). Không đăng khóa API, mã OAuth hoặc dữ liệu cá nhân trong issue công khai.

## Nguồn gốc và tính minh bạch

Đây là một bản cộng đồng không chính thức, được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của [Nous Research](https://nousresearch.com) theo giấy phép MIT. Dự án này không được Nous Research, OpenAI, Anthropic hoặc Google bảo chứng.

Tên sản phẩm, tên model, thương hiệu, giao thức, câu lệnh và nội dung do AI tạo ra được giữ nguyên khi cần để bảo đảm kỹ thuật. Phần giao diện và hướng dẫn dành cho người dùng được Việt hóa.

## Bảo trì và đóng góp

Kho này được duy trì công khai với lịch sử thay đổi, issue, pull request, quy trình build đa nền tảng và bản phát hành có thể kiểm chứng. Trọng tâm bảo trì gồm chất lượng bản dịch, khả năng cài đặt trên ba hệ điều hành, đồng bộ an toàn với Hermes Agent gốc và bảo vệ thông tin đăng nhập của người dùng.

- Xem [phạm vi và trách nhiệm của người duy trì](MAINTAINERS.md).
- Dùng [issue](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) để báo lỗi bản dịch, lỗi cài đặt hoặc đề xuất cải thiện.
- Pull request cần mô tả rõ thay đổi, phạm vi ảnh hưởng và bằng chứng kiểm thử.
- Thay đổi thuộc lõi Hermes nên được đối chiếu với [kho upstream](https://github.com/NousResearch/hermes-agent) để tránh tạo hai cách sửa khác nhau cho cùng một lỗi.

## Giấy phép

MIT, xem [LICENSE](LICENSE). Bản quyền mã nguồn gốc thuộc Nous Research theo thông báo trong giấy phép.
