# Cài Hermes Vietnamese trên Windows bằng hình ảnh

Hướng dẫn này dành cho người tải Hermes Vietnamese bằng Microsoft Edge trên Windows 10 hoặc Windows 11. Bạn không cần mở Terminal, cài Git, cài Python hoặc sửa tệp cấu hình.

> **Vì sao Windows cảnh báo?** Tệp hiện chưa có chữ ký xác minh nhà phát hành và chưa có nhiều lượt tải, nên Edge hoặc Windows SmartScreen có thể hiện cảnh báo uy tín. Dòng `Publisher: Unknown` trong các ảnh dưới đây phản ánh trạng thái chưa ký, không phải kết luận tệp an toàn hoặc có mã độc.

Chỉ tiếp tục khi đủ ba điều kiện:

1. Đường tải thuộc `github.com/LucDinhLe/hermes-agent-vietnamese`.
2. Tên tệp đúng với kiến trúc máy.
3. SHA-256 khớp `SHA256SUMS.txt` của chính bản phát hành đang tải.

## 1. Chọn đúng bộ cài

<!-- current-release:start -->
Latest là [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2), community pilot Windows x64 chưa ký số, chưa phải stable.

1. Tải [Hermes-2026.9.2-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-2026.9.2-win-x64.exe).
2. Tên tương thích [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-Vietnamese-Windows-x64-Setup.exe) có cùng nội dung. Chỉ chạy một tệp.
3. Đối chiếu [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/SHA256SUMS.txt) của cùng bản phát hành.

Hai bộ cài có kích thước **252118156 byte**, SHA-256 `1ae55b4a3280e92d4a297f85d81cbb6bcc0a19170da8d9122755d19f40c43015`. Cập nhật thủ công bằng bộ cài đầy đủ, không có cập nhật tự động nền.
<!-- current-release:end -->

Ảnh bên dưới minh họa cảnh báo Edge từ bản cũ; tên tệp trong ảnh có thể khác 2026.9.2. Dùng tên và mã kiểm tra phía trên làm chuẩn. Bản này chưa có bộ cài ARM64.

Nếu chưa biết máy dùng x64 hay ARM64, nhấn `Windows + I`, chọn **Hệ thống → Giới thiệu** và xem dòng **Loại hệ thống**.

## 2. Khi Edge báo tệp không được tải xuống phổ biến

Edge có thể hiện dòng `isn't commonly downloaded`. Đây là cảnh báo về độ phổ biến của tệp tải xuống. Tệp sẽ không tự tiếp tục nếu bạn chỉ chờ.

1. Bấm **See more**.

![Edge cảnh báo tệp Hermes chưa được tải xuống phổ biến, cần bấm See more](assets/windows-install/edge-warning-see-more-v25.jpg)

2. Tùy phiên bản Edge, mở menu của tệp rồi chọn **Keep**.

![Menu tệp tải xuống của Edge có lựa chọn Keep](assets/windows-install/edge-download-menu-keep-v25.jpg)

3. Khi Edge hiện màn hình **Make sure you trust...**, kiểm tra lại tên tệp và nguồn tải. Dòng `Publisher: Unknown` là trạng thái hiện tại vì bộ cài chưa ký số. Bấm mũi tên `▼` cạnh **Delete**.

![Edge yêu cầu xác nhận tệp Hermes có Publisher Unknown](assets/windows-install/edge-publisher-unknown-v25.jpg)

4. Chọn **Keep anyway** để giữ tệp.

![Mở mũi tên cạnh Delete rồi chọn Keep anyway](assets/windows-install/edge-keep-anyway-v25.jpg)

Một số bản Edge đi thẳng từ **See more** tới màn hình có nút **Keep anyway**, nên bạn có thể không thấy đủ cả bốn màn hình. Không cần chọn **Report this app as safe** hoặc **Report this file as safe** để tiếp tục tải.

Nếu Edge tự thêm `(1)`, `(2)` vào tên vì tệp đã từng được tải, nội dung tệp có thể vẫn giống nhau. Hãy dùng SHA-256 để xác nhận, đừng chỉ dựa vào tên.

## 3. Mở bộ cài

