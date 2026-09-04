# Hermes Vietnamese

**Trợ lý AI trên máy tính, giúp bạn làm việc với tài liệu, tìm thông tin và thực hiện công việc qua trò chuyện bằng tiếng Việt.**

Bạn mô tả việc cần làm, chọn model AI của mình và làm việc cùng Hermes trong một cửa sổ. Ứng dụng có giao diện Việt/Anh và bộ cài đóng gói sẵn môi trường cần thiết, giúp bạn bắt đầu mà không phải tự thiết lập môi trường lập trình.

## Bạn có thể làm gì với Hermes?

- **Làm việc với tài liệu và tệp.** Nhờ AI đọc, tóm tắt, soạn nội dung hoặc hỗ trợ chỉnh sửa các tệp bạn cho phép truy cập.
- **Tìm hiểu và tổng hợp thông tin.** Tra cứu trên web, sử dụng trình duyệt và gom kết quả phục vụ công việc.
- **Theo dõi công việc qua nhiều phiên.** Tách các chủ đề thành phiên riêng, tổ chức theo dự án và quay lại lịch sử khi cần.
- **Thực hiện công việc lặp lại.** Sử dụng kỹ năng, công cụ và tác vụ theo lịch khi đã cấu hình.
- **Chọn dịch vụ AI phù hợp.** Kết nối nhà cung cấp bằng tài khoản hoặc khóa API của bạn; có thể dùng máy chủ model cục bộ nếu đã chuẩn bị.

Hermes phù hợp với người làm nội dung, đào tạo, nghiên cứu, vận hành và người muốn có trợ lý AI hỗ trợ công việc hằng ngày. Khả năng thực hiện từng việc phụ thuộc model, công cụ đã kết nối và quyền bạn cấp.

## Tải và bắt đầu

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2"><img src="https://img.shields.io/badge/Tải_bản_2026.9.2-Windows_x64-F97316?style=for-the-badge" alt="Tải Hermes Vietnamese 2026.9.2 Windows x64"></a>
</p>

<!-- current-release:start -->
> **Bản tải mới nhất là [2026.9.3](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.3), dành cho Windows x64.** Đây là bản dùng thử cộng đồng (community pilot), chưa ký số và chưa phải stable. Windows có thể hiển thị cảnh báo khi tải hoặc cài. Chưa có bộ cài cho macOS, Linux hoặc Windows ARM64 trong bản phát hành này.

**[Tải bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.3/Hermes-2026.9.3-win-x64.exe)** · [Hướng dẫn cài đặt và kết nối](README.vi.md)

<details>
<summary>Kiểm tra tệp tải về</summary>

Bộ cài `Hermes-2026.9.3-win-x64.exe` có kích thước **345527696 byte**. Đối chiếu mã SHA-256 với [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.3/SHA256SUMS.txt):

```text
cc2798452d5c3d87fd0029c28af9e26f51b7406265707bb654521d2b1362e250
```

[Tệp tải thay thế Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.3/Hermes-Vietnamese-Windows-x64-Setup.exe) có cùng nội dung và mã kiểm tra. Chỉ cần tải một trong hai tệp.

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

- [Ghi chú phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2).
- [Mã nguồn của bản phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/v2026.9.2) và [phạm vi bảo trì](MAINTAINERS.md).
- [Hồ sơ kỹ thuật và kiểm thử](docs/release-2026.9.2-public-sync.md).
