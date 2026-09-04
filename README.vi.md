# Hướng dẫn cài đặt và kết nối Hermes Vietnamese

<!-- current-release:start -->
**Latest hiện tại là [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2), chỉ dành cho Windows x64.** Bản community pilot chưa ký số, chưa phải stable; cập nhật thủ công bằng bộ cài đầy đủ.

- [Hermes-2026.9.2-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-2026.9.2-win-x64.exe).
- [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-Vietnamese-Windows-x64-Setup.exe), cùng nội dung với tên tương thích cũ. Chỉ chạy một bộ cài.
- [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/SHA256SUMS.txt).

Hai tệp `.exe` đều có kích thước **252118156 byte**, SHA-256:

```text
1ae55b4a3280e92d4a297f85d81cbb6bcc0a19170da8d9122755d19f40c43015
```
<!-- current-release:end -->

## Kiểm tra máy có phù hợp không

Trên Windows, mở **Cài đặt → Hệ thống → Giới thiệu**, xem **Loại hệ thống**. Đợt này có bộ cài Windows x64; máy ARM64 và hệ điều hành 32-bit không nằm trong phạm vi đã nghiệm thu. Các lượt kiểm thử tự động chạy trên Windows x64 của GitHub; không có cam kết đã thử mọi bản Windows hoặc mọi chính sách máy cơ quan.

2026.9.2 chưa có gói macOS/Linux/Windows ARM64. [vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18) là bản lịch sử, không phải Latest. Windows ARM64/Linux cũ chỉ có bằng chứng build. macOS cũ chưa đạt yêu cầu tin cậy cho người dùng thường; không khuyến nghị vượt Gatekeeper để cài.

## Cài nhanh trong ba bước

### 1. Tải và cài ứng dụng

