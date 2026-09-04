# Hermes Vietnamese

**Trợ lý AI trên máy tính, giúp bạn làm việc với tài liệu, tìm thông tin và thực hiện công việc qua trò chuyện bằng tiếng Việt.**

Bạn mô tả việc cần làm, chọn model AI của mình và làm việc cùng Hermes trong một cửa sổ. Ứng dụng có giao diện Việt/Anh và bộ cài đóng gói sẵn môi trường cần thiết, giúp bạn bắt đầu mà không phải tự thiết lập môi trường lập trình.

## Vì sao có bản Việt hóa này

Hermes Agent của Nous Research là phần mềm mã nguồn mở mạnh, nhưng để chạy được bản gốc, người dùng phải tự dựng môi trường lập trình gồm Python, trình quản lý gói và một chuỗi lệnh trong cửa sổ dòng lệnh. Với người làm nội dung, đào tạo hay vận hành, rào cản đó đủ lớn để bỏ cuộc trước khi kịp thấy phần mềm giúp được gì.

Dự án này sinh ra để rút quãng đường đó xuống còn một bộ cài. Bạn tải một tệp, bấm cài, mở lên và làm việc bằng tiếng Việt. Mọi thứ cần cho lõi chạy đã nằm sẵn trong bộ cài.

Người viết bản này là [Lê Đình Lực](https://github.com/LucDinhLe), làm đào tạo ứng dụng AI cho doanh nghiệp và giảng viên tại Việt Nam. Bản Việt hóa trước hết phục vụ học viên của chính chương trình đào tạo, sau đó mở cho cộng đồng dùng chung.

## Bản này khác bản gốc chỗ nào

- **Cài bằng một bộ cài cho từng nền tảng.** Windows, macOS Apple Silicon và Linux x64 đều có bộ cài riêng, đóng gói sẵn Python 3.12.10 và lõi Hermes, bạn không cần cài môi trường lập trình hay chạy lệnh nào.
- **Giao diện và tài liệu tiếng Việt.** Toàn bộ màn hình, thông báo và hướng dẫn đều có tiếng Việt, kèm [hướng dẫn cài bằng hình ảnh](docs/cai-dat-windows-bang-anh.md) cho người ngại kỹ thuật.
- **Lõi giữ nguyên từng byte so với bản gốc.** Bạn nhận đúng hành vi và các bản sửa lỗi của Nous Research, không nhận thêm rủi ro từ một nhánh sửa riêng. Máy chủ dựng bản phát hành chạy `scripts/engine-sync.mjs check` để chứng minh điều này ở mỗi lần dựng.
- **Cài song song, dữ liệu riêng.** Bản này dùng mã sản phẩm và thư mục dữ liệu riêng nên đứng cạnh bản Hermes cũ, giữ đường quay lui khi cần.
- **Cập nhật chỉ báo tin.** Ứng dụng báo có bản mới kèm tên tệp, kích thước và mã SHA-256, việc tải và cài vẫn do bạn quyết định.

Những gì bản này giữ nguyên như bản gốc gồm toàn bộ tính năng lõi, danh mục nhà cung cấp AI, kỹ năng, công cụ và định dạng dữ liệu. Bản Việt hóa thêm lớp vỏ cho dễ dùng, không cắt bớt và không khóa thêm gì.

## Bạn có thể làm gì với Hermes?

- **Làm việc với tài liệu và tệp.** Nhờ AI đọc, tóm tắt, soạn nội dung hoặc hỗ trợ chỉnh sửa các tệp bạn cho phép truy cập.
- **Tìm hiểu và tổng hợp thông tin.** Tra cứu trên web, sử dụng trình duyệt và gom kết quả phục vụ công việc.
- **Theo dõi công việc qua nhiều phiên.** Tách các chủ đề thành phiên riêng, tổ chức theo dự án và quay lại lịch sử khi cần.
- **Thực hiện công việc lặp lại.** Sử dụng kỹ năng, công cụ và tác vụ theo lịch khi đã cấu hình.
- **Chọn dịch vụ AI phù hợp.** Kết nối nhà cung cấp bằng tài khoản hoặc khóa API của bạn; có thể dùng máy chủ model cục bộ nếu đã chuẩn bị.

Hermes phù hợp với người làm nội dung, đào tạo, nghiên cứu, vận hành và người muốn có trợ lý AI hỗ trợ công việc hằng ngày. Khả năng thực hiện từng việc phụ thuộc model, công cụ đã kết nối và quyền bạn cấp.

## Tải và bắt đầu

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest"><img src="https://img.shields.io/badge/Tải_bản_mới_nhất-Windows_x64-F97316?style=for-the-badge" alt="Tải Hermes Vietnamese bản mới nhất cho Windows x64"></a>
</p>

<!-- current-release:start -->
> **Bản tải mới nhất là [2026.9.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.4), dành cho Windows x64, macOS Apple Silicon và Linux x64.** Đây là bản dùng thử cộng đồng (community pilot), chưa phải stable; Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. Hệ điều hành có thể hiển thị cảnh báo khi tải hoặc cài. Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app`. Trên Linux, cấp quyền chạy cho AppImage (`chmod +x`) hoặc cài gói deb.

**[Tải cho Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-win-x64.exe)** · **[Tải cho macOS Apple Silicon](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-mac-arm64.dmg)** · **[Tải cho Linux x64 (AppImage)](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-x86_64.AppImage)** · [Hướng dẫn cài đặt và kết nối](README.vi.md)

<details>
<summary>Kiểm tra tệp tải về</summary>

Bộ cài Windows `Hermes-2026.9.4-win-x64.exe` có kích thước **345852734 byte**, SHA-256 `3cd30aaad47167c439bb6637af3c531ceffc4e2f74d7a808e3a9c105e3938990`. Tệp [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-Vietnamese-Windows-x64-Setup.exe) có cùng nội dung và mã kiểm tra, chỉ cần tải một trong hai.

Bản macOS `Hermes-2026.9.4-mac-arm64.dmg` có kích thước **385594943 byte**, SHA-256 `8ebc605c66c9cc8eeed6fc314b71cbdabeedea6c62c297035296729571284d8c`.

Bản Linux `Hermes-2026.9.4-linux-x86_64.AppImage` có kích thước **397516248 byte**, SHA-256 `26cfec58e6776f49d5e65cbdd62908119349f7406a4fc549bc417d839134249d`. Gói [Hermes-2026.9.4-linux-amd64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-amd64.deb) có kích thước **320996796 byte**, SHA-256 `fc513d2a836ee5c6ca9762a627bb14b01d5a2cb4e09b234fd81439b61018e351`.

Đối chiếu với [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/SHA256SUMS.txt) của cùng bản phát hành.

</details>
<!-- current-release:end -->

1. **Cài ứng dụng.** Tải bộ cài, kiểm tra nguồn và mã tệp, rồi làm theo hướng dẫn. Nếu đang dùng Hermes, [sao lưu dữ liệu](docs/sao-luu-khoi-phuc.md) và đóng các công việc đang chạy trước khi cài đè.
2. **Kết nối AI.** Mở Hermes, chọn nhà cung cấp và kết nối bằng tài khoản hoặc khóa API của chính bạn. Internet cần thiết cho đăng nhập và sử dụng dịch vụ AI trực tuyến.
3. **Bắt đầu một phiên.** Chọn model, bấm dấu `+` ở thanh tab và giao một việc nhỏ, chẳng hạn “Đọc tài liệu này và tóm tắt các việc cần làm”.

Bạn có thể làm theo [hướng dẫn cài Windows bằng hình ảnh](docs/cai-dat-windows-bang-anh.md).

## Tài khoản AI của bạn

Hermes có các lựa chọn kết nối ChatGPT qua OpenAI OAuth, Claude qua Claude Code, Gemini bằng khóa API và những nhà cung cấp khác. Mỗi lựa chọn có điều kiện truy cập, hạn mức và chi phí riêng.

Ứng dụng không tặng kèm tài khoản, hạn mức hay model AI. Hãy chọn model mà kết nối của bạn hỗ trợ. Xem [cách kết nối từng nhà cung cấp](README.vi.md#kết-nối-chatgpt-claude-và-gemini) hoặc [hướng dẫn xử lý lỗi kết nối](README.vi.md#xử-lý-lỗi-kết-nối-thường-gặp).

## Dữ liệu và sử dụng an toàn

Hermes có thể đọc/sửa tệp, chạy công cụ và thao tác trên máy theo quyền được cấp. Bắt đầu với tệp thử hoặc bản sao, kiểm tra kết quả và cân nhắc trước những thao tác quan trọng. Bản cộng đồng này chưa có bảo hành thương mại.

Khi bạn dùng AI hoặc dịch vụ đã kết nối, dữ liệu cần thiết được gửi đến dịch vụ đó. Bộ cài không chứa tài khoản, khóa API hay lịch sử riêng của người đóng gói. Xem [thông tin về quyền riêng tư và trách nhiệm sử dụng](DISCLAIMER.md).

- **Khi cập nhật**, ứng dụng tự kiểm tra bản mới mỗi ngày (hoặc bấm "Kiểm tra ngay" trong mục Giới thiệu) và báo tên tệp, kích thước, mã SHA-256 kèm nút mở trang tải. Ứng dụng không tự tải hay tự cài, bạn vẫn tải bộ cài đầy đủ từ [bản mới nhất](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest) rồi tự chạy.
- **Khi cài bản mới**, bộ cài dùng mã sản phẩm và thư mục dữ liệu riêng nên cài song song với bản cũ, không ghi đè. Lần mở đầu tiên, nếu máy có dữ liệu Hermes cũ, ứng dụng sẽ hỏi trước khi sao chép cấu hình và lịch sử sang; dữ liệu bản cũ không bị xóa hay di chuyển, bản cũ vẫn dùng được để quay lại nếu cần.
- **Khi cài đè**, dữ liệu được giữ theo thiết kế, nhưng vẫn cần [sao lưu và kiểm tra bản sao](docs/sao-luu-khoi-phuc.md). Không chọn gỡ toàn bộ nếu muốn giữ lịch sử và cấu hình.
- **Khi Windows cảnh báo**, kiểm tra nguồn tải và mã tệp. Nếu phần mềm bảo vệ báo mối đe dọa cụ thể, dừng cài và báo lỗi; không tắt bảo vệ toàn máy. Xem [chính sách ký mã](CODE_SIGNING_POLICY.md).

## Hỗ trợ và thông tin dự án

Gặp vấn đề khi sử dụng? [Gửi báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues) kèm phiên bản, hệ điều hành, các bước gặp lỗi và ảnh đã che thông tin riêng. Vấn đề bảo mật cần theo [hướng dẫn báo riêng](SECURITY.md).

Hermes Vietnamese là dự án cá nhân vì cộng đồng do [Lê Đình Lực](https://github.com/LucDinhLe) phát triển từ [Hermes Agent của Nous Research](https://github.com/NousResearch/hermes-agent) theo [giấy phép MIT](LICENSE). Đây là bản phân phối độc lập, không phải bản phát hành chính thức của Nous Research hoặc các nhà cung cấp AI.

Phần lõi Hermes trong bản này giữ nguyên từng byte so với bản gốc của Nous Research; dự án chỉ duy trì lớp vỏ Việt hóa (ứng dụng, tài liệu, công cụ đóng gói). `scripts/engine-sync.mjs check` là bước kiểm tra tự động xác nhận lõi khớp bản gốc.

- [Ghi chú phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest).
- [Mã nguồn của bản phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/main) và [phạm vi bảo trì](MAINTAINERS.md).
- [Hồ sơ kỹ thuật và kiểm thử của đợt 2026.9.2](docs/release-2026.9.2-public-sync.md).