1. Khi Edge báo tải xong, bấm biểu tượng thư mục hoặc mở thư mục **Downloads/Tải xuống**.
2. Mở `Hermes-2026.9.2-win-x64.exe` hoặc tệp tên tương thích đã xác minh ở phần 1.
3. Nếu Windows SmartScreen hiện cửa sổ **Windows protected your PC**, kiểm tra lại nguồn và SHA-256 rồi chọn **More info/Thông tin thêm → Run anyway/Vẫn chạy**.

Chỉ tiếp tục khi nguồn tải, tên tệp và SHA-256 đúng như phần 1. Nếu Microsoft Defender Antivirus nêu tên một mối đe dọa cụ thể, hãy dừng lại, giữ ảnh chụp và [gửi báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues). Không tắt Defender, SmartScreen hoặc chính sách bảo mật của toàn máy để cài Hermes.

## 4. Hoàn tất thiết lập ba bước

1. Chọn **Tiếng Việt** hoặc **English**.
2. Chờ ứng dụng chuẩn bị lõi đóng gói sẵn. Python và thư viện bắt buộc có trong bộ cài; Internet vẫn cần cho đăng nhập, AI và tính năng mạng/tùy chọn.
3. Tại **Kết nối model**, chọn một trong các đường phù hợp:
   - **OpenAI OAuth (ChatGPT):** đăng nhập tài khoản ChatGPT có quyền dùng Codex.
   - **Claude Pro / Max:** đăng nhập qua Claude Code.
   - **Google Gemini:** nhập khóa API tạo tại Google AI Studio.
   - **Google (tài khoản Google):** đăng nhập Google trong trình duyệt, dùng cùng cửa với Gemini CLI qua Google Cloud Code Assist và gói/hạn mức Google của bạn. Đây không phải nhà cung cấp chính thức của Hermes; khóa API Gemini ở trên vẫn là lối được hỗ trợ đầy đủ.
   - **Nhà cung cấp khác:** nhập tài khoản, API key hoặc endpoint tương ứng.
4. Chọn model, tạo phiên đầu tiên và giao một việc thử không quan trọng.

Nếu máy đã có bản Hermes cũ, bộ cài này cài song song chứ không ghi đè. Lần mở đầu tiên, nếu tìm thấy dữ liệu Hermes cũ, ứng dụng sẽ hỏi trước khi sao chép (không xóa) cấu hình và lịch sử sang; bản cũ vẫn còn nguyên để quay lại nếu cần.

Nếu chưa có tài khoản hoặc khóa API, chọn **Tôi sẽ chọn nhà cung cấp sau**. Sau đó mở **Cài đặt → Model/Nhà cung cấp** để kết nối. Bộ cài không kèm tài khoản model, API key hoặc hạn mức trả phí.

## Kiểm tra tăng cường nếu bạn quen dùng PowerShell

Bạn có thể đối chiếu mã SHA-256 bằng tệp `SHA256SUMS.txt` trong cùng bản phát hành. Mỗi bản có mã riêng, vì vậy không dùng mã của bản cũ để kiểm tra bản mới. Trên Windows, mở PowerShell trong thư mục tải xuống và chạy `Get-FileHash .\Hermes-Vietnamese-Windows-x64-Setup.exe -Algorithm SHA256`, rồi so kết quả với tệp tổng kiểm tra.

## Nếu vẫn không cài được

Trước khi cài đè, [sao lưu và kiểm tra bản sao](sao-luu-khoi-phuc.md), chờ công việc kết thúc rồi đóng ứng dụng/gateway nền. Không chọn gỡ toàn bộ dữ liệu để nâng cấp.

- **Chỉ thấy Delete và Cancel:** bấm mũi tên `▼` cạnh **Delete**, rồi chọn **Keep anyway**.
- **Chỉ thấy menu Delete/Keep:** chọn **Keep**, sau đó làm tiếp màn hình xác nhận nếu Edge hỏi lại.
- **Không thấy Run anyway:** máy có thể đang áp dụng chính sách bảo mật của cơ quan hoặc Smart App Control. Không tắt chính sách bảo mật chỉ để cài; hãy gửi ảnh cảnh báo vào mục Issues để được kiểm tra đúng trường hợp.
- **Bộ cài mở nhưng Hermes không khởi động:** chụp toàn bộ thông báo lỗi và chọn **Mở nhật ký** nếu nút này xuất hiện.

Trạng thái ký số được cập nhật tại [Chính sách ký mã](../CODE_SIGNING_POLICY.md).