1. Tải một bộ cài ở đầu trang và đối chiếu mã SHA-256.
2. Nếu đang dùng Hermes, thực hiện phần [cập nhật và sao lưu](#cập-nhật-sao-lưu-và-gỡ-cài-đặt) trước.
3. Mở bộ cài và làm theo hướng dẫn. Cài mới có thể chọn phạm vi một người dùng hoặc toàn máy; nâng cấp giữ phạm vi và vị trí đã có. Cài toàn máy có thể yêu cầu quyền quản trị Windows.
4. Mở Hermes, chọn ngôn ngữ nếu được hỏi và chờ chuẩn bị lõi đóng gói sẵn.

Python 3.12.10 và thư viện bắt buộc đã ở trong bộ cài. Bạn không cần tự cài môi trường lập trình hoặc tải `install.ps1` để khởi động lõi. Internet vẫn cần cho tải bộ cài, xác thực, dịch vụ AI và một số công cụ tùy chọn.

Nếu Windows/Edge cảnh báo, đọc [hướng dẫn bằng hình ảnh](docs/cai-dat-windows-bang-anh.md). Không tắt Defender, SmartScreen hoặc chính sách bảo mật toàn máy.

### 2. Kết nối model

Chọn nhà cung cấp tại màn kết nối hoặc **Cài đặt → Model/Nhà cung cấp**. Dùng tài khoản hoặc khóa của chính bạn. Nếu chưa muốn kết nối, chọn bỏ qua khi giao diện cho phép và cấu hình sau.

### 3. Thử một phiên mới

Chọn model trong ô nhập, bấm dấu `+` ở thanh tab, gửi một yêu cầu đơn giản. Khi đã nhận trả lời, đóng/mở lại và kiểm tra phiên còn trong danh sách. Không thử lần đầu bằng thao tác xóa tệp, giao dịch hoặc công việc quan trọng.

## Kết nối ChatGPT, Claude và Gemini

### ChatGPT qua OpenAI OAuth

Chọn **OpenAI OAuth (ChatGPT)**, hoàn tất xác thực trong trình duyệt rồi quay lại Hermes. Tài khoản phải có quyền sử dụng qua kết nối tương ứng. Làm theo hướng dẫn bảo mật của OpenAI nếu xác thực bị từ chối.

Đăng nhập thành công chỉ xác nhận tài khoản, không bảo đảm mọi model đều khả dụng. Quyền và mã model qua Codex, OpenAI API hay một gateway khác có thể khác nhau. Không tự đổi dấu chấm/gạch nối trong mã model để đoán tên.

### Claude Pro/Max qua Claude Code

Chọn **Claude Pro / Max (qua Claude Code)** và làm theo luồng xác thực. Chọn model mà tài khoản và cầu nối thực tế hỗ trợ. Danh mục có thể thay đổi; bản phát hành không mở khóa model ngoài quyền được cấp.

Cầu nối này khác Anthropic API key. Không coi gói Claude web là hạn mức API. Nếu giao diện báo điều kiện Claude Code hoặc Extra Usage chưa được xác minh, xử lý điều kiện đó trước; không nhập khóa API để vượt lỗi khi chưa muốn dùng API tính phí riêng.

### Google Gemini bằng khóa API

1. Tạo khóa của chính bạn tại [Google AI Studio](https://aistudio.google.com/apikey).
2. Chọn **Google Gemini (khóa API)** trong Hermes.
3. Nhập khóa, kết nối và chọn model được dự án API cho phép.

Hermes hỗ trợ đường Gemini API; việc người khác dùng được Gemini không chứng minh một tài khoản/model khác sẽ dùng được. Gói Gemini trên web và quyền API cần được kiểm tra riêng. Google Vertex AI là lựa chọn nâng cao cho người đã cấu hình dự án Google Cloud. Bản này không hướng dẫn nhập lại mã OAuth Gemini CLI vào Hermes.

### Nhà cung cấp khác và model cục bộ

Dùng danh mục nhà cung cấp của đúng bản đã cài. Mỗi kết nối có yêu cầu tài khoản, hạn mức và điều khoản riêng. Với model cục bộ hoặc điểm cuối tương thích, bạn phải chuẩn bị máy chủ model; bộ cài không chứa sẵn model AI.

## Xử lý lỗi kết nối thường gặp

### HTTP 404 model, bao gồm Luna

- Kiểm tra model ở **ô nhập của phiên** và nhà cung cấp/gateway đang chọn.
- Tên model ở thanh **Advisor** có thể khác model trả lời chính; đổi Advisor không tự đổi model của phiên.
- Làm mới danh sách model hoặc chọn model được kết nối đó xác nhận hỗ trợ. `404` có thể do sai mã, định tuyến hoặc thiếu quyền; chỉ ảnh lỗi chưa đủ để chọn một nguyên nhân chắc chắn.
- Không đăng khóa API, mã OAuth hay toàn bộ cấu hình để nhờ hỗ trợ.

### Advisor hỏi lại thông tin đã có trong ảnh

Kiểm tra ảnh đã đính kèm thành công và thử trong một phiên mới. Bản này có sửa ngữ cảnh ảnh cho Advisor, nhưng kết quả vẫn phụ thuộc model và kết nối. Nếu lỗi lặp lại, gửi ảnh đã che dữ liệu riêng cùng bước tái hiện.

### Bấm dấu cộng không tạo được phiên

Kiểm tra phiên bản đang chạy, đóng/mở lại đúng ứng dụng sau nâng cấp và chờ gateway kết nối. 2026.9.2 đã qua phép thử ba tab mới và gửi tin trên bộ cài thực tế. Nếu lỗi còn xảy ra, ghi rõ phiên bản, nguồn gateway và ảnh thanh tab; không xóa lịch sử để thử chữa lỗi.

### Khóa API hoặc xác thực bị từ chối

Kiểm tra đúng tài khoản/dự án, khóa còn hiệu lực, quyền model và hạn mức. Làm theo thông báo của nhà cung cấp. Không dùng mật khẩu web làm API key và không chia sẻ khóa lên Issues.

### Lỗi tải install.ps1 hoặc cảnh báo runtime không khớp

Xác nhận đang chạy đúng bản 2026.9.2 từ đường dẫn cài hiện tại, không mở nhầm lối tắt Experimental cũ. Lõi của bộ cài này đã được đóng gói sẵn. Nếu vẫn gặp lỗi, giữ nguyên dữ liệu, chụp thông báo và lấy nhật ký đã loại bí mật; không tự cập nhật checkout lõi hoặc xóa runtime để làm mất bằng chứng.

## Trạng thái ký số và cảnh báo khi cài

2026.9.2 chưa ký số, Authenticode `NotSigned`. Dự án đang hoàn thiện để nộp lại hồ sơ ký số; chưa có xác nhận chấp thuận hay chữ ký mới trong đợt này. Xem [chính sách ký mã](CODE_SIGNING_POLICY.md).

Chỉ cân nhắc tiếp tục qua cảnh báo uy tín khi nguồn tải và SHA-256 khớp. Mã băm xác nhận đúng tệp đã công bố, không bảo đảm phần mềm không có lỗi. Nếu Defender phát hiện mối đe dọa cụ thể hoặc máy cơ quan chặn bằng chính sách, dừng và liên hệ người quản trị. Không tắt bảo vệ toàn máy.

## Cập nhật, sao lưu và gỡ cài đặt

### Cập nhật

1. Chờ công việc kết thúc, sao lưu theo [hướng dẫn](docs/sao-luu-khoi-phuc.md), kiểm tra bản sao đọc được.
2. Đóng Hermes và dừng gateway/bot nền theo cách đang vận hành. Đóng cửa sổ chưa chắc dừng mọi công việc nền.
3. Tải bộ cài từ [Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest), kiểm tra mã rồi cài đè. Không chọn gỡ toàn bộ dữ liệu.
4. Mở lại, kiểm tra phiên bản, lịch sử và kết nối. Khởi động lại gateway/bot đã tạm dừng khi sẵn sàng.

Cài đè giữ dữ liệu theo thiết kế và đã được kiểm thử trên hồ sơ cô lập. Vẫn cần bản sao lưu cho dữ liệu thật. Nếu có lỗi, giữ nhật ký và dùng bản sao đã xác minh để phục hồi; bản quay lui Windows x64 là `vi-v0.32.1-18`. Không khôi phục đè khi chưa sao lưu dữ liệu mới hơn.

Đợt pilot này không có luồng tự cập nhật hoặc tệp `latest*.yml`. Tải bằng bộ cài đầy đủ; không dùng `git pull` hay cập nhật lõi riêng để thay phiên bản ứng dụng.

### Sao lưu

Mở **Trung tâm chỉ huy → Bảo trì → Tạo bản sao lưu**, chờ hoàn tất rồi kiểm tra tệp. Nếu không thấy mục này hoặc ứng dụng không mở, xem cách sao lưu thư mục thủ công trong [hướng dẫn sao lưu](docs/sao-luu-khoi-phuc.md). Bản sao có thể chứa thông tin xác thực, cần giữ riêng tư.

### Gỡ cài đặt

- **Chỉ gỡ ứng dụng** bằng trình gỡ Windows giữ thư mục dữ liệu.
- **Gỡ GUI + agent, giữ dữ liệu** trong Hermes loại ứng dụng/runtime, giữ dữ liệu người dùng để cài lại.
- **Gỡ toàn bộ** xóa cả vùng dữ liệu đã chọn. Chỉ dùng khi đã đọc cảnh báo, kiểm tra sao lưu và thực sự muốn xóa.

## Phiên bản và nguồn gốc

Quy ước **năm.tháng.lần cập nhật trong tháng** bắt đầu với 2026.9.2; phần cuối không phải ngày. [Tag v2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/v2026.9.2) là mã nguồn chính xác của bộ cài. Nhánh main hiện cập nhật tài liệu nhưng chưa hợp nhất toàn bộ mã sản phẩm calendar.

## Riêng tư và hỗ trợ

Hermes Vietnamese là dự án cá nhân độc lập của [Lê Đình Lực](https://github.com/LucDinhLe), dựa trên Hermes Agent của Nous Research theo [MIT](LICENSE). Bộ cài không mang tài khoản, khóa hay lịch sử của người đóng gói. Dịch vụ AI và công cụ mạng bạn dùng có chính sách dữ liệu riêng.

Xem [miễn trừ và quyền riêng tư](DISCLAIMER.md), [báo bảo mật](SECURITY.md), [báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues). Khi báo lỗi, ghi bản đang chạy, hệ điều hành, kiến trúc, bước tái hiện và ảnh đã che thông tin cá nhân. Phần mềm được cung cấp theo nguyên trạng, chưa có bảo hành thương mại.
