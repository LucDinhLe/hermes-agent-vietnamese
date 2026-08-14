<p align="center">
  <img src="assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

# Hermes Vietnamese

**Bản cộng đồng giúp người Việt cài đặt, kết nối model và sử dụng Hermes Agent dễ dàng hơn, kể cả khi không thạo tiếng Anh.**

Hermes là một AI agent có thể làm việc với tệp, dòng lệnh, trình duyệt, bộ nhớ, kỹ năng và lịch tự động. Bản này bổ sung giao diện Việt/Anh, quy trình thiết lập ba bước và bộ cài cho Windows, macOS, Linux. Không gian làm việc, Terminal tích hợp, thuật toán và tính năng lõi của Hermes vẫn được giữ theo dự án gốc.

Đây là **dự án cá nhân vì cộng đồng** do [Lê Đình Lực](https://github.com/LucDinhLe) duy trì, phát triển từ Hermes Agent theo giấy phép MIT. Người dùng kết nối bằng tài khoản hoặc API key do từng dịch vụ cung cấp; dự án này tập trung vào Việt hóa, đóng gói và giúp người Việt thực hiện việc đó dễ dàng hơn.

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-12"><img src="https://img.shields.io/badge/Tải_bản_vi--v0.20.0--12-Windows_%7C_macOS_%7C_Linux-F97316?style=for-the-badge" alt="Tải Hermes Vietnamese"></a>
  <a href="README.vi.md"><img src="https://img.shields.io/badge/Hướng_dẫn-Cài_đặt_%26_kết_nối-DC2626?style=for-the-badge" alt="Hướng dẫn cài đặt và kết nối"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Giấy_phép-MIT-16A34A?style=for-the-badge" alt="Giấy phép MIT"></a>
</p>

## Từ tải về đến giao việc trong ba bước

### Bước 1. Tải về và cài đặt

Mở [trang phát hành vi-v0.20.0-12](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-12), chọn đúng tệp cho máy và chạy bộ cài. Trong lần mở đầu tiên:

1. Chọn **Tiếng Việt** hoặc **English**.
2. Chọn cài Hermes trên máy.
3. Chờ ứng dụng chuẩn bị môi trường chạy.

Người dùng không cần mở Terminal, chạy lệnh hay sửa tệp cấu hình. Lần cài đầu cần Internet và có thể mất vài phút vì Hermes phải tải môi trường chạy cùng các thành phần cần thiết.

Người dùng kỹ thuật có thể xem mã trình cài Windows tại [`scripts/install.ps1`](scripts/install.ps1); cài đặt bằng giao diện không yêu cầu tự chạy tệp này.

| Máy đang dùng                | Tải trực tiếp                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11, chip x64      | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Windows-x64-Setup.exe)           |
| Windows 10/11, chip ARM64    | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Windows-arm64-Setup.exe)       |
| Mac dùng chip Apple M-series | [Bộ cài macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac dùng chip Intel          | [Bộ cài macOS Intel](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64            | [Gói Linux x64 `.deb`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-x64.deb)                 |
| Ubuntu/Debian ARM64          | [Gói Linux ARM64 `.deb`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-arm64.deb)             |
| Fedora/RHEL x64              | [Gói Linux x64 `.rpm`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-x64.rpm)                 |
| Fedora/RHEL ARM64            | [Gói Linux ARM64 `.rpm`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-arm64.rpm)             |
| Linux khác x64               | [Gói Linux x64 `.AppImage`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-x64.AppImage)       |
| Linux khác ARM64             | [Gói Linux ARM64 `.AppImage`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.20.0-12/Hermes-Vietnamese-Linux-arm64.AppImage)   |

### Kiểm tra máy trước khi tải

- **Windows:** nhấn `Windows + I` → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. Dòng **Loại hệ thống** ghi `x64-based processor` thì tải x64; ghi `ARM-based processor` thì tải ARM64.
- **macOS:** mở menu ** → About This Mac/Giới thiệu về máy Mac**. Máy cần macOS 12 trở lên. Dòng **Chip** bắt đầu bằng `Apple M` thì tải Apple Silicon; dòng **Processor** ghi `Intel` thì tải bản Intel.
- **Linux:** mở **Settings → About** để xem kiến trúc. `x86_64` tương ứng x64; `aarch64` hoặc `arm64` tương ứng ARM64. Nếu giao diện không hiển thị, có thể chạy `uname -m` trong Terminal.

Xem thêm [hướng dẫn kiểm tra cấu hình, cài đặt và xử lý SmartScreen/Gatekeeper](README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

### Bước 2. Kết nối model

Màn **Kết nối model** hiện ngay ba lựa chọn phổ biến, theo thứ tự dễ hiểu:

1. **OpenAI OAuth (ChatGPT)** dùng tài khoản ChatGPT của bạn.
2. **Claude Pro / Max (qua Claude Code)** dùng tài khoản Claude Pro hoặc Max của bạn.
3. **Google Gemini (khóa API)** dùng khóa tạo tại Google AI Studio.

Ngay bên dưới là toàn bộ kết nối tài khoản và khóa API mà bản Hermes đang cài hỗ trợ. Danh sách tự lấy từ lõi Hermes nên các nhà cung cấp mới sẽ xuất hiện mà không cần sửa riêng giao diện tiếng Việt. Bạn cũng có thể chọn **Tôi sẽ chọn nhà cung cấp sau** để vào ứng dụng trước.

| Lựa chọn          | Bạn cần có                                       | Cách tính phí                                                                                  |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| ChatGPT OAuth     | Tài khoản ChatGPT có quyền dùng Codex            | Theo gói và giới hạn của tài khoản ChatGPT                                                     |
| Claude Pro / Max  | Gói Claude Pro hoặc Max và đăng nhập Claude Code | Dùng quyền lợi gói Claude; cầu nối từ chối Extra Usage để tránh chuyển sang mức dùng tính thêm |
| Google Gemini     | Khóa API Google AI Studio                        | Theo hạn mức miễn phí hoặc thanh toán API của Google AI Studio                                 |
| Anthropic API     | Khóa API Anthropic                               | Tính phí API riêng, không dùng chung gói Claude Pro/Max                                        |
| Nhà cung cấp khác | Tài khoản hoặc khóa tương ứng                    | Theo chính sách của dịch vụ bạn chọn                                                           |

Hermes không tặng kèm gói model trả phí. Mỗi người tự đăng nhập tài khoản hoặc nhập khóa API của mình. Gemini dùng Google AI Studio API key hoặc Google Vertex AI; Hermes không dùng OAuth của Gemini CLI vì [điều khoản Gemini CLI không cho phần mềm bên thứ ba dùng lại dịch vụ qua OAuth này](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md). Xem thao tác từng bước tại [Kết nối ChatGPT, Claude và Gemini](README.vi.md#kết-nối-chatgpt-claude-và-gemini).

### Bước 3. Bắt đầu giao việc

Chọn model mặc định rồi giao một mục tiêu bằng tiếng Việt hoặc ngôn ngữ bạn muốn. Sau thiết lập, Hermes mở không gian làm việc đầy đủ với:

- Hội thoại và tác vụ nhiều bước.
- Đọc, tạo và chỉnh sửa tệp theo quyền được cấp.
- Terminal tích hợp, công cụ trình duyệt, kỹ năng và bộ nhớ.
- AI agent phụ, lịch chạy và kết nối nền tảng nhắn tin khi được cấu hình.

## Hermes có thể làm gì?

| Khả năng              | Mô tả                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Làm việc với máy tính | Đọc và sửa tệp, chạy lệnh, duyệt web và thực thi mã theo quyền người dùng cấp.                                                |
| Bộ nhớ và kỹ năng     | Ghi nhớ qua nhiều phiên, tìm lại hội thoại và tạo hoặc cải thiện kỹ năng từ trải nghiệm.                                      |
| Nhiều nhà cung cấp AI | Kết nối ChatGPT, Claude Pro/Max, Gemini API, Nous Portal, OpenRouter, Bedrock, Vertex AI và nhiều điểm cuối tương thích khác. |
| Tự động hóa           | Tạo lịch chạy, giao việc cho AI agent phụ và gửi kết quả tới các kênh đã cấu hình.                                            |
| Nền tảng nhắn tin     | Có thể kết nối Telegram, Discord, Slack, WhatsApp và các nền tảng khác qua Gateway.                                           |
| Nhiều môi trường chạy | Hỗ trợ máy cá nhân, Docker, SSH và một số môi trường máy chủ từ xa.                                                           |

Tài liệu kỹ thuật đầy đủ của dự án gốc nằm tại [hermes-agent.nousresearch.com/docs](https://hermes-agent.nousresearch.com/docs/).

## Riêng tư và dữ liệu đăng nhập

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Bộ cài không chứa tài khoản, khóa API, mã OAuth hoặc lịch sử trò chuyện của người đóng gói. Dự án này không vận hành máy chủ tập trung để thu thập thông tin đăng nhập của người dùng.

Khi bạn gửi yêu cầu tới một nhà cung cấp AI hoặc dịch vụ mạng, nội dung cần thiết sẽ được dịch vụ đã chọn xử lý theo điều khoản và chính sách quyền riêng tư của họ. AI agent có thể chạy lệnh và thao tác với tệp trong phạm vi được cấp, vì vậy hãy đọc yêu cầu quyền trước khi chấp thuận và kiểm tra kết quả trước các thao tác quan trọng.

## Trạng thái ký số của bộ cài

Dự án **đã nộp hồ sơ và đang chờ xét duyệt** chương trình ký mã miễn phí dành cho phần mềm mã nguồn mở của SignPath Foundation. Trong thời gian chờ, các bản phát hành hiện tại chưa có chữ ký số xác minh nhà phát hành, nên Windows SmartScreen hoặc macOS Gatekeeper có thể cảnh báo.

Đây là trạng thái kỹ thuật tạm thời trong quá trình hoàn thiện ký số, không có nghĩa Microsoft hoặc Apple đã từ chối dự án hay phần mềm không được phép cài. Chứng thư ký mã dùng để xác minh nguồn phát hành; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp.

Chỉ tải từ [trang phát hành chính thức của kho này](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases) và đối chiếu mã trong `SHA256SUMS.txt` trước khi cài. Không tắt cơ chế bảo mật của hệ điều hành trên toàn máy. Xem [chính sách ký mã](CODE_SIGNING_POLICY.md) và [hướng dẫn xử lý cảnh báo](README.vi.md#trạng-thái-ký-số-và-cảnh-báo-khi-cài).

## Cập nhật và giữ phần tiếng Việt

Bản cộng đồng nhận cập nhật từ kho `LucDinhLe/hermes-agent-vietnamese`. Thay đổi từ Hermes Agent gốc được rà soát, kiểm thử rồi đồng bộ vào nhánh này để hạn chế làm mất lớp Việt hóa và các điều chỉnh tương thích.

Tài khoản, cấu hình, phiên làm việc và bộ nhớ nằm trong thư mục dữ liệu người dùng, tách khỏi tệp ứng dụng. Cập nhật bộ cài không chủ động xóa dữ liệu đó. Bạn vẫn nên sao lưu trước thay đổi lớn hoặc khi chuyển máy.

## Nguồn gốc, giấy phép và miễn trừ

Dự án được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của [Nous Research](https://nousresearch.com) theo giấy phép MIT. Giấy phép, kiến trúc, thuật toán và tính năng lõi vẫn thuộc phạm vi của dự án gốc. Bản cộng đồng bổ sung lớp Việt hóa, tài liệu, đóng gói đa nền tảng và một số điều chỉnh tương thích cho người dùng Việt.

Phần mềm được cung cấp theo nguyên trạng, không kèm cam kết bảo hành. Kết quả AI có thể sai; dịch vụ bên thứ ba có thể thay đổi model, giới hạn hoặc chính sách. Người dùng chịu trách nhiệm kiểm tra kết quả và quyền đã cấp. Xem [LICENSE](LICENSE) và [miễn trừ trách nhiệm bằng tiếng Việt](DISCLAIMER.md).

## Báo lỗi và đóng góp

- [Báo lỗi cài đặt, kết nối hoặc bản dịch](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- [Đọc hướng dẫn đầy đủ bằng tiếng Việt](README.vi.md)
- [Xem phạm vi bảo trì](MAINTAINERS.md)
- Báo cáo vấn đề bảo mật theo [SECURITY.md](SECURITY.md). Không đăng khóa API, mã OAuth hoặc dữ liệu cá nhân trong issue công khai.
