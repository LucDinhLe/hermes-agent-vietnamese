# Hướng dẫn cài đặt và kết nối Hermes Vietnamese

<!-- current-release:start -->
**Latest hiện tại là [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2), chỉ dành cho Windows x64.** Bản community pilot chưa ký số, chưa phải stable. Cập nhật thủ công bằng bộ cài đầy đủ, không có cập nhật tự động nền.

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

2026.9.2 chưa có bộ cài macOS, Linux hoặc Windows ARM64. Chỉ dùng bộ cài phù hợp với máy và không vượt cơ chế bảo vệ của hệ điều hành để thử một gói không được hỗ trợ.

## Cài nhanh trong ba bước

### 1. Tải và cài ứng dụng

1. Tải một bộ cài ở đầu trang và đối chiếu mã SHA-256.
2. Nếu đang dùng Hermes, thực hiện phần [cập nhật và sao lưu](#cập-nhật-sao-lưu-và-gỡ-cài-đặt) trước.
3. Mở bộ cài và làm theo hướng dẫn. Cài mới có thể chọn phạm vi một người dùng hoặc toàn máy. Cài toàn máy có thể yêu cầu quyền quản trị Windows.
4. Mở Hermes, chọn ngôn ngữ nếu được hỏi và chờ chuẩn bị lõi đóng gói sẵn.

Bản này dùng mã sản phẩm và thư mục dữ liệu riêng với các bản Hermes cũ, nên cài song song thay vì ghi đè; lối tắt "Hermes Vietnamese" có thể thay tên lối tắt cũ, nhưng bản cũ vẫn còn nguyên trong danh sách Ứng dụng và vẫn mở được. Lần mở đầu tiên, nếu máy có dữ liệu Hermes cũ, ứng dụng hỏi "Nhập dữ liệu từ bản Hermes cũ?" rồi sao chép (không xóa hay di chuyển) cấu hình, phiên làm việc, trí nhớ, kỹ năng và các thiết lập khác sang thư mục mới. Bản cũ giữ nguyên nên luôn dùng được để quay lại nếu cần.

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

### Google (tài khoản Google)

1. Mở **Cài đặt → Tài khoản**, chọn dòng **Google (tài khoản Google)**.
2. Hoàn tất đăng nhập Google trong trình duyệt hiện ra.
3. Trong Hermes, lựa chọn này xuất hiện dưới tên điểm cuối riêng `google-account` với các model gemini-2.5-pro (mặc định), gemini-2.5-flash, gemini-3-pro-preview, gemini-3-flash-preview, gemini-3.1-pro-preview, gemini-3.1-flash-lite, gemini-3.5-flash.

Lựa chọn này đi qua cùng cửa xác thực với Gemini CLI (công cụ dòng lệnh mã nguồn mở của Google, giấy phép Apache-2.0). Trình duyệt mở ra để đăng nhập Google, sau đó Hermes gọi Gemini qua Google Cloud Code Assist bằng gói/hạn mức Google của chính bạn. Đây không phải nhà cung cấp chính thức của Hermes; Google có thể thay đổi hoặc đóng cửa này bất cứ lúc nào, bạn tự chấp nhận rủi ro đó khi bật lựa chọn. Mã đăng nhập được lưu ở dạng mã hóa (qua keychain hệ điều hành) trong thư mục dữ liệu của ứng dụng. Khóa API Gemini ở mục trên vẫn là lối được hỗ trợ đầy đủ.

### Nhà cung cấp khác và model cục bộ

Dùng danh mục nhà cung cấp của đúng bản đã cài. Mỗi kết nối có yêu cầu tài khoản, hạn mức và điều khoản riêng. Với model cục bộ hoặc điểm cuối tương thích, bạn phải chuẩn bị máy chủ model; bộ cài không chứa sẵn model AI.

## Xử lý lỗi kết nối thường gặp

### HTTP 404 model, bao gồm Luna

- Kiểm tra model ở **ô nhập của phiên** và nhà cung cấp/gateway đang chọn.
- Làm mới danh sách model hoặc chọn model được kết nối đó xác nhận hỗ trợ. `404` có thể do sai mã, định tuyến hoặc thiếu quyền; chỉ ảnh lỗi chưa đủ để chọn một nguyên nhân chắc chắn.
- Không đăng khóa API, mã OAuth hay toàn bộ cấu hình để nhờ hỗ trợ.

### Đọc ảnh đính kèm không ra đúng nội dung

Kiểm tra ảnh đã đính kèm thành công và thử trong một phiên mới. Kết quả đọc ảnh phụ thuộc model và kết nối. Nếu lỗi lặp lại, gửi ảnh đã che dữ liệu riêng cùng bước tái hiện.

### Bấm dấu cộng không tạo được phiên

Kiểm tra phiên bản đang chạy, đóng/mở lại đúng ứng dụng sau nâng cấp và chờ gateway kết nối. Nếu lỗi còn xảy ra, ghi rõ phiên bản, nguồn gateway và ảnh thanh tab; không xóa lịch sử để thử chữa lỗi.

### Khóa API hoặc xác thực bị từ chối

Kiểm tra đúng tài khoản/dự án, khóa còn hiệu lực, quyền model và hạn mức. Làm theo thông báo của nhà cung cấp. Không dùng mật khẩu web làm API key và không chia sẻ khóa lên Issues.

### Lỗi tải install.ps1 hoặc cảnh báo runtime không khớp

Xác nhận đang chạy đúng bản 2026.9.2 từ đường dẫn cài hiện tại, không mở nhầm lối tắt Experimental cũ. Lõi của bộ cài này đã được đóng gói sẵn. Nếu vẫn gặp lỗi, giữ nguyên dữ liệu, chụp thông báo và lấy nhật ký đã loại bí mật; không tự cập nhật checkout lõi hoặc xóa runtime để làm mất bằng chứng.

## Trạng thái ký số và cảnh báo khi cài

2026.9.2 chưa ký số nên Windows có thể hiển thị nhà phát hành chưa xác định hoặc cảnh báo uy tín. Xem [chính sách ký mã](CODE_SIGNING_POLICY.md).

Chỉ cân nhắc tiếp tục qua cảnh báo uy tín khi nguồn tải và SHA-256 khớp. Mã băm xác nhận đúng tệp đã công bố, không bảo đảm phần mềm không có lỗi. Nếu Defender phát hiện mối đe dọa cụ thể hoặc máy cơ quan chặn bằng chính sách, dừng và liên hệ người quản trị. Không tắt bảo vệ toàn máy.

## Cập nhật, sao lưu và gỡ cài đặt

### Cập nhật

1. Chờ công việc kết thúc, sao lưu theo [hướng dẫn](docs/sao-luu-khoi-phuc.md), kiểm tra bản sao đọc được.
2. Đóng Hermes và dừng gateway/bot nền theo cách đang vận hành. Đóng cửa sổ chưa chắc dừng mọi công việc nền.
3. Tải bộ cài từ [Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest), kiểm tra mã rồi cài đè. Không chọn gỡ toàn bộ dữ liệu.
4. Mở lại, kiểm tra phiên bản, lịch sử và kết nối. Khởi động lại gateway/bot đã tạm dừng khi sẵn sàng.

Cài đè giữ dữ liệu theo thiết kế và đã được kiểm thử trên hồ sơ cô lập. Vẫn cần bản sao lưu cho dữ liệu thật. Nếu có lỗi, giữ nhật ký và dùng bản sao đã xác minh để phục hồi; bản quay lui Windows x64 là `vi-v0.32.1-18`. Không khôi phục đè khi chưa sao lưu dữ liệu mới hơn.

Đợt pilot này không có luồng tự tải hay tự cài. Ứng dụng chỉ tự kiểm tra bản mới mỗi ngày (hoặc bấm "Kiểm tra ngay" trong mục Giới thiệu) và báo tên tệp, kích thước, mã SHA-256 kèm nút mở trang tải; việc tải và chạy bộ cài vẫn do bạn tự thực hiện. Bản cũ hơn dùng cơ chế kiểm tra khác nên có thể không thấy được thông báo này; nếu vậy, hãy tự vào trang phát hành để tải bản mới. Không dùng `git pull` hay cập nhật lõi riêng để thay phiên bản ứng dụng.

### Sao lưu

Mở **Trung tâm chỉ huy → Bảo trì → Tạo bản sao lưu**, chờ hoàn tất rồi kiểm tra tệp. Nếu không thấy mục này hoặc ứng dụng không mở, xem cách sao lưu thư mục thủ công trong [hướng dẫn sao lưu](docs/sao-luu-khoi-phuc.md). Bản sao có thể chứa thông tin xác thực, cần giữ riêng tư.

### Gỡ cài đặt

- **Chỉ gỡ ứng dụng** bằng trình gỡ Windows giữ thư mục dữ liệu.
- **Gỡ GUI + agent, giữ dữ liệu** trong Hermes loại ứng dụng/runtime, giữ dữ liệu người dùng để cài lại.
- **Gỡ toàn bộ** xóa cả vùng dữ liệu đã chọn. Chỉ dùng khi đã đọc cảnh báo, kiểm tra sao lưu và thực sự muốn xóa.

Vì bản này dùng thư mục dữ liệu riêng với các bản Hermes cũ, gỡ bản mới không đụng tới dữ liệu hay bản cài cũ; bản cũ vẫn còn nguyên nếu bạn muốn quay lại tạm thời.

## Phiên bản và nguồn gốc

Số phiên bản có dạng **năm.tháng.lần cập nhật trong tháng**; phần cuối không phải ngày. Bạn có thể xem [ghi chú phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2) và [mã nguồn tương ứng](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/v2026.9.2).

## Riêng tư và hỗ trợ

Hermes Vietnamese là dự án cá nhân độc lập của [Lê Đình Lực](https://github.com/LucDinhLe), dựa trên Hermes Agent của Nous Research theo [MIT](LICENSE). Phần lõi giữ nguyên từng byte so với bản gốc, dự án chỉ duy trì lớp vỏ Việt hóa. Bộ cài không mang tài khoản, khóa hay lịch sử của người đóng gói. Dịch vụ AI và công cụ mạng bạn dùng có chính sách dữ liệu riêng.

Xem [miễn trừ và quyền riêng tư](DISCLAIMER.md), [báo bảo mật](SECURITY.md), [báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues). Khi báo lỗi, ghi bản đang chạy, hệ điều hành, kiến trúc, bước tái hiện và ảnh đã che thông tin cá nhân. Phần mềm được cung cấp theo nguyên trạng, chưa có bảo hành thương mại.
